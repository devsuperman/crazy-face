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

/** Where to aim an effect: a face centre and its radius, in world units. */
export interface EffectTarget {
  x: number;
  y: number;
  r: number;
}

interface ActiveEffect {
  start: number;
  ramp: number;
  hold: number;
  /** Indices (into `positions`) of the x coordinates of the points this effect moves. */
  indices: Uint32Array;
  /** Positions of those points when the effect started; the effect is applied on top. */
  base: Float32Array;
  /** Full-strength displacement of those points, interleaved x,y. */
  disp: Float32Array;
}

/** How much bigger than the face an aimed effect reaches, so the head and chin come along. */
const TARGET_REACH = 1.45;

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
  /** Several effects can play at once, as long as they move different points. */
  private effects: ActiveEffect[] = [];

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
    this.effects = [];
    this.springBackUntil = now + 1.5;
  }

  /** True while a preset effect is still being applied. */
  get hasEffect(): boolean {
    return this.effects.length > 0;
  }

  /**
   * Play a preset warp: it eases in, holds, then springs back (or stays, in clay mode).
   * Without a target it works on the whole image; with one it only warps that face,
   * so several faces can each get their own effect at the same time.
   */
  playEffect(kind: EffectKind, now: number, target?: EffectTarget): void {
    const p = this.positions;
    const cx = target ? target.x : 0.5;
    const cy = target ? target.y : this.aspect * 0.5;
    const R = target ? target.r * TARGET_REACH : 0.5 * Math.max(1, this.aspect) * 0.9;
    // Melt droops from the top of the face (or image) down to the chin (or bottom).
    const meltTop = target ? cy - target.r : 0;
    const meltHeight = target ? target.r * 2 : this.aspect;

    const idx: number[] = [];
    const base: number[] = [];
    const disp: number[] = [];

    for (let i = 0; i < p.length; i += 2) {
      const x = p[i];
      const y = p[i + 1];
      const dx = x - cx;
      const dy = y - cy;
      const r = Math.hypot(dx, dy);
      const f = r < R ? (1 - (r / R) ** 2) ** 2 : 0; // 1 at the centre, 0 at R
      let ox = 0;
      let oy = 0;

      switch (kind) {
        case 'balloon': // push everything away from the centre: a big puffy head
          ox = dx * f * 0.9;
          oy = dy * f * 0.9;
          break;
        case 'fish': // squeeze sideways towards the middle: fishy pout
          ox = -dx * f * 0.75;
          oy = -dy * f * 0.25;
          break;
        case 'twist': {
          // rotate around the centre, most in the middle
          const a = f * 2.4;
          const cos = Math.cos(a);
          const sin = Math.sin(a);
          ox = dx * cos - dy * sin - dx;
          oy = dx * sin + dy * cos - dy;
          break;
        }
        case 'melt': {
          // droop more towards the bottom, with uneven drips
          const t = Math.min(1.3, Math.max(0, (y - meltTop) / meltHeight));
          const wx = target ? (dx / target.r) * 0.5 + 0.5 : x; // same drips at any size
          const drip = 0.6 + 0.4 * Math.sin(wx * 14 + 1.3) * Math.sin(wx * 5.3);
          const w = target ? f : 1; // an aimed melt fades out around the face
          ox = dx * t * t * 0.25 * w;
          oy = meltHeight * 0.4 * t ** 1.6 * drip * w;
          break;
        }
      }

      if (Math.abs(ox) + Math.abs(oy) < 1e-6) continue;
      idx.push(i);
      base.push(x, y);
      disp.push(ox, oy);
    }

    const { ramp, hold } = EFFECT_TIMING[kind];
    this.effects.push({
      start: now,
      ramp,
      hold,
      indices: Uint32Array.from(idx),
      base: Float32Array.from(base),
      disp: Float32Array.from(disp),
    });
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

    // Finished effects let go: spring back (or stay put in clay mode).
    if (this.effects.length) {
      this.effects = this.effects.filter((fx) => now - fx.start < fx.ramp + fx.hold);
    }
    for (const fx of this.effects) {
      const t = Math.min(1, Math.max(0, (now - fx.start) / fx.ramp));
      const amount = t * t * (3 - 2 * t); // smoothstep
      for (let k = 0; k < fx.indices.length; k++) {
        const i = fx.indices[k];
        for (let j = 0; j < 2; j++) {
          const goal = fx.base[k * 2 + j] + fx.disp[k * 2 + j] * amount;
          p[i + j] += (goal - p[i + j]) * 0.25;
          v[i + j] *= 0.75;
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
