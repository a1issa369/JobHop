import { Chart as ChartJS } from 'chart.js';
import { SankeyController, Flow } from 'chartjs-chart-sankey';
import { Chart } from 'react-chartjs-2';
import { STAGE_MAP } from '../utils/stageConfig';
import { buildSankeyFlows } from '../utils/sankeyData';

ChartJS.register(SankeyController, Flow);

// Wishlist is excluded - the flow only tracks real pipeline movement.
const NODE_LABELS = Object.fromEntries(
  Object.entries(STAGE_MAP)
    .filter(([key]) => key !== 'wishlist')
    .map(([key, s]) => [key, s.label])
);
const NODE_COLORS = Object.fromEntries(
  Object.entries(STAGE_MAP)
    .filter(([key]) => key !== 'wishlist')
    .map(([key, s]) => [key, s.color])
);

export default function SankeyFlowChart({ applications, stageHistory }) {
  const flows = buildSankeyFlows(applications, stageHistory);

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

  const data = {
    datasets: [
      {
        label: 'Applications',
        data: flows,
        colorFrom: (ctx) => NODE_COLORS[ctx.dataset.data[ctx.dataIndex]?.from] ?? '#9385D1',
        colorTo: (ctx) => NODE_COLORS[ctx.dataset.data[ctx.dataIndex]?.to] ?? '#9385D1',
        colorMode: 'gradient',
        labels: NODE_LABELS,
        color: '#F1ECFA',
        borderColor: '#3D2C55',
        font: { size: 11 },
        // Pins Applied to the far left as the single trunk everything else
        // branches out of, then keeps every later stage in pipeline order
        // reading left-to-right - the horizontal equivalent of "bulk at
        // the top, stages below it in order" (the library only lays
        // sankeys out left-to-right, not top-to-bottom).
        priority: {
          applied: 0,
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
      </p>
      <div className="mt-3 h-72">
        <Chart type="sankey" data={data} options={options} />
      </div>
    </div>
  );
}
