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

## 3. Run it

```sh
npm install
npm run dev
```

Open the printed local URL — on your phone, use `npm run dev -- --host` and open
the LAN address it prints instead.

## How it works

- **Pairing** (`src/lib/pairing.ts`): factions are ranked by Elo, and each
  match-up is picked from factions close together in that ranking (starting
  within 3 ranks of each other, widening if every nearby pair has already been
  voted on in this browser). This keeps votes meaningful instead of always
  pitting the best against the worst.
- **Elo updates** (`supabase/schema.sql`, `record_vote` function): run inside
  Postgres as a `SECURITY DEFINER` function so the browser's anon key never
  needs direct write access to the tables — it only ever calls `record_vote(winner_id, loser_id)`.
- **Repeat-vote limiting** (`src/lib/voteHistory.ts`): each voted pair is stored
  in `localStorage` (no login, no server-side tracking). Once you've voted on a
  pair, it won't be shown again on that device/browser.
- **Tiers** (`src/lib/tiers.ts`): factions are bucketed into S/A/B/C/D by rank
  percentile (top 10% = S, next 20% = A, next 40% = B, next 20% = C, bottom 10% = D),
  so tiers stay populated regardless of how spread out the Elo ratings are.

## Project structure

```
src/
  lib/
    supabaseClient.ts   Supabase client, reads env vars
    pairing.ts          picks the next match-up
    voteHistory.ts       localStorage-backed repeat-vote guard
    tiers.ts             Elo -> S/A/B/C/D bucketing
  hooks/
    useFactions.ts       fetches + refetches factions sorted by Elo
  components/
    FactionCard.tsx
    VoteView.tsx
    TierListView.tsx
supabase/
  schema.sql             tables, RLS policies, record_vote() function
  seed.sql                current tabletop factions
```
