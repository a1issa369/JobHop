import { Bar } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  BarElement,
  CategoryScale,
  LinearScale,
  Tooltip
} from 'chart.js';
import { FUNNEL_ORDER, STAGE_MAP } from '../utils/stageConfig';

ChartJS.register(BarElement, CategoryScale, LinearScale, Tooltip);

// Counts, for each funnel stage, how many applications ever reached at
// least that far (reads from stage_history so a rejected app still counts
// toward every stage it passed through before rejection).
function computeFunnelCounts(applications, stageHistory) {
  const reachedStage = new Map(); // application_id -> Set of stage keys reached

  for (const app of applications) {
    reachedStage.set(app.id, new Set(['applied']));
  }
  for (const h of stageHistory) {
    if (!reachedStage.has(h.application_id)) reachedStage.set(h.application_id, new Set());
    reachedStage.get(h.application_id).add(h.to_stage);
  }

  return FUNNEL_ORDER.map((stageKey) => {
    let count = 0;
    for (const reached of reachedStage.values()) {
      if (reached.has(stageKey)) count += 1;
    }
    return count;
  });
}

export default function ConversionChart({ applications, stageHistory }) {
  const counts = computeFunnelCounts(applications, stageHistory);
  const labels = FUNNEL_ORDER.map((k) => STAGE_MAP[k].label);
  const colors = FUNNEL_ORDER.map((k) => STAGE_MAP[k].color);

  const data = {
    labels,
    datasets: [
      {
        label: 'Applications reaching stage',
        data: counts,
        backgroundColor: colors,
        borderRadius: 4,
        maxBarThickness: 42
      }
    ]
  };

  const maxCount = Math.max(...counts, 1);

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    layout: { padding: { top: 4, bottom: 0 } },
    plugins: {
      legend: { display: false },
      tooltip: {
        callbacks: {
          label: (ctx) => {
            const first = counts[0] || 1;
            const pct = Math.round((ctx.parsed.y / first) * 100);
            return `${ctx.parsed.y} applications (${pct}% of applied)`;
          }
        }
      }
    },
    scales: {
      x: { grid: { display: false }, ticks: { color: '#9FB3C8' } },
      y: {
        beginAtZero: true,
        suggestedMax: maxCount,
        ticks: { color: '#9FB3C8', precision: 0, stepSize: Math.max(1, Math.ceil(maxCount / 4)) },
        grid: { color: 'rgba(37,64,95,0.4)' }
      }
    }
  };

  return (
    <div className="card-surface p-4">
      <h3 className="font-display text-sm font-semibold">Conversion by stage</h3>
      <div className="mt-3 h-36">
        <Bar data={data} options={options} />
      </div>
    </div>
  );
}
