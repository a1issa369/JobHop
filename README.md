# JobHop

A Kanban-style internship/job application tracker with a friend system for
accountability. Cards move through color-coded stages (Wishlist → Applied →
OA/Assessment → Phone Screen → Onsite → Offer, or Rejected/Withdrawn), and
friends can view each other's profile: a GitHub-style activity calendar
(current year only), an optional resume, and a monthly analytical score.

## Stack

- **Frontend**: React (Vite), Tailwind CSS, `@dnd-kit` for drag-and-drop, Chart.js
- **Backend**: Supabase (Postgres, Auth, Storage, Edge Functions)
- **Validation**: zod on the client, `check` constraints in Postgres as a second line of defense

## Setup

1. Create a Supabase project.
2. In the Supabase SQL editor, run `supabase/schema.sql` in full. This creates every
   table, index, RLS policy, and the storage bucket for resumes.
3. Copy `.env.example` to `.env` and fill in your project's URL and anon key.
4. `npm install`
5. `npm run dev`

Optional: deploy `supabase/functions/rate-limiter` as a scheduled Edge Function
to periodically prune the rate-limit log table (`supabase functions deploy
rate-limiter --schedule "0 */6 * * *"`).

## Architecture notes / talking points

- **Auth & RLS**: every table is locked down with Postgres Row Level Security.
  Applications are private by default; a narrow additional policy grants
  accepted friends `SELECT` access to `(id, created_at, stage)` only — the
  client only ever queries those columns for a friend's calendar, so
  recruiter contacts and notes never leave the owner's session even though
  the row-level policy technically permits the row.
- **Rate limiting**: enforced server-side via a Postgres function
  (`check_rate_limit`) that every write-heavy RPC calls first — friend
  requests are capped at 15/hour per user regardless of what the client
  does. The client also throttles locally (`src/lib/rateLimiter.js`) purely
  for instant UX feedback; that layer is not the security boundary.
- **Optimistic UI with rollback**: dragging a card across the board updates
  local state immediately, then confirms with the server; a failed write
  reverts the card to its previous column and surfaces an error.
- **Cursor-friendly design**: `created_at`/`user_id` are indexed on every
  table that gets queried by them, so list views stay fast as data grows;
  swap in `.range()` + a `created_at` cursor if lists get long enough to
  need pagination.
- **Defense in depth on input**: zod validates in the browser; Postgres
  `check` constraints validate again at the database boundary, so a bug or
  a direct API call can't insert a 10,000-character company name or an
  invalid stage value.

## Schema overview

- `profiles` — extends `auth.users`, includes `resume_url`
- `applications` — one row per job/internship card
- `stage_history` — one row per stage transition (powers the conversion chart)
- `friendships` — directed request rows with `pending` / `accepted` / `blocked`
- `rate_limit_log` — sliding-window log used by `check_rate_limit()`
- `monthly_scores` (view) — server-side mirror of the score formula in `src/utils/score.js`
