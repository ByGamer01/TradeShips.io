#version 300 es
precision highp float;

// Static quad corner: (t along segment: 0 or 1, side: -1 or +1)
layout(location = 0) in vec2 aCorner;
// Per-instance segment endpoints (world-space tile coordinates)
layout(location = 1) in vec2 aP1; // ship position
layout(location = 2) in vec2 aP2; // destination port
// Per-instance premultiplied route color (rgb) + base alpha
layout(location = 3) in vec4 aColor;

uniform mat3 uCamera;
uniform float uPixelSize;  // world units per pixel
uniform float uQuadHalfPx; // half-width of quad in pixels

out float vDistPx;   // distance along segment (pixels)
out float vSegLenPx; // total segment length (pixels)
out float vEdge;     // -1..+1 across the line width
out vec4 vColor;

void main() {
  float t = aCorner.x;
  float side = aCorner.y;

  vec2 dir = aP2 - aP1;
  float segLen = length(dir);
  vec2 normDir = segLen > 0.001 ? dir / segLen : vec2(1.0, 0.0);
  vec2 perp = vec2(-normDir.y, normDir.x);

  float halfWidth = uQuadHalfPx * uPixelSize;
  vec2 pos = mix(aP1, aP2, t) + perp * side * halfWidth;
  pos += 0.5; // tile center offset

  vDistPx = t * segLen / uPixelSize;
  vSegLenPx = segLen / uPixelSize;
  vEdge = side;
  vColor = aColor;

  vec3 clip = uCamera * vec3(pos, 1.0);
  gl_Position = vec4(clip.xy, 0.0, 1.0);
}
