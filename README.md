# Crazy Face

Upload a photo and squish, stretch and pull the face around. Let go and it wobbles back.

**Live demo: https://devsuperman.github.io/crazy-face/**

Runs fully in the browser (WebGL2). Photos never leave your device.

## How it works

- The image is drawn as a 64×N grid of triangles (`src/renderer.ts`).
- Dragging pulls nearby grid points along with the pointer, with a smooth falloff (`src/warp.ts`).
- A damped spring pulls every point back to its original spot, which gives the jelly wobble.
- **Clay mode** turns the spring off so the shape stays; **Reset** springs it back.
- **Jelly mode** makes the spring much less damped, so the face wobbles for ages.

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
