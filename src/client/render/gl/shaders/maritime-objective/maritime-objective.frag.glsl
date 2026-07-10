#version 300 es
precision highp float;

in vec2 vLocal;       // [-1, +1] within the instance quad
flat in float vKind;
flat in vec4 vColor;

uniform float uTime;      // seconds — flag wave + zone pulse
uniform float uRingWidth; // ring band width as fraction of radius

out vec4 fragColor;

const float KIND_FILL = 0.0;
const float KIND_RING = 1.0;
const float KIND_FLAG = 2.0;

void main() {
  float dist = length(vLocal);
  float alpha = 0.0;
  vec3 rgb = vColor.rgb;

  if (vKind < 0.5) {
    // Zone fill: soft radial falloff; overlapping spine discs accumulate
    // into a gradient that peaks along the corridor center.
    float pulse = 0.85 + 0.15 * sin(uTime * 1.6);
    alpha = vColor.a * pulse * smoothstep(1.0, 0.55, dist);
  } else if (vKind < 1.5) {
    // Circle border ring with a soft edge on both sides.
    float outer = smoothstep(1.0, 1.0 - uRingWidth * 0.5, dist);
    float inner = smoothstep(1.0 - uRingWidth * 1.5, 1.0 - uRingWidth, dist);
    alpha = vColor.a * outer * inner;
  } else {
    // Flag marker: pole + waving pennant, drawn as SDF in quad space.
    // y grows downward in world space; the pole base sits at the bottom.
    vec2 p = vLocal;

    // Pole: thin vertical bar on the left side.
    float pole = (1.0 - smoothstep(0.05, 0.10, abs(p.x + 0.45))) *
      step(abs(p.y), 0.95);

    // Pennant: tapered banner attached to the pole top, waving with time.
    float t = clamp((p.x + 0.38) / 1.25, 0.0, 1.0);
    float wave = sin(uTime * 4.0 + t * 5.0) * 0.08 * t;
    float halfHeight = mix(0.28, 0.03, t);
    float centerY = -0.55 + wave;
    float pennant = step(p.x, 0.9) * step(-0.38, p.x) *
      (1.0 - smoothstep(halfHeight - 0.04, halfHeight + 0.04, abs(p.y - centerY)));

    float shape = max(pole, pennant);
    // Pole renders light gray; pennant keeps the status color.
    rgb = mix(vec3(0.92), vColor.rgb, step(pole, pennant) );
    alpha = vColor.a * shape;
  }

  // Pipeline blends straight alpha (SRC_ALPHA, ONE_MINUS_SRC_ALPHA).
  fragColor = vec4(rgb, alpha);
}
