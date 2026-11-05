/**
 * Cartoon sound effects, synthesized on the fly with the Web Audio API
 * (no audio files). The AudioContext is created lazily on the first user
 * gesture, because browsers block audio until then.
 */

import type { EffectKind } from './warp';

const STORAGE_KEY = 'crazy-face:muted';

interface ToneOptions {
  type?: OscillatorType;
  from: number;
  to: number;
  duration: number;
  gain?: number;
  delay?: number;
  /** Vibrato speed (Hz) and depth (fraction of the start pitch). */
  vibrato?: [rate: number, depth: number];
}

interface StretchVoice {
  osc: OscillatorNode;
  filter: BiquadFilterNode;
  gain: GainNode;
  lfo: OscillatorNode;
}

export class Sounds {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private stretchVoice: StretchVoice | null = null;
  private recordTap: MediaStreamAudioDestinationNode | null = null;
  muted: boolean;

  constructor() {
    let muted = false;
    try {
      muted = localStorage.getItem(STORAGE_KEY) === '1';
    } catch {
      // storage blocked: just start unmuted
    }
    this.muted = muted;
  }

  setMuted(muted: boolean): void {
    this.muted = muted;
    try {
      localStorage.setItem(STORAGE_KEY, muted ? '1' : '0');
    } catch {
      // ignore
    }
    if (muted) this.setStretch(0);
    if (this.master) this.master.gain.value = muted ? 0 : 1;
  }

  /** Call from a user gesture so the browser lets us make noise. */
  unlock(): void {
    const ctx = this.audio();
    if (ctx && ctx.state === 'suspended') void ctx.resume();
  }

  private audio(): AudioContext | null {
    if (this.ctx) return this.ctx;
    const Ctor =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return null;
    this.ctx = new Ctor();
    this.master = this.ctx.createGain();
    this.master.gain.value = this.muted ? 0 : 1;
    this.master.connect(this.ctx.destination);
    return this.ctx;
  }

  /**
   * A live audio stream with every sound we make, so videos can include them.
   * Returns null when the browser can't route Web Audio into a stream.
   */
  stream(): MediaStream | null {
    const ctx = this.audio();
    if (!ctx || !this.master) return null;
    if (!this.recordTap) {
      try {
        this.recordTap = ctx.createMediaStreamDestination();
      } catch {
        return null;
      }
      this.master.connect(this.recordTap);
    }
    return this.recordTap.stream;
  }

  private ready(): AudioContext | null {
    if (this.muted) return null;
    const ctx = this.audio();
    return ctx && ctx.state === 'running' ? ctx : null;
  }

  private tone(o: ToneOptions): void {
    const ctx = this.ready();
    if (!ctx || !this.master) return;
    const t0 = ctx.currentTime + (o.delay ?? 0);
    const end = t0 + o.duration;

    const osc = ctx.createOscillator();
    osc.type = o.type ?? 'sine';
    osc.frequency.setValueAtTime(o.from, t0);
    osc.frequency.exponentialRampToValueAtTime(Math.max(1, o.to), end);

    const gain = ctx.createGain();
    const peak = o.gain ?? 0.2;
    gain.gain.setValueAtTime(0.0001, t0);
    gain.gain.exponentialRampToValueAtTime(peak, t0 + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0001, end);
    osc.connect(gain).connect(this.master);

    if (o.vibrato) {
      const lfo = ctx.createOscillator();
      const depth = ctx.createGain();
      lfo.frequency.value = o.vibrato[0];
      depth.gain.setValueAtTime(o.from * o.vibrato[1], t0);
      depth.gain.exponentialRampToValueAtTime(1, end);
      lfo.connect(depth).connect(osc.frequency);
      lfo.start(t0);
      lfo.stop(end);
    }

    osc.start(t0);
    osc.stop(end + 0.02);
  }

  /**
   * Rubbery creak while dragging. `amount` is how far the face is stretched
   * (world units, ~0..0.6). Pass 0 to stop.
   */
  setStretch(amount: number): void {
    const ctx = this.ready();
    if (!ctx || !this.master || amount < 0.02) {
      if (this.stretchVoice) {
        const v = this.stretchVoice;
        const now = v.gain.context.currentTime;
        v.gain.gain.setTargetAtTime(0, now, 0.03);
        v.osc.stop(now + 0.2);
        v.lfo.stop(now + 0.2);
        this.stretchVoice = null;
      }
      return;
    }

    if (!this.stretchVoice) {
      const osc = ctx.createOscillator();
      osc.type = 'sawtooth';
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.Q.value = 9;
      const gain = ctx.createGain();
      gain.gain.value = 0;
      const lfo = ctx.createOscillator();
      lfo.frequency.value = 7;
      const lfoDepth = ctx.createGain();
      lfoDepth.gain.value = 9;
      lfo.connect(lfoDepth).connect(osc.frequency);
      osc.connect(filter).connect(gain).connect(this.master);
      osc.start();
      lfo.start();
      this.stretchVoice = { osc, filter, gain, lfo };
    }

    const v = this.stretchVoice;
    const now = ctx.currentTime;
    const a = Math.min(amount, 0.8);
    v.osc.frequency.setTargetAtTime(70 + a * 420, now, 0.05);
    v.filter.frequency.setTargetAtTime(350 + a * 2600, now, 0.05);
    v.gain.gain.setTargetAtTime(Math.min(0.07, a * 0.2), now, 0.05);
  }

  /** The classic "boing" when you let go. Bigger stretch, bigger boing. */
  boing(amount: number): void {
    if (amount < 0.04) return;
    const a = Math.min(amount, 0.8);
    this.tone({
      from: 160 + a * 520,
      to: 70,
      duration: 0.45 + a * 0.6,
      gain: 0.12 + a * 0.25,
      vibrato: [13, 0.22],
    });
  }

  /** A squeaky "ouch" for when you pull way too far. */
  ouch(): void {
    this.tone({ type: 'square', from: 900, to: 1500, duration: 0.09, gain: 0.06 });
    this.tone({ type: 'square', from: 1500, to: 600, duration: 0.16, gain: 0.06, delay: 0.09 });
  }

  /** Sound for each preset effect, timed to roughly match its animation. */
  effect(kind: EffectKind): void {
    switch (kind) {
      case 'balloon': // inflating
        this.tone({ from: 180, to: 900, duration: 0.5, gain: 0.18, vibrato: [22, 0.05] });
        break;
      case 'fish': // blub blub blub
        for (let n = 0; n < 3; n++) {
          this.tone({ from: 520, to: 160, duration: 0.12, gain: 0.2, delay: n * 0.14 });
        }
        break;
      case 'melt': // sad slide whistle
        this.tone({ from: 1100, to: 180, duration: 1.8, gain: 0.14, vibrato: [5, 0.04] });
        break;
      case 'eyes': // a rising "bloop" for each eye
        this.tone({ from: 220, to: 880, duration: 0.22, gain: 0.2 });
        this.tone({ from: 260, to: 1040, duration: 0.24, gain: 0.2, delay: 0.16 });
        break;
      case 'nose': // fom fom! a bike horn
        for (const delay of [0, 0.28]) {
          this.tone({ type: 'square', from: 330, to: 300, duration: 0.2, gain: 0.07, delay });
          this.tone({ type: 'sawtooth', from: 415, to: 380, duration: 0.2, gain: 0.05, delay });
        }
        break;
    }
  }

  /** Countdown beep before a photo; the last one is higher. */
  beep(last = false): void {
    this.tone({ type: 'square', from: last ? 1320 : 880, to: last ? 1320 : 880, duration: 0.12, gain: 0.08 });
  }

  /** Camera shutter "click-clack". */
  shutter(): void {
    this.tone({ type: 'square', from: 2400, to: 300, duration: 0.05, gain: 0.12 });
    this.tone({ type: 'square', from: 1800, to: 200, duration: 0.06, gain: 0.1, delay: 0.08 });
  }

  /** "Ta-da!" when the tug of war has a winner. */
  tada(): void {
    [523, 659, 784, 1047].forEach((f, n) =>
      this.tone({ type: 'triangle', from: f, to: f, duration: n === 3 ? 0.5 : 0.14, gain: 0.14, delay: n * 0.11 }),
    );
  }

  /** Recording starts: a quick rising "dee-doo". */
  recStart(): void {
    this.tone({ type: 'triangle', from: 660, to: 660, duration: 0.09, gain: 0.1 });
    this.tone({ type: 'triangle', from: 990, to: 990, duration: 0.12, gain: 0.1, delay: 0.1 });
  }

  /** Little "pop" for small UI moments. */
  pop(): void {
    this.tone({ from: 300, to: 900, duration: 0.08, gain: 0.15 });
  }

}
