import { useCallback, useMemo } from 'react';
import type { ChartConfiguration } from 'chart.js';
import { baseOptions, Chart, cssVar } from '../components/Chart';
import { Burst } from '../components/Doodles';
import { Empty, Stat, usePersonColor } from '../components/ui';
import { resultOf, round1, velocity } from '../model/metrics';
import { useStore } from '../store';

export function Productivity() {
  const { config, tasks, memberIds, allMemberIds, userName } = useStore();
  const colorOf = usePersonColor();

  const rows = useMemo(
    () =>
      config.sprints
        .filter((s) => s.status !== 'planned')
        .sort((a, b) => a.start.localeCompare(b.start))
        .map((s) => ({ sprint: s, result: resultOf(tasks, s) })),
    [config.sprints, tasks],
  );
  const closed = rows.filter((r) => r.sprint.status === 'closed');

  const vel = velocity(config);
  const rate = (r: (typeof rows)[number]) => (r.result.committed ? r.result.delivered / r.result.committed : 0);
  const avgRate = closed.length ? closed.reduce((s, r) => s + rate(r), 0) / closed.length : null;
  const last = closed[closed.length - 1];
  const prev = closed[closed.length - 2];
  const trend = last && prev ? round1(last.result.delivered - prev.result.delivered) : null;

  const people = useMemo(() => {
    const ids = new Set(memberIds);
    rows.forEach((r) => Object.keys(r.result.perPerson).forEach((id) => id && ids.add(id)));
    return [...ids];
  }, [rows, memberIds]);

  const buildVelocity = useCallback((): ChartConfiguration => {
    const opts = baseOptions()!;
    return {
      type: 'bar',
      data: {
        labels: rows.map((r) => r.sprint.name),
        datasets: [
          {
            label: 'Comprometido',
            data: rows.map((r) => r.result.committed),
            backgroundColor: cssVar('--neutral-mark'),
            borderRadius: { topLeft: 4, topRight: 4 },
            borderSkipped: 'bottom',
            maxBarThickness: 36,
          },
          {
            label: 'Entregue',
            data: rows.map((r) => r.result.delivered),
            backgroundColor: cssVar('--series-1'),
            borderRadius: { topLeft: 4, topRight: 4 },
            borderSkipped: 'bottom',
            maxBarThickness: 36,
          },
        ],
      },
      options: { ...opts, datasets: { bar: { categoryPercentage: 0.7, barPercentage: 0.9 } } } as ChartConfiguration['options'],
    };
  }, [rows]);

  const buildPeople = useCallback((): ChartConfiguration => {
    const opts = baseOptions()!;
    return {
      type: 'bar',
      data: {
        labels: rows.map((r) => r.sprint.name),
        datasets: people.map((id) => ({
          label: userName(id),
          data: rows.map((r) => r.result.perPerson[id] ?? 0),
          backgroundColor: allMemberIds.includes(id) ? cssVar(`--series-${(allMemberIds.indexOf(id) % 8) + 1}`) : cssVar('--neutral-mark'),
          borderRadius: { topLeft: 4, topRight: 4 },
          borderSkipped: 'bottom',
          maxBarThickness: 22,
        })),
      },
      options: { ...opts, datasets: { bar: { categoryPercentage: 0.8, barPercentage: 0.92 } } } as ChartConfiguration['options'],
    };
  }, [rows, people, allMemberIds, userName]);

  if (!rows.length) {
    return (
      <div className="card">
        <Empty>As métricas aparecem depois que a primeira sprint for iniciada.</Empty>
      </div>
    );
  }

  return (
    <>
      <div className="stats">
        <Stat label="Velocidade média" value={vel ?? '—'} sub="Pontos entregues, últimas 3 sprints" />
        <Stat
          label="Taxa de entrega"
          value={avgRate === null ? '—' : `${Math.round(avgRate * 100)}%`}
          sub="Entregue ÷ comprometido (média)"
        />
        <Stat
          label="Última sprint"
          value={last ? last.result.delivered : '—'}
          sub={
            trend === null ? (last ? last.sprint.name : 'Nenhuma encerrada') : `${trend >= 0 ? '+' : ''}${trend} pts vs. anterior`
          }
        />
      </div>

      <section className="card">
        <h2 className="heading-deco">
          Comprometido × entregue <Burst size={20} />
        </h2>
        <div className="legend" style={{ margin: '8px 0' }}>
          <span><i style={{ background: 'var(--neutral-mark)' }} />Comprometido</span>
          <span><i style={{ background: 'var(--series-1)' }} />Entregue</span>
        </div>
        <Chart build={buildVelocity} label="Pontos comprometidos e entregues por sprint" />
        <div className="table-wrap" style={{ marginTop: 12 }}>
          <table>
            <thead>
              <tr>
                <th>Sprint</th>
                <th className="num">Comprometido</th>
                <th className="num">Entregue</th>
                <th className="num">Taxa</th>
                <th className="num">Tarefas concluídas</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.sprint.id}>
                  <td>
                    {r.sprint.name} {r.sprint.status === 'active' && <span className="chip">em andamento</span>}
                  </td>
                  <td className="num">{r.result.committed}</td>
                  <td className="num">{r.result.delivered}</td>
                  <td className="num">{Math.round(rate(r) * 100)}%</td>
                  <td className="num">
                    {r.result.completedTasks}/{r.result.totalTasks}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="card">
        <h2>Entregas por pessoa</h2>
        <div className="legend" style={{ margin: '8px 0' }}>
          {people.map((id) => (
            <span key={id}>
              <i style={{ background: colorOf(id) }} />
              {userName(id)}
            </span>
          ))}
        </div>
        <Chart build={buildPeople} label="Pontos entregues por pessoa em cada sprint" />
        <div className="table-wrap" style={{ marginTop: 12 }}>
          <table>
            <thead>
              <tr>
                <th>Pessoa</th>
                {rows.map((r) => (
                  <th key={r.sprint.id} className="num">
                    {r.sprint.name}
                  </th>
                ))}
                <th className="num">Média (encerradas)</th>
              </tr>
            </thead>
            <tbody>
              {people.map((id) => (
                <tr key={id}>
                  <td>{userName(id)}</td>
                  {rows.map((r) => (
                    <td key={r.sprint.id} className="num">
                      {r.result.perPerson[id] ?? 0}
                    </td>
                  ))}
                  <td className="num">
                    {closed.length ? round1(closed.reduce((s, r) => s + (r.result.perPerson[id] ?? 0), 0) / closed.length) : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="faint" style={{ marginBottom: 0 }}>
          Tarefas com mais de um responsável dividem os pontos igualmente. Use estes números para conversar sobre
          capacidade e impedimentos, não para ranquear pessoas.
        </p>
      </section>
    </>
  );
}
