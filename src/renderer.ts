import { t } from './i18n';
import { MAX_LENSES } from './lens';
import type { StickerPose } from './sticker';
import type { WarpMesh } from './warp';

const VERTEX = `#version 300 es
in vec2 aPos;
in vec2 aUv;
uniform vec2 uScale;
uniform vec2 uOffset;
out vec2 vUv;
void main() {
  vUv = aUv;
  gl_Position = vec4(aPos * uScale + uOffset, 0.0, 1.0);
}`;

// Lenses (👀/👃/🐹/😁) remap the texture lookup per pixel. They work in the photo's rest
// space in world units (u, v × aspect), so they follow the photo when it's warped.
const FRAGMENT = `#version 300 es
precision highp float;
#define MAX_LENSES ${MAX_LENSES}
in vec2 vUv;
uniform sampler2D uTex;
uniform float uAspect;
uniform int uLensCount;
uniform vec4 uLens[MAX_LENSES]; // centre x, y, radius, strength
uniform vec2 uLensPull[MAX_LENSES];
out vec4 outColor;
void main() {
  vec2 p = vUv * vec2(1.0, uAspect);
  for (int i = 0; i < MAX_LENSES; i++) {
    if (i >= uLensCount) break;
    vec4 l = uLens[i];
    vec2 d = p - l.xy;
    float r2 = dot(d, d) / (l.z * l.z);
    if (r2 >= 1.0) continue;
    float f = (1.0 - r2) * (1.0 - r2);
    // Sample closer to the centre: what's there looks bigger. Smooth at the rim.
    p = l.xy + d * (1.0 - l.w * f) - uLensPull[i] * f;
  }
  outColor = texture(uTex, p / vec2(1.0, uAspect));
}`;

// 🎉 The sticker: one textured quad on top of the photo, placed in world units.
const STICKER_VERTEX = `#version 300 es
in vec2 aCorner; // -0.5..0.5
uniform vec2 uScale;
uniform vec2 uOffset;
uniform vec2 uCenter;
uniform vec2 uSize;
uniform float uAngle;
out vec2 vUv;
void main() {
  vUv = aCorner + 0.5;
  vec2 p = aCorner * uSize;
  float c = cos(uAngle);
  float s = sin(uAngle);
  vec2 world = uCenter + vec2(p.x * c - p.y * s, p.x * s + p.y * c);
  gl_Position = vec4(world * uScale + uOffset, 0.0, 1.0);
}`;

const STICKER_FRAGMENT = `#version 300 es
precision mediump float;
in vec2 vUv;
uniform sampler2D uTex;
out vec4 outColor;
void main() {
  outColor = texture(uTex, vUv);
}`;

interface StickerGl {
  program: WebGLProgram;
  vao: WebGLVertexArrayObject;
  texture: WebGLTexture;
  uScale: WebGLUniformLocation;
  uOffset: WebGLUniformLocation;
  uCenter: WebGLUniformLocation;
  uSize: WebGLUniformLocation;
  uAngle: WebGLUniformLocation;
}

/** Where the image sits on screen, in CSS pixels. */
export interface Layout {
  offsetX: number;
  offsetY: number;
  /** CSS pixels per world unit (the image is 1 world unit wide). */
  scale: number;
}

export class Renderer {
  private readonly gl: WebGL2RenderingContext;
  private readonly program: WebGLProgram;
  private readonly vao: WebGLVertexArrayObject;
  private readonly posBuffer: WebGLBuffer;
  private readonly uvBuffer: WebGLBuffer;
  private readonly indexBuffer: WebGLBuffer;
  private readonly texture: WebGLTexture;
  private readonly uScale: WebGLUniformLocation;
  private readonly uOffset: WebGLUniformLocation;
  private readonly uAspect: WebGLUniformLocation;
  private readonly uLensCount: WebGLUniformLocation;
  private readonly uLens: WebGLUniformLocation;
  private readonly uLensPull: WebGLUniformLocation;
  private indexCount = 0;
  private readonly sticker: StickerGl;
  /** Width of the photo texture in pixels: the saved photo keeps this sharpness. */
  private imageWidth = 1;

  constructor(readonly canvas: HTMLCanvasElement) {
    const gl = canvas.getContext('webgl2', {
      antialias: true,
      premultipliedAlpha: false,
    });
    if (!gl) throw new Error(t().text.noWebgl);
    this.gl = gl;

    this.program = createProgram(gl, VERTEX, FRAGMENT);
    this.uScale = gl.getUniformLocation(this.program, 'uScale')!;
    this.uOffset = gl.getUniformLocation(this.program, 'uOffset')!;
    this.uAspect = gl.getUniformLocation(this.program, 'uAspect')!;
    this.uLensCount = gl.getUniformLocation(this.program, 'uLensCount')!;
    this.uLens = gl.getUniformLocation(this.program, 'uLens')!;
    this.uLensPull = gl.getUniformLocation(this.program, 'uLensPull')!;

    this.vao = gl.createVertexArray()!;
    this.posBuffer = gl.createBuffer()!;
    this.uvBuffer = gl.createBuffer()!;
    this.indexBuffer = gl.createBuffer()!;

    gl.bindVertexArray(this.vao);
    bindAttribute(gl, this.program, 'aPos', this.posBuffer);
    bindAttribute(gl, this.program, 'aUv', this.uvBuffer);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.indexBuffer);
    gl.bindVertexArray(null);

    this.texture = gl.createTexture()!;
    gl.bindTexture(gl.TEXTURE_2D, this.texture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);

    this.sticker = createStickerProgram(gl);
  }

  /** Upload the 🎉 sticker art. */
  setSticker(image: TexImageSource): void {
    const gl = this.gl;
    gl.bindTexture(gl.TEXTURE_2D, this.sticker.texture);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
    gl.generateMipmap(gl.TEXTURE_2D);
  }

  /** Upload a new texture (with mipmaps, so a zoomed-out photo stays smooth). */
  setImage(image: TexImageSource): void {
    const gl = this.gl;
    this.imageWidth = sourceWidth(image);
    gl.bindTexture(gl.TEXTURE_2D, this.texture);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
    gl.generateMipmap(gl.TEXTURE_2D);
  }

  setMesh(mesh: WarpMesh): void {
    const gl = this.gl;
    gl.bindVertexArray(this.vao);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.uvBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, mesh.uvs, gl.STATIC_DRAW);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.posBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, mesh.positions, gl.DYNAMIC_DRAW);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, mesh.indices, gl.STATIC_DRAW);
    gl.bindVertexArray(null);
    this.indexCount = mesh.indices.length;
  }

  /** Match the drawing buffer to the canvas' on-screen size. */
  resize(): void {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = Math.round(this.canvas.clientWidth * dpr);
    const h = Math.round(this.canvas.clientHeight * dpr);
    if (this.canvas.width !== w || this.canvas.height !== h) {
      this.canvas.width = w;
      this.canvas.height = h;
    }
  }

  /** Draw the warped photo, then the 🎉 sticker on top when there is one. */
  draw(mesh: WarpMesh, layout: Layout, sticker?: StickerPose | null): void {
    const gl = this.gl;
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, this.canvas.width, this.canvas.height);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    this.paint(mesh, layout, this.canvas.clientWidth, this.canvas.clientHeight, false, sticker);
  }

  /**
   * Salvar foto / 📤: draw the warped photo (and sticker) offscreen at the photo's own
   * resolution, cropped to what's drawn, on white, and encode it as a JPEG.
   */
  exportJpeg(mesh: WarpMesh, sticker?: StickerPose | null, quality = 0.9): Promise<Blob | null> {
    const gl = this.gl;
    const box = drawnBounds(mesh.positions, sticker);
    const bw = box.maxX - box.minX;
    const bh = box.maxY - box.minY;
    const margin = 0.02 * Math.max(bw, bh);
    const limit = Math.min(
      EXPORT_MAX_SIDE,
      gl.getParameter(gl.MAX_RENDERBUFFER_SIZE) as number,
      ...(gl.getParameter(gl.MAX_VIEWPORT_DIMS) as Int32Array),
    );
    // Pixels per world unit: the photo's own, unless the result would be too big.
    const scale = Math.min(this.imageWidth, limit / (Math.max(bw, bh) + 2 * margin));
    const w = Math.max(1, Math.round((bw + 2 * margin) * scale));
    const h = Math.max(1, Math.round((bh + 2 * margin) * scale));
    const layout: Layout = {
      scale,
      offsetX: (margin - box.minX) * scale,
      offsetY: (margin - box.minY) * scale,
    };

    // Draw into a multisampled buffer (smooth edges), then resolve it to a plain one to read.
    const samples = Math.min(4, gl.getParameter(gl.MAX_SAMPLES) as number);
    const msaa = gl.createRenderbuffer()!;
    gl.bindRenderbuffer(gl.RENDERBUFFER, msaa);
    gl.renderbufferStorageMultisample(gl.RENDERBUFFER, samples, gl.RGBA8, w, h);
    const drawFb = gl.createFramebuffer()!;
    gl.bindFramebuffer(gl.FRAMEBUFFER, drawFb);
    gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.RENDERBUFFER, msaa);

    const plain = gl.createRenderbuffer()!;
    gl.bindRenderbuffer(gl.RENDERBUFFER, plain);
    gl.renderbufferStorage(gl.RENDERBUFFER, gl.RGBA8, w, h);
    const readFb = gl.createFramebuffer()!;
    gl.bindFramebuffer(gl.FRAMEBUFFER, readFb);
    gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.RENDERBUFFER, plain);

    gl.bindFramebuffer(gl.FRAMEBUFFER, drawFb);
    gl.viewport(0, 0, w, h);
    gl.clearColor(1, 1, 1, 1);
    gl.clear(gl.COLOR_BUFFER_BIT);
    this.paint(mesh, layout, w, h, true, sticker);

    gl.bindFramebuffer(gl.READ_FRAMEBUFFER, drawFb);
    gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, readFb);
    gl.blitFramebuffer(0, 0, w, h, 0, 0, w, h, gl.COLOR_BUFFER_BIT, gl.NEAREST);
    gl.bindFramebuffer(gl.FRAMEBUFFER, readFb);
    const pixels = new Uint8ClampedArray(w * h * 4);
    gl.readPixels(0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, pixels);

    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.deleteFramebuffer(drawFb);
    gl.deleteFramebuffer(readFb);
    gl.deleteRenderbuffer(msaa);
    gl.deleteRenderbuffer(plain);

    const out = document.createElement('canvas');
    out.width = w;
    out.height = h;
    out.getContext('2d')!.putImageData(new ImageData(pixels, w, h), 0, 0);
    return new Promise((resolve) => out.toBlob(resolve, 'image/jpeg', quality));
  }

  /**
   * Draw the mesh and sticker into the bound framebuffer. `w`/`h` is the size of the
   * layout's pixel space. `onWhite` (export): rows come out top-down for readPixels, and
   * the mesh blends over the opaque background so the result stays opaque.
   */
  private paint(
    mesh: WarpMesh,
    layout: Layout,
    w: number,
    h: number,
    onWhite: boolean,
    sticker?: StickerPose | null,
  ): void {
    const gl = this.gl;
    // World units -> layout pixels -> clip space (y flipped on screen).
    const flip = onWhite ? 1 : -1;
    const scale: [number, number] = [(2 * layout.scale) / w, (flip * 2 * layout.scale) / h];
    const offset: [number, number] = [(2 * layout.offsetX) / w - 1, -flip * (1 - (2 * layout.offsetY) / h)];

    gl.useProgram(this.program);
    gl.uniform2f(this.uScale, ...scale);
    gl.uniform2f(this.uOffset, ...offset);
    const lenses = mesh.lenses;
    gl.uniform1f(this.uAspect, mesh.aspect);
    gl.uniform1i(this.uLensCount, lenses.count);
    if (lenses.count) {
      gl.uniform4fv(this.uLens, lenses.shape);
      gl.uniform2fv(this.uLensPull, lenses.pull);
    }

    if (onWhite) this.blendOver();
    gl.bindVertexArray(this.vao);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.posBuffer);
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, mesh.positions);
    gl.bindTexture(gl.TEXTURE_2D, this.texture);
    gl.drawElements(gl.TRIANGLES, this.indexCount, gl.UNSIGNED_INT, 0);
    gl.bindVertexArray(null);
    gl.disable(gl.BLEND);

    if (sticker && sticker.w > 0) this.drawSticker(sticker, scale, offset);
  }

  /** Blend over what's drawn; alpha adds up so the sticker stays solid on the canvas. */
  private blendOver(): void {
    const gl = this.gl;
    gl.enable(gl.BLEND);
    gl.blendFuncSeparate(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA, gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
  }

  private drawSticker(pose: StickerPose, scale: [number, number], offset: [number, number]): void {
    const gl = this.gl;
    const st = this.sticker;
    gl.useProgram(st.program);
    gl.uniform2f(st.uScale, ...scale);
    gl.uniform2f(st.uOffset, ...offset);
    gl.uniform2f(st.uCenter, pose.x, pose.y);
    gl.uniform2f(st.uSize, pose.w, pose.h);
    gl.uniform1f(st.uAngle, pose.angle);
    this.blendOver();
    gl.bindVertexArray(st.vao);
    gl.bindTexture(gl.TEXTURE_2D, st.texture);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    gl.bindVertexArray(null);
    gl.disable(gl.BLEND);
  }
}

/** Longest side of a saved photo, in pixels. */
const EXPORT_MAX_SIDE = 4096;

/** The box (world units) around the warped photo and the sticker. */
function drawnBounds(positions: Float32Array, sticker?: StickerPose | null) {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  const add = (x: number, y: number) => {
    minX = Math.min(minX, x);
    maxX = Math.max(maxX, x);
    minY = Math.min(minY, y);
    maxY = Math.max(maxY, y);
  };
  for (let i = 0; i < positions.length; i += 2) add(positions[i], positions[i + 1]);
  if (sticker && sticker.w > 0) {
    const c = Math.cos(sticker.angle);
    const s = Math.sin(sticker.angle);
    for (const [cx, cy] of [[-0.5, -0.5], [0.5, -0.5], [-0.5, 0.5], [0.5, 0.5]]) {
      const px = cx * sticker.w;
      const py = cy * sticker.h;
      add(sticker.x + px * c - py * s, sticker.y + px * s + py * c);
    }
  }
  return { minX, minY, maxX, maxY };
}

function sourceWidth(image: TexImageSource): number {
  if (image instanceof HTMLVideoElement) return image.videoWidth;
  if (image instanceof HTMLImageElement) return image.naturalWidth;
  if (typeof VideoFrame !== 'undefined' && image instanceof VideoFrame) return image.displayWidth;
  return (image as { width: number }).width;
}

function createStickerProgram(gl: WebGL2RenderingContext): StickerGl {
  const program = createProgram(gl, STICKER_VERTEX, STICKER_FRAGMENT);
  const vao = gl.createVertexArray()!;
  const buffer = gl.createBuffer()!;
  gl.bindVertexArray(vao);
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-0.5, -0.5, 0.5, -0.5, -0.5, 0.5, 0.5, 0.5]), gl.STATIC_DRAW);
  bindAttribute(gl, program, 'aCorner', buffer);
  gl.bindVertexArray(null);

  const texture = gl.createTexture()!;
  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);

  const at = (name: string) => gl.getUniformLocation(program, name)!;
  return {
    program,
    vao,
    texture,
    uScale: at('uScale'),
    uOffset: at('uOffset'),
    uCenter: at('uCenter'),
    uSize: at('uSize'),
    uAngle: at('uAngle'),
  };
}

function bindAttribute(
  gl: WebGL2RenderingContext,
  program: WebGLProgram,
  name: string,
  buffer: WebGLBuffer,
): void {
  const loc = gl.getAttribLocation(program, name);
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.enableVertexAttribArray(loc);
  gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
}

function createProgram(gl: WebGL2RenderingContext, vs: string, fs: string): WebGLProgram {
  const program = gl.createProgram()!;
  gl.attachShader(program, compile(gl, gl.VERTEX_SHADER, vs));
  gl.attachShader(program, compile(gl, gl.FRAGMENT_SHADER, fs));
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    throw new Error(gl.getProgramInfoLog(program) ?? 'Shader link failed');
  }
  return program;
}

function compile(gl: WebGL2RenderingContext, type: number, source: string): WebGLShader {
  const shader = gl.createShader(type)!;
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    throw new Error(gl.getShaderInfoLog(shader) ?? 'Shader compile failed');
  }
  return shader;
}
