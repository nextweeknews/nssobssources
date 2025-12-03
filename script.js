const API_URL = "https://rapid-haze-012c.nextweekmedia.workers.dev";

// POST body
const postConfig = {
    player_id: "aidankellaher0000",
    client_id: "DISCORD|1069003073311211601",
    leaderboard: "season_10",
    rating_type: "player_global_all"
};

async function fetchLeaderboard() {
    const container = document.getElementById("data");
    container.innerHTML = "<p class='loading'>Loading leaderboard...</p>";

    try {
        const response = await fetch(API_URL, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify(postConfig)
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        displayData(data);

    } catch (err) {
        console.error("Fetch error:", err);
        container.innerHTML = `<p class='error'>Error: ${err.message}</p>`;
    }
}

// Display leaderboard entries
function displayData(data) {
    const container = document.getElementById("data");
    container.innerHTML = "";

    if (Array.isArray(data)) {
        if (data.length === 0) {
            container.innerHTML = "<p class='loading'>No entries found.</p>";
        } else {
            data.forEach(item => makeCard(item));
        }
    } else if (typeof data === "object" && data !== null) {
        makeCard(data);
    } else {
        container.innerHTML = `<p class='loading'>${data}</p>`;
    }
}

// Create a card for each entry
function makeCard(obj) {
    const container = document.getElementById("data");
    const card = document.createElement("div");
    card.className = "card";

    let html = "<h3>Entry</h3><ul>";
    for (const key in obj) {
        if (Object.hasOwnProperty.call(obj, key)) {
            html += `<li><strong>${key}:</strong> ${obj[key]}</li>`;
        }
    }
    html += "</ul>";

    card.innerHTML = html;
    container.appendChild(card);
}

// Run when page loads
window.addEventListener("load", fetchLeaderboard);
