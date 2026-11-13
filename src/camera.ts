/**
 * "Tirar foto": a full-screen camera with a 3-2-1 countdown, then a "Ficou boa?"
 * review before the photo is used. The photo never leaves the device: we only copy
 * the camera's image into a canvas.
 */

import { enhancePhoto, measureTone, scaleTone, type Tone } from './beauty';
import { FULL_CROP, applyCrop, type Crop, type Cropper, type Framing } from './crop';
import { fitToCanvas } from './image';
import { onLocaleChange, t } from './i18n';
import type { Sounds } from './sound';

type Facing = 'user' | 'environment';

const COUNTDOWN_FROM = 3;

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;

/**
 * `photo` is already cropped, without any filter; `light` is the ☀️ Luz strength the
 * user picked in the review (0..1); `framing` is the shot before ✂️ Recortar and its crop.
 */
export type OnPhoto = (photo: HTMLCanvasElement, light: number, framing: Framing) => void;

/** Long side of the review's ☀️ preview, so the slider stays smooth on big photos. */
const PREVIEW_SIDE = 1280;

/** Preview brightness (median, 0..1) below which the room counts as dark. */
const DARK_ROOM = 0.3;

/** `getLight` is ☀️ Luz's current strength in the editor, where the review's slider starts. */
export function setupCamera(onPhoto: OnPhoto, sounds: Sounds, cropper: Cropper, getLight: () => number): void {
  const overlay = $<HTMLDivElement>('camera');
  const video = $<HTMLVideoElement>('camera-video');
  const countdown = $<HTMLDivElement>('camera-countdown');
  const flash = $<HTMLDivElement>('camera-flash');
  const shutter = $<HTMLButtonElement>('camera-shutter');
  const flip = $<HTMLButtonElement>('camera-flip');
  const fallback = $<HTMLInputElement>('camera-fallback');
  const reviewBox = $<HTMLDivElement>('camera-review');
  const reviewPhoto = $<HTMLDivElement>('camera-review-photo');
  const useButton = $<HTMLButtonElement>('camera-use');
  const lightInput = $<HTMLInputElement>('camera-light-level');
  const lamp = $<HTMLButtonElement>('camera-lamp');
  const screenLight = $<HTMLDivElement>('camera-light');

  let stream: MediaStream | null = null;
  let facing: Facing = 'user';
  /** Bumped on every start/close, so a slow getUserMedia can't revive a closed camera. */
  let session = 0;
  let countdownTimer = 0;
  let counting = false;
  /**
   * The photo waiting for "Usar esta" / "Tirar outra" (uncropped), how ✂️ Recortar
   * crops it, the cropped photo, a small copy of it for the ☀️ preview and its light fix.
   */
  let review: {
    photo: HTMLCanvasElement;
    crop: Crop;
    shown: HTMLCanvasElement;
    preview: HTMLCanvasElement;
    tone: Tone;
  } | null = null;
  /** 💡: the screen glows (front camera) or the torch is on (back camera). */
  let lampOn = false;
  /** The user pressed 💡 themselves, so we stop turning it on when the room is dark. */
  let lampTouched = false;
  let torch = false;
  let meterTimer = 0;
  let exposureBoosted = false;

  const supported = () => !!navigator.mediaDevices?.getUserMedia;

  function stopStream(): void {
    clearInterval(meterTimer);
    stream?.getTracks().forEach((t) => t.stop());
    stream = null;
    video.srcObject = null;
    video.style.filter = '';
    torch = false;
    exposureBoosted = false;
    screenLight.hidden = true;
  }

  // --- 💡 Light: a glowing screen for selfies, the torch on the back camera ---

  function setLamp(on: boolean): void {
    lampOn = on;
    const label = on ? t().text.lightOff : t().text.lightOn;
    lamp.setAttribute('aria-pressed', String(on));
    lamp.setAttribute('aria-label', label);
    lamp.title = label;
    overlay.classList.toggle('lamp', on && !torch);
    const track = stream?.getVideoTracks()[0];
    if (torch && track) void track.applyConstraints({ advanced: [{ torch: on } as MediaTrackConstraintSet] }).catch(() => {});
  }

  /** Show 💡 when it can do something: always on the front camera, with a torch on the back one. */
  function updateLamp(track: MediaStreamTrack): void {
    const caps = capabilities(track);
    torch = facing === 'environment' && !!caps.torch;
    lamp.hidden = facing === 'environment' && !torch;
    setLamp(lampOn && !lamp.hidden);
    // Ask for automatic exposure and white balance where the camera lets us choose.
    const tune: Record<string, string> = {};
    if (caps.exposureMode?.includes('continuous')) tune.exposureMode = 'continuous';
    if (caps.whiteBalanceMode?.includes('continuous')) tune.whiteBalanceMode = 'continuous';
    if (Object.keys(tune).length) void track.applyConstraints({ advanced: [tune as MediaTrackConstraintSet] }).catch(() => {});
  }

  /**
   * Every so often, measure how bright the preview is: brighten the preview like the
   * photo will be, ask the camera for more exposure, and turn on 💡 in a dark room.
   */
  function meter(): void {
    const track = stream?.getVideoTracks()[0];
    if (!track || !video.videoWidth || review || counting) return;
    const median = previewBrightness(video);
    const full = Math.min(2, Math.max(1, Math.pow(0.45 / Math.max(median, 0.05), 0.7)));
    const boost = 1 + (full - 1) * getLight();
    video.style.filter = boost > 1.02 ? `brightness(${boost.toFixed(2)}) saturate(1.1)` : '';
    if (median >= DARK_ROOM) return;
    if (!lampOn && !lampTouched && !lamp.hidden) setLamp(true);
    const ev = capabilities(track).exposureCompensation;
    if (!exposureBoosted && ev && ev.max > 0) {
      exposureBoosted = true;
      const value = Math.min(ev.max, 1);
      void track.applyConstraints({ advanced: [{ exposureCompensation: value } as MediaTrackConstraintSet] }).catch(() => {});
    }
  }

  function cancelCountdown(): void {
    clearTimeout(countdownTimer);
    screenLight.hidden = true;
    counting = false;
    countdown.hidden = true;
    shutter.disabled = false;
  }

  /** The review's photo after ✂️: keep a small copy and its light fix for the preview. */
  function reviewOf(photo: HTMLCanvasElement, crop: Crop, shown: HTMLCanvasElement) {
    const k = Math.min(1, PREVIEW_SIDE / Math.max(shown.width, shown.height));
    const preview = k < 1 ? fitToCanvas(shown, Math.round(shown.width * k), Math.round(shown.height * k), false) : shown;
    return { photo, crop, shown, preview, tone: measureTone(shown) };
  }

  function showReview(photo: HTMLCanvasElement): void {
    review = reviewOf(photo, FULL_CROP, photo);
    lightInput.value = String(getLight());
    showReviewPhoto();
    reviewBox.hidden = false;
    overlay.classList.add('reviewing');
    video.pause();
    useButton.focus();
  }

  /** The review shows the photo with ☀️ Luz at the slider's strength. */
  function showReviewPhoto(): void {
    if (!review) return;
    const { preview, tone } = review;
    const light = lightInput.valueAsNumber;
    reviewPhoto.replaceChildren((light > 0 && enhancePhoto(preview, scaleTone(tone, light))) || preview);
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
      updateLamp(s.getVideoTracks()[0]);
      clearInterval(meterTimer);
      meterTimer = window.setInterval(meter, 600);
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
    // Selfie light: the whole screen glows for the last second, so the camera has time to adjust.
    if (n === 1 && lampOn && !torch) screenLight.hidden = false;
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
    sounds.shutter();
    flash.hidden = false;
    flash.style.animation = 'none';
    void flash.offsetWidth;
    flash.style.animation = '';
    window.setTimeout(() => (flash.hidden = true), 250);
    const still = await fullResolutionPhoto(track, mirror);
    screenLight.hidden = true;
    if (mine !== session) return;
    showReview(still ?? frame);
  }

  $('camera-open').addEventListener('click', open);
  $('camera-close').addEventListener('click', close);

  useButton.addEventListener('click', () => {
    if (!review) return;
    const { photo, crop, shown } = review;
    close();
    onPhoto(shown, lightInput.valueAsNumber, { source: photo, crop });
  });

  // ✂️ Recortar: the cropper shows the photo without the light fix.
  $('camera-crop').addEventListener('click', async () => {
    if (!review) return;
    sounds.pop();
    const current = review;
    const crop = await cropper(current.photo, current.crop);
    if (!crop || review !== current) return;
    review = reviewOf(current.photo, crop, applyCrop(current.photo, crop));
    showReviewPhoto();
    useButton.focus();
  });

  $('camera-retake').addEventListener('click', () => {
    sounds.pop();
    hideReview();
    cancelCountdown();
    if (stream) void video.play();
    else void start();
    shutter.focus();
  });

  // The slider redraws at most once a frame while it's dragged.
  let lightFrame = 0;
  lightInput.addEventListener('input', () => {
    cancelAnimationFrame(lightFrame);
    lightFrame = requestAnimationFrame(showReviewPhoto);
  });

  lamp.addEventListener('click', () => {
    lampTouched = true;
    sounds.pop();
    setLamp(!lampOn);
  });

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

  // A new language: redraw the text set from here.
  onLocaleChange(() => {
    setLamp(lampOn);
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

/** Camera settings some browsers offer (Android Chrome); not in TypeScript's DOM types. */
interface CameraCapabilities {
  torch?: boolean;
  exposureMode?: string[];
  whiteBalanceMode?: string[];
  exposureCompensation?: { min: number; max: number; step: number };
}

function capabilities(track: MediaStreamTrack): CameraCapabilities {
  try {
    return (track.getCapabilities?.() ?? {}) as CameraCapabilities;
  } catch {
    return {};
  }
}

const meterCanvas = document.createElement('canvas');
meterCanvas.width = 32;
meterCanvas.height = 18;

/** The median brightness (0..1) of a tiny copy of the video frame. */
function previewBrightness(video: HTMLVideoElement): number {
  const ctx = meterCanvas.getContext('2d', { willReadFrequently: true })!;
  ctx.drawImage(video, 0, 0, meterCanvas.width, meterCanvas.height);
  const data = ctx.getImageData(0, 0, meterCanvas.width, meterCanvas.height).data;
  const luma: number[] = [];
  for (let i = 0; i < data.length; i += 4) luma.push(0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2]);
  luma.sort((a, b) => a - b);
  return luma[luma.length >> 1] / 255;
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

/** A friendly message for a getUserMedia failure, in the current language. */
export function cameraError(err: unknown): string {
  const name = (err as { name?: string })?.name;
  const text = t().text;
  switch (name) {
    case 'NotAllowedError':
    case 'SecurityError':
      return text.cameraDenied;
    case 'NotFoundError':
    case 'OverconstrainedError':
      return text.cameraMissing;
    case 'NotReadableError':
      return text.cameraBusy;
    default:
      return text.cameraFailed;
  }
}
