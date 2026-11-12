import { useMemo, useState } from 'react';
import { Assignees, Stat } from '../components/ui';
import { sumPoints } from '../model/metrics';
import { POKER_VALUES } from '../model/tags';
import { statusOf, STATUS_LABEL, type Task } from '../model/task';
import { useStore } from '../store';

const ESTIMATE_OPTIONS = POKER_VALUES.filter((v) => /^\d+$/.test(v));

export function PointsSelect({ task }: { task: Task }) {
  const { setTags } = useStore();
  const [saving, setSaving] = useState(false);
  const value = task.points === undefined ? '' : String(task.points);
  const options = value && !ESTIMATE_OPTIONS.includes(value as never) ? [value, ...ESTIMATE_OPTIONS] : ESTIMATE_OPTIONS;
  return (
    <select
      aria-label={`Pontos de ${task.title}`}
      value={value}
      disabled={saving}
      onChange={async (e) => {
        setSaving(true);
        try {
          await setTags(task.id, { points: e.target.value === '' ? undefined : Number(e.target.value) });
        } finally {
          setSaving(false);
        }
      }}
      style={{ width: 70 }}
    >
      <option value="">–</option>
      {options.map((v) => (
        <option key={v} value={v}>
          {v}
        </option>
      ))}
    </select>
  );
}

export function Backlog() {
  const { tasks, buckets, memberIds, userName, config } = useStore();
  const [query, setQuery] = useState('');
  const [bucket, setBucket] = useState('');
  const [person, setPerson] = useState('');
  const [onlyUnestimated, setOnlyUnestimated] = useState(false);
  const [showDone, setShowDone] = useState(false);

  const bucketName = (id: string) => buckets.find((b) => b.id === id)?.name ?? '';
  const sprintName = (id?: number) => config.sprints.find((s) => s.id === id)?.name;

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return tasks
      .filter((t) => showDone || !t.completedAt)
      .filter((t) => !q || t.title.toLowerCase().includes(q))
      .filter((t) => !bucket || t.bucketId === bucket)
      .filter((t) => !person || (person === '-' ? t.assignees.length === 0 : t.assignees.includes(person)))
      .filter((t) => !onlyUnestimated || t.points === undefined)
      .sort((a, b) => a.bucketId.localeCompare(b.bucketId) || a.title.localeCompare(b.title));
  }, [tasks, query, bucket, person, onlyUnestimated, showDone]);

  const open = tasks.filter((t) => !t.completedAt);
  const unestimated = open.filter((t) => t.points === undefined);
  const backlog = open.filter((t) => t.sprint === undefined);

  return (
    <>
      <div className="stats">
        <Stat label="Tarefas abertas" value={open.length} />
        <Stat label="Sem estimativa" value={unestimated.length} sub={unestimated.length ? 'Estime na aba Estimativa' : 'Tudo estimado'} />
        <Stat label="Pontos no backlog" value={sumPoints(backlog)} sub={`${backlog.length} tarefas fora de sprint`} />
      </div>

      <section className="card">
        <div className="row" style={{ marginBottom: 12 }}>
          <input
            className="grow"
            placeholder="Buscar tarefa…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            style={{ minWidth: 180 }}
          />
          <select value={bucket} onChange={(e) => setBucket(e.target.value)} aria-label="Bucket">
            <option value="">Todos os buckets</option>
            {buckets.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
          <select value={person} onChange={(e) => setPerson(e.target.value)} aria-label="Responsável">
            <option value="">Todas as pessoas</option>
            <option value="-">Sem responsável</option>
            {memberIds.map((id) => (
              <option key={id} value={id}>
                {userName(id)}
              </option>
            ))}
          </select>
          <label className="row">
            <input type="checkbox" checked={onlyUnestimated} onChange={(e) => setOnlyUnestimated(e.target.checked)} />
            Só sem estimativa
          </label>
          <label className="row">
            <input type="checkbox" checked={showDone} onChange={(e) => setShowDone(e.target.checked)} />
            Mostrar concluídas
          </label>
        </div>

        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Tarefa</th>
                <th>Bucket</th>
                <th>Responsáveis</th>
                <th>Status</th>
                <th>Sprint</th>
                <th className="num">Pontos</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((t) => (
                <tr key={t.id}>
                  <td style={{ overflowWrap: 'anywhere' }}>{t.title}</td>
                  <td>
                    <span className="chip">{bucketName(t.bucketId)}</span>
                  </td>
                  <td>
                    <Assignees ids={t.assignees} />
                  </td>
                  <td className="muted">{STATUS_LABEL[statusOf(t)]}</td>
                  <td className="muted">{sprintName(t.sprint) ?? '—'}</td>
                  <td className="num">
                    <PointsSelect task={t} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filtered.length === 0 && <div className="empty-state">Nenhuma tarefa com esses filtros.</div>}
        </div>
        <p className="faint" style={{ marginBottom: 0 }}>
          {filtered.length} tarefas · {sumPoints(filtered)} pts. Os pontos ficam gravados na descrição da tarefa no
          Planner, como <code>[pts:5]</code>.
        </p>
      </section>
    </>
  );
}
