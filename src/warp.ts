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
const STEP = 1 / 120; // fixed physics timestep in seconds

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

  /** In clay mode the face keeps its shape after you let go. */
  clay = false;

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
    this.springBackUntil = now + 1500;
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
      const decay = Math.exp(-DAMPING * STEP);
      for (let i = 0; i < p.length; i++) {
        v[i] = (v[i] + (rest[i] - p[i]) * STIFFNESS * STEP) * decay;
        p[i] += v[i] * STEP;
      }
    } else {
      v.fill(0);
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
