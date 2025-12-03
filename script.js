const API_URL = "https://teamupdiscord.com/leaderboard-api/client/DISCORD%7C1069003073311211601/leaderboard/Season_10/rating_type/player_global_all/format/global";

async function fetch() {
  try {
    const response = await fetch(API_URL);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const data = await response.json();  // parse JSON response
    console.log("Leaderboard data:", data);
    // … then render data to DOM ...
  } catch (err) {
    console.error("Fetch error:", err);
  }
}

window.addEventListener("load", fetchLeaderboard);

// Auto-run
window.addEventListener("load", fetchLeaderboard);
