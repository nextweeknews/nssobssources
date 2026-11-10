(function () {
  "use strict";

  function matchRows(match, snapshot) {
    const entries = [...snapshot.entries].sort((a, b) => b.elo - a.elo);
    const ranks = new Map(entries.map((entry, index) => [String(entry.player_id), index + 1]));
    const profiles = snapshot.resolved?.players || {};
    return (match.results || []).flatMap(result => (result.players || []).map(player => ({
      id: String(player.player_id), place: result.place,
      name: profiles[player.player_id]?.display_name || player.display_name || `Player ${player.player_id}`,
      elo: Number.isFinite(player.new_elo) ? Math.round(player.new_elo) : null,
      delta: Number.isFinite(player.delta) ? Math.round(player.delta) : null,
      rank: ranks.get(String(player.player_id)) ?? null
    }))).sort((a, b) => a.place - b.place || (b.elo ?? 0) - (a.elo ?? 0));
  }

  if (typeof module !== "undefined" && module.exports) {
    module.exports = { matchRows };
    return;
  }

  const config = window.NSSR_CONFIG;
  const playerId = new URLSearchParams(location.search).get("player_id");
  const list = document.getElementById("resultsList");
  const status = document.getElementById("status");
  const card = document.getElementById("card");
  let displayedMatch = "";

  function span(className, value) {
    const element = document.createElement("span");
    element.className = className;
    element.textContent = value;
    return element;
  }

  function message(value) {
    list.replaceChildren(span("loading", value));
    card.style.height = "360px";
  }

  function render(rows) {
    list.replaceChildren(...rows.map(player => {
      const row = document.createElement("div");
      const medal = ["", "gold", "silver", "bronze"][player.place] || "";
      row.className = `entry${player.id === playerId ? ` highlight-${medal || "default"}` : ""}`;
      const delta = span(`elo-delta ${player.delta > 0 ? "delta-positive" : player.delta < 0 ? "delta-negative" : ""}`,
        player.delta == null || player.delta === 0 ? "" : Math.abs(player.delta));
      if (player.delta) delta.prepend(span("delta-arrow", player.delta > 0 ? "▲" : "▼"));
      const name = span("player-name", player.name);
      name.title = player.name;
      row.append(span(`place ${medal}`, player.place ?? "—"), name,
        span("elo-value", player.elo ?? "—"), delta, span("rank-value", player.rank ?? "—"));
      return row;
    }));
    card.style.height = `${252 + 80 * rows.length}px`;
  }

  async function update() {
    try {
      const match = await window.NSSR_API.latestMatch(playerId);
      if (!match) {
        message("No matches recorded this season");
        displayedMatch = "";
      } else {
        const hash = JSON.stringify(match);
        if (hash !== displayedMatch) {
          const snapshot = await window.NSSR_API.snapshot();
          render(matchRows(match, snapshot));
          // Like obs-test2, hold these ranks until the tracked player's match changes.
          displayedMatch = hash;
        }
      }
      status.textContent = "";
    } catch (error) {
      status.textContent = `${error.message}. Retrying…`;
      if (!displayedMatch) message("Match results temporarily unavailable");
    } finally {
      setTimeout(update, config.REFRESH_MS);
    }
  }

  if (!playerId || !/^\d{1,20}$/.test(playerId)) {
    message("Add ?player_id=DISCORD_USER_ID to the URL");
    return;
  }
  update();
})();
