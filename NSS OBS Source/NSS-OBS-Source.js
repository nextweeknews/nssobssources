// NSS OBS Source.js
const apiDataContainer = document.getElementById('NSS-Leaderboard');
const apiUrl = 'https://kh3pbctcnk.execute-api.us-east-2.amazonaws.com/team-up-api';

fetch(apiUrl)
    .then(response => {
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        return response.json();
    })
    .then(data => {

        // 👇 Print the full API result so you can see the structure
        console.log("API Response:", data);

        // Temporary display so you know something loaded:
        apiDataContainer.innerHTML = "<p>Check console for API response.</p>";
    })
    .catch(error => {
        console.error('Error fetching data:', error);
        apiDataContainer.innerHTML = `<p>Error loading data: ${error.message}</p>`;
    });