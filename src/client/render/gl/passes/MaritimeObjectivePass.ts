/**
 * MaritimeObjectivePass — draws the maritime objective zone on the map.
 *
 * Team mode: a filled disc with a border ring around the central circle.
 * FFA mode: the trade-lane corridor as overlapping soft discs along the
 * spine (their accumulation forms a river-like gradient that peaks at the
 * corridor center). Both shapes get a waving flag marker at the objective
 * center so the capture point reads at a glance.
 *
 * Zone color follows objective status: neutral, contested, or held.
 */

import type { MaritimeObjectiveData } from "../../types";
import { DynamicInstanceBuffer } from "../DynamicBuffer";
import type { RenderSettings } from "../RenderSettings";
import { createProgram } from "../utils/GlUtils";

import fragSrc from "../shaders/maritime-objective/maritime-objective.frag.glsl?raw";
import vertSrc from "../shaders/maritime-objective/maritime-objective.vert.glsl?raw";

// Per-instance: centerX, centerY, quadRadius, kind, r, g, b, a
const FLOATS_PER_INSTANCE = 8;

const KIND_FILL = 0;
const KIND_RING = 1;
const KIND_FLAG = 2;

export class MaritimeObjectivePass {
  private gl: WebGL2RenderingContext;
  private settings: RenderSettings["maritimeObjective"];
  private mapW: number;

  private program: WebGLProgram;
  private vao: WebGLVertexArrayObject;
  private instanceBuf: DynamicInstanceBuffer;
  private instanceCount = 0;

  private uCamera: WebGLUniformLocation;
  private uTime: WebGLUniformLocation;
  private uRingWidth: WebGLUniformLocation;

  constructor(
    gl: WebGL2RenderingContext,
    settings: RenderSettings,
    mapW: number,
  ) {
    this.gl = gl;
    this.settings = settings.maritimeObjective;
    this.mapW = mapW;

    this.program = createProgram(gl, vertSrc, fragSrc);
    this.uCamera = gl.getUniformLocation(this.program, "uCamera")!;
    this.uTime = gl.getUniformLocation(this.program, "uTime")!;
    this.uRingWidth = gl.getUniformLocation(this.program, "uRingWidth")!;

    this.vao = gl.createVertexArray()!;
    gl.bindVertexArray(this.vao);

    // Attribute 0: unit quad [0,1] (two triangles)
    const quadBuf = gl.createBuffer()!;
    gl.bindBuffer(gl.ARRAY_BUFFER, quadBuf);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([0, 0, 1, 0, 0, 1, 1, 0, 1, 1, 0, 1]),
      gl.STATIC_DRAW,
    );
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);

    const glBuf = gl.createBuffer()!;
    this.instanceBuf = new DynamicInstanceBuffer(
      gl,
      glBuf,
      256,
      FLOATS_PER_INSTANCE,
    );
    gl.bindBuffer(gl.ARRAY_BUFFER, glBuf);
    const stride = FLOATS_PER_INSTANCE * 4;

    // Attribute 1: per-instance vec4 (x, y, radius, kind)
    gl.enableVertexAttribArray(1);
    gl.vertexAttribPointer(1, 4, gl.FLOAT, false, stride, 0);
    gl.vertexAttribDivisor(1, 1);

    // Attribute 2: per-instance vec4 (r, g, b, a)
    gl.enableVertexAttribArray(2);
    gl.vertexAttribPointer(2, 4, gl.FLOAT, false, stride, 16);
    gl.vertexAttribDivisor(2, 1);

    gl.bindVertexArray(null);
  }

  /** Replace the objective geometry. Called once per simulation tick. */
  update(objective: MaritimeObjectiveData | null): void {
    if (objective === null) {
      this.instanceCount = 0;
      return;
    }

    const s = this.settings;
    const [r, g, b] = this.statusColor(objective);
    const isLane = objective.shape === "lane";
    const spine = isLane ? (objective.path ?? []) : [];
    const laneRadius = objective.laneHalfWidth ?? objective.radius;

    const maxInstances = (isLane ? spine.length : 1) + 2;
    this.instanceBuf.ensureCapacity(maxInstances);
    const data = this.instanceBuf.float32;
    let count = 0;

    const write = (
      x: number,
      y: number,
      radius: number,
      kind: number,
      alpha: number,
    ) => {
      const off = count * FLOATS_PER_INSTANCE;
      data[off + 0] = x;
      data[off + 1] = y;
      data[off + 2] = radius;
      data[off + 3] = kind;
      data[off + 4] = r;
      data[off + 5] = g;
      data[off + 6] = b;
      data[off + 7] = alpha;
      count++;
    };

    const mapW = this.mapW;
    const coords = (tile: number): [number, number] => {
      const x = tile % mapW;
      return [x, (tile - x) / mapW];
    };

    if (isLane) {
      for (const tile of spine) {
        const [x, y] = coords(tile);
        write(x, y, laneRadius, KIND_FILL, s.laneFillAlpha);
      }
    } else {
      const [cx, cy] = coords(objective.center);
      write(cx, cy, objective.radius, KIND_FILL, s.circleFillAlpha);
      write(cx, cy, objective.radius, KIND_RING, s.ringAlpha);
    }

    const [fx, fy] = coords(objective.center);
    write(fx, fy, s.flagSize, KIND_FLAG, s.flagAlpha);

    this.instanceCount = count;

    const gl = this.gl;
    gl.bindBuffer(gl.ARRAY_BUFFER, this.instanceBuf.buffer);
    gl.bufferSubData(
      gl.ARRAY_BUFFER,
      0,
      this.instanceBuf.float32,
      0,
      count * FLOATS_PER_INSTANCE,
    );
  }

  private statusColor(
    objective: MaritimeObjectiveData,
  ): [number, number, number] {
    const s = this.settings;
    if (objective.status === "contested") {
      return [s.contestedR, s.contestedG, s.contestedB];
    }
    if (objective.controllerID !== 0 || objective.controllerTeam !== null) {
      return [s.heldR, s.heldG, s.heldB];
    }
    return [s.neutralR, s.neutralG, s.neutralB];
  }

  draw(cameraMatrix: Float32Array): void {
    if (this.instanceCount === 0) return;

    const gl = this.gl;
    gl.useProgram(this.program);
    gl.uniformMatrix3fv(this.uCamera, false, cameraMatrix);
    gl.uniform1f(this.uTime, performance.now() / 1000);
    gl.uniform1f(this.uRingWidth, this.settings.ringWidth);

    gl.bindVertexArray(this.vao);
    gl.drawArraysInstanced(gl.TRIANGLES, 0, 6, this.instanceCount);
    gl.bindVertexArray(null);
  }

  dispose(): void {
    const gl = this.gl;
    gl.deleteProgram(this.program);
    this.instanceBuf.dispose();
    gl.deleteVertexArray(this.vao);
  }
}
