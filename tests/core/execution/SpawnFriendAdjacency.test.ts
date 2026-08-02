import { SpawnExecution } from "../../../src/core/execution/SpawnExecution";
import { PlayerInfo, PlayerType } from "../../../src/core/game/Game";
import { setup } from "../../util/Setup";

function human(
  name: string,
  friends: string[] = [],
): PlayerInfo {
  return new PlayerInfo(
    name,
    PlayerType.Human,
    `client_${name}`,
    `player_${name}`,
    false,
    null,
    friends,
  );
}

describe("Friend-adjacent random spawns", () => {
  test("a player spawns near an already-spawned friend", async () => {
    const alice = human("alice");
    const bob = human("bob", ["client_alice"]);
    const game = await setup("world", {}, [alice, bob]);

    game.addExecution(new SpawnExecution("game_id", alice));
    game.addExecution(new SpawnExecution("game_id", bob));
    game.executeNextTick();
    game.executeNextTick();

    const aliceTile = game.playerByClientID("client_alice")?.spawnTile();
    const bobTile = game.playerByClientID("client_bob")?.spawnTile();
    expect(aliceTile).toBeDefined();
    expect(bobTile).toBeDefined();

    const distance = game.manhattanDist(aliceTile!, bobTile!);
    const minDistance = game.config().minDistanceBetweenPlayers();
    // Still respects the minimum separation...
    expect(distance).toBeGreaterThanOrEqual(minDistance);
    // ...but lands inside the adjacency box around the friend
    // (box half-width 2 * minDistance per axis → Manhattan ≤ 4x).
    expect(distance).toBeLessThanOrEqual(4 * minDistance);
  });

  test("a whole party clusters around the first spawned member", async () => {
    const alice = human("alice");
    const bob = human("bob", ["client_alice", "client_carol"]);
    const carol = human("carol", ["client_alice", "client_bob"]);
    const game = await setup("world", {}, [alice, bob, carol]);

    game.addExecution(new SpawnExecution("game_id", alice));
    game.addExecution(new SpawnExecution("game_id", bob));
    game.addExecution(new SpawnExecution("game_id", carol));
    game.executeNextTick();
    game.executeNextTick();

    const tiles = ["client_alice", "client_bob", "client_carol"].map(
      (id) => game.playerByClientID(id)?.spawnTile(),
    );
    for (const tile of tiles) {
      expect(tile).toBeDefined();
    }

    const minDistance = game.config().minDistanceBetweenPlayers();
    for (let i = 0; i < tiles.length; i++) {
      for (let j = i + 1; j < tiles.length; j++) {
        const distance = game.manhattanDist(tiles[i]!, tiles[j]!);
        expect(distance).toBeGreaterThanOrEqual(minDistance);
        // Every pair is at most two adjacency hops apart.
        expect(distance).toBeLessThanOrEqual(8 * minDistance);
      }
    }
  });

  test("falls back to a normal random spawn when no friend has spawned", async () => {
    const alice = human("alice", ["client_ghost"]); // friend not in game
    const game = await setup("world", {}, [alice]);

    game.addExecution(new SpawnExecution("game_id", alice));
    game.executeNextTick();
    game.executeNextTick();

    const tile = game.playerByClientID("client_alice")?.spawnTile();
    expect(tile).toBeDefined();
    expect(game.isLand(tile!)).toBe(true);
  });

  test("friend-biased spawns stay deterministic", async () => {
    const run = async () => {
      const alice = human("alice");
      const bob = human("bob", ["client_alice"]);
      const game = await setup("world", {}, [alice, bob]);
      game.addExecution(new SpawnExecution("game_id", alice));
      game.addExecution(new SpawnExecution("game_id", bob));
      game.executeNextTick();
      game.executeNextTick();
      return [
        game.playerByClientID("client_alice")?.spawnTile(),
        game.playerByClientID("client_bob")?.spawnTile(),
      ];
    };

    expect(await run()).toEqual(await run());
  });
});
