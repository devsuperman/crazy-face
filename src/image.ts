import type { EffectTarget } from './warp';

/** Largest side we upload to the GPU; keeps memory and mobile GPUs happy. */
const MAX_SIDE = 2048;

/** Decode a user file (respecting EXIF rotation) and shrink it if huge. */
export async function loadImageFile(file: Blob): Promise<HTMLCanvasElement> {
  const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
  try {
    return fitToCanvas(bitmap, bitmap.width, bitmap.height);
  } finally {
    bitmap.close();
  }
}

/** Copy an image (or video frame) into a canvas no bigger than MAX_SIDE, optionally flipped sideways. */
export function fitToCanvas(
  source: CanvasImageSource,
  w: number,
  h: number,
  mirror = false,
): HTMLCanvasElement {
  const scale = Math.min(1, MAX_SIDE / Math.max(w, h));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(w * scale);
  canvas.height = Math.round(h * scale);
  const ctx = canvas.getContext('2d')!;
  if (mirror) {
    ctx.translate(canvas.width, 0);
    ctx.scale(-1, 1);
  }
  ctx.drawImage(source, 0, 0, canvas.width, canvas.height);
  return canvas;
}

/** A face region in world units (the image is 1 unit wide). */
interface FaceCircle {
  x: number;
  y: number;
  r: number;
}

/** Faces are taller than wide: the swapped patch is an ellipse this much taller than the circle. */
const HEAD_STRETCH = 1.2;

/**
 * "Troca de cabeças": a copy of `photo` where face i shows face (i + shift) instead.
 * Each face is scaled to fit its new spot and pasted with feathered edges so it blends.
 */
export function swapFaces(photo: HTMLCanvasElement, faces: readonly FaceCircle[], shift: number): HTMLCanvasElement {
  const out = document.createElement('canvas');
  out.width = photo.width;
  out.height = photo.height;
  const ctx = out.getContext('2d')!;
  ctx.drawImage(photo, 0, 0);
  const px = photo.width; // pixels per world unit
  const patch = document.createElement('canvas');
  const pctx = patch.getContext('2d')!;

  faces.forEach((to, i) => {
    const from = faces[(i + shift) % faces.length];
    if (from === to) return;
    const rw = to.r * px;
    const rh = rw * HEAD_STRETCH;
    patch.width = Math.max(1, Math.ceil(rw * 2));
    patch.height = Math.max(1, Math.ceil(rh * 2));

    const sw = from.r * px;
    const sh = sw * HEAD_STRETCH;
    pctx.globalCompositeOperation = 'source-over';
    pctx.drawImage(photo, from.x * px - sw, from.y * px - sh, sw * 2, sh * 2, 0, 0, patch.width, patch.height);

    // Feathered elliptical mask: solid in the middle, fading out at the edge.
    pctx.globalCompositeOperation = 'destination-in';
    pctx.save();
    pctx.translate(patch.width / 2, patch.height / 2);
    pctx.scale(1, HEAD_STRETCH);
    const g = pctx.createRadialGradient(0, 0, rw * 0.55, 0, 0, rw);
    g.addColorStop(0, 'rgba(0, 0, 0, 1)');
    g.addColorStop(1, 'rgba(0, 0, 0, 0)');
    pctx.fillStyle = g;
    pctx.fillRect(-rw, -rw, rw * 2, rw * 2);
    pctx.restore();

    ctx.drawImage(patch, to.x * px - rw, to.y * px - rh, rw * 2, rh * 2);
  });
  return out;
}

/** Where the cartoon face's features are, so 👀/👃 can aim at them without detection. */
export const DEFAULT_FACE_TARGET: EffectTarget = {
  x: 0.5,
  y: 0.56,
  r: 0.36,
  landmarks: {
    eyes: [
      { x: 0.37, y: 0.51 },
      { x: 0.63, y: 0.51 },
    ],
    nose: { x: 0.5, y: 0.63 },
    mouth: { x: 0.5, y: 0.79 },
  },
};

/** A cartoon face so there is something to play with before any upload. */
export function drawDefaultFace(): HTMLCanvasElement {
  const size = 768;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const s = size / 100;

  const ellipse = (x: number, y: number, rx: number, ry: number, fill: string) => {
    ctx.beginPath();
    ctx.ellipse(x * s, y * s, rx * s, ry * s, 0, 0, Math.PI * 2);
    ctx.fillStyle = fill;
    ctx.fill();
  };

  // Background
  const bg = ctx.createLinearGradient(0, 0, 0, size);
  bg.addColorStop(0, '#7dd3fc');
  bg.addColorStop(1, '#c4b5fd');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, size, size);

  // Hair, ears, head
  ellipse(50, 38, 36, 32, '#3b2a20');
  ellipse(17, 55, 6, 9, '#f2b48c');
  ellipse(83, 55, 6, 9, '#f2b48c');
  ellipse(50, 56, 32, 38, '#f6c39f');
  ellipse(50, 26, 30, 12, '#3b2a20');

  // Eyes
  for (const x of [37, 63]) {
    ellipse(x, 50, 8, 6, '#ffffff');
    ellipse(x, 51, 4, 4, '#2d5a8a');
    ellipse(x, 51, 2, 2, '#111111');
    ellipse(x + 1.5, 49.5, 1, 1, '#ffffff');
  }

  // Eyebrows
  ctx.strokeStyle = '#3b2a20';
  ctx.lineWidth = 2.5 * s;
  ctx.lineCap = 'round';
  for (const [x1, x2] of [
    [30, 44],
    [56, 70],
  ]) {
    ctx.beginPath();
    ctx.moveTo(x1 * s, 41 * s);
    ctx.quadraticCurveTo(((x1 + x2) / 2) * s, 37 * s, x2 * s, 41 * s);
    ctx.stroke();
  }

  // Nose, cheeks, mouth
  ellipse(50, 63, 4.5, 5.5, '#e9a582');
  ellipse(30, 68, 6, 4, 'rgba(255, 120, 120, 0.35)');
  ellipse(70, 68, 6, 4, 'rgba(255, 120, 120, 0.35)');
  ctx.beginPath();
  ctx.moveTo(38 * s, 74 * s);
  ctx.quadraticCurveTo(50 * s, 86 * s, 62 * s, 74 * s);
  ctx.closePath();
  ctx.fillStyle = '#8a2430';
  ctx.fill();
  ellipse(50, 79.5, 5, 2.5, '#e8697a');

  return canvas;
}
