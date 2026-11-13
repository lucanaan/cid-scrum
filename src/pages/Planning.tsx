import { useMemo, useState } from 'react';
import { Assignees, Empty, LoadBar, PlannerLink, Points, Stat, formatDate, formatRange } from '../components/ui';
import { nextSprintId, type Sprint } from '../model/appConfig';
import {
  businessDays,
  memberCapacity,
  pointsByPerson,
  sprintTasks,
  sumPoints,
  teamCapacity,
  UNASSIGNED,
  velocity,
} from '../model/metrics';
import { statusOf, type Task } from '../model/task';
import { useStore } from '../store';
import { EditSprintDialog, newSprint, StartSprintDialog } from '../components/SprintDialogs';

export function Planning() {
  const { config } = useStore();
  const editable = config.sprints.filter((s) => s.status !== 'closed').sort((a, b) => a.start.localeCompare(b.start));
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [creating, setCreating] = useState(false);
  const sprint = editable.find((s) => s.id === selectedId) ?? editable.find((s) => s.status === 'planned') ?? editable[0];

  return (
    <>
      <div className="row">
        <label className="row">
          Sprint
          <select
            value={sprint?.id ?? ''}
            onChange={(e) => setSelectedId(Number(e.target.value))}
            disabled={!editable.length}
          >
            {editable.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name} {s.status === 'active' ? '(ativa)' : '(planejada)'}
              </option>
            ))}
            {!editable.length && <option>Nenhuma sprint aberta</option>}
          </select>
        </label>
        <button onClick={() => setCreating(true)}>+ Nova sprint</button>
      </div>
      {creating && (
        <NewSprint
          onDone={(id) => {
            setCreating(false);
            if (id) setSelectedId(id);
          }}
        />
      )}
      {sprint ? (
        <SprintPlan sprint={sprint} />
      ) : (
        !creating && (
          <div className="card">
            <Empty>Crie a primeira sprint para começar o planejamento.</Empty>
          </div>
        )
      )}
    </>
  );
}

function NewSprint({ onDone }: { onDone: (id?: number) => void }) {
  const { config, updateConfig } = useStore();
  const suggested = newSprint(config);
  const [name, setName] = useState(suggested.name);
  const [start, setStart] = useState(suggested.start);
  const [end, setEnd] = useState(suggested.end);
  const [goal, setGoal] = useState('');
  const [busy, setBusy] = useState(false);

  const create = async () => {
    setBusy(true);
    try {
      const cfg = await updateConfig((c) => {
        const sprint: Sprint = { id: nextSprintId(c), name, start, end, goal, status: 'planned', absences: {} };
        return { ...c, sprints: [...c.sprints, sprint] };
      });
      onDone(nextSprintId(cfg) - 1);
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="card stack">
      <h2>Nova sprint</h2>
      <div className="row">
        <label className="stack" style={{ gap: 4 }}>
          <span className="faint">Nome</span>
          <input value={name} onChange={(e) => setName(e.target.value)} />
        </label>
        <label className="stack" style={{ gap: 4 }}>
          <span className="faint">Início</span>
          <input type="date" value={start} onChange={(e) => setStart(e.target.value)} />
        </label>
        <label className="stack" style={{ gap: 4 }}>
          <span className="faint">Fim</span>
          <input type="date" value={end} min={start} onChange={(e) => setEnd(e.target.value)} />
        </label>
        <label className="stack grow" style={{ gap: 4, minWidth: 200 }}>
          <span className="faint">Meta (opcional)</span>
          <input value={goal} onChange={(e) => setGoal(e.target.value)} placeholder="O que esta sprint precisa entregar?" />
        </label>
      </div>
      <div className="row">
        <button className="primary" disabled={busy || !name || !start || end < start} onClick={create}>
          Criar sprint
        </button>
        <button className="ghost" onClick={() => onDone()}>
          Cancelar
        </button>
        <span className="faint">{start && end >= start ? `${businessDays(start, end)} dias úteis` : ''}</span>
      </div>
    </section>
  );
}

function SprintPlan({ sprint }: { sprint: Sprint }) {
  const { tasks, config, memberIds, userName, moveToSprint, setAssignee } = useStore();
  const [query, setQuery] = useState('');
  const [busyIds, setBusyIds] = useState<Set<string>>(new Set());

  const inSprint = sprintTasks(tasks, sprint.id);
  const candidates = useMemo(() => {
    const q = query.trim().toLowerCase();
    return tasks
      .filter((t) => !t.completedAt && t.sprint === undefined)
      .filter((t) => !q || t.title.toLowerCase().includes(q))
      .sort((a, b) => Number(a.points === undefined) - Number(b.points === undefined) || a.title.localeCompare(b.title));
  }, [tasks, query]);

  const total = sumPoints(inSprint);
  const capacity = teamCapacity(config, sprint, memberIds);
  const vel = velocity(config);
  const load = pointsByPerson(inSprint);
  const unestimated = inSprint.filter((t) => t.points === undefined).length;
  const active = config.sprints.find((s) => s.status === 'active');

  const withBusy = async (id: string, fn: () => Promise<unknown>) => {
    setBusyIds((s) => new Set(s).add(id));
    try {
      await fn();
    } finally {
      setBusyIds((s) => {
        const n = new Set(s);
        n.delete(id);
        return n;
      });
    }
  };

  const [starting, setStarting] = useState(false);
  const [editing, setEditing] = useState(false);
  const [addingDoing, setAddingDoing] = useState(false);
  const doing = candidates.filter((t) => statusOf(t) === 'doing');
  const addDoing = async () => {
    setAddingDoing(true);
    try {
      await moveToSprint(
        doing.map((t) => t.id),
        sprint,
      );
    } finally {
      setAddingDoing(false);
    }
  };

  const target = vel ?? capacity;

  return (
    <>
      <div className="stats">
        <Stat label="Pontos na sprint" value={total} sub={`${inSprint.length} tarefas${unestimated ? ` · ${unestimated} sem estimativa` : ''}`} />
        <Stat label="Capacidade da equipe" value={capacity} sub="Descontando ausências" />
        <Stat
          label="Velocidade média"
          value={vel ?? '—'}
          sub={vel === null ? 'Aparece após encerrar a 1ª sprint' : 'Entregue nas últimas 3 sprints'}
        />
        <Stat
          label="Folga"
          value={
            <span className={total > target ? 'status-over' : 'status-ok'}>
              {total > target ? '▲ ' : ''}
              {Math.round((target - total) * 10) / 10}
            </span>
          }
          sub={vel !== null ? 'Em relação à velocidade' : 'Em relação à capacidade'}
        />
      </div>

      <section className="card stack">
        <div className="row">
          <h2 className="grow">
            {sprint.name} <span className="faint">· {formatRange(sprint.start, sprint.end)} · {businessDays(sprint.start, sprint.end)} dias úteis</span>
          </h2>
          <button className="ghost small" onClick={() => setEditing(true)}>
            ✎ Editar
          </button>
          {sprint.status === 'planned' && (
            <button
              className="primary"
              disabled={!!active || inSprint.length === 0}
              title={active ? `Encerre a ${active.name} antes de iniciar outra` : undefined}
              onClick={() => setStarting(true)}
            >
              Iniciar sprint
            </button>
          )}
        </div>
        {starting && <StartSprintDialog sprint={sprint} onClose={() => setStarting(false)} />}
        {editing && <EditSprintDialog sprint={sprint} onClose={() => setEditing(false)} />}
        {sprint.goal && <p className="muted" style={{ margin: 0 }}>Meta: {sprint.goal}</p>}
        {active && sprint.status === 'planned' && (
          <p className="faint" style={{ margin: 0 }}>
            A {active.name} ainda está ativa. Conclua-a na aba Sprint ativa para iniciar esta.
          </p>
        )}

        <h3 style={{ marginTop: 8 }}>Carga por pessoa</h3>
        <div className="stack">
          {memberIds.map((id) => (
            <LoadBar key={id} label={userName(id)} points={load[id] ?? 0} capacity={memberCapacity(config, sprint, id)} />
          ))}
          {load[UNASSIGNED] ? (
            <p className="faint" style={{ margin: 0 }}>
              {load[UNASSIGNED]} pts sem responsável.
            </p>
          ) : null}
        </div>

        <Absences sprint={sprint} />
      </section>

      <div className="grid-2">
        <section className="card">
          <div className="row" style={{ marginBottom: 10 }}>
            <h2 className="grow">Backlog ({candidates.length})</h2>
            <input placeholder="Buscar…" value={query} onChange={(e) => setQuery(e.target.value)} style={{ width: 160 }} />
          </div>
          {doing.length > 0 && (
            <button className="small" style={{ marginBottom: 10 }} disabled={addingDoing} onClick={addDoing}>
              {addingDoing ? 'Adicionando…' : `Adicionar todas em andamento (${doing.length}) →`}
            </button>
          )}
          <div className="task-list scroll">
            {candidates.map((t) => (
              <TaskRow
                key={t.id}
                task={t}
                busy={busyIds.has(t.id)}
                action="Adicionar →"
                onAction={() => withBusy(t.id, () => moveToSprint([t.id], sprint))}
              />
            ))}
            {candidates.length === 0 && <Empty>Backlog vazio.</Empty>}
          </div>
        </section>

        <section className="card">
          <h2 style={{ marginBottom: 10 }}>
            Na sprint ({inSprint.length}) · {total} pts
          </h2>
          <p className="faint" style={{ marginTop: -4 }}>
            Ao entrar na sprint, a data de conclusão da tarefa no Planner vira {formatDate(sprint.end)} (fim da sprint).
          </p>
          <div className="task-list scroll">
            {inSprint.map((t) => (
              <TaskRow
                key={t.id}
                task={t}
                busy={busyIds.has(t.id)}
                action="← Remover"
                onAction={() => withBusy(t.id, () => moveToSprint([t.id], undefined))}
                assign={(uid) => withBusy(t.id, () => setAssignee(t.id, uid))}
              />
            ))}
            {inSprint.length === 0 && <Empty>Adicione tarefas do backlog.</Empty>}
          </div>
        </section>
      </div>
    </>
  );
}

function TaskRow({
  task,
  busy,
  action,
  onAction,
  assign,
}: {
  task: Task;
  busy: boolean;
  action: string;
  onAction: () => void;
  assign?: (userId: string | null) => void;
}) {
  const { memberIds, userName } = useStore();
  return (
    <div className="task-item" style={{ opacity: busy ? 0.6 : 1 }}>
      <Points value={task.points} />
      <span className="title">{task.title}</span>
      <PlannerLink taskId={task.id} />
      {assign ? (
        <select
          aria-label="Responsável"
          value={task.assignees.length === 1 ? task.assignees[0] : task.assignees.length ? '*' : ''}
          disabled={busy}
          onChange={(e) => assign(e.target.value || null)}
          style={{ maxWidth: 140 }}
        >
          <option value="">Sem responsável</option>
          {task.assignees.length > 1 && <option value="*">{task.assignees.map(userName).join(', ')}</option>}
          {memberIds.map((id) => (
            <option key={id} value={id}>
              {userName(id)}
            </option>
          ))}
        </select>
      ) : (
        <Assignees ids={task.assignees} />
      )}
      <button className="small" disabled={busy} onClick={onAction}>
        {action}
      </button>
    </div>
  );
}

function Absences({ sprint }: { sprint: Sprint }) {
  const { memberIds, userName, updateConfig } = useStore();
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const days = businessDays(sprint.start, sprint.end);
  const dirty = Object.keys(draft).length > 0;

  const save = async () => {
    setSaving(true);
    try {
      await updateConfig((c) => ({
        ...c,
        sprints: c.sprints.map((s) => {
          if (s.id !== sprint.id) return s;
          const absences = { ...s.absences };
          for (const [id, v] of Object.entries(draft)) {
            const n = Math.max(0, Math.min(days, Number(v) || 0));
            if (n) absences[id] = n;
            else delete absences[id];
          }
          return { ...s, absences };
        }),
      }));
      setDraft({});
    } finally {
      setSaving(false);
    }
  };

  return (
    <details>
      <summary>Ausências nesta sprint (férias, folgas, feriados)</summary>
      <div className="stack" style={{ marginTop: 10 }}>
        {memberIds.map((id) => (
          <label key={id} className="row">
            <span style={{ width: 160 }}>{userName(id)}</span>
            <input
              type="number"
              min={0}
              max={days}
              style={{ width: 80 }}
              value={draft[id] ?? String(sprint.absences[id] ?? 0)}
              onChange={(e) => setDraft((d) => ({ ...d, [id]: e.target.value }))}
            />
            <span className="faint">de {days} dias úteis</span>
          </label>
        ))}
        <div>
          <button className="primary" disabled={!dirty || saving} onClick={save}>
            Salvar ausências
          </button>
        </div>
      </div>
    </details>
  );
}
