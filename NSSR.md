# NSSR OBS graphics

Nintendo Switch Sports Resort Ranked League uses its own TeamUp league,
`DISCORD|1550493522451234847` (dashboard URL name `2wsc0cal`).

- `nssr-player-data.html?player_id=DISCORD_USER_ID`: 1100 × 880 player card,
  latest three finishes, season Elo chart, and surrounding rankings. Shows the
  top 16, then up to five widening milestone rows and two neighbors on each side
  of the selected player. Rows scale to fit without scrolling.
- `nssr-match-results.html?player_id=DISCORD_USER_ID`: 1720px-wide previous
  match card, with the tracked player highlighted and height based on participants.

Both pages poll every 15 seconds. Change `CURRENT_SEASON` in `nssr-config.js`
to advance both pages: `1` means `season-1`, `2` means `season-2`, etc.
The original NSS graphics continue using `teamup-config.js`.

NSSR uses TeamUp's `/rankings?include=profiles&limit=250` and `/matches/season-N`
REST endpoints through its authenticated proxy. Rankings explicitly request 250 players per page rather than
the default page size. Rankings and history follow pagination cursors;
history is reloaded when the tracked player's match count changes. Names and
avatars come from this new league, without the old NSS member directory or
Worker webhook cache. Match results use the latest match involving the tracked
player, including all opponents. The rank column captures current season ranks
when that match first loads and holds them until the player's match changes,
matching the original graphic's behavior. It is not a historical rank lookup.

## Visual theme

Both NSSR graphics share `nssr-theme.css`, keeping a dark ocean/navy base while
adapting the mint/teal selection bars, coral trim, warm medal accents, and soft corners in
[Nintendo's official Resort menu screenshots](https://www.nintendo.com/jp/topics/article/957c971c-a4ea-4c7d-85c2-1ddadcfe164c).
The palette is adapted for legible broadcast statistics: subdued teal highlights,
warm medal colors, and soft red/amber/green percentage text on dark panels.
The Elo chart uses teal with a coral endpoint. Inter is served from the existing
bundled font, and the canvas outside each card stays transparent. The original
card dimensions and leaderboard selection rules are preserved.

## Authenticated API proxy

Worker: `https://nssr-teamup-api.nextweekmedia.workers.dev`

The source and deployment configuration are in `nssr-proxy/`. The Worker
accepts only GET requests for this NSSR league's rankings and player-filtered
match history. It validates seasons, query parameters, and page limits; all
other leagues, write endpoints, and caller-supplied credentials are rejected.
It adds the `X-API-Key` header server-side, caches successful reads at the edge
for 15 seconds, and strips upstream headers and error bodies. CORS supports
OBS browser sources and local previews. No key is returned to the graphics.

Install the pinned deployment tool with `npm ci`, then configure the secret
through the hidden prompt (do not paste the key into chat or a source file):

```sh
npm run proxy:secret
npm run proxy:deploy
```

The required secret is `TEAMUP_API_KEY`, set to a key from the **NSSR** league's
API & Webhooks page. A read-only key is sufficient. Wrangler retrieves its
existing Cloudflare credential from macOS Keychain. The proxy refuses data
requests with HTTP 503 when its TeamUp key is absent; it never falls back to
unauthenticated requests. `/health` reports whether the binding is configured,
without exposing its value. A successful rankings request additionally verifies
that TeamUp accepts the key.

`API_BASE_URL` in `nssr-config.js` points to the Worker URL above. The read-only
NSSR key is installed as a Worker secret, and authenticated rankings were verified
against the live Season 1 API (56 players at setup).
TeamUp's live API states authentication becomes mandatory on **January 12,
2027**. Do not put a key into static JavaScript or graphic URLs. See
[TeamUp's API reference](https://teamupgg.com/docs/api-reference) and
[Cloudflare secret management](https://developers.cloudflare.com/workers/configuration/secrets/).

`npm run proxy:dev` starts a local proxy. Local secret files (`.dev.vars*`,
`.env*`) and Wrangler state are ignored by Git. No local secret file is needed
for production deployment. The deployment configuration requires the secret
to exist. The initial Worker was bootstrapped without a binding and verified
to reject data reads; subsequent deployments use the committed configuration.
`npm run proxy:check` runs the entrypoint in Cloudflare's local workerd runtime
with a synthetic key and intercepted outbound traffic. It verifies authenticated
fetches and rejection of redirects without forwarding the key to another host.

For local previews, run `python3 -m http.server 8092 --bind 127.0.0.1` from
this repository. Example URLs using a current Season 1 player:

- <http://127.0.0.1:8092/nssr-player-data.html?player_id=374366832863215617>
- <http://127.0.0.1:8092/nssr-match-results.html?player_id=374366832863215617>

Replace `player_id` with any player's Discord ID. OBS browser sources should
use a large enough canvas (for example, 1920 × 1080). The background is
transparent. Run `npm test` for the shared player renderer and NSSR API checks.
