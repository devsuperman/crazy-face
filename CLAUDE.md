# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

Crazy Face is a browser-only toy: take or upload a photo, then squish, stretch and pull the face around (WebGL2). It is plain TypeScript + Vite with no framework, no backend and no tests. `NEXT_STEPS.md` has the roadmap of pending features and known issues.

## Commands

```bash
npm install
npm run dev          # http://localhost:5173
npm run dev:phone    # HTTPS on the LAN (self-signed cert via @vitejs/plugin-basic-ssl); needed to test the camera on a phone
npm run build        # tsc --noEmit + vite build → dist/. This is the only check; it must pass before committing
npx vite preview --port 4173   # serve the build
```

There is no linter or test runner. `tsconfig.json` is strict with `noUnusedLocals`/`noUnusedParameters`, so unused code fails the build.

Pushes to `main` deploy to GitHub Pages (`.github/workflows/deploy.yml`). `vite.config.ts` uses `base: './'` so the build works under `/crazy-face/`.

### Browser testing (Playwright, headless)

- Launch Chromium with `--use-gl=swiftshader --enable-unsafe-swiftshader` so WebGL2 works.
- For the camera, also pass `--use-fake-device-for-media-stream --use-fake-ui-for-media-stream`.
- To load a test photo: draw it on a canvas inside the page, put it in a `DataTransfer`, set that on `#file`, and dispatch `change`.

## Project rules

- **All user-facing text is Brazilian Portuguese (PT-BR):** buttons, hints, captions, alerts and `aria-label`s. Jokes should feel Brazilian, not translated word for word. Code, comments, commits and the README stay in English.
- UI text lives only in `index.html` (static markup) and `src/jokes.ts` (all captions, hints and "ouch" lines; use `pick()`).
- Sounds are generated with the Web Audio API in `src/sound.ts` (no audio files). Add new sounds as methods on `Sounds`.
- Photos never leave the device: no uploads, no servers. ML runs locally (face detection in `src/faces.ts`), and its library, wasm and model are bundled with the app, not loaded from a CDN.
- No frameworks or UI libraries.

## Architecture

**World units.** Everything geometric is in world units: the image is 1 unit wide and `aspect` (height/width) units tall. `Layout` (`{offsetX, offsetY, scale}` in `src/renderer.ts`) maps world units to canvas CSS pixels. `main.ts` computes it in `updateLayout()` (image fit at 80% of the stage so there's room to stretch) and converts pointers with `toWorld()`.

**Data flow.**
- `src/main.ts` is the composition root. It owns the single `WarpMesh` and `Layout`, wires all DOM controls, handles pointer events (multi-touch via a `drags` map keyed by `pointerId`), shows captions/bubbles based on stretch distance, and runs the `requestAnimationFrame` loop: `mesh.update(dt, now)` then `renderer.draw(mesh, layout)`.
- **Two screens.** The app opens on the start screen (`#start`: 📸 Tirar foto, 🖼️ Escolher foto, or the sample face). Once a photo arrives, `showEditor()` hides it and un-inerts the toolbar and stage; **📸 Nova foto** calls `showStart()` to go back (with "Voltar para a foto de antes"). The cartoon face is loaded behind the start screen so the mesh always exists. There is no live video texture: effects work on still photos only (a live mirror was removed because mesh effects can't follow moving faces).
- `setImage()` in `main.ts` is the single entry point for a new photo: it uploads the texture and calls `newMesh()`, which **creates a new `WarpMesh`** (so the mesh reference changes), and starts the face search. Callers then call `showEditor()`. `photo` holds the current photo. Modules that need the mesh get it through a getter (`getMesh: () => mesh`), never by holding a reference.
- `src/warp.ts` (`WarpMesh`) is the physics: a grid of points (64 columns) with rest and current positions, integrated at a fixed 1/120 s step with a damped spring back to rest. `grab/move/release` handle dragging with a falloff radius. `clay` disables the spring, `jelly` lowers damping. `playEffect(kind, now, target?)` runs a timed preset (ramp + hold) as a displacement on top of the current positions; several can run at once, and `target: {x, y, r}` aims one at a face. `chaos`, `poke` and `shake` are impulse helpers. The `eyes`/`nose` kinds are not mesh moves: they go to `mesh.lenses` (`src/lens.ts`), magnifying bulges in the photo's rest space that the renderer draws per pixel in the fragment shader (uniform arrays, up to `MAX_LENSES`). They aim at `EffectTarget.landmarks`, or landmarks guessed from the circle.
- `src/renderer.ts` (`Renderer`) is raw WebGL2: one textured triangle grid whose vertex buffer is re-uploaded from `mesh.positions` each frame, and whose fragment shader remaps texture lookups for the lenses. `setImage(source)` uploads a texture with mipmaps. `preserveDrawingBuffer: true` is required for **Salvar PNG**, which captures the canvas but not DOM overlays like captions.
- `src/image.ts`: `loadImageFile` and `fitToCanvas` (downscale + optional mirroring) normalize every source to an `HTMLCanvasElement`; `drawDefaultFace` draws the built-in cartoon face.
- `src/faces.ts`: `detectFaces(image, max, {quick})` lazily imports `@mediapipe/tasks-vision` (its own chunk) and runs BlazeFace over the whole photo plus half-overlapping square windows of shrinking size, then merges duplicates. Results are circles in world units, biggest first, with BlazeFace's eye/nose/mouth keypoints as `landmarks`. `quick` stops after the biggest windows (a few runs, ~1 s on desktop; fine for selfies). `preloadFaceDetector()` starts the download early (when the camera or gallery opens).
- **Faces (automatic only, no manual marking).** `setImage()` calls `searchFaces()`: a quick detection sets `photoFaces` right away (`facesReady` resolves here), then a full detection runs in the background and replaces it if it finds at least as many faces (small faces in group photos). The effect buttons (`playPreset`, via `targetsFor`) call `playEffect(kind, now, face)` on **every** face in `photoFaces` (up to `MAX_FACES` = 6), falling back to the whole image; with 2+ faces they use `GROUP_EFFECT_CAPTIONS`. 🎭 Um efeito pra cada (`playMix`) gives each face a different kind. The pose-challenge effect waits up to 1.5 s for the quick pass (`waitForFace`). With 2+ faces, the hint says the effects hit everyone. The cartoon face skips detection (`setImage(image, false)`); 👀/👃 use its known features (`DEFAULT_FACE_TARGET`), and on a photo with no face they show a caption instead.
- Pointer handling in `main.ts` also runs **Cabo de guerra**: two drags that start far apart become a `tug`, decided in `finishTug()` when either is released.
- Feature modules use a setup function with injected dependencies instead of importing `main.ts`:
  - `setupCamera(onPhoto, sounds)` in `src/camera.ts`: full-screen `getUserMedia` overlay with a pose challenge, countdown, flash, camera flip, a mirrored selfie, a "Ficou boa?" review (✔ Usar esta / 🔁 Tirar outra), and a fallback to `<input capture>`. The shot uses `ImageCapture.takePhoto()` (full sensor resolution) where available, else the current video frame. It stops the stream when the photo is used, on close or on tab hide (a photo in review is kept). `onPhoto(photo, challenge)` gets the pose challenge so `main.ts` can play its effect.
  - `setupRecorder(deps)` in `src/recorder.ts`: `canvas.captureStream` + `sounds.stream()` (the master bus routed into a `MediaStreamAudioDestinationNode`) into `MediaRecorder`, then a preview dialog with share/download.
