import { useCallback, useMemo, useState } from 'react';
import type { ChartConfiguration } from 'chart.js';
import { baseOptions, Chart, cssVar } from '../components/Chart';
import { Assignees, Points, Stat, formatDate, formatRange } from '../components/ui';
import type { Sprint } from '../model/appConfig';
import { burndown, computeResult, dateKey, sprintTasks, sumPoints } from '../model/metrics';
import { statusOf, STATUS_LABEL, type Status, type Task } from '../model/task';
import { useStore } from '../store';
import { CompleteSprintDialog } from '../components/SprintDialogs';

export function ActiveSprint() {
  const { config } = useStore();
  const sprint = config.sprints.find((s) => s.status === 'active');
  if (!sprint) {
    return (
      <div className="card empty-state">
        Nenhuma sprint ativa. Monte a próxima sprint na aba Backlog e clique em “Iniciar sprint”.
      </div>
    );
  }
  return <SprintView sprint={sprint} />;
}

const COLUMNS: Status[] = ['todo', 'doing', 'done'];

function SprintView({ sprint }: { sprint: Sprint }) {
  const { tasks } = useStore();
  const [closing, setClosing] = useState(false);
  const inSprint = sprintTasks(tasks, sprint.id);
  const result = computeResult(tasks, sprint);
  const today = dateKey(new Date());
  const bd = useMemo(() => burndown(tasks, sprint, today), [tasks, sprint, today]);
  const idx = bd.days.indexOf(today);
  const behind = idx >= 0 && (bd.remaining[idx] ?? 0) > bd.ideal[idx];
  const scopeChange = Math.round((bd.scope - (sprint.committed ?? bd.scope)) * 10) / 10;

  return (
    <>
      <div className="row">
        <h2 className="grow">
          {sprint.name} <span className="faint">· {formatRange(sprint.start, sprint.end)}</span>
        </h2>
        <button onClick={() => setClosing(true)}>Concluir sprint</button>
      </div>
      {sprint.goal && <p className="muted" style={{ margin: 0 }}>Meta: {sprint.goal}</p>}
      {closing && <CompleteSprintDialog sprint={sprint} onClose={() => setClosing(false)} />}

      <div className="stats">
        <Stat label="Entregue" value={`${result.delivered} / ${bd.scope}`} sub={`${result.completedTasks} de ${result.totalTasks} tarefas`} />
        <Stat
          label="Restante"
          value={Math.round((bd.scope - result.delivered) * 10) / 10}
          sub={
            idx < 0 ? (today < sprint.start ? 'A sprint ainda não começou' : 'Prazo da sprint encerrado') : behind ? (
              <span className="status-warn">! Atrás da linha ideal</span>
            ) : (
              <span className="status-ok">✓ No ritmo</span>
            )
          }
        />
        <Stat
          label="Mudança de escopo"
          value={scopeChange > 0 ? `+${scopeChange}` : scopeChange}
          sub={`Comprometido no início: ${sprint.committed ?? '—'} pts`}
        />
      </div>

      <section className="card">
        <h2>Burndown</h2>
        <div className="legend" style={{ margin: '8px 0' }}>
          <span><i className="line" style={{ background: 'var(--series-1)' }} />Pontos restantes</span>
          <span><i className="dash" />Ideal</span>
        </div>
        <BurndownChart days={bd.days} ideal={bd.ideal} remaining={bd.remaining} />
      </section>

      <div className="board">
        {COLUMNS.map((status) => {
          const col = inSprint.filter((t) => statusOf(t) === status);
          return (
            <div key={status} className="column">
              <div className="column-head">
                <span>{STATUS_LABEL[status]}</span>
                <span className="faint">
                  {col.length} · {sumPoints(col)} pts
                </span>
              </div>
              {col.map((t) => (
                <TaskCard key={t.id} task={t} />
              ))}
            </div>
          );
        })}
      </div>
    </>
  );
}

function TaskCard({ task }: { task: Task }) {
  const { setStatus } = useStore();
  const [busy, setBusy] = useState(false);
  const status = statusOf(task);
  const move = async (s: Status) => {
    setBusy(true);
    try {
      await setStatus(task.id, s);
    } finally {
      setBusy(false);
    }
  };
  const prev = COLUMNS[COLUMNS.indexOf(status) - 1];
  const next = COLUMNS[COLUMNS.indexOf(status) + 1];
  return (
    <div className="task-card" style={{ opacity: busy ? 0.6 : 1 }}>
      <div style={{ overflowWrap: 'anywhere' }}>{task.title}</div>
      <div className="row">
        <Points value={task.points} />
        <Assignees ids={task.assignees} />
        <span className="grow" />
        {prev && (
          <button className="small ghost" disabled={busy} onClick={() => move(prev)} title={`Mover para ${STATUS_LABEL[prev]}`}>
            ←
          </button>
        )}
        {next && (
          <button className="small" disabled={busy} onClick={() => move(next)} title={`Mover para ${STATUS_LABEL[next]}`}>
            {next === 'done' ? '✓ Concluir' : 'Iniciar →'}
          </button>
        )}
      </div>
    </div>
  );
}

function BurndownChart({ days, ideal, remaining }: { days: string[]; ideal: number[]; remaining: (number | null)[] }) {
  const build = useCallback((): ChartConfiguration => {
    const blue = cssVar('--series-1');
    return {
      type: 'line',
      data: {
        labels: days.map(formatDate),
        datasets: [
          {
            label: 'Pontos restantes',
            data: remaining,
            borderColor: blue,
            backgroundColor: blue,
            borderWidth: 2,
            pointRadius: 3,
            pointHoverRadius: 5,
            pointBorderColor: cssVar('--surface'),
            pointBorderWidth: 2,
            tension: 0,
            spanGaps: false,
          },
          {
            label: 'Ideal',
            data: ideal,
            borderColor: cssVar('--neutral-mark'),
            borderDash: [5, 4],
            borderWidth: 2,
            pointRadius: 0,
            pointHoverRadius: 0,
            tension: 0,
          },
        ],
      },
      options: baseOptions(),
    };
  }, [days, ideal, remaining]);
  return <Chart build={build} label="Burndown: pontos restantes por dia comparados com a linha ideal" />;
}
