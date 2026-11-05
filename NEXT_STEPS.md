# Next steps

A handoff note so work can continue in a new chat. Last updated: 2026-11-05 (✂️ Recortar: crop and rotate).

## Where things stand

Everything is on `main` (live on GitHub Pages): PT-BR UI, a start screen (take or pick a photo first, then the editor), camera with 😜 pose challenges and a "Ficou boa?" review, 🎬 video clips, 🪢 tug of war, and automatic face detection: every effect button hits every face in the photo, and 🎭 gives each face a different effect. (Modo turma, with hand-marked circles, 🎡 roulette, 🔀 head swap and 🏆 awards, was removed: faces are only found automatically now.)

## Ground rules for this project

- **All user-facing text is in Brazilian Portuguese (PT-BR):** buttons, hints, captions, alerts and `aria-label`s. Jokes should feel Brazilian, not translated word for word. Code, comments, commits and the README stay in English.
- All silly text lives in `src/jokes.ts`. Add new captions there.
- Sounds are made with the Web Audio API in `src/sound.ts`, with no audio files. Add new sounds as methods there.
- Photos never leave the device. Keep it that way: no uploads, no servers.
- No frameworks: plain TypeScript + Vite + WebGL2.

## Code map

| File | What it does |
|---|---|
| `src/main.ts` | App wiring: pointer handling, controls, captions, main loop |
| `src/warp.ts` | Elastic mesh. `playEffect(kind, now, target?)` can aim at a face `{x, y, r}`, and several effects can run at once |
| `src/renderer.ts` | WebGL2 drawing of the mesh, plus the 👀/👃/🐹 lenses in the fragment shader |
| `src/lens.ts` | 👀/👃/🐹 lenses: landmarks, timing, packed shader uniforms |
| `src/camera.ts` | 📸 Camera overlay: pose challenge, countdown, flash, switching cameras, "Ficou boa?" review, full-resolution still, fallback to `<input capture>` |
| `src/recorder.ts` | 🎬 Records canvas + sounds with `MediaRecorder`, then shares or downloads the clip |
| `src/faces.ts` | 🤖 Face detection (MediaPipe BlazeFace, lazy-loaded, multi-scale windows) |
| `src/crop.ts` | ✂️ Recortar: crop dialog (free or fixed ratio, quarter turns), `applyCrop` |
| `src/image.ts` | Loading images, `fitToCanvas` (with mirroring), the default cartoon face |
| `src/sound.ts` | All sounds |
| `src/jokes.ts` | All captions and hints (PT-BR) |

World units: the image is 1 unit wide and `aspect` units tall. `Layout` maps world units to screen pixels.

## Pending tasks

### 1. Test on real phones (iOS Safari and Android Chrome)
Everything has only been tested in headless desktop Chromium (fake camera, CDP touch). Check:
- Camera permission, the front/back switch, the countdown, the mirrored selfie, and the fallback when permission is denied.
- 😜 Desafio de pose: the banner shouldn't cover faces too much on small screens.
- Start screen: fits small screens, and 🖼️ Escolher foto opens the gallery.
- "Ficou boa?" review: 🔁 Tirar outra restarts the camera quickly, also after switching apps.
- Full-resolution still (`ImageCapture.takePhoto()`, Android Chrome): the photo is sharper, it's mirrored correctly with the front camera, and it isn't slow. If its framing differs a lot from the preview (4:3 sensor vs 16:9 video), consider cropping it to the preview's aspect.
- 💬 WhatsApp: the share sheet sends the photo with the text on Android and iOS (some apps drop the text when a file is attached).
- 🎬 Gravar: MP4 on Safari, the share sheet to WhatsApp, and that the sound is in the clip.
- Group photos: how long the full face detection takes on a mid-range phone (it runs in the background after the quick pass), and whether it causes jank while dragging.
- 🪢 Cabo de guerra with two people on one phone.
- Use `npm run dev:phone` (HTTPS on your Wi-Fi), or the Pages deploy.

### 2. Photo-first: face-aware effects

The live mirror was removed: mesh effects can't follow a moving face. The app is now photo-first (start screen → 📸 or 🖼️ → "Ficou boa?" → editor). Next:

1. ✅ **Effects aim at every face.** Each new photo gets two detection passes (`searchFaces` in `main.ts`): a quick one (`detectFaces(..., {quick: true})`) so the buttons work right away, then a full one in the background that finds small faces in group photos. Every effect button plays on all faces in `photoFaces` (up to 6), or on the whole photo if none is found. The detector preloads when the camera or gallery opens. With 2+ faces, the hint says the effects hit everyone. To check on phones: how long the quick detection takes on a mid-range Android (the pose-challenge effect waits up to 1.5 s for it), and whether a selfie face is too big or too close to the edge to be found.
2. ✅ **New face effects on the still photo: 👀 Olhão and 👃 Narigão.** `faces.ts` now keeps BlazeFace's keypoints (`EffectTarget.landmarks`: eyes, nose tip, mouth); faces without keypoints get them guessed from the circle (`estimateLandmarks` in `lens.ts`), and the cartoon face has fixed ones (`DEFAULT_FACE_TARGET` in `image.ts`). The bulges are drawn in the fragment shader as a per-pixel UV remap (`src/lens.ts`, up to 16 at once), in the photo's rest space, so they follow dragging and stack with the mesh effects. They go through `mesh.playEffect('eyes' | 'nose', ...)` like the other presets, are part of 🎭 Um efeito pra cada, and have their own pose challenges. With no face in the photo the buttons say so instead of guessing. To check on phones: whether the strength feels right on real selfies, and on side-on faces (eye distance is clamped so the lens never collapses).
3. ✅ **🐹 Bochechas.** A third lens kind (`cheeks`): two lenses per face, below and slightly outside the eyes, puffing outward. Same flow as 👀/👃 (button, 🎭, pose challenge, cartoon features, no-face caption). To check on phones: placement on real selfies and on turned heads (BlazeFace ear keypoints could help if it looks off).
4. **Next idea:** lens strength could follow a drag (pinch an eye to make it bigger) instead of only being a timed preset.

### 3. ✨ Luz e beleza (dark photos)
Done: `src/beauty.ts` fixes the light (levels, gamma, white balance, colour denoise) and smooths skin on detected faces; ✨ toggle in the toolbar and in the camera review; 💡 selfie screen light / torch; brightened camera preview. To check on phones:
- Real selfies in a dim room: is the skin smoothing natural (strength 0.65 in the shader), and is the noise acceptable after brightening (gamma is capped at 0.5)?
- Does the 💡 glowing screen actually light the face enough, and does the camera's auto-exposure adapt within the last countdown second?
- `exposureCompensation` and `torch` on Android Chrome; iOS has neither (only the screen light).
- Time of `enhancePhoto` on a 2048 px photo on a mid-range phone (it runs when the review opens and again when faces are found).
- Idea: an intensity choice (Leve / Médio / Turbo) instead of on/off.

### 4. ✂️ Recortar (crop and rotate)
Done: optional ✂️ in the toolbar and in the camera's "Ficou boa?" review. Free box or Livre / 1:1 / 3:4 / 4:3 / 9:16, ↺/↻ quarter turns, "Foto inteira". The crop is applied before `setImage()`; the uncropped photo is kept, so cropping again can grow back (warps reset). To check on phones:
- Dragging the corners with a thumb (44 px targets) and the dialog on small screens and with the notch.
- Ideas: fine straightening (±15°), pinch to zoom the box, and a starting box around the detected faces.

### 5. Ideas and polish
- [ ] 🎬 Optionally start recording automatically when 🎭 Um efeito pra cada runs.
- [ ] 🎬/💾 Draw the current caption into clips and saved PNGs.
- [ ] 🤖 Detection uses BlazeFace short-range, which is tuned for selfie distance; the sliding windows help, but tiny or side-on faces can still be missed, and there's no manual fallback (by design).

## Small known issues
- **Salvar PNG** and 🎬 clips don't include captions.
- Untargeted presets (the normal effect buttons) no longer hold points outside the effect radius in place. They spring back on their own instead. The change is barely visible.
- The face detector's wasm is ~14 MB (~4 MB gzipped). It's downloaded when the camera or gallery first opens (not for the cartoon face).

## How to build and test

```bash
npm install
npm run dev          # http://localhost:5173
npm run dev:phone    # HTTPS on your network, for testing the camera on a phone
npm run build        # type-check + build (must pass before committing)
```

Browser testing with Playwright (Chromium is already installed in cloud sessions):
- Serve the build with `npx vite preview --port 4173`.
- Launch Chromium with `--use-gl=swiftshader --enable-unsafe-swiftshader` so WebGL2 works headless.
- For the camera, also pass `--use-fake-device-for-media-stream --use-fake-ui-for-media-stream`.
- To load a test photo, draw it on a canvas inside the page, then set it on `#file` with a `DataTransfer` and dispatch `change`.

## Starter prompt for a new chat

> Read `NEXT_STEPS.md` on `main` of `devsuperman/crazy-face`. Continue with the pending tasks, keeping all user-facing text in PT-BR.
