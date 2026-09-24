// Supabase Edge Function, meant to run on a schedule (e.g. every 6 hours via
// Supabase's built-in Cron: `supabase functions deploy rate-limiter --schedule "0 */6 * * *"`).
//
// It just calls the prune_rate_limit_log() Postgres function so the
// rate_limit_log table doesn't grow unbounded. Real-time limit checks
// happen inline in Postgres (see check_rate_limit() in supabase/schema.sql) —
// this function is only for periodic cleanup, not per-request enforcement.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

Deno.serve(async (_req) => {
  const supabaseAdmin = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  );

  const { error } = await supabaseAdmin.rpc('prune_rate_limit_log');

  if (error) {
    return new Response(JSON.stringify({ ok: false, error: error.message }), { status: 500 });
  }
  return new Response(JSON.stringify({ ok: true }), { status: 200 });
});
