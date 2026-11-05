# Crazy Face

Take or upload a photo and squish, stretch and pull the face around. Let go and it wobbles back.

The app is in Brazilian Portuguese (PT-BR). All the user-facing text lives in `index.html` and `src/jokes.ts`.

**Live demo: https://devsuperman.github.io/crazy-face/**

Runs fully in the browser (WebGL2). Photos never leave your device.

## How it works

- The image is drawn as a 64×N grid of triangles (`src/renderer.ts`).
- Dragging pulls nearby grid points along with the pointer, with a smooth falloff (`src/warp.ts`).
- A damped spring pulls every point back to its original spot, which gives the jelly wobble.
- **Clay mode** turns the spring off so the shape stays; **Reset** springs it back.
- **Jelly mode** makes the spring much less damped, so the face wobbles for ages.

## Start screen

The app opens on a start screen: **📸 Tirar foto**, **🖼️ Escolher foto**, or play with the built-in cartoon face. You can also drop or paste an image. Once there's a photo, the editor opens; **📸 Nova foto** takes you back.

## Take a photo

- **📸 Tirar foto** opens the camera full screen, with a 3-2-1 countdown, beeps, a flash and a shutter sound (`src/camera.ts`).
- The selfie camera is mirrored, and the photo keeps that mirror so it looks like the preview. 🔄 switches cameras when there is more than one.
- After the shot, **Ficou boa?** shows the photo: **✔ Usar esta** or **🔁 Tirar outra**.
- Where the browser supports it (e.g. Android Chrome), the photo is a full-resolution still (`ImageCapture.takePhoto()`), sharper than a video frame.
- The camera turns off as soon as the photo is used, the overlay closes, or the tab goes to the background.
- If the browser has no camera support, the button opens the phone's own camera app instead.
- **😜 Desafio de pose:** before the countdown the camera shows a random pose prompt, like "Cara de quem viu o boleto!". Right after the photo, the prompt's matching effect plays. 🔀 picks another one, or turn it off.
- Browsers only allow the camera on HTTPS pages or `localhost`. To test on a phone on your Wi-Fi, run `npm run dev:phone` and open the `https://` network address it prints (accept the self-signed certificate warning).

## 🎬 Gravar (video clips)

Records a 6-second clip of the canvas with the cartoon sounds (`src/recorder.ts`), as MP4 when the browser can, otherwise WebM. When it's done you can share it straight to WhatsApp & co. (Web Share) or download it. Captions and other overlays are not part of the clip.

## 💬 WhatsApp

Sends the current picture (the same PNG as **Salvar PNG**) with a joke line. On phones it opens the share sheet (Web Share with files), where WhatsApp is listed. Web pages can't attach a file to WhatsApp directly, so where file sharing isn't available (most desktops) it downloads the PNG and opens WhatsApp (`wa.me`) with the text, and you attach the photo there.

## Group photos

Faces are **found automatically** right after a photo arrives (`src/faces.ts`, MediaPipe's BlazeFace detector run on overlapping windows of a few sizes so small faces in group shots are found too). It runs in the browser; the library and model are bundled with the app and only downloaded when first needed (opening the camera or the gallery). There's nothing to mark by hand.

- Every effect button hits **every face** in the photo at once (up to 6), with group captions like "Família Pinóquio reunida! 👃".
- **🎭 Um efeito pra cada:** every face gets a different effect at the same time.
- Effects can be aimed at a face and several can play at once (`playEffect(kind, now, target)` in `src/warp.ts`).

## Silly stuff

- **Effect buttons:** 🎈 Balloon, 🐟 Fish face, 🫠 Melt (`src/warp.ts`), 👀 Big eyes and 👃 Big nose (`src/lens.ts`). They aim at every face in the photo, found automatically (`src/faces.ts`); without a face the mesh ones warp the whole photo.
- **Cartoon sounds:** a rubbery creak while you drag and a boing when you let go. All are made on the fly with the Web Audio API, so there are no audio files (`src/sound.ts`). Use 🔊 to mute.
- **Cheeky captions** after a big stretch, an **"OUCH!"** bubble when you pull too far, and a random joke hint on each visit (`src/jokes.ts`, where it's easy to add more).
- **Shake your phone** to make the face jiggle (iOS asks for permission on the first tap).
- **🪢 Cabo de guerra:** two people grab the face with one finger each, far apart, and pull. When someone lets go, whoever stretched it further wins.

## Develop

```bash
npm install
npm run dev
```

## Build

```bash
npm run build   # output in dist/
```
