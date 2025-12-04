const WORKER_BASE_URL = "https://rapid-haze-012c.nextweekmedia.workers.dev/get_player_rating";

const postConfig = {
  "player_id": "702730732220579950",
};

async function fetchLeaderboard(playerId) {
  const container = document.getElementById("data");
  container.innerHTML = "<p class='loading'>Loading player...</p>";

  // Build URL safely using template literal
  const apiUrl = `${WORKER_BASE_URL}?player_id=${encodeURIComponent(playerId)}`;

  try {
    const response = await fetch(apiUrl, {
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

function displayData(data) {
  const container = document.getElementById("data");
  container.innerHTML = "";

  if (typeof data === "object" && data !== null) {
    makeCard(data);
    return;
  }

  container.innerHTML = `<p>No valid data returned.</p>`;
}

function makeCard(obj) {
  const container = document.getElementById("data");
  const card = document.createElement("div");
  card.className = "card";

  const displayName = obj.display_name || "Unknown";
  const rating = obj.rating ?? "N/A";

  card.innerHTML = `
      <h3>${displayName}</h3>
      <p><strong>Elo:</strong> ${rating}</p>
  `;

  container.appendChild(card);
}

// Example usage: pass player_id dynamically
window.addEventListener("load", () => {
  const playerId = "702730732220579950"; // or read from query string
  fetchLeaderboard(playerId);
});
