import './style.css';
import { DEFAULT_FACE_TARGET, drawDefaultFace, loadImageFile } from './image';
import { Renderer, type Layout } from './renderer';
import { WarpMesh, type EffectKind, type EffectTarget } from './warp';
import { detectFaces, preloadFaceDetector } from './faces';
import { Sounds } from './sound';
import { setupCamera } from './camera';
import { setupRecorder } from './recorder';
import { enhancePhoto, isDark, measureTone, type Tone } from './beauty';
import {
  BEAUTY_OFF_CAPTIONS,
  BEAUTY_ON_CAPTIONS,
  BIG_CAPTIONS,
  EFFECT_CAPTIONS,
  EVERYONE_CAPTIONS,
  GROUP_EFFECT_CAPTIONS,
  GROUP_SUGGEST_HINTS,
  HINTS,
  MEDIUM_CAPTIONS,
  NO_FACE_CAPTIONS,
  OUCH_LINES,
  PHOTO_CAPTIONS,
  SHARE_FALLBACK_CAPTIONS,
  SHARE_TEXTS,
  TUG_DRAW,
  TUG_LEFT_WINS,
  TUG_RIGHT_WINS,
  TUG_START,
  pick,
} from './jokes';

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;

const canvas = $<HTMLCanvasElement>('canvas');
const stage = $<HTMLElement>('stage');
const brush = $<HTMLDivElement>('brush');
const drop = $<HTMLDivElement>('drop');
const fileInput = $<HTMLInputElement>('file');
const radiusInput = $<HTMLInputElement>('radius');
const clayInput = $<HTMLInputElement>('clay');
const jellyInput = $<HTMLInputElement>('jelly');
const beautyInput = $<HTMLInputElement>('beauty');
const muteButton = $<HTMLButtonElement>('mute');
const caption = $<HTMLParagraphElement>('caption');
const bubble = $<HTMLDivElement>('bubble');
const hint = $<HTMLParagraphElement>('hint');

const sounds = new Sounds();
hint.textContent = pick(HINTS);

let renderer: Renderer;
try {
  renderer = new Renderer(canvas);
} catch (err) {
  stage.innerHTML = `<p class="hint">${(err as Error).message}</p>`;
  throw err;
}

let mesh: WarpMesh;
/** The photo being warped. */
let photo: HTMLCanvasElement;
let layout: Layout = { offsetX: 0, offsetY: 0, scale: 1 };
/** Presets ignore clicks until this time (seconds), so they don't pile up. */
let effectBusyUntil = 0;

interface PhotoOptions {
  /** Look for the faces the effect buttons aim at (false for the cartoon). */
  findFaces?: boolean;
  /** ✨ Luz e beleza: on, off, or 'auto' (on if the photo is dark). */
  beauty?: boolean | 'auto';
  /** The photo with the light already fixed (the camera's review made it). */
  lit?: HTMLCanvasElement | null;
}

/**
 * Load a new photo: the single entry point for files, the camera and the default face.
 */
function setImage(image: HTMLCanvasElement, { findFaces = true, beauty = 'auto', lit = null }: PhotoOptions = {}): void {
  photo = image;
  photoTone = findFaces ? measureTone(image) : null;
  litPhoto = lit;
  beautyOn = !!photoTone && (beauty === 'auto' ? isDark(photoTone) : beauty);
  beautyInput.checked = beautyOn;
  beautyInput.disabled = !photoTone;
  photoFaces = [];
  lensFace = undefined;
  renderer.setImage(beautyOn ? lightOnly() : image);
  newMesh(image.height / image.width);
  hint.textContent = pick(HINTS);
  // Faces are easier to find in the brightened photo.
  facesReady = findFaces ? searchFaces(image, beautyOn ? lightOnly() : image) : Promise.resolve();
}

// --- ✨ Luz e beleza ---

/** How the light correction changes the current photo (null for the cartoon). */
let photoTone: Tone | null = null;
/** The current photo with only the light fixed (made on first use). */
let litPhoto: HTMLCanvasElement | null = null;
let beautyOn = false;

/** The photo with the light fixed, or the original if WebGL2 can't do it. */
function lightOnly(): HTMLCanvasElement {
  if (!photoTone) return photo;
  litPhoto ??= enhancePhoto(photo, photoTone);
  return litPhoto ?? photo;
}

/** Put the right version of the photo on screen. The mesh (and its warps) stays. */
function showLook(): void {
  if (!beautyOn || !photoTone) {
    renderer.setImage(photo);
    return;
  }
  // With faces, also smooth the skin; it's quick, so just redo it when faces change.
  const look = photoFaces.length ? enhancePhoto(photo, photoTone, photoFaces) : null;
  renderer.setImage(look ?? lightOnly());
}

beautyInput.addEventListener('change', () => {
  sounds.unlock();
  beautyOn = beautyInput.checked;
  showLook();
  if (beautyOn) sounds.sparkle();
  else sounds.pop();
  showCaption(pick(beautyOn ? BEAUTY_ON_CAPTIONS : BEAUTY_OFF_CAPTIONS));
});

// --- The faces: effect buttons aim at every face instead of the whole photo ---

/** The faces in the current photo, biggest first, once found. */
let photoFaces: EffectTarget[] = [];
/**
 * Where 👀/👃/🐹 aim when there's no detected face: the cartoon's known features.
 * (Mesh presets keep working on the whole cartoon, which fills the picture.)
 */
let lensFace: EffectTarget | undefined;
/** Resolves when the quick face search is over (found or not). */
let facesReady: Promise<void> = Promise.resolve();

const MAX_FACES = 6;

/**
 * Two passes: a quick one (a few detector runs, fine for selfies) so the buttons
 * aim at faces right away, then a full one in the background that also finds the
 * small faces in a group photo. Resolves after the quick pass.
 */
async function searchFaces(image: HTMLCanvasElement, source: HTMLCanvasElement): Promise<void> {
  if (!(await useFaces(image, source, { quick: true }))) return;
  void useFaces(image, source, { quick: false });
}

/**
 * Run one detection pass (on `source`, the same photo maybe brightened) and keep its
 * faces if it found at least as many. False if it failed or the photo changed.
 */
async function useFaces(
  image: HTMLCanvasElement,
  source: HTMLCanvasElement,
  options: { quick: boolean },
): Promise<boolean> {
  let found: EffectTarget[];
  try {
    found = await detectFaces(source, MAX_FACES, options);
  } catch {
    // No detector (offline, old browser): effects keep working on the whole photo.
    return false;
  }
  if (image !== photo) return false; // a newer photo arrived meanwhile
  if (found.length < photoFaces.length) return true;
  const more = found.length > photoFaces.length;
  photoFaces = found;
  if (found.length) showLook();
  if (more && found.length >= 2) {
    hint.textContent = pick(GROUP_SUGGEST_HINTS).replace('{n}', String(found.length));
  }
  return true;
}

/** Wait (up to `ms`) for the faces of `image`; false if the photo changed meanwhile. */
async function waitForFace(image: HTMLCanvasElement, ms: number): Promise<boolean> {
  await Promise.race([facesReady, new Promise((r) => setTimeout(r, ms))]);
  return image === photo;
}

// Start downloading the detector as soon as a photo is on its way.
$('camera-open').addEventListener('click', preloadFaceDetector);
fileInput.addEventListener('click', preloadFaceDetector);

// --- Two screens: the start screen (take or pick a photo), then the editor ---

const startScreen = $<HTMLElement>('start');
const startBack = $<HTMLButtonElement>('start-back');
const editor = [document.querySelector<HTMLElement>('.toolbar')!, stage];

function showStart(): void {
  startScreen.hidden = false;
  for (const el of editor) el.inert = true;
  $<HTMLButtonElement>('camera-open').focus();
}

function showEditor(): void {
  startScreen.hidden = true;
  for (const el of editor) el.inert = false;
  // From now on there is a photo to go back to.
  startBack.hidden = false;
}

$('new-photo').addEventListener('click', () => {
  sounds.unlock();
  showStart();
});
startBack.addEventListener('click', showEditor);
$('start-sample').addEventListener('click', () => {
  sounds.unlock();
  showCartoon();
  showEditor();
  showCaption(pick(PHOTO_CAPTIONS));
});

function newMesh(aspect: number): void {
  mesh = new WarpMesh(aspect);
  mesh.clay = clayInput.checked;
  mesh.jelly = jellyInput.checked;
  renderer.setMesh(mesh);
  updateLayout();
}

/** Fit the image inside the stage with some breathing room for stretching. */
function updateLayout(): void {
  renderer.resize();
  const w = canvas.clientWidth;
  const h = canvas.clientHeight;
  const margin = 0.8;
  const scale = Math.min((w * margin) / 1, (h * margin) / mesh.aspect);
  layout = {
    scale,
    offsetX: (w - scale) / 2,
    offsetY: (h - scale * mesh.aspect) / 2,
  };
  updateBrushSize();
}

function toWorld(e: PointerEvent): [number, number] {
  const rect = canvas.getBoundingClientRect();
  return [
    (e.clientX - rect.left - layout.offsetX) / layout.scale,
    (e.clientY - rect.top - layout.offsetY) / layout.scale,
  ];
}

const brushRadius = () => Number(radiusInput.value);

function updateBrushSize(): void {
  const px = brushRadius() * layout.scale * 2;
  brush.style.width = brush.style.height = `${px}px`;
}

// --- Jokes: captions and "ouch" bubbles ---

/** Stretch (world units) after which the face complains. */
const OUCH_AT = 0.4;
/** Stretch after which letting go earns a caption. */
const MEDIUM_AT = 0.22;
const BIG_AT = 0.42;

let captionTimer = 0;
let lastCaptionAt = 0;

function showCaption(text: string): void {
  lastCaptionAt = performance.now();
  caption.textContent = text;
  caption.hidden = false;
  // Restart the CSS animation even if a caption is already showing.
  caption.style.animation = 'none';
  void caption.offsetWidth;
  caption.style.animation = '';
  clearTimeout(captionTimer);
  captionTimer = window.setTimeout(() => (caption.hidden = true), 2600);
}

let bubbleTimer = 0;
function showBubble(e: PointerEvent): void {
  const rect = stage.getBoundingClientRect();
  bubble.textContent = pick(OUCH_LINES);
  bubble.style.left = `${e.clientX - rect.left}px`;
  bubble.style.top = `${e.clientY - rect.top - 24}px`;
  bubble.hidden = false;
  bubble.style.animation = 'none';
  void bubble.offsetWidth;
  bubble.style.animation = '';
  clearTimeout(bubbleTimer);
  bubbleTimer = window.setTimeout(() => (bubble.hidden = true), 1100);
  sounds.ouch();
}

/** After a stretch, sometimes say something cheeky (but don't spam). */
function maybeCaption(stretch: number): void {
  if (stretch < MEDIUM_AT || performance.now() - lastCaptionAt < 3500) return;
  if (stretch >= BIG_AT) showCaption(pick(BIG_CAPTIONS));
  else if (Math.random() < 0.5) showCaption(pick(MEDIUM_CAPTIONS));
}

// --- Pointer interaction (mouse, touch and pen, multi-touch aware) ---

interface Drag {
  startX: number;
  startY: number;
  stretch: number;
  maxStretch: number;
  ouched: boolean;
}
const drags = new Map<number, Drag>();

/**
 * Cabo de guerra: two fingers grabbing the face far apart start a tug of war.
 * When one lets go, whoever stretched further wins.
 */
const TUG_MIN_GAP = 0.15; // world units between the two fingers
const TUG_MIN_PULL = 0.12; // someone has to actually pull for it to count
let tug: { left: number; right: number } | null = null;

function maybeStartTug(): void {
  if (tug || drags.size !== 2) return;
  const [[a, da], [b, db]] = [...drags];
  if (Math.abs(da.startX - db.startX) < TUG_MIN_GAP) return;
  tug = da.startX < db.startX ? { left: a, right: b } : { left: b, right: a };
  showCaption(pick(TUG_START));
  sounds.beep();
}

/** Call before a tugging pointer is forgotten: announces the winner. */
function finishTug(): void {
  if (!tug) return;
  const left = drags.get(tug.left)?.maxStretch ?? 0;
  const right = drags.get(tug.right)?.maxStretch ?? 0;
  tug = null;
  const best = Math.max(left, right);
  if (best < TUG_MIN_PULL) return;
  if (Math.abs(left - right) < best * 0.12) showCaption(pick(TUG_DRAW));
  else showCaption(pick(left > right ? TUG_LEFT_WINS : TUG_RIGHT_WINS));
  sounds.tada();
}

const currentStretch = () => Math.max(0, ...[...drags.values()].map((d) => d.stretch));

canvas.addEventListener('pointerdown', (e) => {
  sounds.unlock();
  void enableShake();
  canvas.setPointerCapture(e.pointerId);
  const [x, y] = toWorld(e);
  mesh.grab(e.pointerId, x, y, brushRadius());
  drags.set(e.pointerId, { startX: x, startY: y, stretch: 0, maxStretch: 0, ouched: false });
  canvas.classList.add('dragging');
  maybeStartTug();
});

canvas.addEventListener('pointermove', (e) => {
  if (e.pointerType === 'mouse') {
    brush.hidden = false;
    brush.style.left = `${e.offsetX}px`;
    brush.style.top = `${e.offsetY}px`;
  }
  const [x, y] = toWorld(e);
  mesh.move(e.pointerId, x, y);

  const drag = drags.get(e.pointerId);
  if (!drag) return;
  drag.stretch = Math.hypot(x - drag.startX, y - drag.startY);
  drag.maxStretch = Math.max(drag.maxStretch, drag.stretch);
  if (!drag.ouched && drag.stretch > OUCH_AT) {
    drag.ouched = true;
    showBubble(e);
  }
  sounds.setStretch(currentStretch());
});

const endPointer = (e: PointerEvent) => {
  mesh.release(e.pointerId);
  if (tug && (tug.left === e.pointerId || tug.right === e.pointerId)) finishTug();
  const drag = drags.get(e.pointerId);
  drags.delete(e.pointerId);
  if (drag) {
    sounds.setStretch(currentStretch());
    // In clay mode nothing springs back, so no boing.
    if (!mesh.clay) sounds.boing(drag.stretch);
    maybeCaption(drag.maxStretch);
  }
  if (!mesh.isDragging) canvas.classList.remove('dragging');
};
canvas.addEventListener('pointerup', endPointer);
canvas.addEventListener('pointercancel', endPointer);
canvas.addEventListener('pointerleave', () => (brush.hidden = true));

// --- Controls ---

async function useFile(file: File | undefined | null): Promise<void> {
  if (!file || !file.type.startsWith('image/')) return;
  try {
    setImage(await loadImageFile(file));
    showEditor();
  } catch {
    alert('Ops! Não consegui abrir essa imagem.');
  }
}

fileInput.addEventListener('change', () => {
  void useFile(fileInput.files?.[0]);
  fileInput.value = '';
});

const cameraFallback = $<HTMLInputElement>('camera-fallback');
cameraFallback.addEventListener('change', () => {
  void useFile(cameraFallback.files?.[0]);
  cameraFallback.value = '';
});

setupRecorder({ canvas, sounds, showCaption });

setupCamera((shot, challenge, lit) => {
  setImage(shot, { beauty: !!lit, lit });
  showEditor();
  showCaption(pick(PHOTO_CAPTIONS));
  // Desafio de pose: show the photo for a moment, then play the matching effect on the face.
  if (challenge) {
    window.setTimeout(async () => {
      if (await waitForFace(shot, 1500)) void playPreset(challenge.effect, challenge.caption);
    }, 900);
  }
}, sounds);

radiusInput.addEventListener('input', updateBrushSize);
clayInput.addEventListener('change', () => (mesh.clay = clayInput.checked));
jellyInput.addEventListener('change', () => {
  mesh.jelly = jellyInput.checked;
  if (mesh.jelly) {
    showCaption(pick(EFFECT_CAPTIONS.jelly));
    mesh.chaos(3); // give it a little wobble so you can see the difference
    sounds.unlock();
    sounds.boing(0.3);
  }
});

// --- Silly effect buttons ---

const needsFace = (kind: EffectKind) => kind === 'eyes' || kind === 'nose' || kind === 'cheeks';
const KINDS: EffectKind[] = ['balloon', 'fish', 'melt', 'eyes', 'nose', 'cheeks'];
/** Gap between the sounds when several faces get an effect (ms). */
const SOUND_STAGGER = 150;

/**
 * What a preset aims at: every face found, else the whole photo (`undefined`),
 * or the cartoon's features for 👀/👃/🐹. Null if there's nothing to aim at (it says so).
 */
async function targetsFor(kind: EffectKind): Promise<(EffectTarget | undefined)[] | null> {
  if (photoFaces.length) return photoFaces;
  if (!needsFace(kind)) return [undefined];
  if (lensFace) return [lensFace];
  // 👀/👃/🐹 need a face: give the face search a moment to finish.
  const image = photo;
  effectBusyUntil = Infinity;
  const same = await waitForFace(image, 1500);
  effectBusyUntil = 0;
  if (!same) return null;
  if (photoFaces.length) return photoFaces;
  showCaption(pick(NO_FACE_CAPTIONS));
  return null;
}

/** Play a preset on every face (or the whole photo) with its sound and a caption (a random one unless given). */
async function playPreset(kind: EffectKind, text?: string): Promise<void> {
  sounds.unlock();
  // Ignore button-mashing while a preset is still playing.
  if (performance.now() / 1000 < effectBusyUntil) return;
  const targets = await targetsFor(kind);
  if (!targets) return;
  const now = performance.now() / 1000;
  effectBusyUntil = now + WarpMesh.effectDuration(kind);
  for (const target of targets) mesh.playEffect(kind, now, target);
  // One sound per face sounds like a crowd, but more than 3 is just noise.
  for (let i = 0; i < Math.min(3, targets.length); i++) {
    window.setTimeout(() => sounds.effect(kind), i * SOUND_STAGGER);
  }
  const captions = targets.length >= 2 ? GROUP_EFFECT_CAPTIONS[kind] : EFFECT_CAPTIONS[kind];
  showCaption(text ?? pick(captions));
}

for (const button of document.querySelectorAll<HTMLButtonElement>('[data-effect]')) {
  button.addEventListener('click', () => void playPreset(button.dataset.effect as EffectKind));
}

/** 🎭 Um efeito pra cada: every face gets a different effect at the same time. */
function playMix(): void {
  sounds.unlock();
  if (performance.now() / 1000 < effectBusyUntil) return;
  const faces = photoFaces;
  if (faces.length < 2) {
    // One face (or none): just a surprise effect.
    void playPreset(pick(lensFace || faces.length ? KINDS : KINDS.filter((k) => !needsFace(k))));
    return;
  }
  // Shuffle so each round looks different; with more faces than effects some repeat.
  const kinds = [...KINDS].sort(() => Math.random() - 0.5);
  const now = performance.now() / 1000;
  let longest = 0;
  faces.forEach((face, i) => {
    const kind = kinds[i % kinds.length];
    mesh.playEffect(kind, now, face);
    longest = Math.max(longest, WarpMesh.effectDuration(kind));
    window.setTimeout(() => sounds.effect(kind), i * SOUND_STAGGER);
  });
  effectBusyUntil = now + longest;
  showCaption(pick(EVERYONE_CAPTIONS));
}
$('mix').addEventListener('click', playMix);

// --- Sound toggle ---

function updateMuteButton(): void {
  muteButton.textContent = sounds.muted ? '🔇' : '🔊';
  const label = sounds.muted ? 'Ligar sons' : 'Desligar sons';
  muteButton.title = label;
  muteButton.setAttribute('aria-label', label);
}
updateMuteButton();
muteButton.addEventListener('click', () => {
  sounds.setMuted(!sounds.muted);
  sounds.unlock();
  updateMuteButton();
  if (!sounds.muted) sounds.boing(0.2);
});

// --- Shake your phone to wobble the face ---

type MotionPermission = { requestPermission?: () => Promise<'granted' | 'denied'> };
let shakeState: 'off' | 'asking' | 'on' = 'off';
let lastShakeAt = 0;

async function enableShake(): Promise<void> {
  if (shakeState !== 'off' || typeof DeviceMotionEvent === 'undefined') return;
  shakeState = 'asking';
  // iOS asks for permission, and only from inside a tap.
  const request = (DeviceMotionEvent as unknown as MotionPermission).requestPermission;
  if (request) {
    try {
      if ((await request()) !== 'granted') return;
    } catch {
      return;
    }
  }
  shakeState = 'on';
  window.addEventListener('devicemotion', onMotion);
}

function onMotion(e: DeviceMotionEvent): void {
  const a = e.acceleration;
  if (!a || a.x == null || a.y == null) return;
  const strength = Math.hypot(a.x, a.y);
  const now = performance.now();
  if (strength < 12 || now - lastShakeAt < 120) return;
  lastShakeAt = now;
  // Device y points up, screen y points down. The face lags behind the motion.
  const k = Math.min(strength, 40) * 0.04;
  mesh.shake((-a.x / strength) * k, (a.y / strength) * k);
  sounds.boing(Math.min(0.5, strength / 60));
  if (now - lastCaptionAt > 4000 && strength > 20) showCaption(pick(EFFECT_CAPTIONS.shake));
}
$('reset').addEventListener('click', () => {
  effectBusyUntil = 0;
  mesh.reset(performance.now() / 1000);
});

function downloadBlob(blob: Blob, name: string): void {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

$('save').addEventListener('click', () => {
  canvas.toBlob((blob) => {
    if (blob) downloadBlob(blob, 'crazy-face.png');
  }, 'image/png');
});

/**
 * 💬 WhatsApp. On phones the Web Share sheet sends the PNG itself (WhatsApp is listed
 * there). Web pages can't attach a file to WhatsApp directly, so elsewhere we download
 * the PNG and open WhatsApp (wa.me) with the text, and the user attaches the photo.
 */
$('whatsapp').addEventListener('click', () => {
  sounds.unlock();
  const text = pick(SHARE_TEXTS);
  canvas.toBlob(async (blob) => {
    if (!blob) return;
    const file = new File([blob], 'crazy-face.png', { type: 'image/png' });
    if (navigator.canShare?.({ files: [file] })) {
      try {
        await navigator.share({ files: [file], text });
        return;
      } catch (err) {
        // The user closing the share sheet is not an error.
        if ((err as { name?: string })?.name === 'AbortError') return;
      }
    }
    downloadBlob(blob, file.name);
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank', 'noopener');
    showCaption(pick(SHARE_FALLBACK_CAPTIONS));
  }, 'image/png');
});

// Drag & drop and paste
window.addEventListener('dragover', (e) => {
  e.preventDefault();
  drop.hidden = false;
});
window.addEventListener('dragleave', (e) => {
  if (!e.relatedTarget) drop.hidden = true;
});
window.addEventListener('drop', (e) => {
  e.preventDefault();
  drop.hidden = true;
  void useFile(e.dataTransfer?.files[0]);
});
window.addEventListener('paste', (e) => {
  const item = [...(e.clipboardData?.items ?? [])].find((i) => i.type.startsWith('image/'));
  void useFile(item?.getAsFile());
});

new ResizeObserver(updateLayout).observe(stage);

// --- Main loop ---

let last = performance.now() / 1000;
function frame(ms: number): void {
  const now = ms / 1000;
  mesh.update(now - last, now);
  last = now;
  renderer.draw(mesh, layout);
  requestAnimationFrame(frame);
}

/** The built-in cartoon face (no detection needed: we know where its features are). */
function showCartoon(): void {
  // It fills the picture: whole-image mesh effects already fit it.
  setImage(drawDefaultFace(), { findFaces: false });
  lensFace = DEFAULT_FACE_TARGET;
}

// The cartoon face waits behind the start screen until a photo arrives.
showCartoon();
showStart();
requestAnimationFrame(frame);
