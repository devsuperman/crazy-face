# Next steps

A handoff note so work can continue in a new chat. Last updated: 2026-11-05.

## Where things stand

| Branch | What it has | Status |
|---|---|---|
| `main` | The English prototype: warp, effects, sounds, jokes | Live on GitHub Pages |
| `claude/kind-wozniak-ju9ute` | 1. All UI text in PT-BR. 2. 📸 Tirar foto (camera with a 3-2-1 countdown) | Pushed, **no PR yet** |
| `claude/group-photo-fun` | Everything above, plus 3. 👥 Modo turma (mark faces, 🎡 Roleta da vergonha, 🎭 Um efeito pra cada) | Pushed, **no PR yet** |

`claude/group-photo-fun` is built on top of `claude/kind-wozniak-ju9ute`, so merge that one first.

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
| `src/renderer.ts` | WebGL2 drawing of the mesh |
| `src/camera.ts` | 📸 Camera overlay: countdown, flash, switching cameras, fallback to `<input capture>` |
| `src/group.ts` | 👥 Modo turma: face circles, roulette, one effect per face |
| `src/image.ts` | Loading images, `fitToCanvas` (with mirroring), the default cartoon face |
| `src/sound.ts` | All sounds |
| `src/jokes.ts` | All captions and hints (PT-BR) |

World units: the image is 1 unit wide and `aspect` units tall. `Layout` maps world units to screen pixels.

## Pending tasks (in suggested order)

### 1. Ship what is done
- [ ] Open a PR for `claude/kind-wozniak-ju9ute` → `main` (PT-BR + camera).
- [ ] After it merges, open a PR for `claude/group-photo-fun` → `main` (Modo turma).
- [ ] **Test on real phones** (iOS Safari and Android Chrome). This has only been tested in desktop Chromium with a fake camera. Check:
  - Camera permission prompt, the front/back switch, the countdown and the mirrored selfie.
  - The fallback when permission is denied.
  - Modo turma touch: tap vs. drag to size a circle, removing circles, the roulette.
  - Captions not covering the toolbars on small screens.
  - Use `npm run dev:phone` (HTTPS on your Wi-Fi), or the Pages deploy.

### 2. 🎬 Vídeo pro WhatsApp (share a wobble clip)
Groups share videos far more than still PNGs.
- [ ] Add a "🎬 Gravar" button that records the canvas for a few seconds: `canvas.captureStream(30)` + `MediaRecorder`.
- [ ] Include the cartoon sounds: route the `Sounds` master gain into a `MediaStreamAudioDestinationNode` and add its track to the stream.
- [ ] Pick the format with `MediaRecorder.isTypeSupported`: `video/mp4` (Safari), otherwise `video/webm`.
- [ ] Share with `navigator.share({ files: [...] })` when `navigator.canShare` allows it, otherwise download the file.
- [ ] Optional: start recording automatically when 🎡 Roleta or 🎭 Um efeito pra cada runs.

### 3. 😜 Desafio de pose (in the camera)
- [ ] Before the countdown, show a random pose prompt, for example: "Todo mundo com cara de quem viu o boleto!", "Cara de surpresa no amigo secreto!", "Pose de capa de disco de pagode!".
- [ ] Each prompt has a matching effect that plays automatically right after the photo.
- [ ] Code: `src/camera.ts` (prompt overlay) + `src/jokes.ts` (prompt list) + the `onPhoto` callback in `src/main.ts`.

### 4. 🏆 Troféus (Modo turma)
- [ ] A button in the group bar that gives each marked face a funny award label, for example "Mais dramático", "Dormiu na foto" or "Cara de quem vai chorar no casamento".
- [ ] Show it as a label under each circle. Consider drawing it onto the saved PNG too.

### 5. 🪢 Cabo de guerra (two people, one phone)
- [ ] Two fingers pull the same face from opposite sides. Multi-touch already works (the `drags` map in `src/main.ts`).
- [ ] Compare the stretch of the left and right pointers on release, then announce the winner: "Vitória do lado esquerdo!".

### 6. 🤖 Automatic face detection
- [ ] Use MediaPipe Face Landmarker (`@mediapipe/tasks-vision`), which runs in the browser and handles several faces. It adds about a 4 MB model download: host it with the app or load it lazily, only when 👥 Turma opens.
- [ ] Pre-fill the Modo turma circles from the detections. Keep tapping as the fallback and for corrections.
- [ ] Keep photos on the device (the model runs locally).

### 7. 🔀 Troca de cabeças (head swap)
The funniest idea, but the hardest. It needs task 6 first.
- [ ] Swap the face regions between people: draw each face again with UVs taken from another face, using a soft-edged (feathered) mask so the edges blend.
- [ ] Probably needs a second draw pass in `src/renderer.ts`.

### 8. 🪞 Espelho maluco (live fun-house mirror)
- [ ] A live mode where the camera video is the texture (upload a frame each tick with `texImage2D(video)`), so you warp your own face in real time.

## Small known issues / polish
- In Modo turma, taps on circles are ignored while the roulette's effect is still playing. That's on purpose, but there's no feedback. Maybe show a hint.
- Face circles stay at the face's original spot and don't follow the warp. That's fine for now.
- **Salvar PNG** saves only the canvas. Captions and circles are not included.
- Untargeted presets (the normal effect buttons) no longer hold points outside the effect radius in place. They spring back on their own instead. The change is barely visible.

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

> Read `NEXT_STEPS.md` on branch `claude/group-photo-fun` of `devsuperman/crazy-face`. Continue with the next pending task, keeping all user-facing text in PT-BR. Work on a new branch based on `claude/group-photo-fun` (or on `main` if the earlier PRs are merged).
