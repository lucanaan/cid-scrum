import { useMemo, useState, type DragEvent } from 'react';
import { Avatar, formatRange } from '../components/ui';
import { newSprint, StartSprintDialog } from '../components/SprintDialogs';
import type { Sprint } from '../model/appConfig';
import { sumPoints } from '../model/metrics';
import { POKER_VALUES } from '../model/tags';
import { statusOf, STATUS_LABEL, type Status, type Task } from '../model/task';
import { useStore } from '../store';

const ESTIMATE_OPTIONS = POKER_VALUES.filter((v) => /^\d+$/.test(v));
const BACKLOG = 'backlog';
type SectionKey = number | typeof BACKLOG;

export function PointsSelect({ task }: { task: Task }) {
  const { setTags } = useStore();
  const [saving, setSaving] = useState(false);
  const value = task.points === undefined ? '' : String(task.points);
  const options = value && !ESTIMATE_OPTIONS.includes(value as never) ? [value, ...ESTIMATE_OPTIONS] : ESTIMATE_OPTIONS;
  return (
    <select
      className={`pts-select ${value ? '' : 'empty'}`}
      aria-label={`Pontos de ${task.title}`}
      title="Estimativa (pontos)"
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
  const { tasks, config, buckets, allMemberIds, userName, setTagsMany, updateConfig } = useStore();
  const [query, setQuery] = useState('');
  const [people, setPeople] = useState<Set<string>>(new Set());
  const [bucket, setBucket] = useState('');
  const [onlyUnestimated, setOnlyUnestimated] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [dialog, setDialog] = useState<{ kind: 'start'; sprint: Sprint } | null>(null);
  const [moving, setMoving] = useState(false);

  // Só a próxima sprint planejada aparece aqui; a ativa fica na aba "Sprint ativa".
  const active = config.sprints.find((s) => s.status === 'active');
  const planned = useMemo(
    () => config.sprints.filter((s) => s.status === 'planned').sort((a, b) => a.start.localeCompare(b.start))[0],
    [config.sprints],
  );

  const matches = (t: Task) => {
    const q = query.trim().toLowerCase();
    return (
      (!q || t.title.toLowerCase().includes(q)) &&
      (!people.size || t.assignees.some((a) => people.has(a)) || (people.has('') && !t.assignees.length)) &&
      (!bucket || t.bucketId === bucket) &&
      (!onlyUnestimated || t.points === undefined)
    );
  };

  const sectionOf = (t: Task): SectionKey | null => {
    if (planned && t.sprint === planned.id) return planned.id;
    if (active && t.sprint === active.id) return null;
    return t.completedAt ? null : BACKLOG;
  };

  const move = async (ids: string[], to: SectionKey) => {
    const target = to === BACKLOG ? undefined : to;
    const toMove = ids.filter((id) => tasks.find((t) => t.id === id)?.sprint !== target);
    if (!toMove.length) return;
    setMoving(true);
    try {
      await setTagsMany(toMove, { sprint: target });
      setSelected(new Set());
    } finally {
      setMoving(false);
    }
  };

  const createSprint = () => updateConfig((c) => ({ ...c, sprints: [...c.sprints, newSprint(c)] }));

  const toggle = (id: string) =>
    setSelected((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  const destinations: { key: SectionKey; label: string }[] = [
    ...(planned ? [{ key: planned.id as SectionKey, label: planned.name }] : []),
    { key: BACKLOG, label: 'Backlog' },
  ];

  return (
    <>
      <div className="row">
        <input
          placeholder="Pesquisar no backlog…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          style={{ width: 220 }}
        />
        <div className="avatar-filter" role="group" aria-label="Filtrar por responsável">
          {allMemberIds.map((id) => (
            <button
              key={id}
              className={people.has(id) ? 'on' : ''}
              aria-pressed={people.has(id)}
              title={userName(id)}
              onClick={() => setPeople((s) => toggleIn(s, id))}
            >
              <Avatar id={id} />
            </button>
          ))}
          <button
            className={people.has('') ? 'on' : ''}
            aria-pressed={people.has('')}
            title="Sem responsável"
            onClick={() => setPeople((s) => toggleIn(s, ''))}
          >
            <span className="avatar unassigned">?</span>
          </button>
        </div>
        <select value={bucket} onChange={(e) => setBucket(e.target.value)} aria-label="Bucket">
          <option value="">Bucket</option>
          {buckets.map((b) => (
            <option key={b.id} value={b.id}>
              {b.name}
            </option>
          ))}
        </select>
        <label className="row">
          <input type="checkbox" checked={onlyUnestimated} onChange={(e) => setOnlyUnestimated(e.target.checked)} />
          Sem estimativa
        </label>
        {(query || people.size > 0 || bucket || onlyUnestimated) && (
          <button
            className="small ghost"
            onClick={() => {
              setQuery('');
              setPeople(new Set());
              setBucket('');
              setOnlyUnestimated(false);
            }}
          >
            Limpar filtros
          </button>
        )}
      </div>

      {selected.size > 0 && (
        <div className="banner">
          <strong>{selected.size} selecionadas</strong>
          <label className="row">
            Mover para
            <select
              value=""
              disabled={moving}
              onChange={(e) => move([...selected], e.target.value === BACKLOG ? BACKLOG : Number(e.target.value))}
            >
              <option value="" disabled>
                Escolha…
              </option>
              {destinations.map((d) => (
                <option key={d.key} value={d.key}>
                  {d.label}
                </option>
              ))}
            </select>
          </label>
          <span className="grow" />
          <button className="small ghost" onClick={() => setSelected(new Set())}>
            Limpar seleção
          </button>
        </div>
      )}

      {planned ? (
        <Section
          sprint={planned}
          tasks={tasks.filter((t) => sectionOf(t) === planned.id)}
          matches={matches}
          selected={selected}
          onToggle={toggle}
          onDrop={(ids) => move(ids, planned.id)}
          destinations={destinations}
          onMove={(id, to) => move([id], to)}
          action={
            <button
              className="small"
              disabled={!!active}
              title={active ? `Conclua a ${active.name} (aba Sprint ativa) antes de iniciar esta` : undefined}
              onClick={() => setDialog({ kind: 'start', sprint: planned })}
            >
              Iniciar sprint
            </button>
          }
        />
      ) : (
        <div className="bl-section bl-none">
          <span className="muted">Nenhuma sprint em planejamento.</span>
          <button className="small primary" onClick={createSprint}>
            Criar sprint
          </button>
        </div>
      )}

      <Section
        tasks={tasks.filter((t) => sectionOf(t) === BACKLOG)}
        matches={matches}
        selected={selected}
        onToggle={toggle}
        onDrop={(ids) => move(ids, BACKLOG)}
        destinations={destinations}
        onMove={(id, to) => move([id], to)}
        action={null}
      />

      {dialog?.kind === 'start' && <StartSprintDialog sprint={dialog.sprint} onClose={() => setDialog(null)} />}
    </>
  );
}

function toggleIn(s: Set<string>, id: string) {
  const n = new Set(s);
  if (n.has(id)) n.delete(id);
  else n.add(id);
  return n;
}

const STATUS_ORDER: Status[] = ['todo', 'doing', 'done'];

function Section({
  sprint,
  tasks,
  matches,
  selected,
  onToggle,
  onDrop,
  destinations,
  onMove,
  action,
}: {
  sprint?: Sprint;
  tasks: Task[];
  matches: (t: Task) => boolean;
  selected: Set<string>;
  onToggle: (id: string) => void;
  onDrop: (ids: string[]) => void;
  destinations: { key: SectionKey; label: string }[];
  onMove: (id: string, to: SectionKey) => void;
  action: React.ReactNode;
}) {
  const [open, setOpen] = useState(true);
  const [over, setOver] = useState(false);
  const visible = tasks.filter(matches).sort((a, b) => a.orderHint.localeCompare(b.orderHint) || a.title.localeCompare(b.title));
  const byStatus = (s: Status) => sumPoints(tasks.filter((t) => statusOf(t) === s));
  const allSelected = visible.length > 0 && visible.every((t) => selected.has(t.id));
  const here: SectionKey = sprint ? sprint.id : BACKLOG;

  const handleDrop = (e: DragEvent) => {
    e.preventDefault();
    setOver(false);
    try {
      const ids = JSON.parse(e.dataTransfer.getData('application/x-task-ids')) as string[];
      onDrop(ids);
    } catch {
      /* arrasto de outra origem */
    }
  };

  return (
    <section
      className={`bl-section ${over ? 'drop' : ''}`}
      onDragOver={(e) => {
        if (e.dataTransfer.types.includes('application/x-task-ids')) {
          e.preventDefault();
          setOver(true);
        }
      }}
      onDragLeave={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node)) setOver(false);
      }}
      onDrop={handleDrop}
    >
      <div className="bl-head">
        <input
          type="checkbox"
          aria-label="Selecionar todas"
          checked={allSelected}
          onChange={() => visible.forEach((t) => (allSelected || !selected.has(t.id)) && onToggle(t.id))}
        />
        <button className="ghost small caret" onClick={() => setOpen(!open)} aria-expanded={open}>
          {open ? '▾' : '▸'}
        </button>
        <strong>{sprint ? sprint.name : 'Backlog'}</strong>
        {sprint && (
          <span className="faint">
            {formatRange(sprint.start, sprint.end)}
            {sprint.status === 'active' && <span className="chip active-chip">ativa</span>}
          </span>
        )}
        <span className="faint">({tasks.length} tarefas)</span>
        <span className="grow" />
        <span className="status-pills" title="Pontos: não iniciada / em andamento / concluída">
          {STATUS_ORDER.map((s) => (
            <span key={s} className={`pill ${s}`} title={`${STATUS_LABEL[s]}: ${byStatus(s)} pts`}>
              {byStatus(s)}
            </span>
          ))}
        </span>
        {action}
      </div>
      {sprint?.goal && open && <div className="bl-goal faint">Objetivo: {sprint.goal}</div>}
      {open && (
        <div className="bl-rows">
          {visible.map((t) => (
            <Row
              key={t.id}
              task={t}
              selected={selected.has(t.id)}
              onToggle={() => onToggle(t.id)}
              dragIds={() => (selected.has(t.id) ? [...selected] : [t.id])}
              destinations={destinations.filter((d) => d.key !== here)}
              onMove={(to) => onMove(t.id, to)}
            />
          ))}
          {visible.length === 0 && (
            <div className="bl-empty">
              {tasks.length ? 'Nenhuma tarefa com esses filtros.' : 'Arraste tarefas para cá.'}
            </div>
          )}
        </div>
      )}
      <div className="bl-foot faint">
        {tasks.length} tarefas <span className="sep" /> Estimativa: <strong>{sumPoints(tasks)}</strong>
      </div>
    </section>
  );
}

function Row({
  task,
  selected,
  onToggle,
  dragIds,
  destinations,
  onMove,
}: {
  task: Task;
  selected: boolean;
  onToggle: () => void;
  dragIds: () => string[];
  destinations: { key: SectionKey; label: string }[];
  onMove: (to: SectionKey) => void;
}) {
  const { buckets, setStatus, userName } = useStore();
  const [busy, setBusy] = useState(false);
  const status = statusOf(task);
  const bucket = buckets.find((b) => b.id === task.bucketId)?.name;

  return (
    <div
      className={`bl-row ${selected ? 'selected' : ''} ${status === 'done' ? 'done' : ''}`}
      draggable
      onDragStart={(e) => {
        const ids = dragIds();
        e.dataTransfer.setData('application/x-task-ids', JSON.stringify(ids));
        e.dataTransfer.effectAllowed = 'move';
        if (ids.length > 1) {
          const ghost = document.createElement('div');
          ghost.className = 'drag-ghost';
          ghost.textContent = `${ids.length} tarefas`;
          document.body.appendChild(ghost);
          e.dataTransfer.setDragImage(ghost, 10, 10);
          setTimeout(() => ghost.remove());
        }
      }}
    >
      <input type="checkbox" checked={selected} onChange={onToggle} aria-label={`Selecionar ${task.title}`} />
      <span className="grip" aria-hidden>
        ⋮⋮
      </span>
      <span className="bl-title">{task.title}</span>
      {bucket && <span className="chip bl-bucket">{bucket}</span>}
      <select
        className={`lozenge ${status}`}
        value={status}
        disabled={busy}
        aria-label="Status"
        onChange={async (e) => {
          setBusy(true);
          try {
            await setStatus(task.id, e.target.value as Status);
          } finally {
            setBusy(false);
          }
        }}
      >
        {STATUS_ORDER.map((s) => (
          <option key={s} value={s}>
            {STATUS_LABEL[s]}
          </option>
        ))}
      </select>
      <PointsSelect task={task} />
      <span className="bl-assignee">
        {task.assignees.length ? (
          task.assignees.slice(0, 2).map((a) => <Avatar key={a} id={a} />)
        ) : (
          <span className="avatar unassigned" title="Sem responsável" aria-label="Sem responsável">
            ?
          </span>
        )}
        {task.assignees.length > 2 && (
          <span className="faint" title={task.assignees.map(userName).join(', ')}>
            +{task.assignees.length - 2}
          </span>
        )}
      </span>
      <select
        className="more"
        value=""
        aria-label="Mover para"
        title="Mover para…"
        onChange={(e) => onMove(e.target.value === BACKLOG ? BACKLOG : Number(e.target.value))}
      >
        <option value="" disabled>
          Mover para…
        </option>
        {destinations.map((d) => (
          <option key={d.key} value={d.key}>
            {d.label}
          </option>
        ))}
      </select>
    </div>
  );
}
