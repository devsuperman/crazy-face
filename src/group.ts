/**
 * "Modo turma": mark each person's face in a group photo, then play with all of them.
 *
 * - Tap a face to drop a circle on it; drag while tapping to size the circle.
 * - Tap a circle to remove it.
 * - 🎡 Roleta da vergonha: a spotlight jumps between faces and picks a "winner".
 * - 🎭 Um efeito pra cada: every face gets a different effect at the same time.
 * - 🏆 Troféus: every face gets a funny award label.
 * - 🔀 Trocar cabeças: each face is pasted onto the next person (tap again to rotate).
 *
 * When Turma opens on a new photo, faces are found automatically (src/faces.ts);
 * tapping still works to fix or add circles.
 */

import { detectFaces } from './faces';
import { swapFaces } from './image';
import {
  AWARDS,
  AWARD_CAPTIONS,
  BUSY_HINTS,
  EVERYONE_CAPTIONS,
  ROULETTE_CAPTIONS,
  SWAP_BACK_CAPTIONS,
  SWAP_CAPTIONS,
  pick,
} from './jokes';
import type { Layout } from './renderer';
import type { Sounds } from './sound';
import { WarpMesh, type EffectKind, type EffectTarget } from './warp';

const MAX_FACES = 6;
/** Circle radius for a plain tap, and the smallest one you can drag, in world units. */
const DEFAULT_R = 0.12;
const MIN_R = 0.04;
/** Below this drag distance a tap counts as "use the default size". */
const TAP_SLOP = 0.03;
const KINDS: EffectKind[] = ['balloon', 'fish', 'melt'];

interface Face extends EffectTarget {
  el: HTMLDivElement;
  num: HTMLSpanElement;
  award: string;
}

/** A face's award, in world units, for drawing it onto the saved PNG. */
export interface AwardLabel extends EffectTarget {
  text: string;
}

export interface GroupDeps {
  getMesh(): WarpMesh;
  getLayout(): Layout;
  toWorld(e: PointerEvent): [number, number];
  sounds: Sounds;
  showCaption(text: string): void;
  /** The current photo (unswapped), and a way to show another texture on the same mesh. */
  getPhoto(): HTMLCanvasElement;
  showTexture(image: HTMLCanvasElement): void;
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
  /** The visible award labels, to draw them onto the saved PNG. */
  awards(): AwardLabel[];
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
  const awardsButton = $<HTMLButtonElement>('group-awards');
  const swapButton = $<HTMLButtonElement>('group-swap');

  let active = false;
  let faces: Face[] = [];
  let draft: { pointerId: number; face: Face } | null = null;
  let spinning = false;
  const timers: number[] = [];
  /** Troca de cabeças: face i currently shows face (i + swapShift). 0 = original photo. */
  let swapShift = 0;
  /** Faces are detected once per photo; bumping `detectRun` discards a stale detection. */
  let detectedPhoto: HTMLCanvasElement | null = null;
  let detectRun = 0;
  let detecting = false;

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

  function makeFace(x: number, y: number, r = DEFAULT_R): Face {
    const el = document.createElement('div');
    el.className = 'face-marker draft';
    const num = document.createElement('span');
    el.append(num);
    layer.append(el);
    const face: Face = { x, y, r, el, num, award: '' };
    el.addEventListener('click', () => {
      if (!active) return;
      if (spinning) {
        busy();
        return;
      }
      removeFace(face);
    });
    place(face);
    return face;
  }

  function addFace(face: Face): void {
    face.el.classList.remove('draft');
    faces.push(face);
    unswap();
    update();
  }

  function removeFace(face: Face): void {
    face.el.remove();
    faces = faces.filter((f) => f !== face);
    unswap();
    update();
  }

  function setAward(face: Face, text: string): void {
    face.award = text;
    face.el.querySelector('.face-award')?.remove();
    if (!text) return;
    const label = document.createElement('span');
    label.className = 'face-award';
    label.textContent = text;
    face.el.append(label);
  }

  /** Tell the user why their tap did nothing. */
  function busy(): void {
    hint.textContent = pick(BUSY_HINTS);
  }

  /** Renumber the circles, refresh the hint and enable the buttons that make sense. */
  function update(): void {
    faces.forEach((f, n) => {
      f.num.textContent = String(n + 1);
      const award = f.award ? `, troféu: ${f.award}` : '';
      f.el.setAttribute('aria-label', `Pessoa ${n + 1}${award} (toque para remover)`);
    });
    const n = faces.length;
    rouletteButton.disabled = spinning || n < 2;
    everyoneButton.disabled = spinning || n < 1;
    awardsButton.disabled = spinning || n < 1;
    swapButton.disabled = spinning || n < 2;
    // The last rotation is followed by the original photo.
    swapButton.textContent = swapShift > 0 && swapShift === n - 1 ? '🔀 Destrocar' : '🔀 Trocar cabeças';
    clearButton.disabled = spinning || n < 1;
    hint.textContent = detecting
      ? '🤖 Procurando rostos… (pode tocar nos rostos se preferir)'
      : n === 0
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
    if (faces.length === 0 && detectedPhoto !== deps.getPhoto()) void autoDetect();
  }

  /** Find the faces in the photo and drop a circle on each one that isn't marked yet. */
  async function autoDetect(): Promise<void> {
    const photo = deps.getPhoto();
    detectedPhoto = photo;
    const run = ++detectRun;
    detecting = true;
    update();
    let found: EffectTarget[] = [];
    try {
      found = await detectFaces(photo, MAX_FACES);
    } catch {
      // No detector (offline, old browser): tapping still works.
    }
    if (run !== detectRun) return;
    detecting = false;
    let added = 0;
    for (const f of found) {
      if (faces.length >= MAX_FACES) break;
      if (faces.some((g) => Math.hypot(g.x - f.x, g.y - f.y) < Math.max(g.r, f.r))) continue;
      addFace(makeFace(f.x, f.y, f.r));
      added++;
    }
    update();
    if (added) {
      deps.sounds.pop();
      hint.textContent =
        added === 1
          ? 'Achei 1 rosto! 🤖 Toque nos outros, ou toque no círculo se eu errei.'
          : `Achei ${added} rostos! 🤖 Toque num círculo se eu errei, ou toque para marcar mais gente.`;
    } else if (faces.length === 0) {
      hint.textContent = 'Não achei rostos sozinho. 🙈 Toque no rosto de cada pessoa.';
    }
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
    detectRun++;
    detecting = false;
    draft?.face.el.remove();
    draft = null;
    for (const f of faces) f.el.remove();
    faces = [];
    unswap();
    update();
  }

  /** Put the original photo back if heads are swapped. */
  function unswap(): void {
    if (swapShift === 0) return;
    swapShift = 0;
    deps.showTexture(deps.getPhoto());
  }

  function swapHeads(): void {
    const n = faces.length;
    if (spinning || n < 2) return;
    deps.sounds.unlock();
    deps.sounds.swap();
    swapShift = (swapShift + 1) % n;
    const photo = deps.getPhoto();
    deps.showTexture(swapShift ? swapFaces(photo, faces, swapShift) : photo);
    deps.showCaption(pick(swapShift ? SWAP_CAPTIONS : SWAP_BACK_CAPTIONS));
    update();
  }

  function giveAwards(): void {
    if (spinning || faces.length === 0) return;
    deps.sounds.unlock();
    const pool = [...AWARDS].sort(() => Math.random() - 0.5);
    faces.forEach((f, i) => later(() => {
      setAward(f, pool[i % pool.length]);
      deps.sounds.pop();
    }, 300 + i * 350));
    deps.sounds.tada();
    deps.showCaption(pick(AWARD_CAPTIONS));
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
  awardsButton.addEventListener('click', giveAwards);
  swapButton.addEventListener('click', swapHeads);

  return {
    get active() {
      return active;
    },

    pointerDown(e) {
      if (draft) return;
      if (spinning) {
        busy();
        return;
      }
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
          addFace(face);
          deps.sounds.unlock();
          deps.sounds.pop();
        }
      }
      return true;
    },

    relayout() {
      for (const f of faces) place(f);
      if (draft) place(draft.face);
    },

    clear,

    awards() {
      return active ? faces.filter((f) => f.award).map(({ x, y, r, award }) => ({ x, y, r, text: award })) : [];
    },
  };
}
