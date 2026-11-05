import './style.css';
import { drawDefaultFace, loadImageFile } from './image';
import { Renderer, type Layout } from './renderer';
import { WarpMesh } from './warp';

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;

const canvas = $<HTMLCanvasElement>('canvas');
const stage = $<HTMLElement>('stage');
const brush = $<HTMLDivElement>('brush');
const drop = $<HTMLDivElement>('drop');
const fileInput = $<HTMLInputElement>('file');
const radiusInput = $<HTMLInputElement>('radius');
const clayInput = $<HTMLInputElement>('clay');

let renderer: Renderer;
try {
  renderer = new Renderer(canvas);
} catch (err) {
  stage.innerHTML = `<p class="hint">${(err as Error).message}</p>`;
  throw err;
}

let mesh: WarpMesh;
let layout: Layout = { offsetX: 0, offsetY: 0, scale: 1 };

function setImage(image: HTMLCanvasElement): void {
  renderer.setImage(image);
  mesh = new WarpMesh(image.height / image.width);
  mesh.clay = clayInput.checked;
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

// --- Pointer interaction (mouse, touch and pen, multi-touch aware) ---

canvas.addEventListener('pointerdown', (e) => {
  canvas.setPointerCapture(e.pointerId);
  const [x, y] = toWorld(e);
  mesh.grab(e.pointerId, x, y, brushRadius());
  canvas.classList.add('dragging');
});

canvas.addEventListener('pointermove', (e) => {
  if (e.pointerType === 'mouse') {
    brush.hidden = false;
    brush.style.left = `${e.offsetX}px`;
    brush.style.top = `${e.offsetY}px`;
  }
  const [x, y] = toWorld(e);
  mesh.move(e.pointerId, x, y);
});

const endPointer = (e: PointerEvent) => {
  mesh.release(e.pointerId);
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
    alert('Sorry, that image could not be opened.');
  }
}

fileInput.addEventListener('change', () => {
  void useFile(fileInput.files?.[0]);
  fileInput.value = '';
});

radiusInput.addEventListener('input', updateBrushSize);
clayInput.addEventListener('change', () => (mesh.clay = clayInput.checked));
$('reset').addEventListener('click', () => mesh.reset(performance.now() / 1000));

$('save').addEventListener('click', () => {
  canvas.toBlob((blob) => {
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
