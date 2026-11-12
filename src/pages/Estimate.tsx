import { useEffect, useMemo, useState } from 'react';
import { Assignees, Points } from '../components/ui';
import { POKER_VALUES, type PokerState, type PokerValue } from '../model/tags';
import type { Task } from '../model/task';
import { useStore } from '../store';

const NUMERIC = POKER_VALUES.filter((v) => /^\d+$/.test(v)).map(Number);
const cardLabel = (v: PokerValue) => (v === 'c' ? '☕' : v);

export function Estimate() {
  const [mode, setMode] = useState<'poker' | 'quick'>('poker');
  return (
    <>
      <div className="row">
        <div className="segmented" role="tablist">
          <button className={mode === 'poker' ? 'active' : ''} onClick={() => setMode('poker')}>
            Planning Poker
          </button>
          <button className={mode === 'quick' ? 'active' : ''} onClick={() => setMode('quick')}>
            Estimativa rápida
          </button>
        </div>
        <span className="faint">
          {mode === 'poker'
            ? 'Cada pessoa abre o app no próprio computador e vota; os votos aparecem juntos.'
            : 'Você estima sozinho, comparando com tarefas já estimadas.'}
        </span>
      </div>
      {mode === 'poker' ? <Poker /> : <Quick />}
    </>
  );
}

/* ---------------- Planning Poker ---------------- */

function Poker() {
  const { config, tasks, reloadConfig, reloadTask } = useStore();
  const taskId = config.pokerTaskId;
  const task = tasks.find((t) => t.id === taskId);

  // Enquanto a página está aberta, busca votos e mudanças de sessão a cada 3 s.
  useEffect(() => {
    let alive = true;
    const tick = async () => {
      try {
        const cfg = await reloadConfig();
        if (alive && cfg.pokerTaskId) await reloadTask(cfg.pokerTaskId);
      } catch {
        /* falhas de rede temporárias: tenta no próximo ciclo */
      }
    };
    const timer = setInterval(tick, 3000);
    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, [reloadConfig, reloadTask]);

  if (!task) return <PickTask />;
  return <Session task={task} />;
}

function PickTask() {
  const { tasks, updateConfig, setTags } = useStore();
  const [all, setAll] = useState(false);
  const [busy, setBusy] = useState(false);
  const candidates = tasks.filter((t) => !t.completedAt && (all || t.points === undefined));

  const start = async (t: Task) => {
    setBusy(true);
    try {
      await setTags(t.id, { poker: { revealed: false, votes: {} } });
      await updateConfig((c) => ({ ...c, pokerTaskId: t.id }));
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="card">
      <div className="row" style={{ marginBottom: 12 }}>
        <h2 className="grow">Escolha a tarefa para votar</h2>
        <label className="row">
          <input type="checkbox" checked={all} onChange={(e) => setAll(e.target.checked)} />
          Incluir já estimadas
        </label>
      </div>
      <div className="task-list scroll">
        {candidates.map((t) => (
          <div key={t.id} className="task-item">
            <span className="title">{t.title}</span>
            <Assignees ids={t.assignees} />
            <Points value={t.points} />
            <button className="small primary" disabled={busy} onClick={() => start(t)}>
              Abrir votação
            </button>
          </div>
        ))}
        {candidates.length === 0 && <div className="empty-state">Nenhuma tarefa aberta sem estimativa. 🎉</div>}
      </div>
    </section>
  );
}

function stats(poker: PokerState) {
  const nums = Object.values(poker.votes)
    .filter((v) => /^\d+$/.test(v))
    .map(Number);
  if (!nums.length) return null;
  const avg = nums.reduce((a, b) => a + b, 0) / nums.length;
  const counts = new Map<number, number>();
  nums.forEach((n) => counts.set(n, (counts.get(n) ?? 0) + 1));
  const top = Math.max(...counts.values());
  const mode = Math.max(...[...counts].filter(([, c]) => c === top).map(([n]) => n));
  const min = Math.min(...nums);
  const max = Math.max(...nums);
  // Distância em cartas: 3 → 8 são duas cartas de diferença.
  const spread = NUMERIC.indexOf(max) - NUMERIC.indexOf(min);
  const suggestion = top > 1 ? mode : NUMERIC.find((n) => n >= avg) ?? max;
  return { avg, mode, min, max, spread, suggestion, count: nums.length };
}

function Session({ task }: { task: Task }) {
  const { me, memberIds, userName, mutateTags, updateConfig } = useStore();
  const [busy, setBusy] = useState(false);
  const poker = task.poker ?? { revealed: false, votes: {} };
  const myVote = poker.votes[me.id];
  const voters = [...new Set([...memberIds, ...Object.keys(poker.votes)])];
  const s = poker.revealed ? stats(poker) : null;

  const run = async (fn: () => Promise<unknown>) => {
    setBusy(true);
    try {
      await fn();
    } finally {
      setBusy(false);
    }
  };

  const vote = (v: PokerValue) =>
    run(() =>
      mutateTags(task.id, (cur) => {
        const p = cur.poker ?? { revealed: false, votes: {} };
        return { poker: { ...p, votes: { ...p.votes, [me.id]: v } } };
      }),
    );
  const reveal = () =>
    run(() => mutateTags(task.id, (cur) => ({ poker: { ...(cur.poker ?? { votes: {} }), revealed: true } })));
  const revote = () => run(() => mutateTags(task.id, () => ({ poker: { revealed: false, votes: {} } })));
  const finish = (points?: number) =>
    run(async () => {
      await mutateTags(task.id, () => (points === undefined ? { poker: undefined } : { points, poker: undefined }));
      await updateConfig((c) => ({ ...c, pokerTaskId: undefined }));
    });

  return (
    <div className="grid-3">
      <section className="card stack" style={{ gap: 16 }}>
        <div>
          <div className="faint">Votando agora</div>
          <h2 style={{ marginTop: 4 }}>{task.title}</h2>
          {task.description && (
            <details style={{ marginTop: 8 }}>
              <summary>Descrição</summary>
              <p style={{ whiteSpace: 'pre-wrap' }}>{task.description.replace(/\[(pts|sprint|poker):[^\]]*\]\s*/g, '')}</p>
            </details>
          )}
        </div>

        <div>
          <h3 style={{ marginBottom: 8 }}>Seu voto</h3>
          <div className="cards">
            {POKER_VALUES.map((v) => (
              <button
                key={v}
                className={`poker-card ${myVote === v ? 'chosen' : ''}`}
                disabled={busy || poker.revealed}
                onClick={() => vote(v)}
                aria-pressed={myVote === v}
                title={v === '?' ? 'Não sei' : v === 'c' ? 'Preciso de uma pausa' : `${v} pontos`}
              >
                {cardLabel(v)}
              </button>
            ))}
          </div>
        </div>

        <div>
          <h3 style={{ marginBottom: 8 }}>
            Votos ({Object.keys(poker.votes).length}/{voters.length})
          </h3>
          <div className="voters">
            {voters.map((id) => {
              const v = poker.votes[id];
              return (
                <div key={id} className="voter">
                  <div className={`slot ${v ? (poker.revealed ? 'revealed' : 'voted') : ''}`}>
                    {v ? (poker.revealed ? cardLabel(v) : '✓') : ''}
                  </div>
                  <span>{id === me.id ? 'Você' : userName(id)}</span>
                </div>
              );
            })}
          </div>
        </div>

        <div className="row">
          {!poker.revealed ? (
            <button className="primary" disabled={busy || !Object.keys(poker.votes).length} onClick={reveal}>
              Revelar votos
            </button>
          ) : (
            <button disabled={busy} onClick={revote}>
              Votar de novo
            </button>
          )}
          <span className="grow" />
          <button className="ghost" disabled={busy} onClick={() => finish()}>
            Cancelar votação
          </button>
        </div>
      </section>

      <section className="card stack">
        <h2>Resultado</h2>
        {!poker.revealed && <p className="muted">Os votos aparecem quando alguém clicar em “Revelar votos”.</p>}
        {poker.revealed && !s && <p className="muted">Ninguém votou com número. Discutam e votem de novo.</p>}
        {s && (
          <>
            <div className="row" style={{ gap: 24 }}>
              <div>
                <div className="faint">Média</div>
                <div style={{ fontSize: 24, fontWeight: 600 }}>{s.avg.toFixed(1)}</div>
              </div>
              <div>
                <div className="faint">Mais votado</div>
                <div style={{ fontSize: 24, fontWeight: 600 }}>{s.mode}</div>
              </div>
              <div>
                <div className="faint">Faixa</div>
                <div style={{ fontSize: 24, fontWeight: 600 }}>
                  {s.min}–{s.max}
                </div>
              </div>
            </div>
            {s.spread >= 2 ? (
              <p className="status-warn" style={{ margin: 0 }}>
                ! Divergência alta. Peça para quem votou {s.min} e quem votou {s.max} explicar o raciocínio, e votem de
                novo.
              </p>
            ) : (
              <p className="status-ok" style={{ margin: 0 }}>
                ✓ Equipe alinhada.
              </p>
            )}
            <div>
              <h3 style={{ marginBottom: 8 }}>Definir estimativa final</h3>
              <div className="cards">
                {NUMERIC.map((n) => (
                  <button
                    key={n}
                    className={`poker-card ${n === s.suggestion ? 'chosen' : ''}`}
                    style={{ width: 44, height: 52, fontSize: 16 }}
                    disabled={busy}
                    onClick={() => finish(n)}
                    title={n === s.suggestion ? 'Sugestão' : undefined}
                  >
                    {n}
                  </button>
                ))}
              </div>
              <p className="faint">Destacado: sugestão (mais votado ou a carta acima da média).</p>
            </div>
          </>
        )}
      </section>
    </div>
  );
}

/* ---------------- Estimativa rápida ---------------- */

function Quick() {
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
