/**
 * 🎉 Sextou: on Fridays a sticker sits on the photo. It's drawn by the renderer
 * on the canvas (not as an HTML overlay), so it shows up in Salvar PNG and 💬 WhatsApp. Drag it to move it; pinch (or the mouse wheel, Shift to turn) to
 * resize and rotate; tap it for a little party.
 *
 * Everything here is in world units, like the mesh: the photo is 1 wide and
 * `aspect` tall. The sticker isn't warped by the mesh; it sits on top.
 */

/** Where the sticker is drawn this frame. */
export interface StickerPose {
  x: number;
  y: number;
  w: number;
  h: number;
  /** Radians, clockwise on screen. */
  angle: number;
}

/** True on Fridays (device time). `?sextou=1` / `?sextou=0` force it on or off for testing. */
export function isFriday(date = new Date()): boolean {
  const force = new URLSearchParams(location.search).get('sextou');
  if (force === '1') return true;
  if (force === '0') return false;
  return date.getDay() === 5;
}

/** The sticker art: a tilted party label with `text` on it. */
export function drawSticker(text: string): HTMLCanvasElement {
  const font = (px: number) => `900 ${px}px "Arial Black", "Segoe UI", system-ui, sans-serif`;
  const size = 120;
  const pad = 48;
  const border = 14;
  const measure = document.createElement('canvas').getContext('2d')!;
  measure.font = font(size);
  const textW = Math.ceil(measure.measureText(text).width);

  const canvas = document.createElement('canvas');
  canvas.width = textW + pad * 2 + border * 2;
  canvas.height = size + pad * 1.6 + border * 2;
  const ctx = canvas.getContext('2d')!;
  const w = canvas.width;
  const h = canvas.height;

  // White die-cut border with a soft shadow, then the yellow-to-orange label.
  ctx.shadowColor = 'rgba(0, 0, 0, 0.35)';
  ctx.shadowBlur = 10;
  ctx.shadowOffsetY = 4;
  ctx.fillStyle = '#fff';
  roundRect(ctx, 6, 4, w - 12, h - 14, h * 0.3);
  ctx.fill();
  ctx.shadowColor = 'transparent';

  const label = ctx.createLinearGradient(0, 0, w, h);
  label.addColorStop(0, '#ffe14d');
  label.addColorStop(0.55, '#ffb21e');
  label.addColorStop(1, '#ff6b3d');
  ctx.fillStyle = label;
  roundRect(ctx, 6 + border, 4 + border, w - 12 - border * 2, h - 14 - border * 2, h * 0.24);
  ctx.fill();

  // Confetti dots.
  const colours = ['#ff3d8b', '#3dd6ff', '#7b3dff', '#2fd06b', '#fff'];
  for (let i = 0; i < 26; i++) {
    ctx.fillStyle = colours[i % colours.length];
    const x = border + 14 + ((i * 97) % (w - border * 2 - 28));
    const y = border + 12 + ((i * 53) % (h - border * 2 - 34));
    ctx.beginPath();
    ctx.arc(x, y, 4 + (i % 3) * 2, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.font = font(size);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.lineJoin = 'round';
  ctx.lineWidth = 16;
  ctx.strokeStyle = '#fff';
  const cy = (h - 10) / 2 + size * 0.04;
  ctx.strokeText(text, w / 2, cy);
  ctx.fillStyle = '#5a1fa8';
  ctx.fillText(text, w / 2, cy);
  return canvas;
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

const MIN_W = 0.12;
const MAX_W = 1.6;
/** How long a press can last and still count as a tap (seconds). */
const TAP_TIME = 0.4;

type Point = { x: number; y: number };

/** The sticker's place on the photo and the gestures that move it. */
export class Sticker {
  /** On only on Fridays, unless turned off. */
  visible = false;
  private x = 0.5;
  private y = 0.5;
  private w = 0.4;
  private angle = 0;
  /** Height / width of the sticker art. */
  private ratio = 0.4;
  private photoAspect = 1;
  private poppedAt = -Infinity;
  private wiggledAt = -Infinity;

  private readonly touches = new Map<number, Point>();
  /** Pose and touches when the current gesture (re)started. */
  private base = { x: 0, y: 0, w: 0, angle: 0, touches: [] as Point[] };
  private gesture = { startedAt: 0, moved: 0, pinched: false };

  /** Put it in the bottom-right corner of a new photo (captions show at the top), slightly tilted. */
  place(photoAspect: number, artRatio: number, now: number): void {
    this.photoAspect = photoAspect;
    this.ratio = artRatio;
    this.w = Math.min(0.42, (photoAspect * 0.3) / artRatio);
    this.x = 1 - this.w / 2 - 0.03;
    this.y = photoAspect - (this.w * artRatio) / 2 - 0.05;
    this.angle = -0.12;
    this.touches.clear();
    this.pop(now);
  }

  /** Bounce in. */
  pop(now: number): void {
    this.poppedAt = now;
  }

  /** Shake like a happy dog. */
  wiggle(now: number): void {
    this.wiggledAt = now;
  }

  pose(now: number): StickerPose {
    const t = (now - this.poppedAt) / 0.5;
    // Ease out with an overshoot, from 0 to 1.
    const grow = t >= 1 ? 1 : 1 + 2.7 * Math.pow(t - 1, 3) + 1.7 * Math.pow(t - 1, 2);
    const wt = now - this.wiggledAt;
    const wiggle = wt < 0.8 ? Math.sin(wt * 28) * 0.18 * (1 - wt / 0.8) : 0;
    const held = this.touches.size ? 1.06 : 1;
    const w = this.w * Math.max(0, grow) * held * (1 + Math.abs(wiggle) * 0.4);
    return { x: this.x, y: this.y, w, h: w * this.ratio, angle: this.angle + wiggle };
  }

  /** Is (x, y) on the sticker (with a little margin for fingers)? */
  hit(x: number, y: number): boolean {
    if (!this.visible) return false;
    const dx = x - this.x;
    const dy = y - this.y;
    const c = Math.cos(-this.angle);
    const s = Math.sin(-this.angle);
    const lx = dx * c - dy * s;
    const ly = dx * s + dy * c;
    const margin = 0.03;
    return Math.abs(lx) <= this.w / 2 + margin && Math.abs(ly) <= (this.w * this.ratio) / 2 + margin;
  }

  /** Should a new pointer at (x, y) go to the sticker? A second finger anywhere joins a pinch. */
  wants(x: number, y: number): boolean {
    if (!this.visible) return false;
    return this.touches.size === 1 || (this.touches.size === 0 && this.hit(x, y));
  }

  owns(id: number): boolean {
    return this.touches.has(id);
  }

  grab(id: number, x: number, y: number, now: number): void {
    if (!this.touches.size) this.gesture = { startedAt: now, moved: 0, pinched: false };
    this.touches.set(id, { x, y });
    if (this.touches.size >= 2) this.gesture.pinched = true;
    this.rebase();
  }

  move(id: number, x: number, y: number): void {
    const p = this.touches.get(id);
    if (!p) return;
    this.gesture.moved = Math.max(this.gesture.moved, Math.hypot(x - this.base.touches[0].x, y - this.base.touches[0].y));
    p.x = x;
    p.y = y;
    const now = [...this.touches.values()];
    const was = this.base.touches;
    if (now.length === 1) {
      this.moveTo(this.base.x + now[0].x - was[0].x, this.base.y + now[0].y - was[0].y);
      return;
    }
    // Two fingers: follow their midpoint, their distance (size) and their angle (turn).
    const [a, b] = now;
    const [a0, b0] = was;
    const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
    const mid0 = { x: (a0.x + b0.x) / 2, y: (a0.y + b0.y) / 2 };
    const dist = Math.hypot(b.x - a.x, b.y - a.y);
    const dist0 = Math.max(1e-4, Math.hypot(b0.x - a0.x, b0.y - a0.y));
    const turn = Math.atan2(b.y - a.y, b.x - a.x) - Math.atan2(b0.y - a0.y, b0.x - a0.x);
    this.w = clamp(this.base.w * (dist / dist0), MIN_W, MAX_W);
    this.angle = this.base.angle + turn;
    this.moveTo(this.base.x + mid.x - mid0.x, this.base.y + mid.y - mid0.y);
  }

  /** Let go. True if it was a tap (short, still and one finger), not a move. */
  release(id: number, now: number, tapSlop: number): boolean {
    if (!this.touches.delete(id)) return false;
    this.rebase();
    if (this.touches.size) return false;
    const g = this.gesture;
    return !g.pinched && g.moved < tapSlop && now - g.startedAt < TAP_TIME;
  }

  /** Mouse wheel: resize, or turn with Shift. */
  wheel(deltaY: number, turn: boolean): void {
    if (turn) this.angle += deltaY * 0.003;
    else this.w = clamp(this.w * Math.exp(-deltaY * 0.0015), MIN_W, MAX_W);
  }

  /** Keep the centre on the photo so the sticker can't get lost. */
  private moveTo(x: number, y: number): void {
    this.x = clamp(x, 0, 1);
    this.y = clamp(y, 0, this.photoAspect);
  }

  /** Fingers were added or lifted: continue the gesture from where things are now. */
  private rebase(): void {
    this.base = {
      x: this.x,
      y: this.y,
      w: this.w,
      angle: this.angle,
      touches: [...this.touches.values()].slice(0, 2).map((p) => ({ ...p })),
    };
  }
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
