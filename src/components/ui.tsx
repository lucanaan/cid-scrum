import type { ReactNode } from 'react';
import { loadLevel } from '../model/metrics';
import { useStore } from '../store';

/** Cor fixa por pessoa, seguindo a ordem da equipe (nunca pelo ranking). */
export function personColor(index: number): string {
  return `var(--series-${(index % 8) + 1})`;
}

export function usePersonColor() {
  const { allMemberIds } = useStore();
  return (id: string) => {
    const i = allMemberIds.indexOf(id);
    return i < 0 ? 'var(--neutral-mark)' : personColor(i);
  };
}

function initials(name: string) {
  const parts = name.split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] ?? '?') + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase();
}

export function Avatar({ id }: { id: string }) {
  const { userName } = useStore();
  const color = usePersonColor()(id);
  const name = userName(id);
  return (
    <span className="avatar" style={{ background: color }} title={name} aria-label={name}>
      {initials(name)}
    </span>
  );
}

export function Assignees({ ids }: { ids: string[] }) {
  if (!ids.length) return <span className="faint">—</span>;
  return (
    <span className="avatars">
      {ids.map((id) => (
        <Avatar key={id} id={id} />
      ))}
    </span>
  );
}

export function Points({ value }: { value?: number }) {
  return value === undefined ? (
    <span className="pts empty" title="Sem estimativa">
      –
    </span>
  ) : (
    <span className="pts" title={`${value} pontos`}>
      {value}
    </span>
  );
}

export function Stat({ label, value, sub }: { label: string; value: ReactNode; sub?: ReactNode }) {
  return (
    <div className="stat">
      <div className="label">{label}</div>
      <div className="value">{value}</div>
      {sub && <div className="sub">{sub}</div>}
    </div>
  );
}

const LEVEL_TEXT = { ok: 'OK', warn: 'No limite', over: 'Acima', none: 'Sem capacidade' } as const;
const LEVEL_ICON = { ok: '✓', warn: '!', over: '▲', none: '–' } as const;

/** Barra de carga: verde até 90%, amarela de 90 a 100%, vermelha acima. */
export function LoadBar({ label, points, capacity }: { label: ReactNode; points: number; capacity: number }) {
  const level = loadLevel(points, capacity);
  const pct = capacity > 0 ? Math.min(100, (points / capacity) * 100) : points > 0 ? 100 : 0;
  return (
    <div className="load">
      <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{label}</div>
      <div
        className="load-bar"
        role="meter"
        aria-valuenow={points}
        aria-valuemin={0}
        aria-valuemax={capacity}
        title={`${points} de ${capacity} pts`}
      >
        <span className={level} style={{ width: `${pct}%` }} />
      </div>
      <div className="load-value">
        {points} / {capacity} pts{' '}
        <span className={`status-${level === 'none' ? 'ok' : level}`} title={LEVEL_TEXT[level]}>
          {LEVEL_ICON[level]} {LEVEL_TEXT[level]}
        </span>
      </div>
    </div>
  );
}

/** "2026-11-02" -> "02/11" */
export function formatDate(key: string): string {
  const [, m, d] = key.split('-');
  return `${d}/${m}`;
}

export function formatRange(start: string, end: string): string {
  return `${formatDate(start)} – ${formatDate(end)}/${end.slice(0, 4)}`;
}
