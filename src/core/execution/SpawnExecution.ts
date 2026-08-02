import {
  Execution,
  Game,
  GameType,
  Player,
  PlayerInfo,
  PlayerType,
  SpawnArea,
} from "../game/Game";
import { TileRef } from "../game/GameMap";
import { PseudoRandom } from "../PseudoRandom";
import { GameID } from "../Schemas";
import { simpleHash } from "../Util";
import { PlayerExecution } from "./PlayerExecution";
import { TribeExecution } from "./TribeExecution";
import { getSpawnTiles } from "./Util";

type Spawn = { center: TileRef; tiles: TileRef[] };

export class SpawnExecution implements Execution {
  private random: PseudoRandom;
  active: boolean = true;
  private mg: Game;
  private static readonly MAX_SPAWN_TRIES = 1_000;
  private static readonly MAX_FRIEND_SPAWN_TRIES = 200;

  constructor(
    gameID: GameID,
    private playerInfo: PlayerInfo,
    public tile?: TileRef,
  ) {
    this.random = new PseudoRandom(
      simpleHash(playerInfo.id) + simpleHash(gameID),
    );
  }

  init(mg: Game, ticks: number) {
    this.mg = mg;
  }

  tick(ticks: number) {
    this.active = false;

    let player: Player | null = null;
    if (this.mg.hasPlayer(this.playerInfo.id)) {
      player = this.mg.player(this.playerInfo.id);
    } else {
      player = this.mg.addPlayer(this.playerInfo);
    }

    // Security: If random spawn is enabled, prevent players from re-rolling their spawn location
    if (this.mg.config().isRandomSpawn() && player.hasSpawned()) {
      return;
    }

    player.tiles().forEach((t) => player.relinquish(t));
    const spawn = this.getSpawn(this.tile);

    if (!spawn) {
      console.warn(`SpawnExecution: cannot spawn ${this.playerInfo.name}`);
      return;
    }

    spawn.tiles.forEach((t) => {
      player.conquer(t);
    });

    if (!player.hasSpawned()) {
      this.mg.addExecution(new PlayerExecution(player));
      if (player.type() === PlayerType.Bot) {
        this.mg.addExecution(new TribeExecution(player));
      }
    }

    player.setSpawnTile(spawn.center);

    if (
      this.mg.config().gameConfig().gameType === GameType.Singleplayer &&
      this.playerInfo.playerType === PlayerType.Human
    ) {
      // In singleplayer, spawn ends when player selects
      // a spawn location.
      this.mg.endSpawnPhase();
    }
  }

  isActive(): boolean {
    return this.active;
  }

  activeDuringSpawnPhase(): boolean {
    return true;
  }

  private getSpawn(center?: TileRef): Spawn | undefined {
    if (center !== undefined) {
      const tiles = getSpawnTiles(this.mg, center, false);

      if (!tiles.length) {
        return;
      }

      return { center, tiles };
    }

    const friendSpawn = this.getSpawnNearFriends();
    if (friendSpawn !== undefined) {
      return friendSpawn;
    }

    const spawnArea = this.getTeamSpawnArea();
    let tries = 0;

    while (tries < SpawnExecution.MAX_SPAWN_TRIES) {
      tries++;

      const center = this.randTile(spawnArea);
      const spawn = this.trySpawnCenter(center);
      if (spawn !== undefined) {
        return spawn;
      }
    }

    return;
  }

  /**
   * Friends (party members or accepted friends) spawn next to each other:
   * sample tiles inside a box around an already-spawned friend, keeping the
   * regular minimum-distance rule. Falls back to a fully random spawn when
   * nothing fits.
   */
  private getSpawnNearFriends(): Spawn | undefined {
    if (this.playerInfo.friends.length === 0) {
      return;
    }
    const friendIDs = new Set(this.playerInfo.friends);
    const anchors: TileRef[] = [];
    for (const player of this.mg.allPlayers()) {
      const clientID = player.clientID();
      const spawnTile = player.spawnTile();
      if (
        clientID !== null &&
        friendIDs.has(clientID) &&
        spawnTile !== undefined
      ) {
        anchors.push(spawnTile);
      }
    }
    if (anchors.length === 0) {
      return;
    }

    const radius = 2 * this.mg.config().minDistanceBetweenPlayers();
    for (let tries = 0; tries < SpawnExecution.MAX_FRIEND_SPAWN_TRIES; tries++) {
      const anchor = anchors[this.random.nextInt(0, anchors.length)];
      const x =
        this.mg.x(anchor) + this.random.nextInt(-radius, radius + 1);
      const y =
        this.mg.y(anchor) + this.random.nextInt(-radius, radius + 1);
      if (x < 0 || x >= this.mg.width() || y < 0 || y >= this.mg.height()) {
        continue;
      }
      const spawn = this.trySpawnCenter(this.mg.ref(x, y));
      if (spawn !== undefined) {
        return spawn;
      }
    }
    return;
  }

  /** Validate a candidate spawn center; returns the spawn when usable. */
  private trySpawnCenter(center: TileRef): Spawn | undefined {
    if (
      !this.mg.isLand(center) ||
      this.mg.hasOwner(center) ||
      this.mg.isBorder(center)
    ) {
      return;
    }

    const isOtherPlayerSpawnedNearby = this.mg
      .allPlayers()
      .filter((player) => player.id() !== this.playerInfo.id)
      .some((player) => {
        const spawnTile = player.spawnTile();

        if (spawnTile === undefined) {
          return false;
        }

        return (
          this.mg.manhattanDist(spawnTile, center) <
          this.mg.config().minDistanceBetweenPlayers()
        );
      });

    if (isOtherPlayerSpawnedNearby) {
      return;
    }

    const tiles = getSpawnTiles(this.mg, center, true);
    if (!tiles) {
      // if some of the spawn tile is outside of the land, we want to find another spawn tile
      return;
    }

    return { center, tiles };
  }

  private randTile(area?: SpawnArea): TileRef {
    if (area) {
      const x = this.random.nextInt(area.x, area.x + area.width);
      const y = this.random.nextInt(area.y, area.y + area.height);
      return this.mg.ref(x, y);
    }
    const x = this.random.nextInt(0, this.mg.width());
    const y = this.random.nextInt(0, this.mg.height());
    return this.mg.ref(x, y);
  }

  private getTeamSpawnArea(): SpawnArea | undefined {
    const player = this.mg.player(this.playerInfo.id);
    const team = player.team();
    if (team === null) {
      return undefined;
    }
    return this.mg.teamSpawnArea(team);
  }
}
