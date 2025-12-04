const WORKER_BASE_URL = "https://rapid-haze-012c.nextweekmedia.workers.dev/get_player_rating".replace(/\/+$/, "");

async function fetchLeaderboard(playerId) {
  const container = document.getElementById("data");
  container.innerHTML = "<p class='loading'>Loading player...</p>";

  try {
    const response = await fetch(WORKER_BASE_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ player_id: playerId })
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
