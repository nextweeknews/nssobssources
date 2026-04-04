const TEAMUP_CONFIG = window.TEAMUP_CONFIG || {
  CURRENT_LEADERBOARD_KEY: "Season_12",
  DEFAULT_FORMAT: "",
  WORKER_BASE_URL: "https://rapid-haze-012c.nextweekmedia.workers.dev"
};
const WORKER_BASE_URL = `${TEAMUP_CONFIG.WORKER_BASE_URL}/get_player_rating`.replace(/\/+$/, "");

async function fetchPlayerRating(playerId) {
  const container = document.getElementById("data");
  container.innerHTML = "<p class='loading'>Loading player...</p>";

  try {
    const response = await fetch(WORKER_BASE_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ player_id: playerId, leaderboard: TEAMUP_CONFIG.CURRENT_LEADERBOARD_KEY, format: TEAMUP_CONFIG.DEFAULT_FORMAT })
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const text = await response.text();
    let data;

    try {
      data = JSON.parse(text);
    } catch {
      throw new Error("API did not return JSON: " + text);
    }

    displayData(data);

  } catch (err) {
    console.error("Fetch error:", err);
    container.innerHTML = `<p class='error'>Error: ${err.message}</p>`;
  }
}

// Backward-compatible alias for any existing callers.
const fetchLeaderboard = fetchPlayerRating;
