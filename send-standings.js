import fetch from "node-fetch";
import dotenv from "dotenv";
dotenv.config();

const WEBHOOK_URL = process.env.WEBHOOK_URL;
const MESSAGE_ID = process.env.MESSAGE_ID;

const WORKER_URL = "https://small-mud-2771.nextweekmedia.workers.dev/";
const SHEET_ID = "1qIM0HKhx9Y-3eCJCFzBqrbATwiPrK3C1ynATwZzRC1o";

const RANGES = {
  teams: "Season 5!U4:X15",
  players: "Season 5!U18:X32"
};

async function getData(range) {
  const res = await fetch(`${WORKER_URL}?sheetId=${SHEET_ID}&range=${encodeURIComponent(range)}`);
  const json = await res.json();
  return json.values || [];
}

function buildFieldBlock(rows) {
  return rows
    .filter(r => r[0] && r[2])
    .map(r => `**#${r[0]}** ${r[2]} — **${r[3] ?? "–"}**`)
    .join("\n");
}

async function updateMessage() {
  const [teams, players] = await Promise.all([
    getData(RANGES.teams),
    getData(RANGES.players)
  ]);

  const embed = {
    title: "Shotgun League — Season 5 Standings",
    description:
      `__Team Standings__\n${buildFieldBlock(teams)}\n\n` +
      `__Top 10 Players__\n${buildFieldBlock(players)}`,
    color: 0x22c55e,
    footer: { text: "Auto-updating every minute" },
    timestamp: new Date().toISOString()
  };

  const url = `${WEBHOOK_URL}/messages/${MESSAGE_ID}`;
  const res = await fetch(url, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ embeds: [embed] })
  });

  if (!res.ok) {
    console.error("Discord update failed:", await res.text());
  } else {
    console.log("Updated standings message! 🔄");
  }
}

updateMessage().catch(console.error);
