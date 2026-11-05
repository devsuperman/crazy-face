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
