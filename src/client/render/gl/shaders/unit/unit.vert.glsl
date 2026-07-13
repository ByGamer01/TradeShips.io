#version 300 es
precision highp float;

layout(location = 0) in vec2 aPos;

// Per-instance attributes
layout(location = 1) in vec3 aInstPos;   // x, y, ownerID
layout(location = 2) in vec3 aInstFlags; // atlasIdx, flags, flickerHash (uint8→float)

uniform mat3  uCamera;

uniform float uUnitSize;
uniform float uHBombGlowScale; // quad enlargement for the hydrogen bomb glow halo

out vec2  vQuadPos;     // quad coords [0,1] — drives the radial glow falloff
out vec2  vCellUV;      // sprite cell coords; the central 1/scale region is the sprite
flat out float vAtlasCol;
flat out float vOwnerID;
flat out float vFlags;  // 0.0 = normal, 1.0 = flicker, 2.0 = angry
flat out float vHash;   // per-instance hash for flicker phase offset
flat out float vGlow;   // 1.0 if this instance is a hydrogen bomb (draw glow), else 0.0

void main() {
  float worldX = aInstPos.x;
  float worldY = aInstPos.y;
  vOwnerID = aInstPos.z;

  float atlasCol = aInstFlags.x;
  vFlags = aInstFlags.y;
  vAtlasCol = atlasCol;

  // Per-instance hash so each unit flickers independently. Computed CPU-side
  // from the tick position — hashing worldX/Y here would re-roll the phase
  // every frame for nukes whose position is smoothed per frame.
  vHash = aInstFlags.z * (1.0 / 255.0);

  // Hydrogen bombs render an enlarged quad so there's room for a glow halo.
  // New naval units render larger than legacy boats so silhouettes stay
  // readable in the bottom HUD and at tactical zoom.
  float isHBomb = step(abs(atlasCol - float(HYDROGEN_BOMB_COL)), 0.5);
  float isNewNaval = max(
    max(
      step(abs(atlasCol - float(NAVAL_MINE_COL)), 0.5),
      max(step(abs(atlasCol - float(SUBMARINE_COL)), 0.5),
          step(abs(atlasCol - float(CARRIER_COL)), 0.5))
    ),
    max(step(abs(atlasCol - float(AIRCRAFT_COL)), 0.5),
        step(abs(atlasCol - float(ANTI_AIR_FRIGATE_COL)), 0.5))
  );
  // Shells and torpedoes are munitions, not hulls: render them well below
  // ship size so gunfire reads as tracer fire instead of flying boats.
  float isProjectile = max(
    step(abs(atlasCol - float(SHELL_COL)), 0.5),
    step(abs(atlasCol - float(TORPEDO_COL)), 0.5)
  );
  vGlow = isHBomb;
  float quadScale = mix(1.0, 1.22, isNewNaval);
  quadScale = mix(quadScale, 0.65, isProjectile);
  quadScale = mix(quadScale, uHBombGlowScale, isHBomb);

  // UNIT_SIZE is in world-space tiles — no zoom division needed.
  // Units scale with the map like territory tiles do.
  float halfSize = uUnitSize * 0.5 * quadScale;

  vec2 center = vec2(worldX + 0.5, worldY + 0.5);
  vec2 worldPos = center + (aPos - 0.5) * halfSize * 2.0;

  vec3 clip = uCamera * vec3(worldPos, 1.0);
  gl_Position = vec4(clip.xy, 0.0, 1.0);

  vQuadPos = aPos;

  // Hydrogen bombs keep the original sprite size inside the larger glow quad.
  // Enlarged naval sprites instead sample the full cell over the larger quad.
  float spriteUvScale = mix(1.0, quadScale, isHBomb);
  vCellUV = (aPos - 0.5) * spriteUvScale + 0.5;
}
