# Crazy Face

Upload a photo and squish, stretch and pull the face around. Let go and it wobbles back.

**Live demo: https://devsuperman.github.io/crazy-face/**

Runs fully in the browser (WebGL2). Photos never leave your device.

## How it works

- The image is drawn as a 64×N grid of triangles (`src/renderer.ts`).
- Dragging pulls nearby grid points along with the pointer, with a smooth falloff (`src/warp.ts`).
- A damped spring pulls every point back to its original spot, which gives the jelly wobble.
- **Clay mode** turns the spring off so the shape stays; **Reset** springs it back.

## Develop

```bash
npm install
npm run dev
```

## Build

```bash
npm run build   # output in dist/
```

## Deploy to GitHub Pages

The workflow in `.github/workflows/deploy.yml` builds and deploys on every push to `main`.

One-time setup: in the repository go to **Settings → Pages → Build and deployment → Source** and choose **GitHub Actions**.

The site is published at https://devsuperman.github.io/crazy-face/.
