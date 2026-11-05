/**
 * Elastic warp mesh.
 *
 * The image is covered by a grid of points in "world" units, where the image is
 * 1 unit wide and `aspect` units tall. Each point has a rest position (where it
 * started) and a current position. Grabbing pulls nearby points along with the
 * pointer (closer points move more); a damped spring pulls them back home.
 */

export interface Grab {
  /** Pointer position when the grab started (world units). */
  startX: number;
  startY: number;
  /** Current pointer position (world units). */
  x: number;
  y: number;
  /** Indices of affected points, their influence weight and start positions. */
  indices: Uint32Array;
  weights: Float32Array;
  origins: Float32Array;
}

const STIFFNESS = 140; // spring strength (higher = snappier)
const DAMPING = 7; // velocity damping (lower = wobblier)
const JELLY_STIFFNESS = 90;
const JELLY_DAMPING = 1.2; // barely damped: wobbles for ages
const STEP = 1 / 120; // fixed physics timestep in seconds

export type EffectKind = 'balloon' | 'fish' | 'twist' | 'melt';

/** How long each preset takes to reach full strength, and how long it holds there. */
const EFFECT_TIMING: Record<EffectKind, { ramp: number; hold: number }> = {
  balloon: { ramp: 0.35, hold: 0.9 },
  fish: { ramp: 0.3, hold: 0.9 },
  twist: { ramp: 0.6, hold: 0.7 },
  melt: { ramp: 1.6, hold: 1.2 },
};

interface ActiveEffect {
  start: number;
  ramp: number;
  hold: number;
  /** Positions when the effect started; the effect is applied on top of these. */
  base: Float32Array;
  /** Full-strength displacement for every point, interleaved x,y. */
  disp: Float32Array;
}

export class WarpMesh {
  readonly cols: number;
  readonly rows: number;
  readonly aspect: number;
  /** Current positions, interleaved x,y. Uploaded to the GPU every frame. */
  readonly positions: Float32Array;
  /** Texture coordinates, interleaved u,v. Never change. */
  readonly uvs: Float32Array;
  readonly indices: Uint32Array;

  private readonly rest: Float32Array;
  private readonly velocity: Float32Array;
  private readonly grabs = new Map<number, Grab>();
  private accumulator = 0;
  private springBackUntil = 0;
  private effect: ActiveEffect | null = null;

  /** In clay mode the face keeps its shape after you let go. */
  clay = false;
  /** In jelly mode the spring is much less damped, so it wobbles for longer. */
  jelly = false;

  constructor(aspect: number, cols = 64) {
    this.aspect = aspect;
    this.cols = cols;
    this.rows = Math.max(8, Math.round(cols * aspect));

    const count = (this.cols + 1) * (this.rows + 1);
    this.positions = new Float32Array(count * 2);
    this.rest = new Float32Array(count * 2);
    this.velocity = new Float32Array(count * 2);
    this.uvs = new Float32Array(count * 2);

    for (let r = 0; r <= this.rows; r++) {
      for (let c = 0; c <= this.cols; c++) {
        const i = (r * (this.cols + 1) + c) * 2;
        const u = c / this.cols;
        const v = r / this.rows;
        this.uvs[i] = u;
        this.uvs[i + 1] = v;
        this.rest[i] = u;
        this.rest[i + 1] = v * aspect;
      }
    }
    this.positions.set(this.rest);

    this.indices = new Uint32Array(this.cols * this.rows * 6);
    let k = 0;
    for (let r = 0; r < this.rows; r++) {
      for (let c = 0; c < this.cols; c++) {
        const a = r * (this.cols + 1) + c;
        const b = a + 1;
        const d = a + this.cols + 1;
        const e = d + 1;
        this.indices.set([a, d, b, b, d, e], k);
        k += 6;
      }
    }
  }

  /** Start dragging at (x, y). `radius` is the brush size in world units. */
  grab(id: number, x: number, y: number, radius: number): void {
    const idx: number[] = [];
    const w: number[] = [];
    const o: number[] = [];
    const r2 = radius * radius;
    const p = this.positions;

    for (let i = 0; i < p.length; i += 2) {
      const dx = p[i] - x;
      const dy = p[i + 1] - y;
      const d2 = dx * dx + dy * dy;
      if (d2 >= r2) continue;
      // Smooth falloff: 1 at the pointer, 0 at the edge of the brush.
      const t = 1 - d2 / r2;
      idx.push(i);
      w.push(t * t);
      o.push(p[i], p[i + 1]);
    }

    this.grabs.set(id, {
      startX: x,
      startY: y,
      x,
      y,
      indices: Uint32Array.from(idx),
      weights: Float32Array.from(w),
      origins: Float32Array.from(o),
    });
  }

  move(id: number, x: number, y: number): void {
    const g = this.grabs.get(id);
    if (!g) return;
    g.x = x;
    g.y = y;
  }

  release(id: number): void {
    this.grabs.delete(id);
  }

  get isDragging(): boolean {
    return this.grabs.size > 0;
  }

  /** Spring everything back to its original shape, even in clay mode. */
  reset(now: number): void {
    this.grabs.clear();
    this.effect = null;
    this.springBackUntil = now + 1.5;
  }

  /** True while a preset effect is still being applied. */
  get hasEffect(): boolean {
    return this.effect !== null;
  }

  /** Play a preset warp: it eases in, holds, then springs back (or stays, in clay mode). */
  playEffect(kind: EffectKind, now: number): void {
    const base = Float32Array.from(this.positions);
    const disp = new Float32Array(base.length);
    const cx = 0.5;
    const cy = this.aspect * 0.5;
    const R = 0.5 * Math.max(1, this.aspect) * 0.9;

    for (let i = 0; i < base.length; i += 2) {
      const x = base[i];
      const y = base[i + 1];
      const dx = x - cx;
      const dy = y - cy;
      const r = Math.hypot(dx, dy);
      const f = r < R ? (1 - (r / R) ** 2) ** 2 : 0; // 1 at the centre, 0 at R

      switch (kind) {
        case 'balloon': // push everything away from the centre: a big puffy head
          disp[i] = dx * f * 0.9;
          disp[i + 1] = dy * f * 0.9;
          break;
        case 'fish': // squeeze sideways towards the middle: fishy pout
          disp[i] = -dx * f * 0.75;
          disp[i + 1] = -dy * f * 0.25;
          break;
        case 'twist': {
          // rotate around the centre, most in the middle
          const a = f * 2.4;
          const cos = Math.cos(a);
          const sin = Math.sin(a);
          disp[i] = dx * cos - dy * sin - dx;
          disp[i + 1] = dx * sin + dy * cos - dy;
          break;
        }
        case 'melt': {
          // droop more towards the bottom, with uneven drips
          const t = Math.max(0, y / this.aspect);
          const drip = 0.6 + 0.4 * Math.sin(x * 14 + 1.3) * Math.sin(x * 5.3);
          disp[i] = dx * t * t * 0.25;
          disp[i + 1] = this.aspect * 0.4 * t ** 1.6 * drip;
          break;
        }
      }
    }

    const { ramp, hold } = EFFECT_TIMING[kind];
    this.effect = { start: now, ramp, hold, base, disp };
  }

  /** Total time a preset takes before it lets go, in seconds. */
  static effectDuration(kind: EffectKind): number {
    return EFFECT_TIMING[kind].ramp + EFFECT_TIMING[kind].hold;
  }

  /** Shove the points near (x, y) by (dx, dy) and let the spring sort it out. */
  poke(x: number, y: number, radius: number, dx: number, dy: number): void {
    const p = this.positions;
    const v = this.velocity;
    const r2 = radius * radius;
    for (let i = 0; i < p.length; i += 2) {
      const ox = p[i] - x;
      const oy = p[i + 1] - y;
      const d2 = ox * ox + oy * oy;
      if (d2 >= r2) continue;
      const t = 1 - d2 / r2;
      const w = t * t;
      p[i] += dx * w;
      p[i + 1] += dy * w;
      v[i] += dx * w * 4;
      v[i + 1] += dy * w * 4;
    }
  }

  /** Throw a handful of random pokes all over the image. */
  chaos(count = 9): void {
    for (let n = 0; n < count; n++) {
      const x = 0.1 + Math.random() * 0.8;
      const y = (0.1 + Math.random() * 0.8) * this.aspect;
      const a = Math.random() * Math.PI * 2;
      const len = 0.06 + Math.random() * 0.12;
      this.poke(x, y, 0.12 + Math.random() * 0.15, Math.cos(a) * len, Math.sin(a) * len);
    }
  }

  /**
   * Jiggle the whole face as if the device was shaken. Points further from the
   * centre get a bigger kick, so the face flexes instead of just sliding.
   */
  shake(ax: number, ay: number): void {
    if (this.clay) return;
    const p = this.positions;
    const v = this.velocity;
    const cx = 0.5;
    const cy = this.aspect * 0.5;
    for (let i = 0; i < p.length; i += 2) {
      const r = Math.hypot(p[i] - cx, p[i + 1] - cy);
      const k = 0.2 + r * 1.6;
      v[i] += ax * k;
      v[i + 1] += ay * k;
    }
  }

  /** Advance the simulation. `dt` and `now` are in seconds. */
  update(dt: number, now: number): void {
    this.accumulator += Math.min(dt, 0.1);
    while (this.accumulator >= STEP) {
      this.step(now);
      this.accumulator -= STEP;
    }
  }

  private step(now: number): void {
    const p = this.positions;
    const v = this.velocity;
    const rest = this.rest;
    const springOn = !this.clay || now < this.springBackUntil;

    if (springOn) {
      const stiffness = this.jelly ? JELLY_STIFFNESS : STIFFNESS;
      const decay = Math.exp(-(this.jelly ? JELLY_DAMPING : DAMPING) * STEP);
      for (let i = 0; i < p.length; i++) {
        v[i] = (v[i] + (rest[i] - p[i]) * stiffness * STEP) * decay;
        p[i] += v[i] * STEP;
      }
    } else {
      // Clay: no spring, but let pokes coast to a stop instead of freezing instantly.
      const decay = Math.exp(-12 * STEP);
      for (let i = 0; i < p.length; i++) {
        v[i] *= decay;
        p[i] += v[i] * STEP;
      }
    }

    const fx = this.effect;
    if (fx) {
      const elapsed = now - fx.start;
      if (elapsed >= fx.ramp + fx.hold) {
        this.effect = null; // let go: spring back (or stay put in clay mode)
      } else {
        const t = Math.min(1, Math.max(0, elapsed / fx.ramp));
        const amount = t * t * (3 - 2 * t); // smoothstep
        for (let i = 0; i < p.length; i++) {
          const goal = fx.base[i] + fx.disp[i] * amount;
          p[i] += (goal - p[i]) * 0.25;
          v[i] *= 0.75;
        }
      }
    }

    for (const g of this.grabs.values()) {
      const dx = g.x - g.startX;
      const dy = g.y - g.startY;
      for (let k = 0; k < g.indices.length; k++) {
        const i = g.indices[k];
        const w = g.weights[k];
        const tx = g.origins[k * 2] + dx * w;
        const ty = g.origins[k * 2 + 1] + dy * w;
        // Pull strongly towards the drag target; blend at the brush edge.
        const pull = 0.35 + 0.65 * w;
        p[i] += (tx - p[i]) * pull;
        p[i + 1] += (ty - p[i + 1]) * pull;
        v[i] *= 1 - pull;
        v[i + 1] *= 1 - pull;
      }
    }
  }
}
