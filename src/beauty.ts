/**
 * ✨ Luz e beleza: brightens dark photos and smooths the skin on faces.
 *
 * It runs once per photo (not every frame) in a small offscreen WebGL2 context,
 * and returns a new canvas, so the renderer, face detection, Salvar PNG and clips
 * just see a nicer photo. Everything stays on the device.
 *
 * - Light: levels from the photo's histogram, a gamma that moves the median
 *   brightness towards mid-grey, a partial gray-world white balance, a little warmth
 *   and saturation, and colour-noise smoothing (brightening a dark photo also
 *   brightens its noise).
 * - Beauty (needs faces): an edge-preserving blur on skin-coloured pixels inside
 *   each face, keeping the eyes and mouth sharp, plus a soft light on the face.
 */

import { estimateLandmarks } from './lens';
import type { EffectTarget } from './warp';

/** Faces the beauty pass handles (matches MAX_FACES in main.ts). Must match the shader. */
const MAX_FACES = 6;

/** Median brightness the light correction aims for (0..1). */
const TARGET_MEDIAN = 0.46;

/** Photos whose median brightness is below this count as dark (the filter turns on by itself). */
const DARK_MEDIAN = 0.36;

/** How the light correction changes a photo; measured once per photo. */
export interface Tone {
  black: number;
  white: number;
  gamma: number;
  /** White balance gains for R, G, B. */
  gain: [number, number, number];
  /** Colour-noise smoothing, 0..1: more when the photo had to be brightened a lot. */
  denoise: number;
  /** The photo's median brightness before correction (0..1). */
  median: number;
}

/** True if the photo is dark enough that the filter should turn on by itself. */
export const isDark = (tone: Tone) => tone.median < DARK_MEDIAN;

/** Look at a small copy of the photo and work out the correction. */
export function measureTone(image: CanvasImageSource & { width: number; height: number }): Tone {
  const w = 96;
  const h = Math.max(1, Math.round((w * image.height) / image.width));
  const small = document.createElement('canvas');
  small.width = w;
  small.height = h;
  const ctx = small.getContext('2d', { willReadFrequently: true })!;
  ctx.drawImage(image, 0, 0, w, h);
  const data = ctx.getImageData(0, 0, w, h).data;

  const hist = new Uint32Array(256);
  let r = 0;
  let g = 0;
  let b = 0;
  for (let i = 0; i < data.length; i += 4) {
    r += data[i];
    g += data[i + 1];
    b += data[i + 2];
    hist[Math.round(0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2])]++;
  }
  const n = w * h;
  const percentile = (p: number) => {
    let seen = 0;
    for (let i = 0; i < 256; i++) {
      seen += hist[i];
      if (seen >= p * n) return i / 255;
    }
    return 1;
  };
  const p1 = percentile(0.01);
  const median = percentile(0.5);
  const p99 = percentile(0.995);

  // Levels: only pull in the ends, never stretch a low-contrast photo too hard.
  const black = Math.min(p1, 0.08) * 0.85;
  const white = Math.max(p99, 0.55);
  const m = Math.min(0.95, Math.max(0.02, (median - black) / (white - black)));
  // Brighten dark photos a lot, darken bright ones only a little.
  const gamma = Math.min(1.15, Math.max(0.5, Math.log(TARGET_MEDIAN) / Math.log(m)));

  // Gray world, only 30% of the way (a little warmth is nice on skin).
  const avg = (r + g + b) / 3;
  const balance = (c: number, warm: number) =>
    Math.min(1.2, Math.max(0.85, 1 + ((avg / Math.max(c, 1) - 1) * 0.3))) * warm;
  return {
    black,
    white,
    gamma,
    gain: [balance(r, 1.03), balance(g, 1), balance(b, 0.97)],
    denoise: Math.min(0.8, Math.max(0, (1 - gamma) * 1.6)),
    median,
  };
}

const VERTEX = `#version 300 es
out vec2 vUv;
void main() {
  // One triangle that covers the screen. The top row of the canvas is the photo's top row.
  vec2 p = vec2(gl_VertexID == 1 ? 3.0 : -1.0, gl_VertexID == 2 ? 3.0 : -1.0);
  vUv = vec2(p.x + 1.0, 1.0 - p.y) * 0.5;
  gl_Position = vec4(p, 0.0, 1.0);
}`;

const FRAGMENT = `#version 300 es
precision highp float;
#define MAX_FACES ${MAX_FACES}
in vec2 vUv;
uniform sampler2D uTex;
uniform vec2 uTexel;     // 1 / photo size in pixels
uniform float uAspect;   // height / width
uniform vec3 uLevels;    // black, white, gamma
uniform vec3 uGain;
uniform float uDenoise;
uniform int uFaceCount;
uniform vec3 uFace[MAX_FACES];     // centre x, y, radius (world units)
uniform vec3 uKeep[MAX_FACES * 3]; // eyes and mouth: centre x, y, radius
out vec4 outColor;

const vec3 LUMA = vec3(0.2126, 0.7152, 0.0722);

vec3 tone(vec3 c) {
  c = clamp((c * uGain - uLevels.x) / (uLevels.y - uLevels.x), 0.0, 1.0);
  c = pow(c, vec3(uLevels.z));
  // Brightening washes colours out: give some back.
  float y = dot(c, LUMA);
  return clamp(mix(vec3(y), c, 1.12), 0.0, 1.0);
}

// Edge-preserving blur: neighbours that look different count less.
vec3 bilateral(vec2 uv, float stepPx, float sigma) {
  vec3 c0 = texture(uTex, uv).rgb;
  vec3 sum = vec3(0.0);
  float total = 0.0;
  for (int i = -2; i <= 2; i++) {
    for (int j = -2; j <= 2; j++) {
      vec2 o = vec2(float(i), float(j));
      vec3 c = texture(uTex, uv + o * stepPx * uTexel).rgb;
      vec3 d = c - c0;
      float w = exp(-dot(o, o) / 8.0 - dot(d, d) / (2.0 * sigma * sigma));
      sum += c * w;
      total += w;
    }
  }
  return sum / total;
}

// 1 on skin colours, fading out around them (YCbCr box, on the corrected colour).
float skin(vec3 c) {
  float cb = 0.5 - 0.1482 * c.r - 0.2910 * c.g + 0.4392 * c.b;
  float cr = 0.5 + 0.4392 * c.r - 0.3678 * c.g - 0.0714 * c.b;
  float inCb = smoothstep(0.27, 0.31, cb) * (1.0 - smoothstep(0.50, 0.54, cb));
  float inCr = smoothstep(0.50, 0.53, cr) * (1.0 - smoothstep(0.68, 0.72, cr));
  return inCb * inCr;
}

void main() {
  vec3 c0 = texture(uTex, vUv).rgb;
  vec2 p = vUv * vec2(1.0, uAspect);
  vec3 c = c0;

  // Colour noise: take the colour from a blurred copy, keep most of the sharp brightness.
  if (uDenoise > 0.0) {
    vec3 b = bilateral(vUv, 1.5, 0.12);
    vec3 chroma = b + (dot(c0, LUMA) - dot(b, LUMA));
    c = mix(c0, mix(chroma, b, 0.3), uDenoise);
  }

  // Which face (if any) this pixel is on.
  float face = 0.0;
  float faceR = 0.0;
  for (int i = 0; i < MAX_FACES; i++) {
    if (i >= uFaceCount) break;
    vec3 f = uFace[i];
    vec2 d = (p - f.xy) / (f.z * vec2(0.82, 1.0));
    float m = 1.0 - smoothstep(0.65, 1.0, length(d));
    if (m > face) {
      face = m;
      faceR = f.z;
    }
  }

  float light = 1.0;
  if (face > 0.0) {
    float keep = 1.0;
    for (int i = 0; i < MAX_FACES * 3; i++) {
      if (i >= uFaceCount * 3) break;
      vec3 k = uKeep[i];
      keep = min(keep, smoothstep(0.55, 1.0, length(p - k.xy) / k.z));
    }
    // Blur scale follows the face size: ~2% of its radius per tap.
    float stepPx = max(1.0, faceR * 0.022 / uTexel.x);
    vec3 smooth_ = bilateral(vUv, stepPx, 0.07);
    float amount = 0.65 * face * keep * skin(tone(c0));
    c = mix(c, smooth_, amount);
    light += 0.1 * face;
  }

  outColor = vec4(clamp(tone(c) * light, 0.0, 1.0), 1.0);
}`;

interface Pipeline {
  gl: WebGL2RenderingContext;
  canvas: HTMLCanvasElement;
  program: WebGLProgram;
  texture: WebGLTexture;
  u: Record<string, WebGLUniformLocation | null>;
}

let pipeline: Pipeline | null | undefined;

/** The offscreen WebGL2 context, made on first use. Null if the browser can't. */
function getPipeline(): Pipeline | null {
  if (pipeline !== undefined) return pipeline;
  pipeline = null;
  const canvas = document.createElement('canvas');
  const gl = canvas.getContext('webgl2', { preserveDrawingBuffer: true, premultipliedAlpha: false, antialias: false });
  if (!gl) return null;
  const program = gl.createProgram()!;
  for (const [type, source] of [
    [gl.VERTEX_SHADER, VERTEX],
    [gl.FRAGMENT_SHADER, FRAGMENT],
  ] as const) {
    const shader = gl.createShader(type)!;
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      console.warn('beauty shader:', gl.getShaderInfoLog(shader));
      return null;
    }
    gl.attachShader(program, shader);
  }
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) return null;
  const texture = gl.createTexture()!;
  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  const names = ['uTexel', 'uAspect', 'uLevels', 'uGain', 'uDenoise', 'uFaceCount', 'uFace', 'uKeep'];
  const u = Object.fromEntries(names.map((n) => [n, gl.getUniformLocation(program, n)]));
  // The context can be lost (e.g. a phone under memory pressure): make a new one next time.
  canvas.addEventListener('webglcontextlost', () => (pipeline = undefined));
  pipeline = { gl, canvas, program, texture, u };
  return pipeline;
}

/**
 * The photo with ✨ Luz e beleza applied, as a new canvas the same size.
 * `faces` (world units) get the skin smoothing; without faces it only fixes the light.
 * Null if WebGL2 isn't available (the caller just keeps the original photo).
 */
export function enhancePhoto(
  image: HTMLCanvasElement,
  tone: Tone,
  faces: readonly EffectTarget[] = [],
): HTMLCanvasElement | null {
  const p = getPipeline();
  if (!p) return null;
  const { gl, canvas, u } = p;
  const W = image.width;
  const H = image.height;
  canvas.width = W;
  canvas.height = H;

  gl.bindTexture(gl.TEXTURE_2D, p.texture);
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);

  gl.viewport(0, 0, W, H);
  gl.useProgram(p.program);
  gl.uniform2f(u.uTexel, 1 / W, 1 / H);
  gl.uniform1f(u.uAspect, H / W);
  gl.uniform3f(u.uLevels, tone.black, tone.white, tone.gamma);
  gl.uniform3f(u.uGain, ...tone.gain);
  gl.uniform1f(u.uDenoise, tone.denoise);

  const list = faces.slice(0, MAX_FACES);
  gl.uniform1i(u.uFaceCount, list.length);
  if (list.length) {
    const face = new Float32Array(MAX_FACES * 3);
    const keep = new Float32Array(MAX_FACES * 9);
    list.forEach((f, i) => {
      face.set([f.x, f.y, f.r], i * 3);
      const { eyes, mouth } = f.landmarks ?? estimateLandmarks(f);
      keep.set([eyes[0].x, eyes[0].y, f.r * 0.2, eyes[1].x, eyes[1].y, f.r * 0.2, mouth.x, mouth.y, f.r * 0.26], i * 9);
    });
    gl.uniform3fv(u.uFace, face);
    gl.uniform3fv(u.uKeep, keep);
  }

  gl.drawArrays(gl.TRIANGLES, 0, 3);

  const out = document.createElement('canvas');
  out.width = W;
  out.height = H;
  out.getContext('2d')!.drawImage(canvas, 0, 0);
  return out;
}
