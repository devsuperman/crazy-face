/**
 * Face lenses: 👀 Olhão, 👃 Narigão, 🐹 Bochechas and 😁 Sorrisão.
 *
 * A lens is a magnifying bulge drawn by the fragment shader as a texture-coordinate
 * remap, per pixel, so it stays smooth even on the tiny faces of a group photo (a
 * mesh cell is far too coarse for an eye). Lenses sit in the photo's rest space
 * (world units before any warp), so they ride along with dragging and mesh effects.
 * A lens is an ellipse that can magnify more along its axis than across it (the 😁
 * grin stretches the mouth sideways); the round ones have equal radii and strengths.
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
  /** Radius along the axis and across it. */
  rx: number;
  ry: number;
  /** Axis direction (a unit vector). */
  axisX: number;
  axisY: number;
  /**
   * Magnification at full strength, along the axis and across it: the centre is sampled
   * at (1 - strength) × its distance, so 0.5 doubles the size there. Must stay below 1.
   */
  along: number;
  across: number;
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
  /** Packed uniforms, refreshed by `update()`: x, y, rx, ry; along, across, axisX, axisY; pullX, pullY. */
  readonly shape = new Float32Array(MAX_LENSES * 4);
  readonly mag = new Float32Array(MAX_LENSES * 4);
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
    const addOval = (lens: Omit<Lens, 'start' | 'releaseAt'>) =>
      this.list.push({ ...lens, start: now, releaseAt: Infinity });
    const add = ({ r, strength, ...rest }: { x: number; y: number; r: number; strength: number; pullX: number; pullY: number }) =>
      addOval({ ...rest, rx: r, ry: r, axisX: 1, axisY: 0, along: strength, across: strength });

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
      // Stretch the mouth sideways along the eye line (so a tilted head grins along its own
      // mouth), much more than up and down: an ear-to-ear grin with big teeth and a wide jaw.
      const eyeLen = Math.hypot(b.x - a.x, b.y - a.y) || 1;
      const sideX = (b.x - a.x) / eyeLen;
      const sideY = (b.y - a.y) / eyeLen;
      const downX = dx / len;
      const downY = dy / len;
      // A bit below the mouth point (BlazeFace's is near the upper lip), centred on the teeth.
      addOval({
        x: lm.mouth.x + downX * ed * 0.15,
        y: lm.mouth.y + downY * ed * 0.15,
        rx: ed * 1.5,
        ry: ed * 0.8,
        axisX: sideX,
        axisY: sideY,
        along: 0.65, // ~2.9× wider at the centre
        across: 0.4, // ~1.7× taller
        pullX: 0,
        pullY: 0,
      });
      // BlazeFace has no mouth corners: they sit about 0.45 eye distances to each side.
      // Lift each one up and out (this happens before the stretch, in the photo's space),
      // so the stretched mouth curves up. A pull over ~0.65 × r would fold the picture.
      const r = ed * 0.45;
      for (const side of [-1, 1]) {
        const outX = sideX * side;
        const outY = sideY * side;
        add({
          x: lm.mouth.x + outX * ed * 0.45,
          y: lm.mouth.y + outY * ed * 0.45,
          r,
          strength: 0.1,
          pullX: (outX * 0.15 - downX * 0.5) * r,
          pullY: (outY * 0.15 - downY * 0.5) * r,
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
      this.shape.set([l.x, l.y, l.rx, l.ry], i * 4);
      this.mag.set([l.along * amount, l.across * amount, l.axisX, l.axisY], i * 4);
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
