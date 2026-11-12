import { useMemo, useState } from 'react';
import { Assignees, Points } from '../components/ui';
import { POKER_VALUES } from '../model/tags';
import type { Task } from '../model/task';
import { useStore } from '../store';

const NUMERIC = POKER_VALUES.filter((v) => /^\d+$/.test(v)).map(Number);

/** Estimativa individual, comparando com tarefas já estimadas. */
export function Estimate() {
  const { tasks, setTags } = useStore();
  const pending = useMemo(() => tasks.filter((t) => !t.completedAt && t.points === undefined), [tasks]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const selected = pending.find((t) => t.id === selectedId) ?? pending[0];

  // Referências: tarefas já estimadas com cada valor (concluídas primeiro).
  const references = useMemo(() => {
    const out = new Map<number, Task[]>();
    for (const n of NUMERIC) {
      out.set(
        n,
        tasks
          .filter((t) => t.points === n)
          .sort((a, b) => Number(!!b.completedAt) - Number(!!a.completedAt))
          .slice(0, 3),
      );
    }
    return out;
  }, [tasks]);

  const estimate = async (n: number) => {
    if (!selected) return;
    setBusy(true);
    const next = pending[pending.indexOf(selected) + 1];
    try {
      await setTags(selected.id, { points: n });
      setSelectedId(next?.id ?? null);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="grid-2">
      <section className="card">
        <h2>Sem estimativa ({pending.length})</h2>
        <div className="task-list scroll">
          {pending.map((t) => (
            <div
              key={t.id}
              className={`task-item clickable ${selected?.id === t.id ? 'selected' : ''}`}
              onClick={() => setSelectedId(t.id)}
            >
              <span className="title">{t.title}</span>
              <Assignees ids={t.assignees} />
            </div>
          ))}
          {pending.length === 0 && <div className="empty-state">Tudo estimado. 🎉</div>}
        </div>
      </section>

      <section className="card stack" style={{ gap: 14 }}>
        {selected ? (
          <>
            <div>
              <div className="faint">Estimando</div>
              <h2 style={{ marginTop: 4 }}>{selected.title}</h2>
            </div>
            <div className="cards">
              {NUMERIC.map((n) => (
                <button key={n} className="poker-card" disabled={busy} onClick={() => estimate(n)}>
                  {n}
                </button>
              ))}
            </div>
            <div>
              <h3 style={{ marginBottom: 6 }}>Compare com tarefas já estimadas</h3>
              <table>
                <tbody>
                  {NUMERIC.map((n) => (
                    <tr key={n}>
                      <td style={{ width: 48 }}>
                        <Points value={n} />
                      </td>
                      <td className="muted">
                        {references.get(n)!.length
                          ? references.get(n)!.map((t) => t.title).join(' · ')
                          : <span className="faint">nenhuma ainda</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        ) : (
          <div className="empty-state">Selecione uma tarefa à esquerda.</div>
        )}
      </section>
    </div>
  );
}
