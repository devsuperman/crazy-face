/**
 * "🪞 Espelho maluco": the live selfie camera becomes the texture, so you can
 * squish your own face in real time. Stopping freezes the last frame as the photo.
 * Nothing is recorded or sent anywhere: frames go straight from the camera to the GPU.
 */

import { cameraError } from './camera';
import { fitToCanvas } from './image';
import { MIRROR_CAPTIONS, MIRROR_FREEZE_CAPTIONS, pick } from './jokes';
import type { Sounds } from './sound';

export interface MirrorDeps {
  sounds: Sounds;
  showCaption(text: string): void;
  /** The video is playing and has a size: make a mesh for it and start drawing its frames. */
  onStart(video: HTMLVideoElement): void;
  /** Live mode ended. `frame` is the last frame (mirrored like the preview), if it was kept. */
  onStop(frame: HTMLCanvasElement | null): void;
}

export interface Mirror {
  /** The playing video while live, otherwise null. */
  readonly video: HTMLVideoElement | null;
  /** Leave live mode, optionally keeping the last frame as the photo. */
  stop(keepFrame: boolean): void;
}

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;

export function setupMirror(deps: MirrorDeps): Mirror {
  const button = $<HTMLButtonElement>('mirror');
  const video = $<HTMLVideoElement>('mirror-video');

  let stream: MediaStream | null = null;
  let live = false;
  /** Bumped on every start/stop, so a slow getUserMedia can't revive a stopped mirror. */
  let session = 0;

  function setButton(): void {
    button.textContent = live ? '🧊 Congelar' : '🪞 Espelho maluco';
    button.classList.toggle('primary', live);
    button.setAttribute('aria-pressed', String(live));
  }

  async function start(): Promise<void> {
    deps.sounds.unlock();
    if (!navigator.mediaDevices?.getUserMedia) {
      alert('Seu navegador não deixa usar a câmera ao vivo. 😢');
      return;
    }
    const mine = ++session;
    button.disabled = true;
    try {
      const s = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } },
      });
      if (mine !== session) {
        s.getTracks().forEach((t) => t.stop());
        return;
      }
      stream = s;
      video.srcObject = s;
      await video.play();
      if (mine !== session) return;
      if (!video.videoWidth) {
        await new Promise((r) => video.addEventListener('loadedmetadata', r, { once: true }));
      }
      live = true;
      deps.onStart(video);
      deps.showCaption(pick(MIRROR_CAPTIONS));
      deps.sounds.pop();
    } catch (err) {
      if (mine !== session) return;
      stopStream();
      alert(cameraError(err));
    } finally {
      if (mine === session) button.disabled = false;
      setButton();
    }
  }

  function stopStream(): void {
    stream?.getTracks().forEach((t) => t.stop());
    stream = null;
    video.srcObject = null;
  }

  function stop(keepFrame: boolean): void {
    session++;
    button.disabled = false;
    if (!live) {
      stopStream();
      return;
    }
    const frame =
      keepFrame && video.videoWidth ? fitToCanvas(video, video.videoWidth, video.videoHeight, true) : null;
    live = false;
    stopStream();
    setButton();
    deps.onStop(frame);
  }

  button.addEventListener('click', () => {
    if (live) {
      stop(true);
      deps.sounds.shutter();
      deps.showCaption(pick(MIRROR_FREEZE_CAPTIONS));
    } else {
      void start();
    }
  });

  // Don't keep the camera (and its light) on when the tab is in the background.
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) stop(true);
  });

  setButton();

  return {
    get video() {
      return live ? video : null;
    },
    stop,
  };
}
