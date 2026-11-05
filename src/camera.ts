/**
 * "Tirar foto": a full-screen camera with a 3-2-1 countdown, then a "Ficou boa?"
 * review before the photo is used. The photo never leaves the device: we only copy
 * the camera's image into a canvas.
 */

import { fitToCanvas } from './image';
import { POSE_CHALLENGES, pick, type PoseChallenge } from './jokes';
import type { Sounds } from './sound';

type Facing = 'user' | 'environment';

const COUNTDOWN_FROM = 3;

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;

/** `challenge` is the pose prompt that was on screen, or null if the user turned it off. */
export type OnPhoto = (photo: HTMLCanvasElement, challenge: PoseChallenge | null) => void;

export function setupCamera(onPhoto: OnPhoto, sounds: Sounds): void {
  const overlay = $<HTMLDivElement>('camera');
  const video = $<HTMLVideoElement>('camera-video');
  const countdown = $<HTMLDivElement>('camera-countdown');
  const flash = $<HTMLDivElement>('camera-flash');
  const shutter = $<HTMLButtonElement>('camera-shutter');
  const flip = $<HTMLButtonElement>('camera-flip');
  const fallback = $<HTMLInputElement>('camera-fallback');
  const challengeBox = $<HTMLDivElement>('camera-challenge');
  const challengeText = $<HTMLSpanElement>('camera-challenge-text');
  const challengeOn = $<HTMLButtonElement>('camera-challenge-on');
  const reviewBox = $<HTMLDivElement>('camera-review');
  const reviewPhoto = $<HTMLDivElement>('camera-review-photo');
  const useButton = $<HTMLButtonElement>('camera-use');

  let stream: MediaStream | null = null;
  let facing: Facing = 'user';
  /** Bumped on every start/close, so a slow getUserMedia can't revive a closed camera. */
  let session = 0;
  let countdownTimer = 0;
  let counting = false;
  /** The pose prompt on screen; null when the user chose "Sem desafio" (remembered until reload). */
  let challenge: PoseChallenge | null = null;
  let wantsChallenge = true;
  /** The photo waiting for "Usar esta" / "Tirar outra". */
  let review: { photo: HTMLCanvasElement; posed: PoseChallenge | null } | null = null;

  function newChallenge(): void {
    let next = pick(POSE_CHALLENGES);
    while (POSE_CHALLENGES.length > 1 && next === challenge) next = pick(POSE_CHALLENGES);
    challenge = next;
    challengeText.textContent = next.prompt;
    // Replay the pop-in animation.
    challengeBox.style.animation = 'none';
    void challengeBox.offsetWidth;
    challengeBox.style.animation = '';
  }

  function showChallenge(on: boolean): void {
    wantsChallenge = on;
    challengeBox.hidden = !on;
    challengeOn.hidden = on;
    if (on) newChallenge();
    else challenge = null;
  }

  const supported = () => !!navigator.mediaDevices?.getUserMedia;

  function stopStream(): void {
    stream?.getTracks().forEach((t) => t.stop());
    stream = null;
    video.srcObject = null;
  }

  function cancelCountdown(): void {
    clearTimeout(countdownTimer);
    counting = false;
    overlay.classList.remove('counting');
    countdown.hidden = true;
    shutter.disabled = false;
  }

  function showReview(photo: HTMLCanvasElement, posed: PoseChallenge | null): void {
    review = { photo, posed };
    reviewPhoto.replaceChildren(photo);
    reviewBox.hidden = false;
    overlay.classList.add('reviewing');
    video.pause();
    useButton.focus();
  }

  function hideReview(): void {
    review = null;
    reviewPhoto.replaceChildren();
    reviewBox.hidden = true;
    overlay.classList.remove('reviewing');
  }

  function close(): void {
    session++;
    hideReview();
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
    showChallenge(wantsChallenge);
    shutter.focus();
    void start();
  }

  function tick(n: number): void {
    if (n === 0) {
      countdown.hidden = true;
      void takePhoto();
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

  async function takePhoto(): Promise<void> {
    const w = video.videoWidth;
    const h = video.videoHeight;
    const track = stream?.getVideoTracks()[0];
    if (!w || !h || !track) {
      cancelCountdown();
      return;
    }
    const mine = session;
    // Keep the photo looking like the (mirrored) selfie preview.
    const mirror = facing === 'user';
    // Grab the preview frame now, in case the full-resolution still isn't available.
    const frame = fitToCanvas(video, w, h, mirror);
    const posed = challenge;
    sounds.shutter();
    flash.hidden = false;
    flash.style.animation = 'none';
    void flash.offsetWidth;
    flash.style.animation = '';
    window.setTimeout(() => (flash.hidden = true), 250);
    const still = await fullResolutionPhoto(track, mirror);
    if (mine !== session) return;
    showReview(still ?? frame, posed);
  }

  $('camera-open').addEventListener('click', open);
  $('camera-close').addEventListener('click', close);

  useButton.addEventListener('click', () => {
    if (!review) return;
    const { photo, posed } = review;
    close();
    onPhoto(photo, posed);
  });

  $('camera-retake').addEventListener('click', () => {
    sounds.pop();
    hideReview();
    cancelCountdown();
    if (stream) void video.play();
    else void start();
    shutter.focus();
  });

  shutter.addEventListener('click', () => {
    if (counting || !stream) return;
    counting = true;
    overlay.classList.add('counting');
    shutter.disabled = true;
    tick(COUNTDOWN_FROM);
  });

  $('camera-challenge-next').addEventListener('click', () => {
    sounds.pop();
    newChallenge();
  });
  $('camera-challenge-off').addEventListener('click', () => showChallenge(false));
  challengeOn.addEventListener('click', () => {
    sounds.pop();
    showChallenge(true);
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
  // A photo waiting for review is kept; "Tirar outra" turns the camera back on.
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden || overlay.hidden) return;
    if (review) {
      session++;
      stopStream();
    } else {
      close();
    }
  });
}

/** The parts of ImageCapture we use (not in every browser, nor in TypeScript's DOM types). */
type ImageCaptureCtor = new (track: MediaStreamTrack) => { takePhoto(): Promise<Blob> };

/**
 * A still at the camera's full resolution (sharper than a video frame) where the
 * browser supports ImageCapture, e.g. Android Chrome. Null if it isn't available or fails.
 */
async function fullResolutionPhoto(track: MediaStreamTrack, mirror: boolean): Promise<HTMLCanvasElement | null> {
  const ImageCapture = (window as unknown as { ImageCapture?: ImageCaptureCtor }).ImageCapture;
  if (!ImageCapture) return null;
  try {
    const blob = await Promise.race([
      new ImageCapture(track).takePhoto(),
      new Promise<never>((_, reject) => setTimeout(() => reject(new Error('timeout')), 2500)),
    ]);
    const bitmap = await createImageBitmap(blob, { imageOrientation: 'from-image' });
    try {
      return fitToCanvas(bitmap, bitmap.width, bitmap.height, mirror);
    } finally {
      bitmap.close();
    }
  } catch {
    return null;
  }
}

/** A friendly PT-BR message for a getUserMedia failure. */
export function cameraError(err: unknown): string {
  const name = (err as { name?: string })?.name;
  const tail = ' Você ainda pode usar o botão "Escolher foto".';
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
