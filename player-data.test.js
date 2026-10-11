const assert = require("node:assert/strict");
const test = require("node:test");
const { normalizeLeaderboard, leaderboardRows, historyPoints, needsHistory, ordinalRank } = require("./player-data");

test("rank suffixes handle last digits and the teen exceptions", () => {
  for (const [rank, expected] of [[1,"1st"],[2,"2nd"],[3,"3rd"],[4,"4th"],[11,"11th"],[12,"12th"],[13,"13th"],[21,"21st"],[22,"22nd"],[33,"33rd"],[100,"100th"],[101,"101st"],[111,"111th"],[112,"112th"],[113,"113th"],[123,"123rd"]]) {
    assert.equal(ordinalRank(rank), expected);
  }
});

function leaderboard(count) {
  return normalizeLeaderboard({ entries: Array.from({ length: count }, (_, index) => ({
    player_id: String(index + 1), display_name: `Player ${index + 1}`, elo: 2000 - index,
    matches: 10, count_placement_1: 2, count_placement_2: 3, count_placement_3: 1
  })) });
}

test("cache profiles and placement counts match the full ranked graphic", () => {
  const players = normalizeLeaderboard({ leaderboard: "season-14", entries: [
    { team: ["2"], elo: 1300, matches: 0 },
    { player_id: "1", elo: 1600.4, matches: 10, count_placement_1: 2, count_placement_2: 3, count_placement_3: 1 }
  ], resolved: { players: { "1": { display_name: "A < B", avatar_url: "https://example.com/a.png" } } } });
  assert.equal(players[0].name, "A < B");
  assert.equal(players[0].rank, 1);
  assert.equal(players[0].elo, 1600);
  assert.equal(players[0].winRate, 20);
  assert.equal(players[0].top3Rate, 60);
  assert.equal(players[1].winRate, null);
});

test("server-specific member avatars override general TeamUp avatars", () => {
  const snapshot = {entries:[{player_id:"1",elo:1500,avatar_url:"https://cdn.discordapp.com/avatars/1/general.png"}]};
  const server = "https://cdn.discordapp.com/guilds/1069003073311211601/users/1/avatars/server.png";
  const [player] = normalizeLeaderboard(snapshot, {"1":{server_avatar_url:server,avatar_url:"https://cdn.discordapp.com/avatars/1/general.png"}});
  assert.equal(player.avatar, server);
  assert.equal(normalizeLeaderboard(snapshot,{"1":{server_avatar_url:null}})[0].avatar,snapshot.entries[0].avatar_url);
});

test("top ten, fifth-place milestones, and the player's neighbors never overlap", () => {
  const players = leaderboard(128);
  for (let rank = 1; rank <= 128; rank++) {
    const rows = leaderboardRows(players, String(rank));
    const ranks = rows.map(row => row.player.rank);
    assert.deepEqual(ranks.slice(0, 10), [1,2,3,4,5,6,7,8,9,10]);
    assert.equal(new Set(ranks).size, ranks.length);
    assert.ok(ranks.includes(rank));
    if (rank > 10) {
      assert.ok(ranks.includes(Math.max(10, rank - 1)));
      if (rank < 128) assert.ok(ranks.includes(rank + 1));
      assert.ok(rows.filter(row => row.milestone).every(row => row.player.rank % 5 === 0));
    }
  }
  assert.deepEqual(leaderboardRows(players, "24").map(row => row.player.rank), [1,2,3,4,5,6,7,8,9,10,15,20,22,23,24,25,26]);
});

test("history sorts oldest first, deduplicates, filters player, and includes starting Elo", () => {
  const game = (timestamp, id, old_elo, new_elo, matches) => ({ timestamp, results: [{ players: [{ player_id: id, old_elo, new_elo, matches }] }] });
  const points = historyPoints([game(200, "1", 1200, 1250, 2), game(100, "1", 1230, 1200, 1), game(100, "1", 1230, 1200, 1), game(300, "2", 900, 950, 3)], "1");
  assert.deepEqual(points.map(point => point.elo), [1230,1200,1250]);
  assert.deepEqual(points.map(point => point.game), [0,1,2]);
  assert.equal(needsHistory({ matches: 2, elo: 1250 }, 2), false);
  assert.equal(needsHistory({ matches: 2, elo: 1400 }, 2), false);
  assert.equal(needsHistory({ matches: 3, elo: 1250 }, 2), true);
  assert.equal(needsHistory({ matches: 1 }, 2), true);
});

test("milestone intervals widen with rank while preserving the top ten and neighbors", () => {
  const players = leaderboard(1200);
  const milestones = rank => leaderboardRows(players, String(rank)).filter(row => row.milestone).map(row => row.player.rank);
  assert.deepEqual(milestones(33), [15,20,25,30]);
  assert.deepEqual(milestones(60), [20,30,40,50]);
  assert.deepEqual(milestones(100), [25,50,75]);
  assert.deepEqual(milestones(128), [25,50,75,100,125]);
  assert.deepEqual(milestones(250), [50,100,150,200]);
  assert.deepEqual(milestones(1000), [250,500,750]);
  for (const rank of [33,60,100,128,250,1000,1200]) {
    const rows = leaderboardRows(players, String(rank));
    assert.ok(rows.length <= 20);
    assert.ok(rows.some(row => row.player.rank === rank));
    assert.equal(new Set(rows.map(row => row.player.rank)).size, rows.length);
  }
});
