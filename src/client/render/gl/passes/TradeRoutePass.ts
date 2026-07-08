/**
 * TradeRoutePass — draws the live trade network as animated dashed lines,
 * one segment per in-flight trade ship (ship position → destination port).
 *
 * Rendered as instanced screen-space quads: a static 4-vertex corner strip
 * expanded along each segment in the vertex shader, dashed and endpoint-faded
 * in the fragment shader. Dashes drift toward the destination port so routes
 * read as cargo flow. Base color encodes the owner's relation to the local
 * player (own / friendly / foreign); contested and dangerous routes blend
 * toward warning colors so raids on the network are visible at a glance.
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

  private uCamera: WebGLUniformLocation;
  private uPixelSize: WebGLUniformLocation;
  private uQuadHalfPx: WebGLUniformLocation;
  private uLineHalfPx: WebGLUniformLocation;
  private uDash: WebGLUniformLocation;
  private uFlowOffset: WebGLUniformLocation;
  private uEndFadePx: WebGLUniformLocation;

  private readonly startTime = performance.now();

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
    gl.bufferData(gl.ARRAY_BUFFER, this.instanceData.byteLength, gl.DYNAMIC_DRAW);
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

  /** Replace the route set. Called once per simulation tick. */
  update(routes: TradeRouteData[]): void {
    this.count = routes.length;
    if (this.count === 0) return;

    if (this.count > this.capacity) {
      while (this.capacity < this.count) this.capacity *= 2;
      this.instanceData = new Float32Array(
        this.capacity * FLOATS_PER_INSTANCE,
      );
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

  /** Resolve a route's rgba from relation base color + risk warning blend. */
  private writeColor(
    buf: Float32Array,
    idx: number,
    route: TradeRouteData,
  ): void {
    const s = this.settings.tradeRoute;

    let r: number, g: number, b: number, a: number;
    switch (route.relation) {
      case "own":
        r = s.ownR;
        g = s.ownG;
        b = s.ownB;
        a = s.ownAlpha;
        break;
      case "friendly":
        r = s.friendlyR;
        g = s.friendlyG;
        b = s.friendlyB;
        a = s.friendlyAlpha;
        break;
      default:
        r = s.foreignR;
        g = s.foreignG;
        b = s.foreignB;
        a = s.foreignAlpha;
        break;
    }

    if (route.riskLevel === "contested") {
      const t = s.contestedBlend;
      r += (s.contestedR - r) * t;
      g += (s.contestedG - g) * t;
      b += (s.contestedB - b) * t;
    } else if (route.riskLevel === "dangerous") {
      const t = s.dangerousBlend;
      r += (s.dangerousR - r) * t;
      g += (s.dangerousG - g) * t;
      b += (s.dangerousB - b) * t;
    }

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
    const elapsedSec = (performance.now() - this.startTime) / 1000;

    gl.useProgram(this.program);
    gl.uniformMatrix3fv(this.uCamera, false, cameraMatrix);
    gl.uniform1f(this.uPixelSize, pixelSize);
    gl.uniform1f(this.uQuadHalfPx, quadHalfPx);
    gl.uniform1f(this.uLineHalfPx, lineHalfPx);
    gl.uniform2f(this.uDash, s.dashLen, s.gapLen);
    gl.uniform1f(this.uFlowOffset, elapsedSec * s.flowSpeed);
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
