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

## Take a photo

- **📸 Tirar foto** opens the camera full screen, with a 3-2-1 countdown, beeps, a flash and a shutter sound (`src/camera.ts`).
- The selfie camera is mirrored, and the photo keeps that mirror so it looks like the preview. 🔄 switches cameras when there is more than one.
- The camera turns off as soon as the photo is taken, the overlay closes, or the tab goes to the background.
- If the browser has no camera support, the button opens the phone's own camera app instead.
- Browsers only allow the camera on HTTPS pages or `localhost`. To test on a phone on your Wi-Fi, run `npm run dev:phone` and open the `https://` network address it prints (accept the self-signed certificate warning).

## Modo turma (group photos)

Tap **👥 Turma** to play with a photo of two or more people (`src/group.ts`).

- Tap each person's face to drop a numbered circle on it. Drag while tapping to size the circle, and tap a circle to remove it (up to 6 faces).
- **🎡 Roleta da vergonha:** a spotlight jumps between the faces, slows down and picks one person, who gets a random effect and a caption like "Quem paga a pizza é você! 🍕".
- **🎭 Um efeito pra cada:** every face gets a different effect at the same time.
- Effects can be aimed at a face and several can play at once (`playEffect(kind, now, target)` in `src/warp.ts`).

## Silly stuff

- **Effect buttons:** 🎈 Balloon, 🐟 Fish face, 🌀 Twister, 🫠 Melt and 🎲 Chaos (`src/warp.ts`).
- **Cartoon sounds:** a rubbery creak while you drag and a boing when you let go. All are made on the fly with the Web Audio API, so there are no audio files (`src/sound.ts`). Use 🔊 to mute.
- **Cheeky captions** after a big stretch, an **"OUCH!"** bubble when you pull too far, and a random joke hint on each visit (`src/jokes.ts`, where it's easy to add more).
- **Shake your phone** to make the face jiggle (iOS asks for permission on the first tap).

## Develop

```bash
npm install
npm run dev
```

## Build

```bash
npm run build   # output in dist/
```
