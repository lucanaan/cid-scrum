import { useEffect, useRef } from 'react';
import { Chart as ChartJS, registerables, type ChartConfiguration } from 'chart.js';

ChartJS.register(...registerables);

/** Lê um token de cor do CSS (as cores mudam com o tema claro/escuro). */
export function cssVar(name: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

/** Opções comuns: grade discreta, tooltip por índice, sem legenda do Chart.js (usamos HTML). */
export function baseOptions(): ChartConfiguration['options'] {
  const grid = cssVar('--grid');
  const ink = cssVar('--text-2');
  return {
    responsive: true,
    maintainAspectRatio: false,
    animation: false,
    interaction: { mode: 'index', intersect: false },
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: cssVar('--surface'),
        titleColor: cssVar('--text'),
        bodyColor: cssVar('--text-2'),
        borderColor: cssVar('--border'),
        borderWidth: 1,
        padding: 10,
        boxPadding: 4,
      },
    },
    scales: {
      x: { grid: { display: false }, ticks: { color: ink }, border: { color: grid } },
      y: { beginAtZero: true, grid: { color: grid }, ticks: { color: ink, precision: 0 }, border: { display: false } },
    },
  };
}

/** `build` é chamado de novo quando os dados mudam. */
export function Chart({ build, label }: { build: () => ChartConfiguration; label: string }) {
  const canvas = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!canvas.current) return;
    const chart = new ChartJS(canvas.current, build());
    return () => chart.destroy();
  }, [build]);

  return (
    <div className="chart-box">
      <canvas ref={canvas} role="img" aria-label={label} />
    </div>
  );
}
