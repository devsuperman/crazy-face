# Crazy Face: developer guide

How Crazy Face is built, how each feature works, and how to run it. For what the app does from a player's point of view, see the [README](../README.md). Pending work and known issues are in [NEXT_STEPS.md](../NEXT_STEPS.md).

## Tech stack

- **TypeScript** (strict, with `noUnusedLocals` / `noUnusedParameters`) and **Vite**. No framework and no UI library.
- **WebGL2**, written by hand, for drawing the warped photo, the lenses, the photo filter and the sticker.
- **Web Audio API** for every sound, generated on the fly (no audio files).
- **[MediaPipe Tasks Vision](https://www.npmjs.com/package/@mediapipe/tasks-vision)** (BlazeFace) for face detection. The library, its wasm and the model are bundled with the app and lazy-loaded, never fetched from a CDN.
- **Browser APIs:** `getUserMedia` and `ImageCapture` (camera), Web Share with files (sharing), `DeviceMotionEvent` (shake), Pointer Events (multi-touch).
- **No backend.** It's a static site deployed to GitHub Pages. Photos never leave the device.
- **No tests or linter.** `npm run build` (type check + build) is the only check.

## Run locally

Requirements: Node.js 22 (the version CI uses) and npm.

```bash
npm install
```

```bash
npm run dev
```

Open http://localhost:5173.

### Test the camera on a phone

Browsers only allow the camera on HTTPS pages or `localhost`. To use your phone on the same Wi-Fi:

```bash
npm run dev:phone
```

Open the `https://` network address it prints and accept the self-signed certificate warning (the cert comes from `@vitejs/plugin-basic-ssl`).

### Testing tricks

- `?sextou=1` / `?sextou=0` force the 🎉 Sextou sticker on or off on any day.
- Headless Chromium (Playwright): launch with `--use-gl=swiftshader --enable-unsafe-swiftshader` so WebGL2 works, and add `--use-fake-device-for-media-stream --use-fake-ui-for-media-stream` for the camera.
- To load a test photo in an automated browser: draw it on a canvas in the page, put it in a `DataTransfer`, set that on `#file`, and dispatch `change`.

## Build and deploy

```bash
npm run build                  # tsc --noEmit + vite build → dist/
```

```bash
npx vite preview --port 4173   # serve the build locally
```

The build must pass before committing. Every push to `main` builds and deploys to GitHub Pages (`.github/workflows/deploy.yml`). `vite.config.ts` uses `base: './'` so the build works under `/crazy-face/`.

### README screenshots

`docs/screenshots/` holds the images in `README.md`. The three `.webp` photos are real results saved from the app (the author's own face, used with permission), with the transparent margins trimmed. `start.png` and `stretch.png` show the English UI with the cartoon face: headless Chromium (Playwright, `--use-gl=swiftshader --enable-unsafe-swiftshader`) at a 390×780 viewport and `deviceScaleFactor: 2`, opening `?lang=en&sextou=0` on `vite preview`. The 👀/👃/🐹/😁 lenses don't render under SwiftShader, so take shots of those on a real device.

## Project rules

- **The app speaks Brazilian Portuguese (the source language) and English.** Every user-facing string (buttons, hints, alerts, `aria-label`s, `title`s) goes in both `src/locales/pt.ts` and `src/locales/en.ts`; `en` is typed against `pt`, so a missing key fails the build. Jokes are written for each language, not translated word for word. Code, comments, commits and the docs stay in English.
- Read text with `t()` from `src/i18n.ts` when it is shown (`pick(t().hints)`). Static markup in `index.html` keeps the PT-BR text and names its key with `data-i18n`, `data-i18n-aria` or `data-i18n-title`; `applyDom()` fills them. Text set from code that stays on screen is redrawn in an `onLocaleChange()` listener.
- New sounds are methods on `Sounds` in `src/sound.ts`.
- Photos never leave the device: no uploads, no servers, no CDN for the ML model.
- No frameworks or UI libraries.

## Code map

| File | What it does |
|---|---|
| `index.html` | Static markup: start screen, top bar, stage, bottom dock (effects, actions, ⚙️ sheet), camera and crop dialogs |
| `src/main.ts` | Composition root: wiring, pointer handling, layout, main loop |
| `src/warp.ts` | `WarpMesh`: the elastic grid physics and the timed effects |
| `src/lens.ts` | 👀 / 👃 / 🐹 lenses: landmarks, timing, packed shader uniforms |
| `src/renderer.ts` | `Renderer`: WebGL2 drawing of the mesh, lenses and sticker |
| `src/faces.ts` | Face detection (MediaPipe BlazeFace, lazy-loaded, multi-scale windows) |
| `src/beauty.ts` | ✨ Luz e beleza: tone measurement and the one-pass photo filter |
| `src/camera.ts` | 📸 Camera overlay, review, light, fallback |
| `src/crop.ts` | ✂️ Recortar dialog and `applyCrop` |
| `src/sticker.ts` | 🎉 Sextou sticker: drawing and gestures |
| `src/image.ts` | Loading and normalizing images, the cartoon face |
| `src/sound.ts` | All sounds (Web Audio) |
| `src/i18n.ts` | Languages: `t()`, `applyDom()`, detection (`?lang=pt\|en`, saved choice, browser language, English fallback), the PT \| EN picker |
| `src/locales/pt.ts`, `en.ts` | All user-facing text, PT-BR and English |
| `src/jokes.ts` | `pick()` |
| `src/style.css` | Styles |

## Architecture

### World units

Everything geometric is in world units: the image is 1 unit wide and `aspect` (height / width) units tall. A `Layout` (`{offsetX, offsetY, scale}` in `src/renderer.ts`) maps world units to canvas CSS pixels. `main.ts` computes it in `updateLayout()` (the image fits in 80% of the stage, so there's room to stretch) and converts pointers with `toWorld()`.

### Data flow

- `src/main.ts` owns the single `WarpMesh` and `Layout`, wires the DOM controls, handles pointer events (multi-touch through a `drags` map keyed by `pointerId`) and runs the `requestAnimationFrame` loop: `mesh.update(dt, now)`, then `renderer.draw(mesh, layout)`.
- **Two screens.** The app opens on the start screen (`#start`). When a photo arrives, `showEditor()` hides it and un-inerts the toolbar, stage and dock; **📸 Nova foto** calls `showStart()`. The cartoon face is loaded behind the start screen so a mesh always exists.
- **Mobile-first layout.** A slim top bar (name, 🌐 PT | EN, 🔊), the stage, then a bottom dock (`.dock`) in thumb reach: the effects strip (one row that scrolls sideways and centres when it fits) and four actions (📸 Nova foto, ⚙️ Ajustes, 💾 Salvar, 💬 WhatsApp), with `env(safe-area-inset-*)` padding. **↺ Resetar** (`#reset`, `.button.reset`) floats over the top-right corner of the stage, so it is always visible. ⚙️ Ajustes (`#settings`, `setSettings()` in `main.ts`) floats over the bottom of the photo, so the layout doesn't move; it holds ✂️, ✨, Modo massinha, 🎉 and Pincel, and closes on ⚙️ again, a touch on the photo, Escape, or going back to the start screen.
- `setImage()` is the single entry point for a new photo: it uploads the texture, calls `newMesh()` (which **creates a new `WarpMesh`**, so the reference changes) and starts the face search. Modules that need the mesh get it through a getter (`getMesh: () => mesh`), never by holding a reference.
- Feature modules use a setup function with injected dependencies instead of importing `main.ts`, e.g. `setupCamera(onPhoto, sounds, cropper)` and `setupCropper(sounds)`.
- Effects work on still photos only. There's no live video texture, because mesh effects can't follow moving faces.

## How the features work

### Stretching (the mesh)

`WarpMesh` in `src/warp.ts` is a grid of points (64 columns, rows to match the aspect) with a rest and a current position each. It's integrated at a fixed 1/120 s step with a damped spring back to rest, which gives the wobble. `grab` / `move` / `release` pull nearby points along with the pointer, with a smooth falloff radius.

`Renderer` draws the photo as one textured triangle grid and re-uploads the vertex buffer from `mesh.positions` every frame. **Salvar foto** and 💬 use `exportJpeg(mesh, sticker)`: it redraws offscreen (multisampled framebuffer, then `readPixels`) at the photo texture's own pixels per world unit (long side ≤ 4096), cropped to the warped mesh and sticker plus a 2% margin, on white (JPEG has no transparency), and encodes a JPEG at quality 0.9. That's sharper than the screen and several times smaller than a PNG. It doesn't read the on-screen canvas, so the context has no `preserveDrawingBuffer`; DOM overlays like the "ouch" bubble aren't in it.

### 🧱 Modo massinha

`mesh.clay` turns the spring off, so the shape stays. It's checked by default in `index.html`, so new meshes start with it on. **Resetar** springs the mesh back to rest.

### Effect buttons

`playEffect(kind, now, target?)` runs a timed preset (ramp + hold) as a displacement on top of the current positions. Several can run at once, and `target: {x, y, r}` aims one at a face. `chaos`, `poke` and `shake` are impulse helpers (shaking the phone uses `shake`).

### 👀 / 👃 / 🐹 / 😁 Lenses

These aren't mesh moves. They go to `mesh.lenses` (`src/lens.ts`): magnifying bulges in the photo's rest space that the fragment shader applies per pixel by remapping texture lookups (uniform arrays, up to `MAX_LENSES` = 24). They aim at the detected face landmarks, or at landmarks guessed from the face circle. The cartoon face uses its known features (`DEFAULT_FACE_TARGET`); on a photo with no face they do nothing.

😁 Sorrisão (`smile`) uses three lenses per face. BlazeFace only gives the mouth centre, so each corner is placed 0.45 eye distances to either side along the eye line. The mouth gets a light bulge whose centre dips a little, and a small lens on each corner pulls it up and outward, which turns the lips into an ear-to-ear grin. Bigger corner lenses bend the jaw line. A lens pull above about 0.65 × its radius folds the picture over itself, so the corners use ~0.54.

### Face detection

`detectFaces(image, max, {quick})` in `src/faces.ts` lazily imports `@mediapipe/tasks-vision` (its own chunk) and runs BlazeFace over the whole photo plus half-overlapping square windows of shrinking size, then merges duplicates. Results are circles in world units, biggest first, with BlazeFace's eye / nose / mouth keypoints as `landmarks`. `preloadFaceDetector()` starts the download early, when the camera or gallery opens.

`setImage()` calls `searchFaces()`:

1. A **quick** pass (only the biggest windows, about 1 s on desktop, fine for selfies) sets `photoFaces` right away.
2. A **full** pass runs in the background and replaces it if it finds at least as many faces (small faces in group photos).

The effect buttons (`playPreset`, via `targetsFor`) play on **every** face in `photoFaces` (up to `MAX_FACES` = 6), falling back to the whole image. 🎭 Um efeito pra cada (`playMix`) gives each face a different kind. The cartoon face skips detection.

### ✨ Luz e beleza

`src/beauty.ts`:

- `measureTone(image)` reads a 96 px histogram: levels, gamma towards a 0.46 median, a partial gray-world white balance and a denoise amount.
- `enhancePhoto(image, tone, faces?)` runs one pass in its own offscreen WebGL2 context and returns a new canvas: light fix and colour denoise everywhere, plus a strong skin smoothing (two bilateral passes, at ~3% and ~6% of the face radius, mixed at 0.9 by a YCbCr skin mask, eyes and mouth kept sharp), a soft light inside each face and a warm glow on the skin.

`main.ts` keeps the original `photo`. The filter is on for camera photos (unless turned off in the review) and for dark gallery photos (`isDark`). Faces are detected on the brightened copy. `showLook()` swaps only the texture (the mesh and its warps stay) when the toggle changes or faces arrive.

### ✂️ Recortar

`setupCropper(sounds)` in `src/crop.ts` returns a `Cropper`, `(image, start?) => Promise<Crop | null>`: a full-screen dialog with a draggable box (corners resize, the inside moves), Livre / 1:1 / 3:4 / 4:3 / 9:16 and quarter turns. A `Crop` is `{turns, x, y, w, h}`: clockwise quarter turns, then a box in fractions of the turned photo, so the same crop fits both the photo and its brightened copy. `applyCrop(image, crop)` makes the new canvas.

Cropping happens **before** `setImage()`, so the mesh, faces and ✨ only see the cropped photo. `main.ts` keeps `photoFraming` (`{source, crop}`, the uncropped photo) so a later crop from the toolbar can grow back. A new crop creates a new mesh, so warps reset. The cartoon can't be cropped.

### 📸 Camera

`setupCamera(onPhoto, sounds, cropper)` in `src/camera.ts` opens a full-screen `getUserMedia` overlay with:

- a countdown, flash and camera flip;
- a mirrored selfie (the photo keeps the mirror so it matches the preview);
- the "Ficou boa?" review with the ✨ chip and ✂️ Recortar;
- 💡 light: a warm glowing screen around a smaller preview on the front camera (the whole screen lit for the last countdown second), the torch on the back camera when it has one; it turns on by itself in a dark room;
- a preview brightened with a CSS filter to match the photo, plus continuous exposure / white balance and +1 EV in the dark where `getCapabilities()` offers them;
- a fallback to `<input capture>` when there's no camera API.

The shot uses `ImageCapture.takePhoto()` (full sensor resolution) where available, else the current video frame. The stream stops when the photo is used, on close or when the tab is hidden (a photo in review is kept). `onPhoto(photo, lit, framing)` gets the cropped photo, the light state and the framing. The editor opens on the photo as it is, with no effect playing.

### 🎉 Sextou sticker

`src/sticker.ts`: `isFriday()` checks the device's local day (`?sextou=1` / `?sextou=0` force it). `drawSticker(text)` draws the label on a 2D canvas. `Sticker` holds its pose in world units and handles the gestures: drag, two-finger pinch to resize and rotate, mouse wheel, tap. The renderer draws it as a second textured quad after the mesh (`renderer.setSticker`, `draw(mesh, layout, pose)`), so it's in **Salvar foto** and 💬 shares but isn't warped. `setImage()` calls `placeSticker()` (new text, top centre). When faces arrive, `sticker.avoid(faces)` slides it along the top (centre, right or left) to the spot that covers them least, unless the user has already moved it. Pointer handlers give the sticker first pick (`sticker.wants`), and a tap wiggles it and plays `sounds.party()`.

### 💬 WhatsApp

Builds the same JPEG as **Salvar foto** plus an invite line from `src/locales/` (`share`) followed by the site link (`siteLink()`: the page address with `?lang=` so friends get the same language). The link is part of the text because some share targets drop a separate `url` when a file is attached. Where Web Share with files is available (most phones) it opens the share sheet. Web pages can't attach files to WhatsApp directly, so elsewhere it downloads the JPEG and opens `wa.me` with the text.

### Images and sounds

- `src/image.ts`: `loadImageFile` and `fitToCanvas` (downscale + optional mirroring) normalize every source (file, drop, paste, camera) to an `HTMLCanvasElement`. `drawDefaultFace` draws the built-in cartoon face.
- `src/sound.ts`: creak while dragging, boing on release, countdown beeps, shutter, party and the rest, all synthesized with the Web Audio API. 🔊 mutes them.
