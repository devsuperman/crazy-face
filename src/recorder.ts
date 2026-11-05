/**
 * "🎬 Gravar": record a short clip of the canvas, with the cartoon sounds,
 * then share it (WhatsApp & co.) or download it. Everything stays on the device.
 */

import { RECORD_CAPTIONS, pick } from './jokes';
import type { Sounds } from './sound';

const SECONDS = 6;

/** Best first: MP4 plays everywhere (and on WhatsApp); WebM is the fallback. */
const MIME_TYPES = [
  'video/mp4;codecs=avc1,mp4a.40.2',
  'video/mp4',
  'video/webm;codecs=vp9,opus',
  'video/webm;codecs=vp8,opus',
  'video/webm',
];

export interface RecorderDeps {
  canvas: HTMLCanvasElement;
  sounds: Sounds;
  showCaption(text: string): void;
}

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;

export function setupRecorder(deps: RecorderDeps): void {
  const button = $<HTMLButtonElement>('record');
  const badge = $<HTMLDivElement>('rec-badge');
  const dialog = $<HTMLDivElement>('clip');
  const preview = $<HTMLVideoElement>('clip-video');
  const shareButton = $<HTMLButtonElement>('clip-share');
  const downloadButton = $<HTMLButtonElement>('clip-download');

  let recorder: MediaRecorder | null = null;
  let tickTimer = 0;
  let clip: File | null = null;
  let clipUrl = '';

  const supported = () =>
    typeof MediaRecorder !== 'undefined' && typeof deps.canvas.captureStream === 'function';

  function pickMime(): string {
    return MIME_TYPES.find((t) => MediaRecorder.isTypeSupported?.(t)) ?? '';
  }

  function setIdle(): void {
    clearInterval(tickTimer);
    button.textContent = '🎬 Gravar';
    button.classList.remove('recording');
    button.setAttribute('aria-label', `Gravar vídeo de ${SECONDS} segundos`);
    badge.hidden = true;
  }

  function start(): void {
    if (!supported()) {
      alert('Seu navegador não consegue gravar vídeo. 😢 Tente o Chrome ou o Safari mais recente.');
      return;
    }
    deps.sounds.unlock();
    const stream = deps.canvas.captureStream(30);
    const audio = deps.sounds.stream();
    audio?.getAudioTracks().forEach((t) => stream.addTrack(t));

    const mimeType = pickMime();
    let rec: MediaRecorder;
    try {
      rec = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
    } catch {
      alert('Ops! Não consegui começar a gravação.');
      return;
    }
    const chunks: Blob[] = [];
    rec.ondataavailable = (e) => {
      if (e.data.size) chunks.push(e.data);
    };
    rec.onstop = () => {
      // Only stop the canvas track: the audio track belongs to Sounds and is reused.
      stream.getVideoTracks().forEach((t) => t.stop());
      recorder = null;
      setIdle();
      const type = (rec.mimeType || mimeType || 'video/webm').split(';')[0];
      if (!chunks.length) return;
      showClip(new Blob(chunks, { type }), type);
    };

    recorder = rec;
    rec.start(250);
    deps.sounds.recStart();
    deps.showCaption(pick(RECORD_CAPTIONS));

    let left = SECONDS;
    const tick = () => {
      button.textContent = `⏹ Parar (${left})`;
      badge.textContent = `● GRAVANDO ${left}s`;
      if (left-- <= 0) stop();
    };
    button.classList.add('recording');
    button.setAttribute('aria-label', 'Parar gravação');
    badge.hidden = false;
    tick();
    tickTimer = window.setInterval(tick, 1000);
  }

  function stop(): void {
    clearInterval(tickTimer);
    if (recorder && recorder.state !== 'inactive') recorder.stop();
  }

  function showClip(blob: Blob, type: string): void {
    const ext = type.includes('mp4') ? 'mp4' : 'webm';
    clip = new File([blob], `crazy-face.${ext}`, { type });
    URL.revokeObjectURL(clipUrl);
    clipUrl = URL.createObjectURL(blob);
    preview.src = clipUrl;
    shareButton.hidden = !navigator.canShare?.({ files: [clip] });
    dialog.hidden = false;
    void preview.play().catch(() => {});
  }

  function closeClip(): void {
    dialog.hidden = true;
    preview.pause();
    preview.removeAttribute('src');
    preview.load();
  }

  function download(): void {
    if (!clip) return;
    const a = document.createElement('a');
    a.href = clipUrl;
    a.download = clip.name;
    a.click();
  }

  shareButton.addEventListener('click', async () => {
    if (!clip) return;
    try {
      await navigator.share({ files: [clip], title: 'Crazy Face' });
    } catch (err) {
      // The user closing the share sheet is not an error.
      if ((err as { name?: string })?.name !== 'AbortError') download();
    }
  });
  downloadButton.addEventListener('click', download);
  $('clip-close').addEventListener('click', closeClip);
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !dialog.hidden) closeClip();
  });

  setIdle();
  button.addEventListener('click', () => (recorder ? stop() : start()));
}
