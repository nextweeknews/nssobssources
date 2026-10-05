const assert = require("node:assert/strict");
const test = require("node:test");
const sharp = require("sharp");

const {
  buildLeaderboardImage,
  buildMessagePayload,
  buildMultipart,
  buildPlayerTeamMap,
  normalizeRows,
  normalizeTopTenRows
} = require("./send-standings");

const teams = [
  ["1", "", "Daggers", "-231"],
  ["2", "", "Burgers", "-222"]
];

const players = [
  ["1", "", "Ricardo", "-80"],
  ["2", "", "Balt", "-74"]
];

const rosters = [
  ["Rank", "", "Name"],
  ["", "", "Daggers"],
  ["1", "", "Ricardo"],
  ["", "", "Dan"],
  ["", "", "Vinny"],
  ["", "", "Ap13"],
  ["", "", "Burgers"],
  ["2", "", "Balt"],
  ["", "", "Beef"],
  ["", "", "Jacob"],
  ["", "", "Coclobster"]
];

test("preserves the current standings rows and maps player team styling", () => {
  assert.deepEqual(normalizeRows(teams), [
    { rank: "1", name: "Daggers", score: "-231" },
    { rank: "2", name: "Burgers", score: "-222" }
  ]);

  const playerTeams = buildPlayerTeamMap(rosters);
  assert.equal(playerTeams.get("RICARDO"), "Daggers");
  assert.equal(playerTeams.get("BALT"), "Burgers");
});

test("includes every player tied within the top 10", () => {
  assert.deepEqual(normalizeTopTenRows([
    ["9", "", "Ciberian", "-65"],
    ["10", "", "Ap13", "-63"],
    ["10", "", "Anderson", "-63"],
    ["10", "", "Seventy", "-63"],
    ["10", "", "Jacob", "-63"],
    ["14", "", "Tim/TJS", "-62"]
  ]).map(row => row.name), ["Ciberian", "Ap13", "Anderson", "Seventy", "Jacob"]);
});

test("renders a Discord-ready PNG and multipart attachment", async () => {
  const image = await buildLeaderboardImage(
    teams,
    players,
    rosters,
    async () => new Map()
  );
  const metadata = await sharp(image).metadata();
  assert.equal(metadata.format, "png");
  assert.equal(metadata.width, 2400);
  assert.equal(metadata.height, 1632);
  assert.equal(metadata.hasAlpha, true);

  const payload = buildMessagePayload(new Date("2026-10-05T00:00:00Z"));
  payload.attachments = [{ id: 0, filename: "standings.png" }];
  assert.equal(payload.flags, 32768);
  assert.equal(payload.components[0].components[0].type, 12);
  assert.equal(payload.components[0].components[1].components[0].url, "https://nssgolf.com/proleague");
  assert.equal(payload.components[0].components[2].content, "Updated <t:1791158400:R>");
  const multipart = buildMultipart(payload, image);
  assert.match(multipart.contentType, /^multipart\/form-data; boundary=/);
  assert.ok(multipart.body.includes(Buffer.from("attachment://standings.png")));
  assert.ok(multipart.body.includes(image));
});
