import { Chart as ChartJS, LinearScale, Tooltip } from 'chart.js';
import { SankeyController, Flow } from 'chartjs-chart-sankey';
import { Chart } from 'react-chartjs-2';
import { STAGE_MAP } from '../utils/stageConfig';
import { buildSankeyFlows, computeNodeTotals } from '../utils/sankeyData';

// The Sankey controller draws on Chart.js's linear scale, so that has to be
// registered here, in this file. It used to work only because ConversionChart
// happened to register LinearScale globally, and both shared one bundle so
// that always ran first. Now that pages load as separate chunks, the Sankey
// chunk can run on its own and crash with '"linear" is not a registered
// scale'. Registering the same component twice is harmless, so each chart
// file registers everything it needs and none depends on another.
ChartJS.register(SankeyController, Flow, LinearScale, Tooltip);

// Wishlist is excluded - the flow only tracks real pipeline movement.
// "waiting_for_response" is a synthetic node (not a real stage anyone can
// drag a card into) representing applications still sitting at Applied
// with no outcome yet - see buildSankeyFlows.
const NODE_LABELS = {
  ...Object.fromEntries(
    Object.entries(STAGE_MAP)
      .filter(([key]) => key !== 'wishlist')
      .map(([key, s]) => [key, s.label])
  ),
  waiting_for_response: 'Waiting for response'
};
const NODE_COLORS = {
  ...Object.fromEntries(
    Object.entries(STAGE_MAP)
      .filter(([key]) => key !== 'wishlist')
      .map(([key, s]) => [key, s.color])
  ),
  waiting_for_response: '#6B7684'
};

// chartjs-chart-sankey only exposes a `priority` for which COLUMN a node
// lands in (left-to-right) - it has no setting for vertical order within a
// column, and defaults to whatever order nodes are first encountered while
// walking the edge list. Left alone, that meant Rejected could end up
// above Offer, or any outcome could land in a different spot every reload,
// purely based on insertion order. Sorting the edges into this fixed order
// before handing them to the chart makes that encounter order consistent
// and sensible every time: top-to-bottom, Applied's immediate next steps
// first, then interviews, then outcomes (best to worst).
const VERTICAL_ORDER = {
  applied: 0,
  waiting_for_response: 1,
  assessment: 2,
  phone_screen: 3,
  onsite: 4,
  offer: 5,
  rejected: 6,
  withdrawn: 7
};

function sortForStableLayout(flows) {
  return [...flows].sort((a, b) => {
    const fromDiff = (VERTICAL_ORDER[a.from] ?? 99) - (VERTICAL_ORDER[b.from] ?? 99);
    if (fromDiff !== 0) return fromDiff;
    return (VERTICAL_ORDER[a.to] ?? 99) - (VERTICAL_ORDER[b.to] ?? 99);
  });
}

export default function SankeyFlowChart({ applications, stageHistory }) {
  const flows = sortForStableLayout(buildSankeyFlows(applications, stageHistory));

  if (flows.length === 0) {
    return (
      <div className="card-surface p-4">
        <h3 className="font-display text-sm font-semibold">Application flow</h3>
        <p className="mt-3 text-sm text-ink2">
          Move a card from Applied into a later stage to see its path here.
        </p>
      </div>
    );
  }

  const nodeTotals = computeNodeTotals(flows);
  // Each node's label gets its running total appended (e.g. "Applied 12"),
  // matching how the reference design shows a count under every stage name.
  const labelsWithCounts = Object.fromEntries(
    Object.entries(NODE_LABELS).map(([key, label]) => [
      key,
      nodeTotals[key] ? `${label} (${nodeTotals[key]})` : label
    ])
  );

  const data = {
    datasets: [
      {
        label: 'Applications',
        data: flows,
        colorFrom: (ctx) => NODE_COLORS[ctx.dataset.data[ctx.dataIndex]?.from] ?? '#9385D1',
        colorTo: (ctx) => NODE_COLORS[ctx.dataset.data[ctx.dataIndex]?.to] ?? '#9385D1',
        colorMode: 'gradient',
        labels: labelsWithCounts,
        color: '#F1ECFA',
        borderColor: '#3D2C55',
        font: { size: 11 },
        // Pins Applied to the far left as the single trunk everything else
        // branches out of, then keeps every later stage in pipeline order
        // reading left-to-right - the horizontal equivalent of "bulk at
        // the top, stages below it in order" (the library only lays
        // sankeys out left-to-right, not top-to-bottom). The synthetic
        // "waiting" bucket sits in the same column as Assessment, since
        // it's just as much an immediate next-step from Applied.
        priority: {
          applied: 0,
          waiting_for_response: 1,
          assessment: 1,
          phone_screen: 2,
          onsite: 3,
          offer: 4,
          rejected: 4,
          withdrawn: 4
        }
      }
    ]
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        callbacks: {
          label: (ctx) => {
            const { from, to, flow } = ctx.dataset.data[ctx.dataIndex];
            const label = (key) => NODE_LABELS[key] ?? key;
            return `${label(from)} → ${label(to)}: ${flow}`;
          }
        }
      }
    }
  };

  return (
    <div className="card-surface p-4">
      <h3 className="font-display text-sm font-semibold">Application flow</h3>
      <p className="mt-1 text-xs text-ink2">
        Where applications go after Applied - assessments, interviews, offers, and rejections.
        Moving a card backward (undoing a mis-drop) isn't counted as a real transition.
      </p>
      <div className="mt-3 h-72">
        <Chart type="sankey" data={data} options={options} />
      </div>
    </div>
  );
}
