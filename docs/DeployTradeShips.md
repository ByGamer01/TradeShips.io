# Deploying TradeShips

State of the infrastructure inherited from OpenFront and what TradeShips still
needs before a public deployment. Companion docs: `Architecture.md` (CDN and
process model), `Auth.md` (JWT flow), `API.md` (endpoints the client calls).

## What already works

- **Docker image**: `Dockerfile` + `.dockerignore` build the full server.
- **Deploy pipeline**: `build-deploy.sh` → `build.sh` + `deploy.sh` push the
  image to GHCR and update a remote host over SSH (Hetzner-style layout with
  named hosts; adapt the host list in `deploy.sh` to your own servers).
- **Env template**: `example.env` (copy to `.env` / `.env.prod`).
- **CDN is optional**: with `CDN_BASE=""` all assets are served same-origin
  by the game server. A bucket + CDN in front only matters for scale.

## Runtime environment variables (server)

| Variable | Required | Notes |
| --- | --- | --- |
| `GAME_ENV` | yes | `prod` switches lobby timer to 2min (`ServerEnv.gameCreationRate`). |
| `NUM_WORKERS` | yes | Worker processes; throws at startup if unset. |
| `DOMAIN` | yes | Also the JWT audience; JWKS is fetched from `https://api.<DOMAIN>`. |
| `SUBDOMAIN` | yes | Instance name used by the master. |
| `GIT_COMMIT` | yes | Stamped into `/commit.txt`; deploy scripts set it. |
| `ADMIN_TOKEN` | yes | Admin endpoints guard; throws when read if unset. |
| `TURNSTILE_SITE_KEY` | yes | Cloudflare Turnstile (bot gate on join). |
| `API_KEY` | yes* | Sent to the closed API for `/users/@me`; useless until TradeShips has its own API. |
| `CDN_BASE` | no | Empty = same-origin assets. |
| `EXTERNAL_API_ENABLED` | no | Keep `false` for the public alpha without `api.<DOMAIN>`; set `true` only after the TradeShips API exists. |
| `OTEL_EXPORTER_OTLP_ENDPOINT` / `OTEL_AUTH_HEADER` | no | Telemetry, disabled in dev. |
| `ALLOWED_FLARES` | no | Restricts cosmetic flares. |

## Alpha mode without the external API

TradeShips can run publicly without the closed OpenFront API by keeping:

```env
EXTERNAL_API_ENABLED=false
CDN_BASE=
```

In this mode:

- anonymous `persistentId` tokens are accepted in prod;
- Turnstile validation is bypassed server-side;
- client auth refresh is skipped;
- archived game lookup returns "not found" without calling `api.<DOMAIN>`;
- matchmaking polling is skipped;
- deploy skips R2 asset upload and serves assets from the game container.

When accounts, stats, cosmetics, replays, matchmaking, JWKS, and asset upload
are needed, implement the endpoints in `docs/Auth.md`/`docs/API.md`, create
`api.<DOMAIN>`, then set `EXTERNAL_API_ENABLED=true`.

Client-side features that also point at the closed API and degrade to console
errors without it: login/account modal, news box, cosmetics, stats. They are
non-fatal (dev already runs without them).

## Pre-launch code checklist (test harness)

Documented in detail in the session memory `tradeships/test-harness-prod-checklist`:

- `src/server/MapPlaylist.ts:40,106,222-223` — forced 25M starting gold.
- `src/server/MasterLobbyService.ts:16-18` — single FFA lobby fed from the
  "special" playlist (upstream: ffa/team/special × 2 lobbies, config per type).
- `src/core/execution/WinCheckExecution.ts` — timeout winner still decided by
  territory on maritime maps instead of maritime control.
- `src/server/GamePreviewBuilder.ts:212` ("OpenFront Game" OG text) and
  `src/client/components/Footer.ts:33` (r/OpenFront link).
