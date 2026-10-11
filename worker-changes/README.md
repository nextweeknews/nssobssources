# Player Data OBS graphic

`player-data.html?player_id=DISCORD_USER_ID` uses the same 1100 × 880 card,
colors, rounded rows, stat gradients, transparent background, and 15-second
leaderboard refresh as `obs-rank-full.html`. It follows the active season in
`teamup-config.js`. For example:

```text
player-data.html?player_id=702730732220579950
```

The left side shows a large server-specific Discord avatar and TeamUp name above a row of four
prominent stats: Elo, rank, win percentage, and top-three percentage. An SVG
Elo chart sits beneath them. The right side shows the top
10, bordered milestone rows before the selected player's neighborhood, and
up to two neighbors on each side. Milestones start at increments of five and
widen to 10, 25, 50, 100, etc. as the rank increases, keeping at most five
milestone rows. For example, rank 128 shows 25, 50, 75, 100, and 125 before
the nearby players. Rows scale to fit without scrolling; a player already in
the top 10 appears once.

## Separate Worker patch

The graphic's history requires `POST /get_player_history`. The Worker disables
other live proxy routes. `player-history.patch` adds
only this cache-backed route before that switch and leaves the other live
routes disabled. It targets the existing source at
`nssgolf/teamup-leaderboard-worker/index.js`; the unfinished matchmaking
changes there have not been edited.

From the `nssgolf` checkout, inspect and apply the patch on the feature branch
used for that Worker change:

```sh
git apply --check /Users/aidankellaher/Developer/nssobssources/worker-changes/player-history.patch
git apply /Users/aidankellaher/Developer/nssobssources/worker-changes/player-history.patch
```

The deployable source is maintained in `nextweeknews/nssgolf` at
`teamup-leaderboard-worker/`. The patch is retained as the separately packaged
change requested during implementation. Follow that repository's review and
release rules and deploy the Worker route before publishing this graphic.
The unfinished matchmaking checkout remains untouched.

Server avatars come from the existing public NSS Golf
`discord_guild_members` member profiles. The graphic prefers `server_avatar_url`
for both the main player and leaderboard rows, falling back to the general
avatar when the member has no server-specific avatar. This uses the existing
Supabase publishable client key in `teamup-config.js`; no private key is sent
to the browser. Member profiles refresh with the 15-second leaderboard poll.

The route validates the player against the current cached season and uses
TeamUp's player-filtered match-history endpoint:

```text
/v1/client/{client_id}/matches/{leaderboard}?player={player_id}&limit=100&cursor=...
```

The `player` query parameter was verified with real Season 14 data. TeamUp
ignores `player_id` on this endpoint. Global history omits the format path
segment. Authentication stays in the existing Worker's `TEAMUP_API_KEY`
binding; the graphic never receives credentials.

On first use the Worker paginates the season history. It stores one combined
history per season/player in the existing KV binding. Unchanged match counts
reuse this cache, including after a browser reload. A higher match count
fetches only pages containing new games, stopping at the latest cached game.
A lower count rebuilds the history to account for an undo. Zero matches need
no upstream call. History pagination has a visible 10,000-game ceiling.

The browser requests history on initial load and when that player's cached
match count changes, including games with no Elo change. Other players'
matches, changes in rank, and regular refreshes do not trigger history
requests. If history and the snapshot disagree or a request fails, the
graphic preserves the last rendered chart and retries. KV is eventually
consistent, so simultaneous cold loads can duplicate an upstream fetch.

## Validation

Run `npm test` in this repository. Tests execute the added route from the
patch itself with synthetic KV/TeamUp responses and check pagination,
incremental fetches, undo handling, cache reuse, validation, upstream lag,
failure retries, leaderboard selection, placement rates, and chart ordering.
The patch also passed `git apply --check` against the current canonical source
and JavaScript syntax checks after applying to a temporary copy.

Browser verification used a local preview server with an actual cached
Season 14 leaderboard and NWN Aidan's six TeamUp games. It confirmed the
1100 × 880 card, 15-second polling, no history fetch on an unchanged poll,
one additional fetch for a simulated new match with unchanged Elo, and no
leaderboard overflow at rank 33 or rank 128. Final production verification
must include the deployed history route and rendered graphic.
