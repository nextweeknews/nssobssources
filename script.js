const API_URL = "https://kh3pbctcnk.execute-api.us-east-2.amazonaws.com/team-up-api";

// Fetch and display API data
async function loadAPI() {
    const container = document.getElementById("data");

    container.className = "loading";
    container.textContent = "Loading...";

    try {
        const response = await fetch(API_URL);
        if (!response.ok) throw new Error("API returned " + response.status);

        const data = await response.json();
        container.innerHTML = ""; // Clear loading text
        container.className = "";

        // If API returns an array
        if (Array.isArray(data)) {
            data.forEach(item => makeCard(item));
        } else {
            // If API returns a single object
            makeCard(data);
        }

    } catch (err) {
        container.className = "error";
        container.textContent = "Error loading data: " + err;
    }
}

// Create a formatted card for each entry
function makeCard(obj) {
    const container = document.getElementById("data");

    const card = document.createElement("div");
    card.className = "card";

    let html = "<h3>Entry</h3><ul>";

    for (const key in obj) {
        html += `<li><strong>${key}:</strong> ${obj[key]}</li>`;
    }
    html += "</ul>";

    card.innerHTML = html;
    container.appendChild(card);
}

// Run automatically when page loads
window.onload = loadAPI;
