import { useEffect, useRef, useState } from 'react';
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

function useDarkMode(): boolean {
  const [dark, setDark] = useState(() => matchMedia('(prefers-color-scheme: dark)').matches);
  useEffect(() => {
    const mq = matchMedia('(prefers-color-scheme: dark)');
    const onChange = () => setDark(mq.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);
  return dark;
}

/** `build` é chamado de novo quando os dados ou o tema mudam, para reler as cores. */
export function Chart({ build, label }: { build: () => ChartConfiguration; label: string }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const dark = useDarkMode();

  useEffect(() => {
    if (!canvas.current) return;
    const chart = new ChartJS(canvas.current, build());
    return () => chart.destroy();
  }, [build, dark]);

  return (
    <div className="chart-box">
      <canvas ref={canvas} role="img" aria-label={label} />
    </div>
  );
}
