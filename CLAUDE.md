# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

Crazy Face is a browser-only toy: take or upload a photo, then squish, stretch and pull the face around (WebGL2). It is plain TypeScript + Vite with no framework, no backend and no tests. `NEXT_STEPS.md` has the roadmap of pending features and known issues. Its "Where things stand" branch table is out of date: those branches are already merged into `main`.

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
- Photos never leave the device: no uploads, no servers. Any future ML (e.g. face detection) must run locally.
- No frameworks or UI libraries.

## Architecture

**World units.** Everything geometric is in world units: the image is 1 unit wide and `aspect` (height/width) units tall. `Layout` (`{offsetX, offsetY, scale}` in `src/renderer.ts`) maps world units to canvas CSS pixels. `main.ts` computes it in `updateLayout()` (image fit at 80% of the stage so there's room to stretch) and converts pointers with `toWorld()`.

**Data flow.**
- `src/main.ts` is the composition root. It owns the single `WarpMesh` and `Layout`, wires all DOM controls, handles pointer events (multi-touch via a `drags` map keyed by `pointerId`), shows captions/bubbles based on stretch distance, and runs the `requestAnimationFrame` loop: `mesh.update(dt, now)` then `renderer.draw(mesh, layout)`.
- `setImage()` in `main.ts` is the single entry point for a new photo: it uploads the texture, **creates a new `WarpMesh`** (so the mesh reference changes), and resets group mode. Modules that need the mesh get it through a getter (`getMesh: () => mesh`), never by holding a reference.
- `src/warp.ts` (`WarpMesh`) is the physics: a grid of points (64 columns) with rest and current positions, integrated at a fixed 1/120 s step with a damped spring back to rest. `grab/move/release` handle dragging with a falloff radius. `clay` disables the spring, `jelly` lowers damping. `playEffect(kind, now, target?)` runs a timed preset (ramp + hold) as a displacement on top of the current positions; several can run at once, and `target: {x, y, r}` aims one at a face. `chaos`, `poke` and `shake` are impulse helpers.
- `src/renderer.ts` (`Renderer`) is raw WebGL2: one textured triangle grid whose vertex buffer is re-uploaded from `mesh.positions` each frame. `preserveDrawingBuffer: true` is required for **Salvar PNG** (`canvas.toBlob`), which therefore captures only the canvas, not DOM overlays like captions or face circles.
- `src/image.ts`: `loadImageFile` and `fitToCanvas` (downscale + optional mirroring) normalize every source to an `HTMLCanvasElement`; `drawDefaultFace` draws the built-in cartoon face.
- Feature modules use a setup function with injected dependencies instead of importing `main.ts`:
  - `setupCamera(onPhoto, sounds)` in `src/camera.ts`: full-screen `getUserMedia` overlay with countdown, flash, camera flip, a mirrored selfie, and a fallback to `<input capture>`. It stops the stream on capture, close or tab hide.
  - `setupGroup(deps)` in `src/group.ts` returns a `Group` object. While `group.active`, `main.ts` forwards pointer events to it instead of warping. It places DOM face circles (in world units, repositioned on `relayout()`), runs the roulette and "one effect per face" by calling `mesh.playEffect(..., target)`, and reports effect durations through `onEffects` so `main.ts` can block preset buttons until they finish (`effectBusyUntil`).
