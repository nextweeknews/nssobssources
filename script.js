const API_URL = "https://rapid-haze-012c.nextweekmedia.workers.dev";

// Your POST body (the data you're sending to the API)
const postConfig = {
    client_id: "DISCORD|1069003073311211601",
};

async function sendPost() {
    try {
        const response = await fetch(API_URL, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify(postConfig)
        });

        const result = await response.json();
        console.log("POST Success:", result);

        // Display it on the page
        displayData(result);

    } catch (err) {
        console.error("POST Error:", err);
        document.getElementById("data").innerText = "Error: " + err.message;
    }
}

// Display the API response (reuses your makeCard function)
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
        html += `<li><strong>${key}:</strong> ${obj[key]}</li>`;
    }

    html += "</ul>";
    card.innerHTML = html;

    container.appendChild(card);
}

// Auto-run POST on page load (optional)
window.onload = sendPost;
