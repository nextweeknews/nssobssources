import test from "node:test";
import assert from "node:assert/strict";
import { handle, upstreamURL } from "./index.mjs";

const root = "https://proxy.example/v1/client/DISCORD%7C1550493522451234847";
const rankings = `${root}/rankings?leaderboard=season-1&include=profiles&limit=250&format=global`;

function harness(upstream = () => Response.json({ entries: [{ player_id: "1" }] })) {
  const values = new Map(), calls = [], tasks = [];
  const cache = { match: async key => values.get(key.url)?.clone(), put: async (key, response) => { values.set(key.url, response); } };
  const ctx = { waitUntil: task => tasks.push(task) };
  return {
    calls,
    async request(url = rankings, options = {}, env = { TEAMUP_API_KEY: "synthetic-test-key" }) {
      const response = await handle(new Request(url, options), env, ctx, async (url, init) => {
        calls.push({ url: new URL(url), init });
        return upstream();
      }, cache);
      await Promise.all(tasks.splice(0));
      return response;
    }
  };
}

test("proxy authenticates NSSR reads server-side and serves canonical cached JSON", async () => {
  const proxy = harness();
  const response = await proxy.request(rankings, { headers: { Authorization: "untrusted", "X-API-Key": "untrusted", Cookie: "untrusted" } });
  assert.equal(response.status, 200);
  assert.equal(proxy.calls.length, 1);
  assert.equal(proxy.calls[0].url.host, "api.teamupgg.com");
  assert.equal(proxy.calls[0].url.searchParams.get("limit"), "250");
  assert.deepEqual(proxy.calls[0].init.headers, { "X-API-Key": "synthetic-test-key", Accept: "application/json" });
  assert.equal(proxy.calls[0].init.redirect, "manual");
  assert.equal(response.headers.get("X-API-Key"), null);
  assert.equal(response.headers.get("Access-Control-Allow-Origin"), "*");
  assert.equal(response.headers.get("X-NSSR-Cache"), "MISS");
  assert.ok(!(await response.text()).includes("synthetic-test-key"));
  const cached = await proxy.request(`${root}/rankings?format=global&limit=250&include=profiles&leaderboard=season-1`);
  assert.equal(cached.headers.get("X-NSSR-Cache"), "HIT");
  assert.equal(proxy.calls.length, 1);
});

test("proxy accepts NSSR seasons and player pagination without exposing other APIs", async () => {
  const proxy = harness();
  await proxy.request(`${root}/matches/season-15?player=123&limit=100&cursor=YWJj%3D`);
  const url = proxy.calls[0].url;
  assert.equal(url.searchParams.get("player"), "123");
  assert.equal(url.searchParams.get("cursor"), "YWJj=");
  assert.ok(url.pathname.endsWith("/matches/season-15"));
  for (const bad of [
    rankings.replace("1550493522451234847", "1069003073311211601"),
    rankings.replace("rankings", "players/123/profile"),
    rankings.replace("season-1", "Season_1"),
    rankings.replace("limit=250", "limit=251"),
    `${rankings}&include_hidden=true`, `${rankings}&limit=10`,
    `${root}/matches/season-1?limit=1`,
    `${root}/matches/season-1?player=123&limit=101`,
    `${root}/matches/season-1?player=not-a-discord-id`,
    `${root}/rankings%ZZ?leaderboard=season-1`
  ]) assert.equal((await proxy.request(bad)).status, 400, bad);
  assert.equal(proxy.calls.length, 1);
  assert.equal((await proxy.request(rankings, { method: "POST" })).status, 405);
  assert.equal((await proxy.request(rankings, { method: "OPTIONS" })).status, 204);
  assert.throws(() => upstreamURL("https://proxy.example/record_match"));
});

test("proxy fails closed without a key even if data was previously cached", async () => {
  const proxy = harness();
  await proxy.request();
  const response = await proxy.request(rankings, {}, {});
  assert.equal(response.status, 503);
  assert.equal(proxy.calls.length, 1);
  const health = await proxy.request("https://proxy.example/health", {}, {});
  assert.equal(health.status, 503);
  assert.deepEqual(await health.json(), { service: "nssr-teamup-api", configured: false });
});

test("proxy suppresses upstream failures, redirects, and credential-bearing headers", async () => {
  for (const status of [301, 401, 403, 429, 500]) {
    const proxy = harness(() => new Response("sensitive upstream error", { status, headers: { Location: "https://other.example", "Set-Cookie": "private" } }));
    const response = await proxy.request();
    assert.equal(response.status, status === 429 ? 429 : 502);
    assert.ok(!(await response.text()).includes("sensitive"));
    assert.equal(response.headers.get("Set-Cookie"), null);
    await proxy.request();
    assert.equal(proxy.calls.length, 2);
  }
  assert.equal((await harness(() => new Response("html")).request()).status, 502);
  assert.equal((await harness(() => { throw new Error("private failure"); }).request()).status, 502);
});
