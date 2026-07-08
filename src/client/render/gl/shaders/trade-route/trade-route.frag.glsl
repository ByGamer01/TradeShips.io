#version 300 es
precision highp float;

in float vDistPx;   // distance along segment (pixels)
in float vSegLenPx; // total segment length (pixels)
in float vEdge;     // -1..+1 across the line width
in vec4 vColor;     // route color (rgb) + base alpha

uniform float uQuadHalfPx; // total half-width of quad in pixels
uniform float uLineHalfPx; // line half-width in pixels
uniform vec2 uDash;        // (dashLen, gapLen) in pixels
uniform float uFlowOffset; // dash phase offset in pixels (animates flow)
uniform float uEndFadePx;  // fade-in/out length at segment endpoints

out vec4 fragColor;

void main() {
  // Animated dash pattern. Subtracting the offset drifts the dashes toward
  // the destination port, reading as cargo flowing along the route.
  float period = uDash.x + uDash.y;
  float phase = mod(vDistPx - uFlowOffset, period);
  float dashAlpha = 1.0 - smoothstep(uDash.x - 0.75, uDash.x + 0.75, phase);
  if (dashAlpha < 0.01) discard;

  // Soft anti-aliased line edge.
  float d = abs(vEdge) * uQuadHalfPx;
  float lineAlpha = 1.0 - smoothstep(uLineHalfPx - 0.6, uLineHalfPx + 0.6, d);
  if (lineAlpha < 0.01) discard;

  // Fade near both endpoints so routes don't stab through ship and port
  // sprites.
  float endAlpha = smoothstep(0.0, uEndFadePx, vDistPx) *
    (1.0 - smoothstep(vSegLenPx - uEndFadePx, vSegLenPx, vDistPx));

  fragColor = vec4(vColor.rgb, vColor.a * dashAlpha * lineAlpha * endAlpha);
}
