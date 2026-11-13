# Next steps

A handoff note so work can continue in a new chat. Last updated: 2026-11-13 (📤 Compartilhar com amigos: one button with three clear choices, 💾 Salvar na galeria, 💬 Enviar no WhatsApp and 🔗 Compartilhar o link do Crazy Face; before that, mobile-first bottom dock with ⚙️ Ajustes, stronger ✨, Sextou sticker at the top, WhatsApp invite with the site link; before that, 🎉 Sextou: Friday sticker; before that, a cleanup removed captions, 🎬 Gravar, 🪢 Cabo de guerra and Modo gelatina, and made Modo massinha on by default).

## Where things stand

Everything is on `main` (live on GitHub Pages): PT-BR and English UI (🌐 picker, see `src/i18n.ts`), a start screen (take or pick a photo first, then the editor), camera with a "Ficou boa?" review, Modo massinha on by default, and automatic face detection: every effect button hits every face in the photo, and 🎭 gives each face a different effect. (Modo turma, with hand-marked circles, 🎡 roulette, 🔀 head swap and 🏆 awards, was removed: faces are only found automatically now. Later, the pop-up captions, 🎬 Gravar, 🪢 Cabo de guerra, Modo gelatina and the 😜 Desafio de pose were removed too.)

## Ground rules for this project

- **User-facing text is in PT-BR (the source) and English:** every string goes in both `src/locales/pt.ts` and `src/locales/en.ts` (the build fails if one is missing). Jokes are written for each language, not translated word for word. Code, comments, commits and the README stay in English.
- All text lives in `src/locales/` (read with `t()` from `src/i18n.ts`); `index.html` marks its strings with `data-i18n*` keys. There are no pop-up captions anymore.
- Sounds are made with the Web Audio API in `src/sound.ts`, with no audio files. Add new sounds as methods there.
- Photos never leave the device. Keep it that way: no uploads, no servers.
- No frameworks: plain TypeScript + Vite + WebGL2.

## Code map

| File | What it does |
|---|---|
| `src/main.ts` | App wiring: pointer handling, controls, main loop |
| `src/warp.ts` | Elastic mesh. `playEffect(kind, now, target?)` can aim at a face `{x, y, r}`, and several effects can run at once |
| `src/renderer.ts` | WebGL2 drawing of the mesh, plus the 👀/👃/🐹 lenses in the fragment shader |
| `src/lens.ts` | 👀/👃/🐹 lenses: landmarks, timing, packed shader uniforms |
| `src/camera.ts` | 📸 Camera overlay: countdown, flash, switching cameras, "Ficou boa?" review, full-resolution still, fallback to `<input capture>` |
| `src/faces.ts` | 🤖 Face detection (MediaPipe BlazeFace, lazy-loaded, multi-scale windows) |
| `src/crop.ts` | ✂️ Recortar: crop dialog (free or fixed ratio, quarter turns), `applyCrop` |
| `src/image.ts` | Loading images, `fitToCanvas` (with mirroring), the default cartoon face |
| `src/sound.ts` | All sounds |
| `src/i18n.ts` | Languages: `t()`, `applyDom()` for `data-i18n*` markup, detection (`?lang`, saved choice, browser), the 🌐 PT \| EN picker |
| `src/locales/pt.ts`, `en.ts` | All user-facing text: UI labels, alerts, hints, "ouch" lines, share texts and the 🎉 Sextou sticker texts |
| `src/jokes.ts` | `pick()` |

World units: the image is 1 unit wide and `aspect` units tall. `Layout` maps world units to screen pixels.

## Pending tasks

### 1. Test on real phones (iOS Safari and Android Chrome)
Everything has only been tested in headless desktop Chromium (fake camera, CDP touch). Check:
- Camera permission, the front/back switch, the countdown, the mirrored selfie, and the fallback when permission is denied.
- Start screen: fits small screens, and 🖼️ Escolher foto opens the gallery.
- "Ficou boa?" review: 🔁 Tirar outra restarts the camera quickly, also after switching apps.
- Full-resolution still (`ImageCapture.takePhoto()`, Android Chrome): the photo is sharper, it's mirrored correctly with the front camera, and it isn't slow. If its framing differs a lot from the preview (4:3 sensor vs 16:9 video), consider cropping it to the preview's aspect.
- 📤 Compartilhar com amigos: 💬 the share sheet sends the photo with the text on Android and iOS (some apps drop the text when a file is attached); on computers, the photo pastes into WhatsApp Web after `wa.me` opens (and the pop-up isn't blocked after the export's wait). 💾 on iPhone: "Save Image" in the share sheet puts it in Photos; on Android, the download shows in the gallery. 🔗 the link share sheet on both. If the share sheet refuses to open after the export's wait (Safari's user-activation limit), export first and share on a second tap.
- Group photos: how long the full face detection takes on a mid-range phone (it runs in the background after the quick pass), and whether it causes jank while dragging.
- Modo massinha by default: whether groups of 4-6 people on one phone expect effects to stay until Resetar.
- Use `npm run dev:phone` (HTTPS on your Wi-Fi), or the Pages deploy.

### 2. Photo-first: face-aware effects

The live mirror was removed: mesh effects can't follow a moving face. The app is now photo-first (start screen → 📸 or 🖼️ → "Ficou boa?" → editor). Next:

1. ✅ **Effects aim at every face.** Each new photo gets two detection passes (`searchFaces` in `main.ts`): a quick one (`detectFaces(..., {quick: true})`) so the buttons work right away, then a full one in the background that finds small faces in group photos. Every effect button plays on all faces in `photoFaces` (up to 6), or on the whole photo if none is found. The detector preloads when the camera or gallery opens. With 2+ faces, the hint says the effects hit everyone. To check on phones: how long the quick detection takes on a mid-range Android, and whether a selfie face is too big or too close to the edge to be found.
2. ✅ **New face effects on the still photo: 👀 Olhão and 👃 Narigão.** `faces.ts` now keeps BlazeFace's keypoints (`EffectTarget.landmarks`: eyes, nose tip, mouth); faces without keypoints get them guessed from the circle (`estimateLandmarks` in `lens.ts`), and the cartoon face has fixed ones (`DEFAULT_FACE_TARGET` in `image.ts`). The bulges are drawn in the fragment shader as a per-pixel UV remap (`src/lens.ts`, up to 16 at once), in the photo's rest space, so they follow dragging and stack with the mesh effects. They go through `mesh.playEffect('eyes' | 'nose', ...)` like the other presets and are part of 🎭 Um efeito pra cada. With no face in the photo the buttons do nothing instead of guessing. To check on phones: whether the strength feels right on real selfies, and on side-on faces (eye distance is clamped so the lens never collapses).
3. ✅ **🐹 Bochechas.** A third lens kind (`cheeks`): two lenses per face, below and slightly outside the eyes, puffing outward. Same flow as 👀/👃 (button, 🎭, cartoon features). To check on phones: placement on real selfies and on turned heads (BlazeFace ear keypoints could help if it looks off).
4. **Next idea:** lens strength could follow a drag (pinch an eye to make it bigger) instead of only being a timed preset.

### 3. ✨ Luz e beleza (dark photos)
Done: `src/beauty.ts` fixes the light (levels, gamma, white balance, colour denoise) and smooths skin on detected faces; ✨ toggle in ⚙️ Ajustes and in the camera review; 💡 selfie screen light / torch; brightened camera preview. To check on phones:
- Real selfies in a dim room: is the skin smoothing natural (made stronger: 0.9 mix of two bilateral passes, plus a warm glow; check it doesn't look plastic), and is the noise acceptable after brightening (gamma is capped at 0.5)?
- Does the 💡 glowing screen actually light the face enough, and does the camera's auto-exposure adapt within the last countdown second?
- `exposureCompensation` and `torch` on Android Chrome; iOS has neither (only the screen light).
- Time of `enhancePhoto` on a 2048 px photo on a mid-range phone (it runs when the review opens and again when faces are found).
- Idea: an intensity choice (Leve / Médio / Turbo) instead of on/off.

### 4. ✂️ Recortar (crop and rotate)
Done: optional ✂️ in ⚙️ Ajustes and in the camera's "Ficou boa?" review. Free box or Livre / 1:1 / 3:4 / 4:3 / 9:16, ↺/↻ quarter turns, "Foto inteira". The crop is applied before `setImage()`; the uncropped photo is kept, so cropping again can grow back (warps reset). To check on phones:
- Dragging the corners with a thumb (44 px targets) and the dialog on small screens and with the notch.
- Ideas: fine straightening (±15°), pinch to zoom the box, and a starting box around the detected faces.

### 5. 🎉 Sextou (Friday sticker)
Done: on Fridays (device time) a "SEXTOU!" sticker sits at the top of the photo, sliding to the side when it would cover a face. Drag to move, pinch (or mouse wheel, Shift to turn) to resize and rotate, tap for a wiggle and a party sound; 🎉 Sextou in ⚙️ Ajustes turns it off. It's drawn on the canvas, so it's in saved photos and shares. Test any day with `?sextou=1`. To check on phones:
- The pinch with real fingers, and that a tap on the sticker never starts a face drag.
- Ideas: other days or dates (only Friday for now, by choice), and remembering where the sticker was put.

### 6. Ideas and polish
- [ ] 🤖 Detection uses BlazeFace short-range, which is tuned for selfie distance; the sliding windows help, but tiny or side-on faces can still be missed, and there's no manual fallback (by design).

## Small known issues
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

> Read `NEXT_STEPS.md` on `main` of `devsuperman/crazy-face`. Continue with the pending tasks, keeping all user-facing text in both PT-BR and English.
