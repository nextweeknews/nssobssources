(function () {
  "use strict";
  // Change CURRENT_SEASON once to advance both NSSR graphics to season-2, etc.
  const CURRENT_SEASON = 1;
  window.NSSR_CONFIG = Object.freeze({
    GAME: "NSSR",
    CURRENT_SEASON,
    CURRENT_LEADERBOARD_KEY: `season-${CURRENT_SEASON}`,
    CURRENT_LEADERBOARD_LABEL: `Season ${CURRENT_SEASON}`,
    CLIENT_ID: "DISCORD|1550493522451234847",
    API_BASE_URL: "https://nssr-teamup-api.nextweekmedia.workers.dev",
    DEFAULT_FORMAT: "global",
    LEADERBOARD_LIMIT: 250,
    TOP_PLAYERS: 16,
    REFRESH_MS: 15000
  });
})();
