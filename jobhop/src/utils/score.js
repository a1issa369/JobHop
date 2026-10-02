import { FUNNEL_ORDER } from './stageConfig';

/**
 * Simple monthly score: applications count + conversion rate.
 *   - volume component: applications submitted this month, capped so one
 *     wildly high month doesn't blow out the 0-100 scale (cap at 20 apps = 50 pts)
 *   - conversion component: (apps that moved past "applied") / (apps applied) * 50
 *
 * Both components are 0-50, summed to a 0-100 score.
 * This mirrors the same formula the DB view `monthly_scores` computes server-side
 * (see supabase/schema.sql) — kept here too for any client-side preview/estimate.
 */
export function computeMonthlyScore(applicationsThisMonth) {
  const total = applicationsThisMonth.length;
  if (total === 0) return 0;

  const volumeScore = Math.min(total / 20, 1) * 50;

  const applied = applicationsThisMonth.filter((a) =>
    FUNNEL_ORDER.includes(a.stage) || a.stage === 'offer'
  ).length;
  const advanced = applicationsThisMonth.filter(
    (a) => FUNNEL_ORDER.indexOf(a.stage) > FUNNEL_ORDER.indexOf('applied')
  ).length;

  const conversionScore = applied > 0 ? (advanced / applied) * 50 : 0;

  return Math.round(volumeScore + conversionScore);
}
