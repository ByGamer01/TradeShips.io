import cluster from "cluster";
import crypto from "crypto";
import express from "express";
import rateLimit from "express-rate-limit";
import http from "http";
import path from "path";
import { fileURLToPath } from "url";
import { z } from "zod";
import { GameEnv } from "../core/configuration/Config";
import { GAME_ID_REGEX } from "../core/Schemas";
import { logger } from "./Logger";
import { MapPlaylist } from "./MapPlaylist";
import { MasterLobbyService } from "./MasterLobbyService";
import { setNoStoreHeaders } from "./NoStoreHeaders";
import { PARTY_ID_REGEX, PartyRegistry } from "./PartyRegistry";
import { renderAppShell } from "./RenderHtml";
import { ServerEnv } from "./ServerEnv";
import { applyStaticAssetCacheControl } from "./StaticAssetCache";

const playlist = new MapPlaylist();
let lobbyService: MasterLobbyService;

const app = express();
const server = http.createServer(app);

const log = logger.child({ comp: "m" });

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

app.use(express.json());

// Serve the shared app shell for the root document.
app.use(async (req, res, next) => {
  if (req.path === "/") {
    try {
      await renderAppShell(
        res,
        path.join(__dirname, "../../static/index.html"),
      );
    } catch (error) {
      log.error("Error rendering index.html:", error);
      res.status(500).send("Internal Server Error");
    }
  } else {
    next();
  }
});

app.use(
  express.static(path.join(__dirname, "../../static"), {
    maxAge: "1y", // Set max-age to 1 year for all static assets
    setHeaders: (res) => {
      applyStaticAssetCacheControl(
        res.setHeader.bind(res),
        res.req.originalUrl,
      );
    },
  }),
);

app.set("trust proxy", 3);
app.use(
  rateLimit({
    windowMs: 1000, // 1 second
    max: 20, // 20 requests per IP per second
  }),
);

app.use("/api", (_req, res, next) => {
  setNoStoreHeaders(res);
  next();
});

// Start the master process
export async function startMaster() {
  if (!cluster.isPrimary) {
    throw new Error(
      "startMaster() should only be called in the primary process",
    );
  }

  log.info(`Primary ${process.pid} is running`);
  log.info(`Setting up ${ServerEnv.numWorkers()} workers...`);

  lobbyService = new MasterLobbyService(playlist, log);

  // Generate admin token for worker authentication
  const ADMIN_TOKEN = crypto.randomBytes(16).toString("hex");
  process.env.ADMIN_TOKEN = ADMIN_TOKEN;

  const INSTANCE_ID =
    ServerEnv.env() === GameEnv.Dev
      ? "DEV_ID"
      : crypto.randomBytes(4).toString("hex");
  process.env.INSTANCE_ID = INSTANCE_ID;

  log.info(`Instance ID: ${INSTANCE_ID}`);

  // Fork workers
  for (let i = 0; i < ServerEnv.numWorkers(); i++) {
    const worker = cluster.fork({
      WORKER_ID: i,
      ADMIN_TOKEN,
      INSTANCE_ID,
    });

    lobbyService.registerWorker(i, worker);
    log.info(`Started worker ${i} (PID: ${worker.process.pid})`);
  }

  // Handle worker crashes
  cluster.on("exit", (worker, code, signal) => {
    const workerId = (worker as any).process?.env?.WORKER_ID;
    if (workerId === undefined) {
      log.error(`worker crashed could not find id`);
      return;
    }

    const workerIdNum = parseInt(workerId);
    lobbyService.removeWorker(workerIdNum);

    log.warn(
      `Worker ${workerId} (PID: ${worker.process.pid}) died with code: ${code} and signal: ${signal}`,
    );
    log.info(`Restarting worker ${workerId}...`);

    // Restart the worker with the same ID
    const newWorker = cluster.fork({
      WORKER_ID: workerId,
      ADMIN_TOKEN,
      INSTANCE_ID,
    });

    lobbyService.registerWorker(workerIdNum, newWorker);
    log.info(
      `Restarted worker ${workerId} (New PID: ${newWorker.process.pid})`,
    );
  });

  const PORT = 3000;
  server.listen(PORT, () => {
    log.info(`Master HTTP server listening on port ${PORT}`);
  });
}

app.get("/api/health", (_req, res) => {
  const ready = lobbyService?.isHealthy() ?? false;
  if (ready) {
    res.json({ status: "ok" });
  } else {
    res.status(503).json({ status: "unavailable" });
  }
});

//
// Squad-queue parties (rendezvous for friends joining public lobbies together)
//

const partyRegistry = new PartyRegistry();
setInterval(() => partyRegistry.sweep(), 60_000).unref();

const PartyNameSchema = z.string().min(1).max(64);
const PartyCreateBodySchema = z.object({ name: PartyNameSchema });
const PartyJoinBodySchema = z.object({ name: PartyNameSchema });
const PartyMemberBodySchema = z.object({ memberId: z.string().max(64) });
const PartyTargetBodySchema = z.object({
  memberId: z.string().max(64),
  gameID: z.string().regex(GAME_ID_REGEX),
});

function parsePartyId(raw: string): string | null {
  return PARTY_ID_REGEX.test(raw) ? raw : null;
}

app.post("/api/party", (req, res) => {
  const body = PartyCreateBodySchema.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: "invalid_body" });
    return;
  }
  const created = partyRegistry.create(body.data.name);
  if (created === null) {
    res.status(503).json({ error: "party_capacity" });
    return;
  }
  res.json(created);
});

app.get("/api/party/:id", (req, res) => {
  const partyId = parsePartyId(req.params.id);
  const info = partyId === null ? null : partyRegistry.get(partyId);
  if (partyId === null || info === null) {
    res.status(404).json({ error: "not_found" });
    return;
  }
  // With a memberId the caller learns its own role (leader promotion after
  // the original leader leaves is only knowable server-side).
  const memberId = req.query.memberId;
  const youAreLeader =
    typeof memberId === "string"
      ? partyRegistry.isLeader(partyId, memberId)
      : undefined;
  res.json({ ...info, youAreLeader });
});

app.post("/api/party/:id/join", (req, res) => {
  const partyId = parsePartyId(req.params.id);
  const body = PartyJoinBodySchema.safeParse(req.body);
  if (partyId === null || !body.success) {
    res.status(400).json({ error: "invalid_body" });
    return;
  }
  const result = partyRegistry.join(partyId, body.data.name);
  switch (result.status) {
    case "ok":
      res.json({ memberId: result.memberId });
      return;
    case "full":
      res.status(409).json({ error: "party_full" });
      return;
    case "not_found":
      res.status(404).json({ error: "not_found" });
      return;
  }
});

app.post("/api/party/:id/leave", (req, res) => {
  const partyId = parsePartyId(req.params.id);
  const body = PartyMemberBodySchema.safeParse(req.body);
  if (partyId === null || !body.success) {
    res.status(400).json({ error: "invalid_body" });
    return;
  }
  partyRegistry.leave(partyId, body.data.memberId);
  res.json({ ok: true });
});

app.post("/api/party/:id/target", (req, res) => {
  const partyId = parsePartyId(req.params.id);
  const body = PartyTargetBodySchema.safeParse(req.body);
  if (partyId === null || !body.success) {
    res.status(400).json({ error: "invalid_body" });
    return;
  }
  const ok = partyRegistry.setTarget(
    partyId,
    body.data.memberId,
    body.data.gameID,
  );
  if (!ok) {
    res.status(403).json({ error: "not_leader" });
    return;
  }
  res.json({ ok: true });
});

// SPA fallback route
app.get("/{*splat}", async function (_req, res) {
  try {
    const htmlPath = path.join(__dirname, "../../static/index.html");
    await renderAppShell(res, htmlPath);
  } catch (error) {
    log.error("Error rendering SPA fallback:", error);
    res.status(500).send("Internal Server Error");
  }
});
