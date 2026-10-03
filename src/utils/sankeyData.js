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

// Pipeline order used to tell a real forward transition apart from a
// correction (e.g. a card accidentally dropped on "Rejected" and dragged
// back to "Applied" to undo it). Offer/Rejected/Withdrawn are all terminal
// outcomes reachable from any earlier stage, so they share the highest rank
// rather than being ordered against each other.
export const STAGE_RANK = {
  applied: 0,
  assessment: 1,
  phone_screen: 2,
  onsite: 3,
  offer: 4,
  rejected: 4,
  withdrawn: 4
};

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
    // A backward move (e.g. Onsite -> Applied) is virtually always someone
    // undoing a mis-drop, not a real pipeline event, so it's left out of
    // the flow counts entirely rather than drawn as a confusing loop.
    // Anything with an unrecognized stage name falls through and is kept,
    // rather than silently dropped.
    if (STAGE_RANK[from] != null && STAGE_RANK[to] != null && STAGE_RANK[to] < STAGE_RANK[from]) {
      return;
    }
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

  const edges = Array.from(edgeCounts.entries()).map(([key, flow]) => {
    const [from, to] = key.split('→');
    return { from, to, flow };
  });

  // Cards currently sitting at Applied with no outcome yet don't have an
  // outgoing stage_history edge to draw, so without this they'd just vanish
  // from the chart instead of showing up as "still in the pipeline". This
  // synthetic edge makes that pending bucket visible as its own node.
  const waitingCount = applications.filter((a) => a.stage === 'applied').length;
  if (waitingCount > 0) {
    edges.push({ from: 'applied', to: 'waiting_for_response', flow: waitingCount });
  }

  return edges;
}

// A node's "total" is how many applications have passed through it -
// summed from whichever side actually has edges (incoming for anything
// that isn't a pure source, outgoing for a pure source like Applied).
export function computeNodeTotals(flows) {
  const incoming = {};
  const outgoing = {};
  for (const f of flows) {
    incoming[f.to] = (incoming[f.to] ?? 0) + Number(f.flow);
    outgoing[f.from] = (outgoing[f.from] ?? 0) + Number(f.flow);
  }
  const nodes = new Set([...Object.keys(incoming), ...Object.keys(outgoing)]);
  const totals = {};
  for (const n of nodes) {
    totals[n] = incoming[n] ?? outgoing[n] ?? 0;
  }
  return totals;
}
