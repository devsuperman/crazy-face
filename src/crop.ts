/**
 * ✂️ Recortar: turn the photo in quarter turns and crop it, free or at a fixed ratio.
 * It runs before setImage(), so the mesh, the face search and ✨ Luz e beleza only
 * ever see the cropped photo.
 */

import type { Sounds } from './sound';

/** Quarter turns clockwise (0-3), then a box in fractions (0..1) of the turned photo. */
export interface Crop {
  turns: number;
  x: number;
  y: number;
  w: number;
  h: number;
}

/** A photo as it came in (camera or gallery) and how it was cropped. */
export interface Framing {
  source: HTMLCanvasElement;
  crop: Crop;
}

export const FULL_CROP: Crop = { turns: 0, x: 0, y: 0, w: 1, h: 1 };

const EPS = 1e-4;
export const sameCrop = (a: Crop, b: Crop): boolean =>
  a.turns === b.turns &&
  Math.abs(a.x - b.x) < EPS &&
  Math.abs(a.y - b.y) < EPS &&
  Math.abs(a.w - b.w) < EPS &&
  Math.abs(a.h - b.h) < EPS;

/** Opens the crop screen on `image`; resolves with the new crop, or null if cancelled. */
export type Cropper = (image: HTMLCanvasElement, start?: Crop) => Promise<Crop | null>;

/** Turn and crop `image` into a new canvas (same pixel density, never scaled up). */
export function applyCrop(image: HTMLCanvasElement, crop: Crop): HTMLCanvasElement {
  const [tw, th] = turnedSize(image, crop.turns);
  const out = document.createElement('canvas');
  out.width = Math.max(1, Math.round(crop.w * tw));
  out.height = Math.max(1, Math.round(crop.h * th));
  const ctx = out.getContext('2d')!;
  ctx.imageSmoothingQuality = 'high';
  ctx.translate(-crop.x * tw, -crop.y * th);
  drawTurned(ctx, image, crop.turns, tw, th);
  return out;
}

function turnedSize(image: HTMLCanvasElement, turns: number): [number, number] {
  return turns % 2 ? [image.height, image.width] : [image.width, image.height];
}

/** Draw `image` turned clockwise `turns` times, filling a `w` × `h` (turned) area. */
function drawTurned(ctx: CanvasRenderingContext2D, image: HTMLCanvasElement, turns: number, w: number, h: number): void {
  ctx.save();
  if (turns === 1) {
    ctx.translate(w, 0);
    ctx.rotate(Math.PI / 2);
  } else if (turns === 2) {
    ctx.translate(w, h);
    ctx.rotate(Math.PI);
  } else if (turns === 3) {
    ctx.translate(0, h);
    ctx.rotate(-Math.PI / 2);
  }
  if (turns % 2) ctx.drawImage(image, 0, 0, h, w);
  else ctx.drawImage(image, 0, 0, w, h);
  ctx.restore();
}

/** Width / height of the fixed formats ("free" has none). */
const RATIOS: Record<string, number | null> = {
  free: null,
  '1:1': 1,
  '3:4': 3 / 4,
  '4:3': 4 / 3,
  '9:16': 9 / 16,
};

/** Smallest crop box side, in screen pixels. */
const MIN_BOX = 40;
/** Room around the photo so the corner handles stay on screen (px). */
const PAD = 28;

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const clamp = (v: number, lo: number, hi: number) => Math.max(Math.min(lo, hi), Math.min(hi, v));

interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

export function setupCropper(sounds: Sounds): Cropper {
  const overlay = $<HTMLDivElement>('crop');
  const area = $<HTMLDivElement>('crop-area');
  const frame = $<HTMLDivElement>('crop-frame');
  const preview = $<HTMLCanvasElement>('crop-canvas');
  const boxEl = $<HTMLDivElement>('crop-box');
  const doneButton = $<HTMLButtonElement>('crop-done');
  const ratioButtons = [...overlay.querySelectorAll<HTMLButtonElement>('[data-ratio]')];

  let image: HTMLCanvasElement | null = null;
  let turns = 0;
  /** The crop box in fractions of the turned photo. */
  let box: Box = { x: 0, y: 0, w: 1, h: 1 };
  let ratio: number | null = null;
  /** The preview's size on screen (CSS px). */
  let W = 1;
  let H = 1;
  let finish: ((crop: Crop | null) => void) | null = null;
  let drag: { id: number; corner: [number, number] | null; start: Box; x0: number; y0: number } | null = null;

  const toPx = (b: Box): Box => ({ x: b.x * W, y: b.y * H, w: b.w * W, h: b.h * H });
  const fromPx = (b: Box): Box => ({ x: b.x / W, y: b.y / H, w: b.w / W, h: b.h / H });

  /** Fit the turned photo in the screen, redraw it and the box. */
  function layout(): void {
    if (!image) return;
    const [tw, th] = turnedSize(image, turns);
    const s = Math.min((area.clientWidth - PAD * 2) / tw, (area.clientHeight - PAD * 2) / th);
    W = Math.max(1, tw * s);
    H = Math.max(1, th * s);
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    preview.width = Math.max(1, Math.round(W * dpr));
    preview.height = Math.max(1, Math.round(H * dpr));
    preview.style.width = `${W}px`;
    preview.style.height = `${H}px`;
    drawTurned(preview.getContext('2d')!, image, turns, preview.width, preview.height);
    showBox();
  }

  function showBox(): void {
    const b = toPx(box);
    boxEl.style.left = `${b.x}px`;
    boxEl.style.top = `${b.y}px`;
    boxEl.style.width = `${b.w}px`;
    boxEl.style.height = `${b.h}px`;
  }

  /** The biggest box of the chosen format, centred where the box is now. */
  function fitRatio(): void {
    if (ratio === null) return;
    const b = toPx(box);
    let w = W;
    let h = W / ratio;
    if (h > H) {
      h = H;
      w = H * ratio;
    }
    const x = clamp(b.x + b.w / 2 - w / 2, 0, W - w);
    const y = clamp(b.y + b.h / 2 - h / 2, 0, H - h);
    box = fromPx({ x, y, w, h });
  }

  function setRatio(key: string): void {
    ratio = RATIOS[key] ?? null;
    for (const b of ratioButtons) b.setAttribute('aria-pressed', String(b.dataset.ratio === key));
    fitRatio();
    showBox();
  }

  /** Turn a quarter clockwise (+1) or anticlockwise (-1); the box turns with the photo. */
  function turn(dir: 1 | -1): void {
    const { x, y, w, h } = box;
    box = dir === 1 ? { x: 1 - y - h, y: x, w: h, h: w } : { x: y, y: 1 - x - w, w: h, h: w };
    turns = (turns + dir + 4) % 4;
    layout();
    fitRatio();
    showBox();
    sounds.pop();
  }

  function point(e: PointerEvent): [number, number] {
    const r = frame.getBoundingClientRect();
    return [e.clientX - r.left, e.clientY - r.top];
  }

  frame.addEventListener('pointerdown', (e) => {
    if (drag) return;
    const target = e.target as HTMLElement;
    const handle = target.closest<HTMLElement>('[data-corner]');
    if (!handle && !boxEl.contains(target)) return;
    e.preventDefault();
    frame.setPointerCapture(e.pointerId);
    const [x0, y0] = point(e);
    const c = handle?.dataset.corner;
    drag = {
      id: e.pointerId,
      corner: c ? [c.includes('e') ? 1 : -1, c.includes('s') ? 1 : -1] : null,
      start: toPx(box),
      x0,
      y0,
    };
  });

  frame.addEventListener('pointermove', (e) => {
    if (!drag || e.pointerId !== drag.id) return;
    const [px, py] = point(e);
    const s = drag.start;
    if (!drag.corner) {
      box = fromPx({
        x: clamp(s.x + px - drag.x0, 0, W - s.w),
        y: clamp(s.y + py - drag.y0, 0, H - s.h),
        w: s.w,
        h: s.h,
      });
    } else {
      // The opposite corner stays put.
      const [dx, dy] = drag.corner;
      const ax = dx > 0 ? s.x : s.x + s.w;
      const ay = dy > 0 ? s.y : s.y + s.h;
      const maxW = dx > 0 ? W - ax : ax;
      const maxH = dy > 0 ? H - ay : ay;
      let w = clamp((px - ax) * dx, MIN_BOX, maxW);
      let h = clamp((py - ay) * dy, MIN_BOX, maxH);
      if (ratio !== null) {
        if (w / h > ratio) w = h * ratio;
        else h = w / ratio;
      }
      box = fromPx({ x: dx > 0 ? ax : ax - w, y: dy > 0 ? ay : ay - h, w, h });
    }
    showBox();
  });

  const endDrag = (e: PointerEvent) => {
    if (drag?.id === e.pointerId) drag = null;
  };
  frame.addEventListener('pointerup', endDrag);
  frame.addEventListener('pointercancel', endDrag);

  for (const b of ratioButtons) b.addEventListener('click', () => setRatio(b.dataset.ratio ?? 'free'));
  $('crop-left').addEventListener('click', () => turn(-1));
  $('crop-right').addEventListener('click', () => turn(1));
  $('crop-reset').addEventListener('click', () => {
    box = { x: 0, y: 0, w: 1, h: 1 };
    setRatio('free');
    sounds.pop();
  });

  function close(result: Crop | null): void {
    overlay.hidden = true;
    image = null;
    drag = null;
    const done = finish;
    finish = null;
    done?.(result);
  }

  doneButton.addEventListener('click', () => {
    sounds.snip();
    close({ turns, ...box });
  });
  $('crop-cancel').addEventListener('click', () => close(null));
  overlay.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') close(null);
  });

  new ResizeObserver(layout).observe(area);

  return (img, start = FULL_CROP) => {
    if (finish) close(null);
    image = img;
    turns = ((start.turns % 4) + 4) % 4;
    box = { x: start.x, y: start.y, w: start.w, h: start.h };
    setRatio('free');
    overlay.hidden = false;
    layout();
    doneButton.focus();
    return new Promise((resolve) => (finish = resolve));
  };
}
