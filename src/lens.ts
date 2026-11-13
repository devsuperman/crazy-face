/**
 * Face lenses: 👀 Olhão, 👃 Narigão, 🐹 Bochechas and 😁 Sorrisão.
 *
 * A lens is a magnifying bulge drawn by the fragment shader as a texture-coordinate
 * remap, per pixel, so it stays smooth even on the tiny faces of a group photo (a
 * mesh cell is far too coarse for an eye). Lenses sit in the photo's rest space
 * (world units before any warp), so they ride along with dragging and mesh effects.
 */

import type { EffectTarget } from './warp';

export interface Point {
  x: number;
  y: number;
}

/** Where the features of a face are, in world units. */
export interface Landmarks {
  eyes: [Point, Point];
  nose: Point;
  mouth: Point;
}

export type LensKind = 'eyes' | 'nose' | 'cheeks' | 'smile';

/** The most lenses drawn at once (6 faces × 3 for a smile, plus a few more). Must match the shader. */
export const MAX_LENSES = 24;

const TIMING = { ramp: 0.4, hold: 1.4, release: 0.5 };

interface Lens {
  x: number;
  y: number;
  r: number;
  /** Magnification at full strength: the centre is sampled at (1 - strength) × its distance. */
  strength: number;
  /** Shift at the centre (world units), so the bulge also droops (the nose goes down). */
  pullX: number;
  pullY: number;
  start: number;
  /** Set when the lens starts letting go (seconds). */
  releaseAt: number;
}

/** Guess where the eyes, nose and mouth are from a face circle (for faces tapped by hand). */
export function estimateLandmarks(t: EffectTarget): Landmarks {
  // Matches the circles from faces.ts: the centre is a bit above the nose, r ≈ 0.62 × box.
  const ey = t.y - 0.22 * t.r;
  return {
    eyes: [
      { x: t.x - 0.3 * t.r, y: ey },
      { x: t.x + 0.3 * t.r, y: ey },
    ],
    nose: { x: t.x, y: t.y + 0.1 * t.r },
    mouth: { x: t.x, y: t.y + 0.38 * t.r },
  };
}

export class Lenses {
  private list: Lens[] = [];
  /** Packed uniforms, refreshed by `update()`: x, y, radius, strength and pullX, pullY. */
  readonly shape = new Float32Array(MAX_LENSES * 4);
  readonly pull = new Float32Array(MAX_LENSES * 2);
  count = 0;

  static duration(): number {
    return TIMING.ramp + TIMING.hold;
  }

  /** Put eye, nose, cheek or smile lenses on a face. */
  play(kind: LensKind, now: number, target: EffectTarget): void {
    const lm = target.landmarks ?? estimateLandmarks(target);
    const [a, b] = lm.eyes;
    // Eye distance sets the scale; never let it collapse on a side-on face.
    const ed = Math.max(Math.hypot(b.x - a.x, b.y - a.y), target.r * 0.35);
    const add = (lens: Omit<Lens, 'start' | 'releaseAt'>) =>
      this.list.push({ ...lens, start: now, releaseAt: Infinity });

    // "Down" is from between the eyes towards the mouth, so tilted heads work too.
    const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
    const dx = lm.mouth.x - mid.x;
    const dy = lm.mouth.y - mid.y;
    const len = Math.hypot(dx, dy) || 1;

    if (kind === 'eyes') {
      for (const e of lm.eyes) add({ x: e.x, y: e.y, r: ed * 0.55, strength: 0.62, pullX: 0, pullY: 0 });
    } else if (kind === 'cheeks') {
      // Below each eye, level with the nose, a bit towards the side of the face.
      const r = ed * 0.72;
      for (const e of lm.eyes) {
        const ox = e.x - mid.x;
        const oy = e.y - mid.y;
        const olen = Math.hypot(ox, oy) || 1;
        const outX = ox / olen;
        const outY = oy / olen;
        add({
          x: e.x + dx * 0.6 + outX * ed * 0.25,
          y: e.y + dy * 0.6 + outY * ed * 0.25,
          r,
          strength: 0.55,
          // Puff out sideways and droop a little, like a hamster with full cheeks.
          pullX: outX * r * 0.22 + (dx / len) * r * 0.08,
          pullY: outY * r * 0.22 + (dy / len) * r * 0.08,
        });
      }
    } else if (kind === 'smile') {
      // BlazeFace only gives the mouth centre: the corners sit about 0.45 eye distances
      // to each side, along the eye line (so a tilted head smiles along its own mouth).
      const eyeLen = Math.hypot(b.x - a.x, b.y - a.y) || 1;
      const sideX = (b.x - a.x) / eyeLen;
      const sideY = (b.y - a.y) / eyeLen;
      const downX = dx / len;
      const downY = dy / len;
      // A slightly bigger mouth whose middle dips a little: the bottom of the grin.
      const rm = ed * 0.55;
      add({
        x: lm.mouth.x,
        y: lm.mouth.y,
        r: rm,
        strength: 0.35,
        pullX: downX * rm * 0.05,
        pullY: downY * rm * 0.05,
      });
      // Each corner goes up and out, ear to ear. Small lenses, so the jaw line stays put.
      // (A pull over ~0.65 × r would fold the picture over itself; this one is ~0.54.)
      const r = ed * 0.48;
      for (const side of [-1, 1]) {
        const outX = sideX * side;
        const outY = sideY * side;
        add({
          x: lm.mouth.x + outX * ed * 0.45,
          y: lm.mouth.y + outY * ed * 0.45,
          r,
          strength: 0.15,
          pullX: (outX * 0.2 - downX * 0.5) * r,
          pullY: (outY * 0.2 - downY * 0.5) * r,
        });
      }
    } else {
      const r = ed * 0.62;
      add({
        x: lm.nose.x + (dx / len) * ed * 0.06,
        y: lm.nose.y + (dy / len) * ed * 0.06,
        r,
        strength: 0.55,
        pullX: (dx / len) * r * 0.18,
        pullY: (dy / len) * r * 0.18,
      });
    }
    // Too many? Drop the oldest.
    if (this.list.length > MAX_LENSES) this.list.splice(0, this.list.length - MAX_LENSES);
  }

  /** Let every lens go (Resetar). */
  release(now: number): void {
    for (const l of this.list) l.releaseAt = Math.min(l.releaseAt, now);
  }

  /** Advance the animation. In clay mode, lenses stay at full size until reset. */
  update(now: number, clay: boolean): void {
    for (const l of this.list) {
      // Also catches lenses held by clay mode once it's switched off.
      if (l.releaseAt === Infinity && !clay && now - l.start > TIMING.ramp + TIMING.hold) l.releaseAt = now;
    }
    this.list = this.list.filter((l) => now - l.releaseAt < TIMING.release);

    this.count = 0;
    for (const l of this.list) {
      const amount = envelope(now - l.start) * releaseCurve(now - l.releaseAt);
      if (amount <= 0) continue;
      const i = this.count++;
      this.shape.set([l.x, l.y, l.r, l.strength * amount], i * 4);
      this.pull.set([l.pullX * amount, l.pullY * amount], i * 2);
    }
  }
}

/** Grow with a cartoon overshoot ("bloop"), then hold. */
function envelope(t: number): number {
  if (t <= 0) return 0;
  if (t >= TIMING.ramp) return 1;
  const x = t / TIMING.ramp - 1;
  const c = 2.2; // easeOutBack: overshoots by ~15%
  return 1 + (c + 1) * x ** 3 + c * x ** 2;
}

/** 1 until the release starts, then eases down to 0. */
function releaseCurve(t: number): number {
  if (t <= 0) return 1;
  const k = Math.min(1, t / TIMING.release);
  return 1 - k * k * (3 - 2 * k);
}
