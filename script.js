const API_URL = "https://kh3pbctcnk.execute-api.us-east-2.amazonaws.com/team-up-api/get_player_rating";

const postConfig = {
    "player_id": "702730732220579950",
    "client_id": "DISCORD|1069003073311211601",
    "leaderboard": "Season_10",
    "rating_type": "player_global_even"
};

async function fetchLeaderboard() {
    const container = document.getElementById("data");
    container.innerHTML = "<p class='loading'>Loading leaderboard...</p>";

    try {
        const response = await fetch(API_URL, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(postConfig)
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

    if (Array.isArray(data)) {
        data.forEach(item => makeCard(item));
    } else if (typeof data === "object" && data !== null) {
        makeCard(data);
    } else {
        container.innerHTML = `<p class='loading'>${data}</p>`;
    }
}

function makeCard(obj) {
    const container = document.getElementById("data");
    const card = document.createElement("div");
    card.className = "card";

    // Extract fields safely
    const displayName = obj.display_name || "Unknown";
    const rating = obj.rating || "N/A";

    // Only show these two fields
    const html = `
        <h3>Player Rating</h3>
        <ul>
            <li><strong>Display Name:</strong> ${displayName}</li>
            <li><strong>Rating:</strong> ${rating}</li>
        </ul>
    `;

    card.innerHTML = html;
    container.appendChild(card);
}

window.addEventListener("load", fetchLeaderboard);
