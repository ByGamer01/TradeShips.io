# Maritime Conquest MVP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the first playable identity shift from land conquest to maritime control: visible system sea lanes plus a central sea-zone objective.

**Architecture:** Keep simulation state separate from rendering. The first slice uses client-derived route/zone control for UX validation, then a server-authoritative objective can replace it without changing the renderer contract. Existing trade-route rendering is repurposed from per-ship destination arrows into static sea lanes.

**Tech Stack:** TypeScript, Vitest, WebGL renderer, existing FrameData/GameView pipeline.

---

### Task 1: Convert live trade destination overlay into static ocean lanes

**Files:**
- Modify: `src/client/render/frame/derive/TradeRoutes.ts`
- Modify: `src/client/render/types/Renderer.ts`
- Modify: `src/client/render/gl/passes/TradeRoutePass.ts`
- Test: `tests/client/render/frame/derive/trade-routes.test.ts`

- [ ] Add failing tests proving routes can exist without trade ships, can be controlled by one fleet, and become contested with rival fleets.
- [ ] Implement deterministic water-majority sea-lane generation from map geometry.
- [ ] Remove directional dash motion so lanes do not read as “this ship is going there”.
- [ ] Keep old API behavior when no ocean-route options are passed, so older trade ledger tests remain stable.

### Task 2: Add central maritime objective data

**Files:**
- Create: `src/client/render/frame/derive/MaritimeObjective.ts`
- Modify: `src/client/render/types/Renderer.ts`
- Modify: `src/client/render/types/FrameData.ts`
- Modify: `src/client/view/GameView.ts`
- Test: `tests/client/render/frame/derive/maritime-objective.test.ts`

- [ ] Add failing tests for neutral, capturing, contested, and controlled states.
- [ ] Compute a central water zone from map dimensions and nearest water tiles.
- [ ] Compute naval power from fleet units inside the zone.
- [ ] Produce concise FrameData for HUD/rendering.

### Task 3: Minimal HUD language for Maritime Conquest

**Files:**
- Modify: `src/client/hud/layers/UnitDisplay.ts` or create `src/client/hud/layers/MaritimeObjectivePanel.ts`
- Modify: `resources/lang/en.json`
- Test: existing HUD render tests or a new focused HUD test.

- [ ] Show “Control the central sea route to win.”
- [ ] Show objective name, leading fleet, control percent, and contested state.
- [ ] Keep text short; do not cover the playfield.

### Task 4: Verification

**Commands:**
- `npx vitest run tests/client/render/frame/derive/trade-routes.test.ts tests/client/render/frame/derive/maritime-objective.test.ts`
- `npx tsc --noEmit`

**Constraint:** Do not run build.
