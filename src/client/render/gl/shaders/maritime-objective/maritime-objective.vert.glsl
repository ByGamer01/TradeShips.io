#version 300 es
precision highp float;

// Unit quad [0,1]
layout(location = 0) in vec2 aPos;
// Per-instance: centerX, centerY, quadRadius, kind
//   kind: 0 = zone fill disc, 1 = circle ring, 2 = flag marker
layout(location = 1) in vec4 aInstance;
// Per-instance: r, g, b, alpha
layout(location = 2) in vec4 aColor;

uniform mat3 uCamera;

out vec2 vLocal;       // [-1, +1] within the instance quad
flat out float vKind;
flat out vec4 vColor;

void main() {
  vec2 local = aPos * 2.0 - 1.0; // [-1, +1]
  vKind = aInstance.w;
  vColor = aColor;
  vLocal = local;

  vec2 worldPos = aInstance.xy + local * aInstance.z;
  vec3 clip = uCamera * vec3(worldPos, 1.0);
  gl_Position = vec4(clip.xy, 0.0, 1.0);
}
