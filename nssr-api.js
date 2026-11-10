(function () {
  "use strict";
  const config = window.NSSR_CONFIG;
  const base = `${config.API_BASE_URL}/v1/client/${encodeURIComponent(config.CLIENT_ID)}`;
  const season = config.CURRENT_LEADERBOARD_KEY;

  async function get(path, params = {}) {
    const url = new URL(`${base}${path}`);
    url.search = new URLSearchParams({ format: config.DEFAULT_FORMAT, ...params });
    const response = await fetch(url, { signal: AbortSignal.timeout(12000) });
    if (!response.ok) throw new Error(`NSSR data request failed (${response.status})`);
    return response.json();
  }

  async function pages(path, params, field) {
    const items = [], profiles = {}, cursors = new Set();
    let cursor;
    do {
      const data = await get(path, { ...params, ...(cursor ? { cursor } : {}) });
      if (!Array.isArray(data[field])) throw new Error(`NSSR ${field} unavailable`);
      items.push(...data[field]);
      Object.assign(profiles, data.resolved?.players);
      cursor = data.cursor;
      if (cursor && (cursors.has(cursor) || cursors.size >= 100)) {
        throw new Error("NSSR pagination did not finish");
      }
      cursors.add(cursor);
    } while (cursor);
    return { [field]: items, resolved: { players: profiles } };
  }

  async function snapshot() {
    return pages("/rankings", { leaderboard: season, include: "profiles", limit: config.LEADERBOARD_LIMIT }, "entries");
  }

  async function history(playerId) {
    const data = await pages(`/matches/${encodeURIComponent(season)}`, { player: playerId, limit: 100 }, "matches");
    // Count actual player records, so lagging history is retried by player-data.js.
    return { ...data, matches_count: data.matches.filter(match => match.results?.some(result =>
      result.players?.some(player => String(player.player_id) === playerId))).length };
  }

  async function latestMatch(playerId) {
    const data = await get(`/matches/${encodeURIComponent(season)}`, { player: playerId, limit: 1 });
    if (!Array.isArray(data.matches)) throw new Error("NSSR matches unavailable");
    // Keep the full opponent results; a player-filtered API request returns the whole match.
    return data.matches.find(match => match.results?.some(result =>
      result.players?.some(player => String(player.player_id) === playerId))) || null;
  }

  window.NSSR_API = Object.freeze({ snapshot, history, latestMatch });
})();
