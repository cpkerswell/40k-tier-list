# 40K Tier List

Head-to-head Warhammer 40K faction voting. Two nearby-ranked factions are shown,
you pick the stronger one, and an Elo rating updates behind the scenes. Standings
are grouped into S/A/B/C/D tiers. No login — repeat votes on the same match-up
are blocked client-side via `localStorage`.

## Stack

- Vite + React + TypeScript
- Supabase (Postgres + PostgREST) for storage and Elo updates
- No component library — hand-written mobile-first CSS

## 1. Create the Supabase project

1. Go to [supabase.com](https://supabase.com) and sign in (or create a free account).
2. Click **New project**. Pick an organization, give it a name (e.g. `40k-tier-list`),
   set a database password (save it somewhere — you won't need it for this app, but
   you will if you ever connect directly to Postgres), and choose a region close to
   your users.
3. Wait for provisioning to finish (a minute or two).
4. In the left sidebar, open **SQL Editor** → **New query**. Paste in the contents of
   [`supabase/schema.sql`](./supabase/schema.sql) and run it. This creates the
   `factions` and `votes` tables, the `record_vote` function that does the Elo math,
   and row-level security policies (public read-only; writes only via `record_vote`).
5. Run [`supabase/seed.sql`](./supabase/seed.sql) the same way to populate the
   current tabletop factions. Re-running it later is safe — it skips names that
   already exist.
6. In the left sidebar, open **Project Settings** → **API**. You'll need two values
   from here in the next step:
   - **Project URL** (e.g. `https://abcdefghijk.supabase.co`)
   - **anon public** key (under Project API keys — this is the key meant for
     browser use; row-level security keeps it safe)

## 2. Connect the app to your project

Copy the example env file and fill in the two values from the step above:

```sh
cp .env.example .env.local
```

```env
VITE_SUPABASE_URL=https://your-project-ref.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-public-key
```

`.env.local` is already git-ignored (matches the `*.local` pattern), so your keys
never get committed. Never put the **service_role** key in this file or anywhere
in the frontend — it bypasses row-level security entirely.

## 3. Applying database changes (Supabase CLI)

Instead of copy-pasting SQL into the dashboard's SQL Editor every time, link
this repo to your project once and push future migrations with one command.

Run these yourself — they need your own Supabase login and database password,
so this part can't be scripted for you:

```sh
npx supabase login
npx supabase link --project-ref wzojscflhlyxbefejxip
npx supabase db pull
```

- `login` opens a browser to authenticate the CLI with your Supabase account.
- `link` connects this repo to the project — it'll ask for the database
  password you set when creating it.
- `db pull` snapshots the project's current schema into `supabase/migrations/`
  and marks it as already applied, so a later `db push` won't try to replay
  everything from scratch.

From then on:

- `npm run db:new-migration <name>` creates a new timestamped file under
  `supabase/migrations/`.
- `npm run db:push` applies any migrations that haven't been run yet against
  the linked project.

The old workflow — pasting `schema.sql` / `seed.sql` / the numbered files
below into the SQL Editor by hand — still works fine if you'd rather not
install the CLI.

## 4. Run it

```sh
npm install
npm run dev
```

Open the printed local URL — on your phone, use `npm run dev -- --host` and open
the LAN address it prints instead.

## Deploying (Vercel)

Git auto-deploy is **disabled** for `main` (via `vercel.json`'s
`git.deploymentEnabled`). Vercel's build cache intermittently shipped a stale,
incomplete bundle on Git-triggered deploys (env vars not inlined → blank page),
and `VERCEL_FORCE_NO_BUILD_CACHE` didn't reliably prevent it. So production is
released explicitly instead:

```sh
npm run deploy   # vercel --prod --force  +  post-deploy smoke test
```

`--force` skips the build cache (always produces the correct bundle). The smoke
test (`npm run smoke [url]`) then fetches the deployed bundle and fails if the
Supabase URL isn't inlined or the bundle is suspiciously small — the exact
blank-page failure mode — retrying a few times to allow for alias propagation.
Pushing to `main` still updates GitHub but no longer touches production.

## How it works

- **Pairing** (`src/lib/pairing.ts`): factions are ranked by Elo, and each
  match-up is picked from factions close together in that ranking (starting
  within 3 ranks of each other, widening if every nearby pair has already been
  voted on in this browser). This keeps votes meaningful instead of always
  pitting the best against the worst.
- **Elo updates** (`supabase/schema.sql`, `record_vote` function): run inside
  Postgres as a `SECURITY DEFINER` function so the browser's anon key never
  needs direct write access to the tables — it only ever calls `record_vote(winner_id, loser_id)`.
- **Vote-spam mitigation** (same `record_vote` function): each side's K-factor
  is divided by `(1 + how many of that voter's own last 10 votes in this group
  already had this exact faction winning/losing)`. One voter repeatedly making
  the same faction win (or lose) — deliberate spam or just enthusiastically
  clicking through the "champion" gauntlet — has diminishing effect on the
  shared rating rather than compounding. Needs no new columns or tracking ID;
  it keys on `voter_name`, which every voter now has (`src/lib/identity.ts`
  auto-generates a random one if they don't pick one), so anonymous voters are
  covered too. Deliberately soft rather than an on/off ban — there's no login,
  so a determined bad actor can always reset and start over; this only blunts
  casual spam.
- **Repeat-vote limiting** (`src/lib/voteHistory.ts`): each voted pair is stored
  in `localStorage` (no login, no server-side tracking). Once you've voted on a
  pair, it won't be shown again on that device/browser.
- **Tiers** (`src/lib/tiers.ts`): factions are bucketed into S/A/B/C/D by rank
  percentile (top 10% = S, next 20% = A, next 40% = B, next 20% = C, bottom 10% = D),
  so tiers stay populated regardless of how spread out the Elo ratings are.
- **Groups** (`src/lib/group.ts`): visiting `/<slug>` (e.g. `/groupA`) gives that
  URL its own fully isolated voting pool — separate Elo, tier list, activity
  feed, and repeat-vote history — without affecting the root URL or any other
  group. New slugs need no setup; they're created the first time anyone
  visits. Ratings live in the `group_ratings` table, keyed by
  `(group_slug, faction_id)`, defaulting to 1500/0 for any faction nobody in
  that group has voted on yet (see `factions_for_group` in `schema.sql`).
- **Dispositions** (`src/lib/dispositions.ts`): the five Warhammer 40k 11th
  edition Force Dispositions (Take and Hold, Purge the Foe, Reconnaissance,
  Disruption, Priority Assets). On the Factions tab, tag a known faction with
  whichever ones you play it with; when that faction comes up in a vote,
  you're shown one of its tagged dispositions (toggle this off in the header).
  Every vote still updates the faction's normal whole-faction Elo, and
  additionally updates a disposition-scoped Elo for any tagged side. The tier
  list's "By Disposition" view splits a faction into separate ranked rows only
  once 2+ distinct dispositions actually have votes for it; otherwise it stays
  a single unified row.

## Project structure

```
src/
  lib/
    supabaseClient.ts    Supabase client, reads env vars
    pairing.ts           picks the next match-up (nearest-rank, preference-first)
    voteHistory.ts       localStorage-backed repeat-vote guard
    preferences.ts       localStorage-backed "factions I know" set
    identity.ts          localStorage-backed voter display name
    tiers.ts             Elo -> S/A/B/C/D bucketing
    factionTheme.ts      per-faction color + icon
    relativeTime.ts      "3m ago" formatting for the feed
  hooks/
    useFactions.ts       fetches + refetches factions sorted by Elo
  components/
    FactionCard.tsx
    VoteView.tsx
    PreferencesView.tsx  "Factions" tab — mark which ones you know
    TierListView.tsx
    ActivityFeed.tsx     "Feed" tab — live votes via Supabase Realtime
    VoterNameControl.tsx
    icons.tsx            original SVG glyphs per faction
supabase/
  schema.sql             tables, RLS policies, record_vote() function
  seed.sql                current tabletop factions
  migrations/             incremental changes; superseded once db pull baselines them
  config.toml             Supabase CLI project config
```
