const API_URL = "https://teamupdiscord.com/leaderboard-api/client/DISCORD|C1069003073311211601";

async function fetchLeaderboard() {
    const container = document.getElementById("data");
    container.innerHTML = "<p class='loading'>Loading leaderboard...</p>";

    try {
        const response = await fetch(API_URL);

        // Try parsing JSON
        const data = await response.json();

        displayData(data);

    } catch (err) {
        console.error("Fetch Error:", err);
        container.innerHTML = `<p class="error">Error: ${err.message}</p>`;
    }
}

// Example function to display data (reuse your makeCard function)
function displayData(data) {
    const container = document.getElementById("data");
    container.innerHTML = "";

    if (Array.isArray(data)) {
        data.forEach(item => makeCard(item));
    } else {
        makeCard(data);
    }
}

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

// Auto-run
window.addEventListener("load", fetchLeaderboard);
