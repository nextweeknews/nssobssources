 const API_URL = "https://kh3pbctcnk.execute-api.us-east-2.amazonaws.com/team-up-api";

async function fetchLeaderboard() {
  try {
    const response = await fetch(API_URL);  // built-in fetch
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const data = await response.json();  // parse JSON response
    console.log("Leaderboard data:", data);
    // … render data to DOM here ...
  } catch (err) {
    console.error("Fetch error:", err);
  }
}

// Run on page load
window.addEventListener("load", fetchLeaderboard);
