const fetch = require("node-fetch");
const path = require("node:path");
process.env.FONTCONFIG_FILE ||= path.join(__dirname, "fontconfig.xml");
const sharp = require("sharp");
require("dotenv").config();

const INTER_FONT = path.join(__dirname, "fonts", "InterVariable.ttf");

const WEBHOOK_URL = process.env.WEBHOOK_URL;
const MESSAGE_ID = process.env.MESSAGE_ID;

const WORKER_URL = "https://small-mud-2771.nextweekmedia.workers.dev/";
const SHEET_ID = "1qIM0HKhx9Y-3eCJCFzBqrbATwiPrK3C1ynATwZzRC1o";
const RESULTS_URL = "https://nssgolf.com/proleague";
const TITLE = "Shotgun Pro League — Season 8, Stage 2";

const RANGES = {
  teams: "Season 8, Stage 2!U4:X15",
  players: "Season 8, Stage 2!AE4:AH",
  rosters: "Season 8, Stage 2!A3:S63"
};
const OUTPUT_SCALE = 2;
const ROW_HEIGHT = 82;
const ROW_GAP = 10;
const ROW_RADIUS = 16;
const RANK_WIDTH = 110;
const SCORE_WIDTH = 130;
const LOGO_SIZE = 64;
const NAME_GAP = 18;

const TEAM_STYLES = {
  ANIMALS: { bg: "#2b2020", fg: "#ffffff" },
  "TERRIFIC TIGERS": { bg: "#fe6d01", fg: "#000000" },
  BREAKERS: { bg: "#f1c232", fg: "#1c4487" },
  DAGGERS: { bg: "#ea9999", fg: "#1d2244" },
  SNIPERS: { bg: "#275318", fg: "#ffe6cd" },
  MCSTROKERS: { bg: "#4d94d8", fg: "#ffffff" },
  INFERNIX: { bg: "#f6b26b", fg: "#000000" },
  "INFERNIX*": { bg: "#f6b26b", fg: "#000000" },
  "DOUBLE-EAGLES": { bg: "#1c4487", fg: "#ffffff" },
  "PHANTOM TROUPE": { bg: "#674ea7", fg: "#ffffff" },
  ASTERISM: { bg: "#ba2636", fg: "#ffffff" },
  CARROTS: { bg: "#ff9966", fg: "#000000" },
  "SPOCCO COWS": { bg: "#78206e", fg: "#ffffff" },
  BURGERS: { bg: "#7e5444", fg: "#ffffff" },
  TREEMEISTERS: { bg: "#2d6316", fg: "#ffffff" },
  "FLAG SMOKERS": { bg: "#03384b", fg: "#ffffff" },
  REVERIE: { bg: "#d9d2e9", fg: "#00367a" },
  DELIRIUM: { bg: "#86c7f5", fg: "#052741" }
};

async function getData(range) {
  const res = await fetch(
    `${WORKER_URL}?sheetId=${SHEET_ID}&range=${encodeURIComponent(range)}`
  );
  if (!res.ok) throw new Error(`Standings request failed (${res.status})`);
  const json = await res.json();
  return json.values || [];
}

function normalizeRows(rows) {
  return rows
    .filter(row => row[0] && row[2])
    .map(row => ({
      rank: String(row[0]),
      name: String(row[2]).trim(),
      score: row[3] ?? "–"
    }));
}

function normalizeTopTenRows(rows) {
  return normalizeRows(rows).filter(row => Number(row.rank) <= 10);
}

function normalizeKey(value) {
  return String(value || "").trim().toUpperCase();
}

function slugify(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function buildPlayerTeamMap(rows) {
  const populated = rows.filter(row =>
    Array.isArray(row) && row.some(cell => String(cell ?? "").trim())
  );
  const result = new Map();

  for (let i = 1; i < populated.length; i += 5) {
    const teamName = String(populated[i]?.[2] ?? "").trim();
    if (!teamName) continue;

    for (const playerRow of populated.slice(i + 1, i + 5)) {
      const playerName = String(playerRow?.[2] ?? "").trim();
      if (playerName) result.set(normalizeKey(playerName), teamName);
    }
  }

  return result;
}

function escapeXml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function rankColor(rank) {
  return rank === "1" ? "#ffd700" : rank === "2" ? "#c0c0c0" : rank === "3" ? "#cd7f32" : "#c7d7ff";
}

async function loadTeamLogos(teamNames) {
  const entries = await Promise.all(
    [...new Set(teamNames.filter(Boolean))].map(async teamName => {
      const res = await fetch(`${RESULTS_URL}/logos/${slugify(teamName)}.png`);
      if (!res.ok) return [normalizeKey(teamName), null];
      const type = res.headers.get("content-type") || "image/png";
      return [normalizeKey(teamName), `data:${type};base64,${(await res.buffer()).toString("base64")}`];
    })
  );
  return new Map(entries);
}

function addText(textLayers, text, x, y, size, weight, color, anchor = "left", letterSpacing = 0) {
  textLayers.push({ text, x, y, size, weight, color, anchor, letterSpacing });
}

function renderRows(rows, { x, y, width, playerTeamMap, logos, textLayers }) {
  return rows.map((row, index) => {
    const rowY = y + index * (ROW_HEIGHT + ROW_GAP);
    const teamName = playerTeamMap ? playerTeamMap.get(normalizeKey(row.name)) : row.name;
    const style = TEAM_STYLES[normalizeKey(teamName)] || { bg: "#283247", fg: "#ffffff" };
    const logo = logos.get(normalizeKey(teamName));
    const logoMarkup = logo
      ? `<image href="${logo}" x="${x + RANK_WIDTH + NAME_GAP / 2}" y="${rowY + (ROW_HEIGHT - LOGO_SIZE) / 2}" width="${LOGO_SIZE}" height="${LOGO_SIZE}" preserveAspectRatio="xMidYMid meet"/>`
      : "";

    addText(textLayers, row.rank, x + RANK_WIDTH / 2, rowY + ROW_HEIGHT / 2, 40, 900, rankColor(row.rank), "center");
    addText(textLayers, row.name.toUpperCase(), x + RANK_WIDTH + LOGO_SIZE + NAME_GAP, rowY + ROW_HEIGHT / 2, 38, 900, style.fg, "left", 0.4);
    addText(textLayers, row.score, x + width - SCORE_WIDTH / 2, rowY + ROW_HEIGHT / 2, 40, 900, "#000000", "center", 0.5);

    return `
      <rect x="${x}" y="${rowY}" width="${width}" height="${ROW_HEIGHT}" rx="${ROW_RADIUS}" fill="#202a40"/>
      <path d="M${x + ROW_RADIUS} ${rowY}H${x + RANK_WIDTH}V${rowY + ROW_HEIGHT}H${x + ROW_RADIUS}Q${x} ${rowY + ROW_HEIGHT} ${x} ${rowY + ROW_HEIGHT - ROW_RADIUS}V${rowY + ROW_RADIUS}Q${x} ${rowY} ${x + ROW_RADIUS} ${rowY}Z" fill="#202a40"/>
      <rect x="${x + RANK_WIDTH}" y="${rowY}" width="${width - RANK_WIDTH - SCORE_WIDTH}" height="${ROW_HEIGHT}" fill="${style.bg}"/>
      <path d="M${x + width - SCORE_WIDTH} ${rowY}H${x + width - ROW_RADIUS}Q${x + width} ${rowY} ${x + width} ${rowY + ROW_RADIUS}V${rowY + ROW_HEIGHT - ROW_RADIUS}Q${x + width} ${rowY + ROW_HEIGHT} ${x + width - ROW_RADIUS} ${rowY + ROW_HEIGHT}H${x + width - SCORE_WIDTH}Z" fill="#d9d9d9"/>
      ${logoMarkup}`;
  }).join("");
}

async function renderTextLayer({ text, x, y, size, weight, color, anchor, letterSpacing }) {
  const spacing = letterSpacing
    ? ` letter_spacing="${Math.round(letterSpacing * 1024)}"`
    : "";
  const { data, info } = await sharp({
    text: {
      text: `<span foreground="${color}" font_size="${size * 1024}" font_weight="${weight}"${spacing}>${escapeXml(text)}</span>`,
      font: "Inter Variable",
      fontfile: INTER_FONT,
      rgba: true,
      dpi: 72 * OUTPUT_SCALE
    }
  }).png().toBuffer({ resolveWithObject: true });

  return {
    input: data,
    left: Math.round(x * OUTPUT_SCALE - (anchor === "center" ? info.width / 2 : 0)),
    top: Math.round(y * OUTPUT_SCALE - info.height / 2)
  };
}

async function buildLeaderboardImages(teamRows, playerRows, rosterRows, logoLoader = loadTeamLogos) {
  const teams = normalizeRows(teamRows);
  const players = normalizeTopTenRows(playerRows);
  const playerTeamMap = buildPlayerTeamMap(rosterRows);
  const logos = await logoLoader([
    ...teams.map(team => team.name),
    ...players.map(player => playerTeamMap.get(normalizeKey(player.name)))
  ]);

  const width = 1200;
  const tableWidth = 1104;
  const tableX = 48;
  const teamHeaderY = 210;
  const teamRowsY = 272;
  const rowsHeight = rows => rows.length * ROW_HEIGHT + Math.max(0, rows.length - 1) * ROW_GAP;
  const playersHeaderY = 54;
  const playerRowsY = playersHeaderY + 62;
  const teamHeight = teamRowsY + rowsHeight(teams) + 50;
  const playerHeight = playerRowsY + rowsHeight(players) + 50;
  const imageHeight = Math.max(teamHeight, playerHeight);
  const tableHeader = (y, label, textLayers) => {
    addText(textLayers, "RANK", tableX + RANK_WIDTH / 2, y + 26, 18, 800, "#9ca3c7", "center", 3);
    addText(textLayers, label, tableX + RANK_WIDTH + LOGO_SIZE + NAME_GAP, y + 26, 18, 800, "#9ca3c7", "left", 3);
    addText(textLayers, "SCORE", tableX + tableWidth - SCORE_WIDTH / 2, y + 26, 18, 800, "#9ca3c7", "center", 3);
    return `<rect x="${tableX}" y="${y}" width="${tableWidth}" height="52" rx="${ROW_RADIUS}" fill="#252e41"/>`;
  };

  const renderImage = async (height, content, textLayers) => {
    const background = await sharp(Buffer.from(`
    <svg width="${width * OUTPUT_SCALE}" height="${height * OUTPUT_SCALE}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
      ${content}
    </svg>`)).png().toBuffer();
    return sharp(background)
      .composite(await Promise.all(textLayers.map(renderTextLayer)))
      .png()
      .toBuffer();
  };

  const teamText = [];
  addText(teamText, "SHOTGUN PRO LEAGUE", 48, 54, 26, 800, "#4f86d9", "left", 8);
  addText(teamText, "SEASON 8 · STAGE 2", 48, 102, 64, 900, "#4f86d9", "left", 1);
  addText(teamText, "TEAM STANDINGS", tableX, 187, 30, 900, "#4f86d9", "left", 0.8);

  const playerText = [];
  addText(playerText, "TOP 10 PLAYERS", tableX, 31, 30, 900, "#4f86d9", "left", 0.8);

  return Promise.all([
    renderImage(imageHeight, `
      <line x1="48" y1="158" x2="1152" y2="158" stroke="#4f86d9" stroke-width="4"/>
      ${tableHeader(teamHeaderY, "TEAM", teamText)}
      ${renderRows(teams, { x: tableX, y: teamRowsY, width: tableWidth, logos, textLayers: teamText })}`, teamText),
    renderImage(imageHeight, `
      ${tableHeader(playersHeaderY, "PLAYER", playerText)}
      ${renderRows(players, { x: tableX, y: playerRowsY, width: tableWidth, playerTeamMap, logos, textLayers: playerText })}`, playerText)
  ]);
}

function buildMessagePayload(now = new Date()) {
  const timestamp = Math.floor(now.getTime() / 1000);
  return {
    flags: 1 << 15,
    components: [{
      type: 17,
      accent_color: 0x22c55e,
      components: [
        {
          type: 12,
          items: [{
            media: { url: "attachment://team-standings.png" },
            description: `${TITLE} team standings`
          }]
        },
        {
          type: 12,
          items: [{
            media: { url: "attachment://player-standings.png" },
            description: `${TITLE} individual player standings`
          }]
        },
        {
          type: 1,
          components: [{
            type: 2,
            style: 5,
            label: "Full & Previous Season Results",
            url: RESULTS_URL
          }]
        },
        { type: 10, content: `Updated <t:${timestamp}:R>` }
      ]
    }]
  };
}

function buildMultipart(payload, files) {
  const boundary = `----nss-standings-${Date.now()}`;
  const body = Buffer.concat([
    Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="payload_json"\r\nContent-Type: application/json\r\n\r\n${JSON.stringify(payload)}\r\n`),
    ...files.flatMap(({ filename, data }, index) => [
      Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="files[${index}]"; filename="${filename}"\r\nContent-Type: image/png\r\n\r\n`),
      data,
      Buffer.from("\r\n")
    ]),
    Buffer.from(`--${boundary}--\r\n`)
  ]);
  return { body, contentType: `multipart/form-data; boundary=${boundary}` };
}

async function main() {
  if (!WEBHOOK_URL) {
    console.error("WEBHOOK_URL is not set in .env");
    process.exit(1);
  }

  const [teams, players, rosters] = await Promise.all([
    getData(RANGES.teams),
    getData(RANGES.players),
    getData(RANGES.rosters)
  ]);
  const [teamImage, playerImage] = await buildLeaderboardImages(teams, players, rosters);
  const files = [
    { filename: "team-standings.png", data: teamImage },
    { filename: "player-standings.png", data: playerImage }
  ];
  const payload = {
    ...buildMessagePayload(),
    attachments: files.map((file, id) => ({ id, filename: file.filename }))
  };
  if (MESSAGE_ID) {
    payload.content = null;
    payload.embeds = [];
  }
  const multipart = buildMultipart(payload, files);
  const url = MESSAGE_ID
    ? `${WEBHOOK_URL}/messages/${MESSAGE_ID}?with_components=true`
    : `${WEBHOOK_URL}?wait=true&with_components=true`;
  const res = await fetch(url, {
    method: MESSAGE_ID ? "PATCH" : "POST",
    headers: { "Content-Type": multipart.contentType },
    body: multipart.body
  });

  if (!res.ok) {
    console.error("Failed to update:", await res.text());
    process.exit(1);
  }

  if (!MESSAGE_ID) {
    const data = await res.json();
    console.log("Created fresh message with id:", data.id);
    console.log("➡ Copy this ID into your .env and GitHub Secrets");
    return;
  }

  console.log("Updated message:", MESSAGE_ID);
}

module.exports = {
  buildLeaderboardImages,
  buildMessagePayload,
  buildMultipart,
  buildPlayerTeamMap,
  normalizeRows,
  normalizeTopTenRows,
  renderTextLayer
};

if (require.main === module) main().catch(error => {
  console.error(error);
  process.exit(1);
});
