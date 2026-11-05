import './style.css';
import { drawDefaultFace, loadImageFile } from './image';
import { Renderer, type Layout } from './renderer';
import { WarpMesh, type EffectKind } from './warp';
import { Sounds } from './sound';
import { setupCamera } from './camera';
import { setupGroup } from './group';
import { setupRecorder } from './recorder';
import {
  BIG_CAPTIONS,
  EFFECT_CAPTIONS,
  HINTS,
  MEDIUM_CAPTIONS,
  OUCH_LINES,
  PHOTO_CAPTIONS,
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
const muteButton = $<HTMLButtonElement>('mute');
const caption = $<HTMLParagraphElement>('caption');
const bubble = $<HTMLDivElement>('bubble');

const sounds = new Sounds();
$('hint').textContent = pick(HINTS);

let renderer: Renderer;
try {
  renderer = new Renderer(canvas);
} catch (err) {
  stage.innerHTML = `<p class="hint">${(err as Error).message}</p>`;
  throw err;
}

let mesh: WarpMesh;
/** The photo being warped (before any head swap). */
let photo: HTMLCanvasElement;
let layout: Layout = { offsetX: 0, offsetY: 0, scale: 1 };
/** Presets ignore clicks until this time (seconds), so they don't pile up. */
let effectBusyUntil = 0;

const group = setupGroup({
  getMesh: () => mesh,
  getLayout: () => layout,
  toWorld,
  sounds,
  showCaption,
  getPhoto: () => photo,
  showTexture: (image) => renderer.setImage(image),
  onOpen: () => {},
  onEffects: (seconds) => {
    effectBusyUntil = Math.max(effectBusyUntil, performance.now() / 1000 + seconds);
  },
});

function setImage(image: HTMLCanvasElement): void {
  photo = image;
  renderer.setImage(image);
  mesh = new WarpMesh(image.height / image.width);
  mesh.clay = clayInput.checked;
  mesh.jelly = jellyInput.checked;
  renderer.setMesh(mesh);
  group.clear();
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
  group.relayout();
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
  if (group.active) {
    group.pointerDown(e);
    return;
  }
  canvas.setPointerCapture(e.pointerId);
  const [x, y] = toWorld(e);
  mesh.grab(e.pointerId, x, y, brushRadius());
  drags.set(e.pointerId, { startX: x, startY: y, stretch: 0, maxStretch: 0, ouched: false });
  canvas.classList.add('dragging');
  maybeStartTug();
});

canvas.addEventListener('pointermove', (e) => {
  if (group.active) {
    brush.hidden = true;
    group.pointerMove(e);
    return;
  }
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
  if (group.pointerUp(e)) return;
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

setupCamera((photo, challenge) => {
  setImage(photo);
  showCaption(pick(PHOTO_CAPTIONS));
  // Desafio de pose: show the photo for a moment, then play the matching effect.
  if (challenge) window.setTimeout(() => playPreset(challenge.effect, challenge.caption), 900);
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

/** Play a whole-image preset with its sound and a caption (a random one unless given). */
function playPreset(kind: EffectKind | 'chaos', text?: string): void {
  sounds.unlock();
  const now = performance.now() / 1000;
  if (kind === 'chaos') {
    mesh.chaos();
    sounds.chaos();
  } else {
    // Ignore button-mashing while a preset is still playing.
    if (now < effectBusyUntil) return;
    effectBusyUntil = now + WarpMesh.effectDuration(kind);
    mesh.playEffect(kind, now);
    sounds.effect(kind);
  }
  showCaption(text ?? pick(EFFECT_CAPTIONS[kind]));
}

for (const button of document.querySelectorAll<HTMLButtonElement>('[data-effect]')) {
  button.addEventListener('click', () => playPreset(button.dataset.effect as EffectKind | 'chaos'));
}

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

/** The canvas as it looks now, plus the 🏆 award labels if any are showing. */
function snapshot(): HTMLCanvasElement {
  const labels = group.awards();
  if (!labels.length) return canvas;
  const out = document.createElement('canvas');
  out.width = canvas.width;
  out.height = canvas.height;
  const ctx = out.getContext('2d')!;
  ctx.drawImage(canvas, 0, 0);
  const k = canvas.width / canvas.clientWidth; // CSS pixels -> canvas pixels
  const font = 13 * k;
  ctx.font = `800 ${font}px system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  for (const l of labels) {
    const x = (layout.offsetX + l.x * layout.scale) * k;
    const y = (layout.offsetY + (l.y + l.r) * layout.scale) * k + 6 * k + font;
    const w = ctx.measureText(l.text).width + 20 * k;
    const h = font * 1.8;
    ctx.fillStyle = '#ffe14f';
    ctx.beginPath();
    ctx.roundRect(x - w / 2, y - h / 2, w, h, h / 2);
    ctx.fill();
    ctx.fillStyle = '#2a2100';
    ctx.fillText(l.text, x, y);
  }
  return out;
}

$('save').addEventListener('click', () => {
  snapshot().toBlob((blob) => {
    if (!blob) return;
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'crazy-face.png';
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
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

setImage(drawDefaultFace());
requestAnimationFrame(frame);
