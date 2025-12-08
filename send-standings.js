const fetch = require("node-fetch");
require("dotenv").config();

const WEBHOOK_URL = process.env.WEBHOOK_URL;
const MESSAGE_ID = process.env.MESSAGE_ID;

const WORKER_URL = "https://small-mud-2771.nextweekmedia.workers.dev/";
const SHEET_ID = "1qIM0HKhx9Y-3eCJCFzBqrbATwiPrK3C1ynATwZzRC1o";

const RANGES = {
  teams: "Season 5!U4:X15",
  players: "Season 5!U18:X32"
};

async function getData(range) {
  const res = await fetch(
    `${WORKER_URL}?sheetId=${SHEET_ID}&range=${encodeURIComponent(range)}`
  );
  const json = await res.json();
  return json.values || [];
}

function buildFieldBlock(rows) {
  return rows
    .filter(r => r[0] && r[2])
    .map(r => `**#${r[0]}** ${r[2]} — **${r[3] ?? "–"}**`)
    .join("\n");
}

async function buildEmbed() {
  const [teams, players] = await Promise.all([
    getData(RANGES.teams),
    getData(RANGES.players)
  ]);

  return {
    title: "Shotgun League — Season 5 Standings",
    description:
      `__Team Standings__\n${buildFieldBlock(teams)}\n\n` +
      `__Top 10 Players__\n${buildFieldBlock(players)}`,
    color: 0x22c55e,
    footer: { text: "Live from Google Sheets" },
    timestamp: new Date().toISOString()
  };
}

async function main() {
  if (!WEBHOOK_URL) {
    console.error("WEBHOOK_URL is not set in .env");
    process.exit(1);
  }

  const embed = await buildEmbed();

  if (!MESSAGE_ID) {
    console.log("No MESSAGE_ID — creating a new message…");
    const res = await fetch(`${WEBHOOK_URL}?wait=true`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ embeds: [embed] })
    });
    const data = await res.json();
    console.log("Created fresh message with id:", data.id);
    console.log("➡ Copy this ID into your .env and GitHub Secrets");
    return;
  }

  const res = await fetch(`${WEBHOOK_URL}/messages/${MESSAGE_ID}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ embeds: [embed] })
  });

  if (!res.ok) {
    console.error("Failed to update:", await res.text());
    process.exit(1);
  }

  console.log("Updated message:", MESSAGE_ID);
}

main().catch(console.error);
