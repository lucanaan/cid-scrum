import { useState } from 'react';
import { Avatar } from '../components/ui';
import { memberConfig } from '../model/appConfig';
import { useStore } from '../store';

export function Team() {
  const { config, tasks, users, userName, updateConfig } = useStore();
  const [draft, setDraft] = useState<Record<string, { capacity?: string; active?: boolean }>>({});
  const [defaultCap, setDefaultCap] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Todas as pessoas conhecidas, inclusive as desativadas.
  const ids = new Set<string>(Object.keys(config.members));
  tasks.forEach((t) => t.assignees.forEach((a) => ids.add(a)));
  const people = [...ids].sort((a, b) => userName(a).localeCompare(userName(b)));
  const dirty = Object.keys(draft).length > 0 || defaultCap !== null;

  const save = async () => {
    setSaving(true);
    try {
      await updateConfig((c) => {
        const members = { ...c.members };
        for (const [id, d] of Object.entries(draft)) {
          const cur = memberConfig(c, id);
          members[id] = {
            capacity: d.capacity !== undefined ? Math.max(0, Number(d.capacity) || 0) : cur.capacity,
            active: d.active ?? cur.active,
          };
        }
        return {
          ...c,
          members,
          defaultCapacity: defaultCap !== null ? Math.max(0, Number(defaultCap) || 0) : c.defaultCapacity,
        };
      });
      setDraft({});
      setDefaultCap(null);
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="card stack">
      <h2>Equipe e capacidade</h2>
      <p className="muted" style={{ margin: 0 }}>
        Capacidade = quantos pontos a pessoa costuma entregar numa sprint completa. Ausências são descontadas
        proporcionalmente na aba Planejamento. As pessoas aparecem aqui quando são responsáveis por alguma tarefa no
        Planner.
      </p>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Pessoa</th>
              <th className="num">Pontos por sprint</th>
              <th>Participa das sprints</th>
            </tr>
          </thead>
          <tbody>
            {people.map((id) => {
              const cur = memberConfig(config, id);
              const d = draft[id] ?? {};
              return (
                <tr key={id}>
                  <td>
                    <span className="row">
                      <Avatar id={id} />
                      {users[id]?.displayName ?? userName(id)}
                      {!config.members[id] && <span className="chip">padrão</span>}
                    </span>
                  </td>
                  <td className="num">
                    <input
                      type="number"
                      min={0}
                      style={{ width: 80, textAlign: 'right' }}
                      value={d.capacity ?? String(cur.capacity)}
                      onChange={(e) => setDraft((x) => ({ ...x, [id]: { ...x[id], capacity: e.target.value } }))}
                      aria-label={`Capacidade de ${userName(id)}`}
                    />
                  </td>
                  <td>
                    <input
                      type="checkbox"
                      checked={d.active ?? cur.active}
                      onChange={(e) => setDraft((x) => ({ ...x, [id]: { ...x[id], active: e.target.checked } }))}
                      aria-label={`${userName(id)} participa`}
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <label className="row">
        Capacidade padrão para pessoas novas
        <input
          type="number"
          min={0}
          style={{ width: 80 }}
          value={defaultCap ?? String(config.defaultCapacity)}
          onChange={(e) => setDefaultCap(e.target.value)}
        />
        pts
      </label>
      <div>
        <button className="primary" disabled={!dirty || saving} onClick={save}>
          {saving ? 'Salvando…' : 'Salvar'}
        </button>
      </div>
    </section>
  );
}
