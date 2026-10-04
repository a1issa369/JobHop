import { format } from 'date-fns';

// `created_at` columns come back from Supabase as UTC ISO timestamps.
// Bucketing activity by calendar day needs the user's LOCAL calendar day,
// not the UTC one - slicing the first 10 characters of the ISO string
// (the old approach) takes the UTC date, which is off by a day for most
// of the world depending on time of day: an application made at 7pm
// Pacific is already "tomorrow" in UTC. `new Date(iso)` parses the
// absolute instant; date-fns' `format` then reads it back using the
// browser's LOCAL timezone, which is what the calendar heatmap actually
// needs to key by.
export function localDateKey(iso) {
  return format(new Date(iso), 'yyyy-MM-dd');
}

// The UTC instant that corresponds to local midnight on Jan 1 of `year` -
// used as a query lower bound so "this year's activity" means the user's
// own calendar year, not UTC's (which, depending on timezone, can start
// up to a day early or late relative to the user's actual Jan 1).
export function startOfLocalYearISO(year) {
  return new Date(year, 0, 1).toISOString();
}
