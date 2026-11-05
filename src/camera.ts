/**
 * "Tirar foto": a full-screen camera with a 3-2-1 countdown.
 * The photo never leaves the device: we only copy a video frame into a canvas.
 */

import { fitToCanvas } from './image';
import type { Sounds } from './sound';

type Facing = 'user' | 'environment';

const COUNTDOWN_FROM = 3;

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;

export function setupCamera(onPhoto: (photo: HTMLCanvasElement) => void, sounds: Sounds): void {
  const overlay = $<HTMLDivElement>('camera');
  const video = $<HTMLVideoElement>('camera-video');
  const countdown = $<HTMLDivElement>('camera-countdown');
  const flash = $<HTMLDivElement>('camera-flash');
  const shutter = $<HTMLButtonElement>('camera-shutter');
  const flip = $<HTMLButtonElement>('camera-flip');
  const fallback = $<HTMLInputElement>('camera-fallback');

  let stream: MediaStream | null = null;
  let facing: Facing = 'user';
  /** Bumped on every start/close, so a slow getUserMedia can't revive a closed camera. */
  let session = 0;
  let countdownTimer = 0;
  let counting = false;

  const supported = () => !!navigator.mediaDevices?.getUserMedia;

  function stopStream(): void {
    stream?.getTracks().forEach((t) => t.stop());
    stream = null;
    video.srcObject = null;
  }

  function cancelCountdown(): void {
    clearTimeout(countdownTimer);
    counting = false;
    countdown.hidden = true;
    shutter.disabled = false;
  }

  function close(): void {
    session++;
    cancelCountdown();
    stopStream();
    overlay.hidden = true;
  }

  async function start(): Promise<void> {
    const mine = ++session;
    stopStream();
    try {
      const s = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: { facingMode: facing, width: { ideal: 1920 }, height: { ideal: 1080 } },
      });
      if (mine !== session) {
        s.getTracks().forEach((t) => t.stop());
        return;
      }
      stream = s;
      video.srcObject = s;
      video.classList.toggle('mirrored', facing === 'user');
      await video.play();
      void updateFlipButton();
    } catch (err) {
      if (mine !== session) return;
      close();
      alert(cameraError(err));
    }
  }

  /** Only offer "trocar câmera" when there is more than one. */
  async function updateFlipButton(): Promise<void> {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      flip.hidden = devices.filter((d) => d.kind === 'videoinput').length < 2;
    } catch {
      flip.hidden = true;
    }
  }

  function open(): void {
    sounds.unlock();
    if (!supported()) {
      // Old browsers: let the phone's own camera app take the photo.
      fallback.click();
      return;
    }
    overlay.hidden = false;
    shutter.focus();
    void start();
  }

  function tick(n: number): void {
    if (n === 0) {
      countdown.hidden = true;
      takePhoto();
      return;
    }
    countdown.textContent = String(n);
    countdown.hidden = false;
    // Restart the pop animation for each number.
    countdown.style.animation = 'none';
    void countdown.offsetWidth;
    countdown.style.animation = '';
    sounds.beep(n === 1);
    countdownTimer = window.setTimeout(() => tick(n - 1), 1000);
  }

  function takePhoto(): void {
    const w = video.videoWidth;
    const h = video.videoHeight;
    if (!w || !h) {
      cancelCountdown();
      return;
    }
    // Keep the photo looking like the (mirrored) selfie preview.
    const photo = fitToCanvas(video, w, h, facing === 'user');
    sounds.shutter();
    flash.hidden = false;
    flash.style.animation = 'none';
    void flash.offsetWidth;
    flash.style.animation = '';
    window.setTimeout(() => {
      flash.hidden = true;
      close();
      onPhoto(photo);
    }, 250);
  }

  $('camera-open').addEventListener('click', open);
  $('camera-close').addEventListener('click', close);

  shutter.addEventListener('click', () => {
    if (counting || !stream) return;
    counting = true;
    shutter.disabled = true;
    tick(COUNTDOWN_FROM);
  });

  flip.addEventListener('click', () => {
    cancelCountdown();
    facing = facing === 'user' ? 'environment' : 'user';
    void start();
  });

  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !overlay.hidden) close();
  });

  // Don't keep the camera (and its light) on when the tab is in the background.
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && !overlay.hidden) close();
  });
}

function cameraError(err: unknown): string {
  const name = (err as { name?: string })?.name;
  const tail = ' Você ainda pode usar o botão "Enviar foto".';
  switch (name) {
    case 'NotAllowedError':
    case 'SecurityError':
      return 'Não consegui acessar a câmera. Libere a permissão nas configurações do navegador.' + tail;
    case 'NotFoundError':
    case 'OverconstrainedError':
      return 'Não encontrei nenhuma câmera neste aparelho.' + tail;
    case 'NotReadableError':
      return 'A câmera está sendo usada por outro app. Feche o outro app e tente de novo.';
    default:
      return 'Ops! A câmera não quis funcionar.' + tail;
  }
}
