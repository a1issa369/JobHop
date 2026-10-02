// Deletes the authenticated caller's own account. Runs server-side because
// auth.admin.deleteUser() requires the service role key, which must never
// reach the browser. The function trusts only the caller's own JWT - it
// reads the user id FROM the verified token, never from the request body,
// so there's no way to pass someone else's id and delete their account.
//
// Deploy with: supabase functions deploy delete-account

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405 });
  }

  const authHeader = req.headers.get('Authorization') ?? '';
  const token = authHeader.replace('Bearer ', '');
  if (!token) {
    return new Response(JSON.stringify({ error: 'Missing auth token' }), { status: 401 });
  }

  // First client: verifies the caller's token (anon key + their JWT).
  const supabaseAuth = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_ANON_KEY') ?? '',
    { global: { headers: { Authorization: authHeader } } }
  );
  const {
    data: { user },
    error: userError
  } = await supabaseAuth.auth.getUser(token);

  if (userError || !user) {
    return new Response(JSON.stringify({ error: 'Invalid or expired session' }), { status: 401 });
  }

  // Second client: service role, used only to perform the deletion.
  const supabaseAdmin = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  );

  // Deleting the auth user cascades to `profiles` (and from there to
  // `applications`, `stage_history`, `friendships`) via the `on delete
  // cascade` foreign keys already defined in schema.sql.
  const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(user.id);

  if (deleteError) {
    return new Response(JSON.stringify({ error: deleteError.message }), { status: 500 });
  }

  return new Response(JSON.stringify({ ok: true }), { status: 200 });
});
