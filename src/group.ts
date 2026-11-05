/**
 * "Modo turma": mark each person's face in a group photo, then play with all of them.
 *
 * - Tap a face to drop a circle on it; drag while tapping to size the circle.
 * - Tap a circle to remove it.
 * - 🎡 Roleta da vergonha: a spotlight jumps between faces and picks a "winner".
 * - 🎭 Um efeito pra cada: every face gets a different effect at the same time.
 */

import { EVERYONE_CAPTIONS, ROULETTE_CAPTIONS, pick } from './jokes';
import type { Layout } from './renderer';
import type { Sounds } from './sound';
import { WarpMesh, type EffectKind, type EffectTarget } from './warp';

const MAX_FACES = 6;
/** Circle radius for a plain tap, and the smallest one you can drag, in world units. */
const DEFAULT_R = 0.12;
const MIN_R = 0.04;
/** Below this drag distance a tap counts as "use the default size". */
const TAP_SLOP = 0.03;
const KINDS: EffectKind[] = ['balloon', 'fish', 'twist', 'melt'];

interface Face extends EffectTarget {
  el: HTMLDivElement;
}

export interface GroupDeps {
  getMesh(): WarpMesh;
  getLayout(): Layout;
  toWorld(e: PointerEvent): [number, number];
  sounds: Sounds;
  showCaption(text: string): void;
  /** Tells the app how long (seconds) the effects will play, to block other presets meanwhile. */
  onEffects(seconds: number): void;
}

export interface Group {
  readonly active: boolean;
  pointerDown(e: PointerEvent): void;
  pointerMove(e: PointerEvent): void;
  /** Returns true if the pointer was ours (so the app shouldn't treat it as a drag). */
  pointerUp(e: PointerEvent): boolean;
  relayout(): void;
  /** Forget all faces (a new photo was loaded). */
  clear(): void;
}

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;

export function setupGroup(deps: GroupDeps): Group {
  const effectsBar = $<HTMLDivElement>('effects-bar');
  const groupBar = $<HTMLDivElement>('group-bar');
  const layer = $<HTMLDivElement>('faces');
  const stage = $<HTMLElement>('stage');
  const hint = $<HTMLParagraphElement>('group-hint');
  const rouletteButton = $<HTMLButtonElement>('group-roulette');
  const everyoneButton = $<HTMLButtonElement>('group-everyone');
  const clearButton = $<HTMLButtonElement>('group-clear');

  let active = false;
  let faces: Face[] = [];
  let draft: { pointerId: number; face: Face } | null = null;
  let spinning = false;
  const timers: number[] = [];

  const later = (fn: () => void, ms: number) => timers.push(window.setTimeout(fn, ms));
  function cancelTimers(): void {
    timers.splice(0).forEach(clearTimeout);
    spinning = false;
    for (const f of faces) f.el.classList.remove('lit', 'winner');
    layer.classList.remove('resting');
  }

  function place(face: Face): void {
    const { offsetX, offsetY, scale } = deps.getLayout();
    const size = face.r * 2 * scale;
    Object.assign(face.el.style, {
      left: `${offsetX + face.x * scale}px`,
      top: `${offsetY + face.y * scale}px`,
      width: `${size}px`,
      height: `${size}px`,
    });
  }

  function makeFace(x: number, y: number): Face {
    const el = document.createElement('div');
    el.className = 'face-marker draft';
    layer.append(el);
    const face: Face = { x, y, r: DEFAULT_R, el };
    el.addEventListener('click', () => {
      if (spinning || !active) return;
      removeFace(face);
    });
    place(face);
    return face;
  }

  function removeFace(face: Face): void {
    face.el.remove();
    faces = faces.filter((f) => f !== face);
    update();
  }

  /** Renumber the circles, refresh the hint and enable the buttons that make sense. */
  function update(): void {
    faces.forEach((f, n) => {
      f.el.textContent = String(n + 1);
      f.el.setAttribute('aria-label', `Pessoa ${n + 1} (toque para remover)`);
    });
    const n = faces.length;
    rouletteButton.disabled = spinning || n < 2;
    everyoneButton.disabled = spinning || n < 1;
    clearButton.disabled = spinning || n < 1;
    hint.textContent =
      n === 0
        ? 'Toque no rosto de cada pessoa. Arraste para ajustar o tamanho do círculo.'
        : n === 1
          ? 'Agora toque no rosto da próxima pessoa.'
          : n >= MAX_FACES
            ? `Turma completa (${MAX_FACES} rostos)! Toque num círculo para removê-lo.`
            : 'Tudo pronto! Escolha uma brincadeira, marque mais gente, ou toque num círculo para removê-lo.';
  }

  function open(): void {
    active = true;
    stage.classList.add('group-mode');
    effectsBar.hidden = true;
    groupBar.hidden = false;
    layer.hidden = false;
    layer.classList.add('editing');
    update();
  }

  function close(): void {
    cancelTimers();
    draft?.face.el.remove();
    draft = null;
    active = false;
    stage.classList.remove('group-mode');
    effectsBar.hidden = false;
    groupBar.hidden = true;
    layer.hidden = true;
    layer.classList.remove('editing');
  }

  function clear(): void {
    cancelTimers();
    draft?.face.el.remove();
    draft = null;
    for (const f of faces) f.el.remove();
    faces = [];
    update();
  }

  function playOn(face: Face, kind: EffectKind): number {
    deps.getMesh().playEffect(kind, performance.now() / 1000, face);
    return WarpMesh.effectDuration(kind);
  }

  /** Fade the circles while effects play, so you can see the faces. */
  function rest(seconds: number): void {
    layer.classList.add('resting');
    later(() => layer.classList.remove('resting'), seconds * 1000 + 400);
  }

  function roulette(): void {
    const n = faces.length;
    if (spinning || n < 2) return;
    deps.sounds.unlock();
    spinning = true;
    update();

    const winner = Math.floor(Math.random() * n);
    const start = Math.floor(Math.random() * n);
    // Go around a few times and stop exactly on the winner.
    const steps = n * (3 + Math.floor(Math.random() * 2)) + ((winner - start + n) % n);
    let at = 0;
    for (let s = 0; s <= steps; s++) {
      const k = s / steps;
      at += 60 + 380 * k ** 2.5; // starts fast, slows down at the end
      const index = (start + s) % n;
      later(() => {
        faces.forEach((f, i) => f.el.classList.toggle('lit', i === index));
        deps.sounds.tick();
      }, at);
    }

    later(() => {
      const face = faces[winner];
      face.el.classList.remove('lit');
      face.el.classList.add('winner');
      deps.sounds.tada();
      deps.showCaption(pick(ROULETTE_CAPTIONS));
      const kind = pick(KINDS);
      later(() => {
        deps.sounds.effect(kind);
        const seconds = playOn(face, kind);
        deps.onEffects(seconds);
        later(() => {
          face.el.classList.remove('winner');
          spinning = false;
          update();
        }, seconds * 1000 + 600);
      }, 500);
    }, at + 350);
  }

  function everyone(): void {
    if (spinning || faces.length === 0) return;
    deps.sounds.unlock();
    // Shuffle so each round looks different; with more than 4 faces some repeat.
    const kinds = [...KINDS].sort(() => Math.random() - 0.5);
    let longest = 0;
    faces.forEach((face, i) => {
      const kind = kinds[i % kinds.length];
      longest = Math.max(longest, playOn(face, kind));
      later(() => deps.sounds.effect(kind), i * 150);
    });
    deps.onEffects(longest);
    rest(longest);
    deps.showCaption(pick(EVERYONE_CAPTIONS));
  }

  $('group-open').addEventListener('click', open);
  $('group-close').addEventListener('click', close);
  clearButton.addEventListener('click', clear);
  rouletteButton.addEventListener('click', roulette);
  everyoneButton.addEventListener('click', everyone);

  return {
    get active() {
      return active;
    },

    pointerDown(e) {
      if (draft || spinning) return;
      if (faces.length >= MAX_FACES) {
        hint.textContent = `Máximo de ${MAX_FACES} rostos. Toque num círculo para removê-lo.`;
        return;
      }
      (e.target as Element).setPointerCapture?.(e.pointerId);
      const [x, y] = deps.toWorld(e);
      draft = { pointerId: e.pointerId, face: makeFace(x, y) };
    },

    pointerMove(e) {
      if (!draft || draft.pointerId !== e.pointerId) return;
      const [x, y] = deps.toWorld(e);
      const d = Math.hypot(x - draft.face.x, y - draft.face.y);
      draft.face.r = d < TAP_SLOP ? DEFAULT_R : Math.max(MIN_R, d);
      place(draft.face);
    },

    pointerUp(e) {
      if (!active) return false;
      if (draft && draft.pointerId === e.pointerId) {
        const { face } = draft;
        draft = null;
        if (e.type === 'pointercancel') {
          face.el.remove();
        } else {
          face.el.classList.remove('draft');
          faces.push(face);
          deps.sounds.unlock();
          deps.sounds.pop();
          update();
        }
      }
      return true;
    },

    relayout() {
      for (const f of faces) place(f);
      if (draft) place(draft.face);
    },

    clear,
  };
}
