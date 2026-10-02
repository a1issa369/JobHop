// Turns raw stage_history rows (one row per drag-and-drop stage change)
// into aggregated Sankey edges: {from, to, flow} where `flow` is how many
// applications made that exact transition.
//
// Only real pipeline movement is shown here - no "Created" source node and
// no "Wishlist" stage. The graph starts at Applied (the bulk entry point)
// and only shows transitions between it and the stages that come after:
// Assessment, Phone Screen, Onsite/Final, Offer, Rejected, Withdrawn. A
// card that's still sitting in Wishlist, or has never moved anywhere yet,
// simply has no edge to draw - which is correct, since it hasn't flowed
// into the pipeline yet.

export function buildSankeyFlows(applications, stageHistory) {
  const historyByApp = new Map();
  for (const h of stageHistory) {
    if (!historyByApp.has(h.application_id)) historyByApp.set(h.application_id, []);
    historyByApp.get(h.application_id).push(h);
  }

  const edgeCounts = new Map(); // "from→to" -> count

  function addEdge(from, to) {
    if (!from || !to || from === to) return;
    if (from === 'wishlist' || to === 'wishlist') return;
    const key = `${from}→${to}`;
    edgeCounts.set(key, (edgeCounts.get(key) ?? 0) + 1);
  }

  for (const app of applications) {
    const history = (historyByApp.get(app.id) ?? [])
      .slice()
      .sort((a, b) => new Date(a.changed_at) - new Date(b.changed_at));

    for (const h of history) {
      addEdge(h.from_stage, h.to_stage);
    }
  }

  return Array.from(edgeCounts.entries()).map(([key, flow]) => {
    const [from, to] = key.split('→');
    return { from, to, flow };
  });
}
