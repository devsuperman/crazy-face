/**
 * Automatic face detection for Modo turma, with MediaPipe's BlazeFace detector.
 *
 * Runs entirely in the browser: the photo never leaves the device. The library,
 * its WebAssembly runtime and the model are bundled with the app (no CDN) and only
 * downloaded the first time 👥 Turma opens, thanks to the dynamic import below.
 */

import type { FaceDetector } from '@mediapipe/tasks-vision';
import modelUrl from './assets/blaze_face_short_range.tflite?url';
import wasmLoaderUrl from '@mediapipe/tasks-vision/vision_wasm_internal.js?url';
import wasmBinaryUrl from '@mediapipe/tasks-vision/vision_wasm_internal.wasm?url';
import type { EffectTarget } from './warp';

interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
  score: number;
}

/** Smallest sliding window, in photo pixels: finds faces down to about 1/20 of the photo's short side. */
const MIN_WINDOW = 160;

let detectorPromise: Promise<FaceDetector> | null = null;

function loadDetector(): Promise<FaceDetector> {
  detectorPromise ??= (async () => {
    const { FaceDetector } = await import('@mediapipe/tasks-vision');
    return FaceDetector.createFromOptions(
      { wasmLoaderPath: wasmLoaderUrl, wasmBinaryPath: wasmBinaryUrl },
      {
        baseOptions: { modelAssetPath: modelUrl, delegate: 'CPU' },
        runningMode: 'IMAGE',
        minDetectionConfidence: 0.6,
      },
    );
  })();
  // If loading fails (offline, old browser), let the next call try again.
  detectorPromise.catch(() => (detectorPromise = null));
  return detectorPromise;
}

/**
 * Find the faces in a photo, biggest first, as circles in world units
 * (the image is 1 unit wide). Returns at most `max` faces.
 */
export async function detectFaces(image: HTMLCanvasElement, max: number): Promise<EffectTarget[]> {
  const detector = await loadDetector();
  const W = image.width;
  const H = image.height;

  // BlazeFace looks at a 128 px copy and only finds faces that fill a good part of
  // it, so faces in a group photo are too tiny. Slide square windows of a few sizes
  // over the photo (half-overlapping, so every face fits whole in some window).
  const boxes: Box[] = [];
  const tile = document.createElement('canvas');
  const ctx = tile.getContext('2d')!;
  const short = Math.min(W, H);
  const run = (ox: number, oy: number, tw: number, th: number) => {
    const k = Math.min(1, 512 / Math.max(tw, th)); // the model doesn't need more pixels
    tile.width = Math.round(tw * k);
    tile.height = Math.round(th * k);
    ctx.drawImage(image, ox, oy, tw, th, 0, 0, tile.width, tile.height);
    for (const d of detector.detect(tile).detections) {
      const b = d.boundingBox;
      if (!b) continue;
      boxes.push({
        x: ox + b.originX / k,
        y: oy + b.originY / k,
        w: b.width / k,
        h: b.height / k,
        score: d.categories[0]?.score ?? 0,
      });
    }
  };
  run(0, 0, W, H);
  for (let side = short; side >= Math.min(short, MIN_WINDOW); side /= 2) {
    const stride = side / 2;
    const nx = Math.max(1, Math.ceil((W - side) / stride) + 1);
    const ny = Math.max(1, Math.ceil((H - side) / stride) + 1);
    for (let i = 0; i < nx; i++) {
      for (let j = 0; j < ny; j++) {
        const ox = nx === 1 ? 0 : ((W - side) * i) / (nx - 1);
        const oy = ny === 1 ? 0 : ((H - side) * j) / (ny - 1);
        run(ox, oy, Math.min(side, W), Math.min(side, H));
      }
    }
    // Yield so the page can repaint the "procurando" hint between sizes.
    await new Promise((r) => setTimeout(r));
  }

  // Merge duplicates (the same face seen in several tiles): keep the best score.
  boxes.sort((a, b) => b.score - a.score);
  const kept: Box[] = [];
  for (const b of boxes) if (!kept.some((k) => overlaps(k, b))) kept.push(b);

  return kept
    .sort((a, b) => b.w * b.h - a.w * a.h)
    .slice(0, max)
    .map((b) => ({
      // The box goes from the brows to the chin: nudge the circle up a bit to fit the head.
      x: (b.x + b.w / 2) / W,
      y: (b.y + b.h * 0.45) / W,
      r: (Math.max(b.w, b.h) * 0.62) / W,
    }));
}

/** True if the boxes are mostly the same face. */
function overlaps(a: Box, b: Box): boolean {
  const ix = Math.max(0, Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x));
  const iy = Math.max(0, Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y));
  const inter = ix * iy;
  return inter / Math.min(a.w * a.h, b.w * b.h) > 0.4;
}
