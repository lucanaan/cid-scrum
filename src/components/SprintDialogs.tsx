import { useState } from 'react';
import { nextSprintId, type AppConfig, type Sprint } from '../model/appConfig';
import { businessDays, computeResult, daysBetween, dateKey, sprintTasks, sumPoints } from '../model/metrics';
import { useStore } from '../store';
import { Modal } from './Modal';
import { formatDate } from './ui';

export function addDays(key: string, n: number): string {
  const [y, m, d] = key.split('-').map(Number);
  return dateKey(new Date(y, m - 1, d + n));
}

function nextMonday(): string {
  const d = new Date();
  d.setDate(d.getDate() + ((8 - d.getDay()) % 7 || 7));
  return dateKey(d);
}

/** Sprint nova logo depois da última, com a mesma duração (padrão: 2 semanas). */
export function newSprint(c: AppConfig): Sprint {
  const last = [...c.sprints].sort((a, b) => b.end.localeCompare(a.end))[0];
  const length = last ? daysBetween(last.start, last.end).length : 14;
  const start = last ? addDays(last.end, 1) : nextMonday();
  const id = nextSprintId(c);
  return { id, name: `Sprint ${id}`, start, end: addDays(start, length - 1), goal: '', status: 'planned', absences: {} };
}

const DURATIONS = [7, 14, 21, 28];

export function StartSprintDialog({ sprint, onClose }: { sprint: Sprint; onClose: () => void }) {
  const { tasks, config, updateConfig } = useStore();
  const inSprint = sprintTasks(tasks, sprint.id);
  const unestimated = inSprint.filter((t) => t.points === undefined);
  const active = config.sprints.find((s) => s.status === 'active');

  const plannedLength = daysBetween(sprint.start, sprint.end).length;
  const [name, setName] = useState(sprint.name);
  const [duration, setDuration] = useState(DURATIONS.includes(plannedLength) ? String(plannedLength) : 'custom');
  // Datas no passado são permitidas: dá para registrar uma sprint que já começou.
  const [start, setStart] = useState(sprint.start);
  const [end, setEnd] = useState(sprint.end);
  const [goal, setGoal] = useState(sprint.goal);
  const [busy, setBusy] = useState(false);

  const changeStart = (v: string) => {
    setStart(v);
    if (duration !== 'custom' && v) setEnd(addDays(v, Number(duration) - 1));
  };
  const changeDuration = (v: string) => {
    setDuration(v);
    if (v !== 'custom' && start) setEnd(addDays(start, Number(v) - 1));
  };

  const valid = name.trim() && start && end && end >= start && !active;
  const submit = async () => {
    setBusy(true);
    try {
      await updateConfig((c) => ({
        ...c,
        sprints: c.sprints.map((s) =>
          s.id === sprint.id
            ? { ...s, name: name.trim(), start, end, goal, status: 'active', committed: sumPoints(inSprint) }
            : s,
        ),
      }));
      onClose();
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      title="Iniciar sprint"
      onClose={onClose}
      footer={
        <>
          <button className="ghost" onClick={onClose}>
            Cancelar
          </button>
          <button className="primary" disabled={!valid || busy} onClick={submit}>
            {busy ? 'Iniciando…' : 'Iniciar'}
          </button>
        </>
      }
    >
      {active && (
        <p className="alert">
          <span aria-hidden>▲</span> A {active.name} ainda está ativa. Conclua-a antes de iniciar outra.
        </p>
      )}
      {unestimated.length > 0 && (
        <p className="alert">
          <span aria-hidden>▲</span>
          <span>
            {unestimated.length === 1
              ? `A tarefa "${unestimated[0].title}" não tem estimativa.`
              : `${unestimated.length} tarefas não têm estimativa.`}{' '}
            Pontos definidos depois do início da sprint contam como mudança de escopo.
          </span>
        </p>
      )}
      <p>
        <strong>{inSprint.length}</strong> tarefas ({sumPoints(inSprint)} pts) vão ser incluídas nesta sprint.
      </p>
      <label className="field">
        <span>Nome da sprint *</span>
        <input value={name} onChange={(e) => setName(e.target.value)} />
      </label>
      <label className="field">
        <span>Duração *</span>
        <select value={duration} onChange={(e) => changeDuration(e.target.value)}>
          {DURATIONS.map((d) => (
            <option key={d} value={d}>
              {d / 7} {d === 7 ? 'semana' : 'semanas'}
            </option>
          ))}
          <option value="custom">Personalizado</option>
        </select>
      </label>
      <label className="field">
        <span>Data de início *</span>
        <input type="date" value={start} onChange={(e) => changeStart(e.target.value)} />
        <small className="faint">
          Início planejado: <strong>{formatDate(sprint.start)}/{sprint.start.slice(0, 4)}</strong>. A data de início
          afeta a velocidade e o burndown.
        </small>
      </label>
      <label className="field">
        <span>Data de término *</span>
        <input
          type="date"
          value={end}
          min={start}
          onChange={(e) => {
            setEnd(e.target.value);
            setDuration('custom');
          }}
        />
      </label>
      <label className="field">
        <span>Objetivo da sprint</span>
        <textarea rows={4} value={goal} onChange={(e) => setGoal(e.target.value)} />
      </label>
    </Modal>
  );
}

export function CompleteSprintDialog({ sprint, onClose }: { sprint: Sprint; onClose: () => void }) {
  const { tasks, config, updateConfig, setTagsMany } = useStore();
  const inSprint = sprintTasks(tasks, sprint.id);
  const done = inSprint.filter((t) => t.completedAt);
  const open = inSprint.filter((t) => !t.completedAt);
  const planned = config.sprints.filter((s) => s.status === 'planned').sort((a, b) => a.start.localeCompare(b.start));
  const [dest, setDest] = useState<string>(planned[0] ? String(planned[0].id) : 'new');
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setBusy(true);
    try {
      // O resultado é gravado antes de mover as tarefas, para o histórico não mudar depois.
      const result = computeResult(tasks, sprint);
      let target: number | undefined = dest === 'backlog' ? undefined : Number(dest);
      await updateConfig((c) => {
        const sprints = c.sprints.map((s) => (s.id === sprint.id ? { ...s, status: 'closed' as const, result } : s));
        if (dest === 'new' && open.length) {
          const s = newSprint({ ...c, sprints });
          target = s.id;
          sprints.push(s);
        }
        return { ...c, sprints };
      });
      await setTagsMany(
        open.map((t) => t.id),
        { sprint: target },
      );
      onClose();
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      title={`Concluir ${sprint.name}`}
      onClose={onClose}
      footer={
        <>
          <button className="ghost" onClick={onClose}>
            Cancelar
          </button>
          <button className="primary" disabled={busy} onClick={submit}>
            {busy ? 'Concluindo…' : 'Concluir sprint'}
          </button>
        </>
      }
    >
      <p>
        A sprint tem <strong>{done.length}</strong> {done.length === 1 ? 'tarefa concluída' : 'tarefas concluídas'} (
        {sumPoints(done)} pts) e <strong>{open.length}</strong> {open.length === 1 ? 'tarefa aberta' : 'tarefas abertas'} (
        {sumPoints(open)} pts).
      </p>
      <ul className="muted" style={{ paddingLeft: 20, margin: 0 }}>
        <li>As concluídas entram no histórico de produtividade.</li>
        <li>As abertas vão para outra sprint ou voltam para o backlog.</li>
      </ul>
      {open.length > 0 && (
        <label className="field">
          <span>Mover tarefas abertas para</span>
          <select value={dest} onChange={(e) => setDest(e.target.value)}>
            {planned.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
            <option value="new">Nova sprint</option>
            <option value="backlog">Backlog</option>
          </select>
        </label>
      )}
    </Modal>
  );
}

/** Edita nome, datas e objetivo de uma sprint planejada ou ativa. */
export function EditSprintDialog({ sprint, onClose }: { sprint: Sprint; onClose: () => void }) {
  const { updateConfig } = useStore();
  const [name, setName] = useState(sprint.name);
  const [start, setStart] = useState(sprint.start);
  const [end, setEnd] = useState(sprint.end);
  const [goal, setGoal] = useState(sprint.goal);
  const [busy, setBusy] = useState(false);
  const valid = name.trim() && start && end && end >= start;

  const submit = async () => {
    setBusy(true);
    try {
      await updateConfig((c) => ({
        ...c,
        sprints: c.sprints.map((s) => (s.id === sprint.id ? { ...s, name: name.trim(), start, end, goal } : s)),
      }));
      onClose();
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      title={`Editar ${sprint.name}`}
      onClose={onClose}
      footer={
        <>
          <button className="ghost" onClick={onClose}>
            Cancelar
          </button>
          <button className="primary" disabled={!valid || busy} onClick={submit}>
            {busy ? 'Salvando…' : 'Salvar'}
          </button>
        </>
      }
    >
      <label className="field">
        <span>Nome da sprint *</span>
        <input value={name} onChange={(e) => setName(e.target.value)} />
      </label>
      <label className="field">
        <span>Data de início *</span>
        <input type="date" value={start} onChange={(e) => setStart(e.target.value)} />
      </label>
      <label className="field">
        <span>Data de término *</span>
        <input type="date" value={end} min={start} onChange={(e) => setEnd(e.target.value)} />
        {start && end >= start && <small className="faint">{businessDays(start, end)} dias úteis</small>}
      </label>
      <label className="field">
        <span>Objetivo da sprint</span>
        <textarea rows={3} value={goal} onChange={(e) => setGoal(e.target.value)} />
      </label>
      {sprint.status === 'active' && start < sprint.start && (
        <p className="faint">
          Depois de salvar, clique em <strong>Atualizar</strong> para o burndown incluir as tarefas concluídas desde a nova
          data de início.
        </p>
      )}
    </Modal>
  );
}
