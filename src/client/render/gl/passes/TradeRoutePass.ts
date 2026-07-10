/**
 * TradeRoutePass — draws system ocean lanes as dashed lines.
 *
 * Rendered as instanced screen-space quads: a static 4-vertex corner strip
 * expanded along each segment in the vertex shader, dashed and endpoint-faded
 * in the fragment shader. Dashes are intentionally static: these are neutral
 * sea lanes to capture, not per-ship destination arrows. They intentionally
 * do not use player colors: player-colored strips make merchant traffic read
 * like old territorial conquest. Contested and dangerous routes still tint
 * toward warning colors so naval fights are visible at a glance.
 */

import type { TradeRouteData } from "../../types";
import type { RenderSettings } from "../RenderSettings";
import { createProgram } from "../utils/GlUtils";

import fragSrc from "../shaders/trade-route/trade-route.frag.glsl?raw";
import vertSrc from "../shaders/trade-route/trade-route.vert.glsl?raw";

// Per-instance layout: p1(x,y) p2(x,y) color(r,g,b,a)
const FLOATS_PER_INSTANCE = 8;
const BYTES_PER_INSTANCE = FLOATS_PER_INSTANCE * 4;
const INITIAL_CAPACITY = 256;

/**
 * Resolve a route's rgba using neutral sea-lane colors only. The palette arg
 * is intentionally ignored; trade routes must not inherit player colors.
 */
export function resolveTradeRouteColor(
  route: TradeRouteData,
  _paletteData: Float32Array | null,
  settings: RenderSettings["tradeRoute"],
): [number, number, number, number] {
  let r = settings.foreignR;
  let g = settings.foreignG;
  let b = settings.foreignB;
  const systemLane = route.shipId < 0;
  const a = Math.min(
    1,
    settings.foreignAlpha *
      (systemLane ? 1.35 : route.ownerID > 0 ? 0.9 : 0.65),
  );

  if (route.riskLevel === "contested") {
    const t = settings.contestedBlend;
    r += (settings.contestedR - r) * t;
    g += (settings.contestedG - g) * t;
    b += (settings.contestedB - b) * t;
  } else if (route.riskLevel === "dangerous") {
    const t = settings.dangerousBlend;
    r += (settings.dangerousR - r) * t;
    g += (settings.dangerousG - g) * t;
    b += (settings.dangerousB - b) * t;
  }

  return [r, g, b, a];
}

export class TradeRoutePass {
  private gl: WebGL2RenderingContext;
  private settings: RenderSettings;
  private mapW: number;

  private program: WebGLProgram;
  private vao: WebGLVertexArrayObject;
  private instanceBuf: WebGLBuffer;
  private instanceData: Float32Array;
  private capacity = INITIAL_CAPACITY;
  private count = 0;
  private paletteData: Float32Array | null = null;

  private uCamera: WebGLUniformLocation;
  private uPixelSize: WebGLUniformLocation;
  private uQuadHalfPx: WebGLUniformLocation;
  private uLineHalfPx: WebGLUniformLocation;
  private uDash: WebGLUniformLocation;
  private uFlowOffset: WebGLUniformLocation;
  private uEndFadePx: WebGLUniformLocation;

  constructor(
    gl: WebGL2RenderingContext,
    settings: RenderSettings,
    mapW: number,
  ) {
    this.gl = gl;
    this.settings = settings;
    this.mapW = mapW;

    this.program = createProgram(gl, vertSrc, fragSrc);
    this.uCamera = gl.getUniformLocation(this.program, "uCamera")!;
    this.uPixelSize = gl.getUniformLocation(this.program, "uPixelSize")!;
    this.uQuadHalfPx = gl.getUniformLocation(this.program, "uQuadHalfPx")!;
    this.uLineHalfPx = gl.getUniformLocation(this.program, "uLineHalfPx")!;
    this.uDash = gl.getUniformLocation(this.program, "uDash")!;
    this.uFlowOffset = gl.getUniformLocation(this.program, "uFlowOffset")!;
    this.uEndFadePx = gl.getUniformLocation(this.program, "uEndFadePx")!;

    this.instanceData = new Float32Array(this.capacity * FLOATS_PER_INSTANCE);

    this.vao = gl.createVertexArray()!;
    gl.bindVertexArray(this.vao);

    // Static quad corners: (t along segment, side across width) as a strip.
    const cornerBuf = gl.createBuffer()!;
    gl.bindBuffer(gl.ARRAY_BUFFER, cornerBuf);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([0, -1, 1, -1, 0, 1, 1, 1]),
      gl.STATIC_DRAW,
    );
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);

    // Per-instance segment + color attributes.
    this.instanceBuf = gl.createBuffer()!;
    gl.bindBuffer(gl.ARRAY_BUFFER, this.instanceBuf);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      this.instanceData.byteLength,
      gl.DYNAMIC_DRAW,
    );
    gl.enableVertexAttribArray(1);
    gl.vertexAttribPointer(1, 2, gl.FLOAT, false, BYTES_PER_INSTANCE, 0);
    gl.vertexAttribDivisor(1, 1);
    gl.enableVertexAttribArray(2);
    gl.vertexAttribPointer(2, 2, gl.FLOAT, false, BYTES_PER_INSTANCE, 8);
    gl.vertexAttribDivisor(2, 1);
    gl.enableVertexAttribArray(3);
    gl.vertexAttribPointer(3, 4, gl.FLOAT, false, BYTES_PER_INSTANCE, 16);
    gl.vertexAttribDivisor(3, 1);

    gl.bindVertexArray(null);
  }

  /** Share the renderer's player-color palette (rgba fill, indexed by ownerID). */
  setPaletteData(data: Float32Array): void {
    this.paletteData = data;
  }

  /** Replace the route set. Called once per simulation tick. */
  update(routes: TradeRouteData[]): void {
    this.count = routes.length;
    if (this.count === 0) return;

    if (this.count > this.capacity) {
      while (this.capacity < this.count) this.capacity *= 2;
      this.instanceData = new Float32Array(this.capacity * FLOATS_PER_INSTANCE);
      const gl = this.gl;
      gl.bindBuffer(gl.ARRAY_BUFFER, this.instanceBuf);
      gl.bufferData(
        gl.ARRAY_BUFFER,
        this.instanceData.byteLength,
        gl.DYNAMIC_DRAW,
      );
    }

    const buf = this.instanceData;
    const mapW = this.mapW;
    for (let i = 0; i < routes.length; i++) {
      const r = routes[i];
      const fromX = r.from % mapW;
      const toX = r.to % mapW;
      const idx = i * FLOATS_PER_INSTANCE;
      buf[idx + 0] = fromX;
      buf[idx + 1] = (r.from - fromX) / mapW;
      buf[idx + 2] = toX;
      buf[idx + 3] = (r.to - toX) / mapW;
      this.writeColor(buf, idx + 4, r);
    }

    const gl = this.gl;
    gl.bindBuffer(gl.ARRAY_BUFFER, this.instanceBuf);
    gl.bufferSubData(
      gl.ARRAY_BUFFER,
      0,
      buf.subarray(0, this.count * FLOATS_PER_INSTANCE),
    );
  }

  /** Write a route's rgba (owner palette color + risk warning blend) into the instance buffer. */
  private writeColor(
    buf: Float32Array,
    idx: number,
    route: TradeRouteData,
  ): void {
    const [r, g, b, a] = resolveTradeRouteColor(
      route,
      this.paletteData,
      this.settings.tradeRoute,
    );
    buf[idx + 0] = r;
    buf[idx + 1] = g;
    buf[idx + 2] = b;
    buf[idx + 3] = a;
  }

  draw(cameraMatrix: Float32Array): void {
    if (this.count === 0) return;

    const gl = this.gl;
    const s = this.settings.tradeRoute;
    const pixelSize = 2.0 / (cameraMatrix[0] * gl.drawingBufferWidth);

    const lineHalfPx = s.lineWidth / 2;
    const quadHalfPx = lineHalfPx + 1.0; // AA padding
    gl.useProgram(this.program);
    gl.uniformMatrix3fv(this.uCamera, false, cameraMatrix);
    gl.uniform1f(this.uPixelSize, pixelSize);
    gl.uniform1f(this.uQuadHalfPx, quadHalfPx);
    gl.uniform1f(this.uLineHalfPx, lineHalfPx);
    gl.uniform2f(this.uDash, s.dashLen, s.gapLen);
    gl.uniform1f(this.uFlowOffset, 0);
    gl.uniform1f(this.uEndFadePx, s.endFade);

    gl.bindVertexArray(this.vao);
    gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, this.count);
    gl.bindVertexArray(null);
  }

  dispose(): void {
    const gl = this.gl;
    gl.deleteProgram(this.program);
    gl.deleteVertexArray(this.vao);
    gl.deleteBuffer(this.instanceBuf);
  }
}
