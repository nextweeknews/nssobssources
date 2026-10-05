const assert = require("node:assert/strict");
const test = require("node:test");
const sharp = require("sharp");

const {
  buildLeaderboardImages,
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

test("renders Discord-ready PNGs and multipart attachments", async () => {
  const [teamImage, playerImage] = await buildLeaderboardImages(
    teams,
    players,
    rosters,
    async () => new Map()
  );
  const teamMetadata = await sharp(teamImage).metadata();
  assert.equal(teamMetadata.format, "png");
  assert.equal(teamMetadata.width, 2400);
  assert.equal(teamMetadata.height, 992);
  assert.equal(teamMetadata.hasAlpha, true);

  const playerMetadata = await sharp(playerImage).metadata();
  assert.equal(playerMetadata.format, "png");
  assert.equal(playerMetadata.width, 2400);
  assert.equal(playerMetadata.height, 680);
  assert.equal(playerMetadata.hasAlpha, true);

  const payload = buildMessagePayload(new Date("2026-10-05T00:00:00Z"));
  const files = [
    { filename: "team-standings.png", data: teamImage },
    { filename: "player-standings.png", data: playerImage }
  ];
  payload.attachments = files.map((file, id) => ({ id, filename: file.filename }));
  assert.equal(payload.flags, 32768);
  assert.equal(payload.components[0].components[0].type, 12);
  assert.equal(payload.components[0].components[1].type, 12);
  assert.equal(payload.components[0].components[2].components[0].url, "https://nssgolf.com/proleague");
  assert.equal(payload.components[0].components[3].content, "Updated <t:1791158400:R>");
  const multipart = buildMultipart(payload, files);
  assert.match(multipart.contentType, /^multipart\/form-data; boundary=/);
  assert.ok(multipart.body.includes(Buffer.from("attachment://team-standings.png")));
  assert.ok(multipart.body.includes(Buffer.from("attachment://player-standings.png")));
  assert.ok(multipart.body.includes(teamImage));
  assert.ok(multipart.body.includes(playerImage));
});
