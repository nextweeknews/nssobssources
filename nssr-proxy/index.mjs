const CLIENT_ID = "DISCORD|1550493522451234847";
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Expose-Headers": "X-NSSR-Cache, Retry-After",
  "X-Content-Type-Options": "nosniff"
};

function json(status, error) {
  return Response.json({ error }, { status, headers: { ...CORS, "Cache-Control": "no-store" } });
}

// Build the upstream URL from an allowlist. Never forward caller headers or a URL.
export function upstreamURL(requestURL) {
  const incoming = new URL(requestURL);
  const path = decodeURIComponent(incoming.pathname);
  const prefix = `/v1/client/${CLIENT_ID}`;
  const rankings = path === `${prefix}/rankings`;
  const match = path.match(/^\/v1\/client\/DISCORD\|1550493522451234847\/matches\/(season-[1-9]\d{0,3})$/);
  if (!rankings && !match) throw new Error("Unsupported endpoint");

  const allowed = new Set(rankings ? ["leaderboard", "format", "limit", "cursor", "include"] : ["format", "limit", "cursor", "player"]);
  for (const key of incoming.searchParams.keys()) {
    if (!allowed.has(key) || incoming.searchParams.getAll(key).length !== 1) throw new Error("Unsupported query");
  }
  const season = rankings ? incoming.searchParams.get("leaderboard") : match[1];
  if (!/^season-[1-9]\d{0,3}$/.test(season || "")) throw new Error("Invalid season");
  const format = incoming.searchParams.get("format") || "global";
  if (format !== "global") throw new Error("Invalid format");
  const limit = incoming.searchParams.get("limit") || (rankings ? "250" : "100");
  if (!/^\d{1,3}$/.test(limit) || Number(limit) < 1 || Number(limit) > (rankings ? 250 : 100)) throw new Error("Invalid limit");
  const cursor = incoming.searchParams.get("cursor");
  if (cursor !== null && !/^[A-Za-z0-9+/_=-]{1,4096}$/.test(cursor)) throw new Error("Invalid cursor");
  const upstream = new URL(`https://api.teamupgg.com/v1/client/${encodeURIComponent(CLIENT_ID)}${rankings ? "/rankings" : `/matches/${season}`}`);
  upstream.searchParams.set("format", format);
  upstream.searchParams.set("limit", String(Number(limit)));
  if (rankings) {
    upstream.searchParams.set("leaderboard", season);
    const include = incoming.searchParams.get("include");
    if (include !== null && include !== "profiles") throw new Error("Invalid include");
    if (include) upstream.searchParams.set("include", include);
  } else {
    const player = incoming.searchParams.get("player");
    if (!/^\d{1,20}$/.test(player || "")) throw new Error("Invalid player");
    upstream.searchParams.set("player", player);
  }
  if (cursor) upstream.searchParams.set("cursor", cursor);
  upstream.searchParams.sort();
  return upstream;
}

export async function handle(request, env, ctx, fetchUpstream, cache) {
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });
  if (request.method !== "GET") return json(405, "Only GET requests are allowed");
  if (new URL(request.url).pathname === "/health") {
    return Response.json({ service: "nssr-teamup-api", configured: Boolean(env.TEAMUP_API_KEY) }, {
      status: env.TEAMUP_API_KEY ? 200 : 503, headers: { ...CORS, "Cache-Control": "no-store" }
    });
  }
  let upstream;
  try { upstream = upstreamURL(request.url); }
  catch { return json(400, "Unsupported NSSR data request"); }
  // Fail closed: never silently fall back to unauthenticated TeamUp reads.
  if (!env.TEAMUP_API_KEY) return json(503, "NSSR API key is not configured");

  const cacheKey = new Request(new URL(upstream.pathname + upstream.search, request.url));
  let stage = "cache_read";
  try {
    const cached = await cache.match(cacheKey);
    if (cached) return publicResponse(cached, "HIT");
    stage = "upstream_fetch";
    const response = await fetchUpstream(upstream, {
      method: "GET",
      headers: { "X-API-Key": env.TEAMUP_API_KEY, "Accept": "application/json" },
      // Workers supports manual redirects; reject every non-2xx response below.
      redirect: "manual",
      signal: AbortSignal.timeout(10000)
    });
    // Do not relay upstream error bodies or headers, which might contain credentials.
    if (!response.ok) {
      await response.body?.cancel();
      console.warn(JSON.stringify({ event: "teamup_error", status: response.status }));
      return json(response.status === 429 ? 429 : 502, "TeamUp data is temporarily unavailable");
    }
    if (!/^application\/json\b/i.test(response.headers.get("Content-Type") || "")) {
      await response.body?.cancel();
      return json(502, "TeamUp returned an unexpected response");
    }
    stage = "response";
    const stored = new Response(response.body, { headers: { "Content-Type": "application/json", "Cache-Control": "public, max-age=15" } });
    ctx.waitUntil(cache.put(cacheKey, stored.clone()).catch(() => {
      console.warn(JSON.stringify({ event: "cache_write_failed" }));
    }));
    return publicResponse(stored, "MISS");
  } catch (error) {
    const kind = error instanceof TypeError ? "type" : error?.name === "TimeoutError" ? "timeout" : "other";
    console.warn(JSON.stringify({ event: "proxy_failed", stage, kind }));
    return json(502, "TeamUp data is temporarily unavailable");
  }
}

function publicResponse(response, cacheStatus) {
  return new Response(response.body, { headers: {
    ...CORS, "Content-Type": "application/json", "Cache-Control": "no-store", "X-NSSR-Cache": cacheStatus
  } });
}

export default {
  fetch(request, env, ctx) {
    return handle(request, env, ctx, (url, init) => fetch(url.toString(), init), caches.default);
  }
};
