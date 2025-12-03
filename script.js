// Cloudflare Worker URL
const API_URL = "https://rapid-haze-012c.nextweekmedia.workers.dev";

// POST body (API configuration)
const postConfig = {
    client_id: "DISCORD|1069003073311211601",
};

// Send POST request to API
async function sendPost() {
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

        let result;
        try {
            result = await response.json(); // Try parsing JSON
        } catch {
            result = await response.text(); // Fallback to raw text
        }

        displayData(result);

    } catch (err) {
        console.error("POST Error:", err);
        container.innerHTML = `<p class="error">Error: ${err.message}</p>`;
    }
}

// Display API response in cards
function displayData(data) {
    const container = document.getElementById("data");
    container.innerHTML = ""; // Clear loading/error text

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

// Create a card for each leaderboard entry
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

// Run when the page loads
window.addEventListener("load", sendPost);
