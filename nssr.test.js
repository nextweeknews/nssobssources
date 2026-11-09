const assert = require("node:assert/strict");
const test = require("node:test");
const fs = require("node:fs");
const vm = require("node:vm");
const { matchRows } = require("./nssr-match-results");

function client(respond, season = 1) {
  const calls = [];
  const context = vm.createContext({ window: {}, URL, URLSearchParams, AbortSignal,
    fetch: async url => {
      calls.push(new URL(url));
      return { ok: true, json: async () => respond(new URL(url)) };
    }
  });
  vm.runInContext(fs.readFileSync(`${__dirname}/nssr-config.js`, "utf8").replace("CURRENT_SEASON = 1", `CURRENT_SEASON = ${season}`), context);
  vm.runInContext(fs.readFileSync(`${__dirname}/nssr-api.js`, "utf8"), context);
  return { api: context.window.NSSR_API, config: context.window.NSSR_CONFIG, calls };
}

test("NSSR isolates the server and paginates rankings and profiles for each season", async () => {
  for (const season of [1, 2, 15]) {
    const { api, calls, config } = client(url => url.searchParams.has("cursor")
      ? { entries: [{ player_id: "2" }], resolved: { players: { "2": { display_name: "Two" } } } }
      : { entries: [{ player_id: "1" }], cursor: "next", resolved: { players: { "1": { display_name: "One" } } } }, season);
    const data = await api.snapshot();
    assert.equal(config.GAME, "NSSR");
    assert.equal(data.entries.length, 2);
    assert.equal(data.resolved.players["1"].display_name, "One");
    assert.equal(data.resolved.players["2"].display_name, "Two");
    assert.equal(calls.length, 2);
    for (const url of calls) {
      assert.equal(decodeURIComponent(url.pathname), "/v1/client/DISCORD|1550493522451234847/rankings");
      assert.equal(url.searchParams.get("leaderboard"), `season-${season}`);
      assert.equal(url.searchParams.get("include"), "profiles");
      assert.equal(url.searchParams.get("format"), "global");
      assert.equal(url.searchParams.get("limit"), "250");
    }
  }
});

test("NSSR shows the top 16, widening milestones, and nearby players through rank 250", () => {
  const { normalizeLeaderboard, leaderboardRows } = require("./player-data");
  const players = normalizeLeaderboard({ entries: Array.from({ length: 250 }, (_, i) => ({ player_id: String(i + 1), elo: 2000 - i })) });
  for (let rank = 1; rank <= 250; rank++) {
    const rows = leaderboardRows(players, String(rank), 16);
    const ranks = rows.map(row => row.player.rank);
    assert.deepEqual(ranks.slice(0, 16), Array.from({ length: 16 }, (_, i) => i + 1));
    assert.equal(new Set(ranks).size, ranks.length);
    assert.ok(ranks.includes(rank));
    assert.ok(rows.length <= 26);
    assert.ok(rows.filter(row => row.milestone).length <= 5);
    if (rank > 16) {
      assert.ok(ranks.includes(rank - 1));
      if (rank < 250) assert.ok(ranks.includes(rank + 1));
    }
  }
  assert.deepEqual(leaderboardRows(players, "33", 16).map(row => row.player.rank), [1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,20,25,30,31,32,33,34,35]);
  assert.equal(leaderboardRows(players.slice(0, 7), "3", 16).length, 7);
});

test("NSSR history follows player cursors and retains full opponents and ties", async () => {
  const match = timestamp => ({ timestamp, results: [
    { place: 1, players: [{ player_id: "1", new_elo: 1500 }] },
    { place: 1, players: [{ player_id: "2", new_elo: 1400 }] }
  ] });
  const { api, calls } = client(url => ({ matches: [match(url.searchParams.has("cursor") ? 100 : 200)],
    ...(url.searchParams.has("cursor") ? {} : { cursor: "older" }) }));
  const history = await api.history("1");
  assert.equal(history.matches_count, 2);
  assert.equal(history.matches[0].results.length, 2);
  assert.equal(calls.length, 2);
  assert.ok(calls.every(url => url.searchParams.get("player") === "1" && url.pathname.endsWith("/matches/season-1")));
  const latest = await api.latestMatch("1");
  assert.equal(calls.at(-1).searchParams.get("limit"), "1");
  assert.equal(latest.timestamp, 200);
  assert.equal(latest.results[1].players[0].player_id, "2");
});

test("NSSR handles empty history and rejects malformed or looping pagination", async () => {
  const empty = client(() => ({ matches: [] }));
  assert.equal(await empty.api.latestMatch("1"), null);
  assert.equal((await empty.api.history("1")).matches_count, 0);
  await assert.rejects(client(() => ({})).api.snapshot(), /entries unavailable/);
  await assert.rejects(client(() => ({ entries: [], cursor: "loop" })).api.snapshot(), /pagination did not finish/);
});

test("match rows use match Elo/deltas, season ranks, names, and all placements", () => {
  const rows = matchRows({ results: [
    { place: 2, players: [{ player_id: "1", display_name: "Fallback", new_elo: 1450, delta: -10 }] },
    { place: 1, players: [{ player_id: "2", display_name: "A < B", new_elo: 1550, delta: 10 }] },
    { place: 2, players: [{ player_id: "3" }] }
  ] }, { entries: [{ player_id: "1", elo: 1600 }, { player_id: "2", elo: 1500 }],
    resolved: { players: { "1": { display_name: "New server name" } } } });
  assert.deepEqual(rows.map(row => row.id), ["2", "1", "3"]);
  assert.equal(rows[0].name, "A < B");
  assert.equal(rows[0].rank, 2);
  assert.equal(rows[1].name, "New server name");
  assert.equal(rows[1].elo, 1450);
  assert.equal(rows[1].delta, -10);
  assert.equal(rows[1].rank, 1);
  assert.equal(rows[2].rank, null);
  assert.equal(rows[2].elo, null);
});
