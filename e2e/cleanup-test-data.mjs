// One-off cleanup for stray test applications left behind by interrupted
// e2e runs. The suite's own tests delete what they create at the end of a
// successful run, but any run that fails or gets killed partway through
// (very common while iterating on the suite itself) skips that step - and
// those leftovers pile up in "Applied" etc. on your real test accounts
// over many runs. That pile-up is exactly what made the "moving a card to
// a new stage persists after reload" test flaky: the board sorts
// oldest-first and paginates 12 per page, so once enough junk builds up,
// a freshly created card lands on page 2+ instead of page 1.
//
// Run once with: node e2e/cleanup-test-data.mjs
// (uses .env + .env.test, same as the suite itself - safe to re-run any
// time, it only ever deletes rows matching the test suite's own naming.)
import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';

config({ path: '.env' });
config({ path: '.env.test' });

// Every uniqueName() prefix the suite actually uses (see helpers.js /
// applications.spec.js / validation.spec.js) - add to this list if a new
// spec introduces another one.
const TEST_COMPANY_PREFIXES = ['Acme Corp', 'Globex Inc', 'PastDeadline Co'];

const ACCOUNTS = [
  { email: process.env.TEST_USER_EMAIL, password: process.env.TEST_USER_PASSWORD, label: 'TEST_USER' },
  { email: process.env.TEST_USER2_EMAIL, password: process.env.TEST_USER2_PASSWORD, label: 'TEST_USER2' }
].filter((a) => a.email && a.password);

async function cleanupAccount({ email, password, label }) {
  const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);
  const { error: signInErr } = await supabase.auth.signInWithPassword({ email, password });
  if (signInErr) {
    console.error(`[${label}] sign-in failed: ${signInErr.message}`);
    return;
  }

  for (const prefix of TEST_COMPANY_PREFIXES) {
    const { data, error } = await supabase
      .from('applications')
      .delete()
      .ilike('company', `${prefix}%`)
      .select('id, company');

    if (error) {
      console.error(`[${label}] failed deleting "${prefix}*": ${error.message}`);
      continue;
    }
    if (data?.length) {
      console.log(`[${label}] deleted ${data.length} stray "${prefix}*" card(s).`);
    }
  }
}

for (const account of ACCOUNTS) {
  await cleanupAccount(account);
}

console.log('Done.');
