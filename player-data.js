(function () {
  "use strict";

  function normalizeLeaderboard(data, members = {}) {
    const entries = Array.isArray(data?.leaderboard) ? data.leaderboard : data?.entries;
    if (!Array.isArray(entries)) throw new Error("Leaderboard data is unavailable");
    const profiles = data?.resolved?.players || {};
    // Keep the same Elo ordering and stable tie order as obs-rank-full.html.
    return [...entries].sort((a, b) => (b.elo ?? 0) - (a.elo ?? 0)).map((entry, index) => {
      const id = String(entry.team?.[0] ?? entry.player_id ?? "");
      const profile = profiles[id] || {};
      const member = members[id] || {};
      const matches = Number(entry.matches ?? 0);
      const wins = Number(entry.count_placement_1 ?? entry.wins ?? 0);
      const top3 = wins + Number(entry.count_placement_2 ?? 0) + Number(entry.count_placement_3 ?? 0);
      return {
        id, rank: index + 1, elo: Math.round(entry.elo ?? 0), matches,
        name: entry.display_name || profile.display_name || profile.username || `Player ${id}`,
        avatar: member.server_avatar_url || entry.server_avatar_url || profile.server_avatar_url || member.avatar_url || entry.avatar_url || profile.avatar_url,
        winRate: matches > 0 ? wins / matches * 100 : null,
        top3Rate: matches > 0 ? top3 / matches * 100 : null
      };
    });
  }

  function leaderboardRows(players, playerId) {
    const selectedIndex = players.findIndex(player => player.id === playerId);
    const rows = players.slice(0, 10).map(player => ({ player, milestone: false }));
    if (selectedIndex < 10) return rows;
    const start = Math.max(10, selectedIndex - 2);
    const end = Math.min(players.length, selectedIndex + 3);
    // Use familiar 5/10/25/50/100/... milestones, keeping at most five rows.
    let step = 5;
    for (let scale = 10; Math.floor(start / step) - Math.floor(10 / step) > 5; scale *= 10) {
      step = [scale, scale * 2.5, scale * 5].find(value => Math.floor(start / value) - Math.floor(10 / value) <= 5) || scale * 5;
    }
    for (let rank = (Math.floor(10 / step) + 1) * step; rank <= start; rank += step) {
      rows.push({ player: players[rank - 1], milestone: true });
    }
    for (let index = start; index < end; index++) rows.push({ player: players[index], milestone: false });
    return rows;
  }

  function historyPoints(matches, playerId) {
    const byTimestamp = new Map();
    for (const match of matches) {
      const result = (match.results || []).find(result =>
        (result.players || []).some(entry => String(entry.player_id) === playerId));
      const player = result?.players?.find(entry => String(entry.player_id) === playerId);
      if (!player || !Number.isFinite(player.new_elo) || !Number.isFinite(match.timestamp)) continue;
      byTimestamp.set(match.timestamp, {
        timestamp: match.timestamp, elo: player.new_elo, before: player.old_elo, game: player.matches,
        finish: Number.isInteger(result.place) && result.place > 0 ? result.place : null,
        tied: result.tied ?? (match.results || []).filter(team => team.place === result.place)
          .reduce((count, team) => count + (team.players || []).length, 0) > 1,
        delta: Number.isFinite(player.delta) ? player.delta : Number.isFinite(player.old_elo) ? player.new_elo - player.old_elo : null
      });
    }
    const points = [...byTimestamp.values()].sort((a, b) => a.timestamp - b.timestamp);
    if (points.length && Number.isFinite(points[0].before)) {
      points.unshift({ elo: points[0].before, game: Number.isFinite(points[0].game) ? points[0].game - 1 : 0 });
    }
    return points;
  }

  function lastThreeMatches(points) {
    return points.filter(point => point.timestamp != null).slice(-3);
  }

  function rateColor(rate, low, mid, high) {
    if (rate == null) return "#d3d3d3";
    const colors = [[248,113,113], [250,204,21], [74,222,128]];
    const segment = rate < mid ? 0 : 1;
    const t = Math.max(0, Math.min(1, (rate - (segment ? mid : low)) / (segment ? high - mid : mid - low)));
    return `rgb(${colors[segment].map((value, i) => Math.round(value + t * (colors[segment + 1][i] - value))).join(",")})`;
  }

  // Both browser polling and the runnable checks use this exact match-count gate.
  function needsHistory(player, loadedMatches) {
    return player.matches !== loadedMatches;
  }

  function ordinalRank(rank) {
    const lastTwo = rank % 100;
    const suffix = lastTwo >= 11 && lastTwo <= 13 ? "th" : ({ 1: "st", 2: "nd", 3: "rd" }[rank % 10] || "th");
    return `${rank}${suffix}`;
  }

  if (typeof module !== "undefined" && module.exports) {
    module.exports = { normalizeLeaderboard, leaderboardRows, historyPoints, lastThreeMatches, needsHistory, ordinalRank };
    return;
  }

  const config = window.TEAMUP_CONFIG;
  const playerId = new URLSearchParams(location.search).get("player_id");
  const profileEl = document.getElementById("profile");
  const listEl = document.getElementById("resultsList");
  const statusEl = document.getElementById("status");
  const messageEl = document.getElementById("chartMessage");
  const chartEl = document.getElementById("chart");
  const recentEl = document.getElementById("recentMatches");
  let loadedMatches = null;
  let busy = false;
  let displayedState = "";
  let chartPoints = [];
  const memberProfiles = {};

  function span(className, text) {
    const element = document.createElement("span");
    element.className = className;
    element.textContent = text;
    return element;
  }

  function identity(player) {
    const element = span("identity", "");
    const fallback = span("avatar", player.name.slice(0, 1).toUpperCase());
    element.append(fallback);
    // TeamUp profiles are untrusted; render names as text and permit only HTTPS avatars.
    if (player.avatar && /^https:\/\//i.test(player.avatar)) {
      const image = document.createElement("img");
      image.className = "avatar";
      image.alt = "";
      image.src = player.avatar;
      image.addEventListener("load", () => fallback.replaceWith(image), { once: true });
    }
    const name = span("name", player.name);
    name.title = player.name;
    element.append(name);
    return element;
  }

  function rate(value) { return value == null ? "—" : `${Math.round(value)}%`; }

  function renderLeaderboard(players, player) {
    const matchCount = document.getElementById("matchCount");
    matchCount.textContent = `${player.matches} matches`;
    matchCount.hidden = false;
    profileEl.replaceChildren(identity(player));
    for (const [label, value, color] of [
      ["Elo", player.elo, "#fff"], ["Rank", ordinalRank(player.rank), "#c7d7ff"],
      ["Win %", rate(player.winRate), rateColor(player.winRate, 10, 25, 40)],
      ["Top 3 %", rate(player.top3Rate), rateColor(player.top3Rate, 50, 70, 90)]
    ]) {
      const stat = document.createElement("div");
      stat.className = "stat";
      const number = span("value", value);
      number.style.color = color;
      stat.append(span("label", label), number);
      profileEl.append(stat);
    }
    const rows = leaderboardRows(players, playerId).map((row, index, list) => ({
      ...row, jump: index > 0 && row.player.rank > list[index - 1].player.rank + 1
    }));
    const style = getComputedStyle(listEl);
    const rowGap = parseFloat(style.getPropertyValue("--row-gap"));
    const separatorGap = parseFloat(style.getPropertyValue("--separator-space"));
    const spacing = rows.slice(1).reduce((total, row) => total + (row.jump ? 2 * separatorGap + 1 : rowGap), 0);
    const height = Math.min(42, (listEl.clientHeight - spacing) / rows.length);
    listEl.style.setProperty("--row-height", `${height}px`);
    listEl.style.setProperty("--row-font", `${Math.max(11, Math.min(16, height * .7))}px`);
    listEl.style.setProperty("--avatar-size", `${Math.max(12, Math.min(28, height - 8))}px`);
    listEl.replaceChildren(...rows.flatMap(({ player: rowPlayer, milestone, jump }) => {
      const row = document.createElement("div");
      row.className = `entry rank-${rowPlayer.rank}${milestone ? " milestone" : ""}${rowPlayer.id === playerId ? " selected" : ""}`;
      row.dataset.rank = rowPlayer.rank;
      const medal = ["", "gold", "silver", "bronze"][rowPlayer.rank] || "";
      const winRate = span("", rate(rowPlayer.winRate));
      winRate.style.color = rateColor(rowPlayer.winRate, 10, 25, 40);
      row.append(span(`place ${medal}`, rowPlayer.rank), identity(rowPlayer), span("elo", rowPlayer.elo), winRate);
      if (jump) {
        const separator = document.createElement("div");
        separator.className = "rank-gap";
        separator.dataset.rank = rowPlayer.rank;
        separator.setAttribute("aria-hidden", "true");
        return [separator, row];
      }
      return [row];
    }));
  }

  function svgElement(tag, attributes, text) {
    const element = document.createElementNS("http://www.w3.org/2000/svg", tag);
    for (const [key, value] of Object.entries(attributes)) element.setAttribute(key, value);
    if (text != null) element.textContent = text;
    chartEl.append(element);
    return element;
  }

  function renderRecentMatches(points) {
    const matches = lastThreeMatches(points);
    recentEl.replaceChildren(...Array.from({ length: 3 }, (_, index) => {
      const match = matches[index - (3 - matches.length)];
      const finish = match?.finish;
      const change = Number.isFinite(match?.delta) ? Math.round(match.delta) : null;
      const entry = document.createElement("div");
      entry.className = "match-result";
      entry.title = match ? `Match ${match.game ?? ""} · ${new Date(match.timestamp).toLocaleDateString()}` : "No earlier match";
      const medal = ["", "gold", "silver", "bronze"][finish] || "";
      const movement = span(`match-change${change > 0 ? " gain" : change < 0 ? " loss" : ""}`,
        change != null ? Math.abs(change) : "—");
      if (change != null && change !== 0) movement.prepend(span("delta-arrow", change > 0 ? "▲" : "▼"));
      movement.setAttribute("aria-label", change != null ? `${change > 0 ? "Gained" : change < 0 ? "Lost" : "Unchanged:"} ${Math.abs(change)} Elo` : "Elo movement unavailable");
      entry.append(span(`match-finish ${medal}`, finish != null ? `${match.tied ? "T-" : ""}${ordinalRank(finish)}` : "—"), movement);
      return entry;
    }));
  }

  function renderChart(points) {
    renderRecentMatches(points);
    chartEl.replaceChildren();
    if (!points.length) {
      messageEl.hidden = false;
      messageEl.textContent = "No games recorded this season";
      return;
    }
    messageEl.hidden = true;
    const width = chartEl.clientWidth, height = chartEl.clientHeight;
    chartEl.setAttribute("viewBox", `0 0 ${width} ${height}`);
    const left = 58, right = width - 24, top = 32, bottom = height - 24;
    const min = Math.min(...points.map(point => point.elo));
    const max = Math.max(...points.map(point => point.elo));
    const pad = Math.max(5, (max - min) * .08);
    const low = Math.floor((min - pad) / 5) * 5;
    const high = Math.ceil((max + pad) / 5) * 5;
    const x = index => left + index / Math.max(1, points.length - 1) * (right - left);
    const y = elo => bottom - (elo - low) / (high - low) * (bottom - top);
    const textStyle = { fill: "#9ca3c7", "font-size": 13, "font-family": "Inter, system-ui, sans-serif" };
    for (let tick = 0; tick <= 4; tick++) {
      const elo = low + (high - low) * tick / 4;
      svgElement("line", { x1: left, x2: right, y1: y(elo), y2: y(elo), stroke: "#ffffff", "stroke-opacity": .1 });
      svgElement("text", { ...textStyle, x: left - 10, y: y(elo) + 4, "text-anchor": "end" }, Math.round(elo));
    }
    const coordinates = points.map((point, index) => `${x(index)},${y(point.elo)}`).join(" ");
    svgElement("polyline", { points: coordinates, fill: "none", stroke: "#c7d7ff", "stroke-width": 3, "stroke-linejoin": "round", "stroke-linecap": "round" });
    const last = points[points.length - 1];
    svgElement("circle", { cx: x(points.length - 1), cy: y(last.elo), r: 5, fill: "#4ade80" });
    chartEl.setAttribute("aria-label", `Elo history over ${points.length - 1} matches, latest rating ${Math.round(last.elo)}`);
  }

  async function post(path, body) {
    const response = await fetch(`${config.WORKER_BASE_URL}${path}`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ leaderboard: config.CURRENT_LEADERBOARD_KEY, format: config.DEFAULT_FORMAT, ...body }),
      signal: AbortSignal.timeout(12000)
    });
    if (!response.ok) throw new Error(`Data request failed (${response.status})`);
    return response.json();
  }

  async function update() {
    if (busy) return;
    busy = true;
    try {
      const snapshot = await post("/get_leaderboard_snapshot", {});
      const initialPlayers = normalizeLeaderboard(snapshot, memberProfiles);
      const ids = leaderboardRows(initialPlayers, playerId).map(row => row.player.id);
      let avatarWarning = "";
      try {
        const query = new URLSearchParams({
          select: "discord_user_id,server_avatar_url,avatar_url", discord_user_id: `in.(${ids.join(",")})`
        });
        const response = await fetch(`${config.GUILD_MEMBER_API_URL}?${query}`, {
          headers: { apikey: config.GUILD_MEMBER_PUBLISHABLE_KEY }, signal: AbortSignal.timeout(5000)
        });
        if (!response.ok) throw new Error("Member profiles unavailable");
        const members = await response.json();
        if (!Array.isArray(members)) throw new Error("Invalid member profiles");
        ids.forEach(id => { memberProfiles[id] = null; });
        members.forEach(member => { memberProfiles[String(member.discord_user_id)] = member; });
      } catch {
        avatarWarning = "Server avatars temporarily unavailable. Retrying…";
      }
      const players = normalizeLeaderboard(snapshot, memberProfiles);
      const player = players.find(entry => entry.id === playerId);
      if (!player) throw new Error("Player not found in this season's leaderboard");
      const state = JSON.stringify(players);
      if (state !== displayedState) {
        renderLeaderboard(players, player);
        displayedState = state;
      }
      statusEl.textContent = avatarWarning;
      if (needsHistory(player, loadedMatches)) {
        try {
          const data = await post("/get_player_history", { player_id: playerId });
          if (!Array.isArray(data.matches)) throw new Error("History data is unavailable");
          // If the upstream history is still catching up, retry without marking it loaded.
          if (data.matches_count !== player.matches) throw new Error("Waiting for the latest match history");
          const nextPoints = historyPoints(data.matches, playerId);
          if (player.matches > 0 && nextPoints.length < 2) throw new Error("Player rating history is incomplete");
          chartPoints = nextPoints;
          renderChart(chartPoints);
          loadedMatches = player.matches;
        } catch (error) {
          statusEl.textContent = `History: ${error.message}. Retrying…`;
          if (!chartPoints.length) {
            recentEl.replaceChildren(span("recent-loading", "Recent matches temporarily unavailable"));
            messageEl.hidden = false;
            messageEl.textContent = "Rating history temporarily unavailable";
          }
        }
      }
    } catch (error) {
      statusEl.textContent = `${error.message}. Retrying…`;
    } finally {
      busy = false;
    }
  }

  if (!playerId || !/^\d{1,20}$/.test(playerId)) {
    profileEl.style.display = "flex";
    profileEl.textContent = "Add ?player_id=DISCORD_USER_ID to the URL";
    recentEl.replaceChildren(span("recent-loading", "Select a player to show recent matches"));
    messageEl.textContent = "Select a player to show their season history";
    return;
  }
  update();
  setInterval(update, 15000);
})();
