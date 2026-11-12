import { memberConfig, type AppConfig, type Sprint, type SprintResult } from './appConfig';
import type { Task } from './task';

export const UNASSIGNED = '';

/** Data local no formato AAAA-MM-DD. */
export function dateKey(d: Date | string): string {
  const date = typeof d === 'string' ? new Date(d) : d;
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function parseDay(key: string): Date {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d);
}

/** Todos os dias de `start` a `end`, inclusive. */
export function daysBetween(start: string, end: string): string[] {
  const out: string[] = [];
  const cur = parseDay(start);
  const last = parseDay(end);
  while (cur <= last && out.length < 400) {
    out.push(dateKey(cur));
    cur.setDate(cur.getDate() + 1);
  }
  return out;
}

export function isBusinessDay(key: string): boolean {
  const wd = parseDay(key).getDay();
  return wd !== 0 && wd !== 6;
}

export function businessDays(start: string, end: string): number {
  return daysBetween(start, end).filter(isBusinessDay).length;
}

/** Capacidade de uma pessoa na sprint, descontando as ausências. */
export function memberCapacity(config: AppConfig, sprint: Sprint, userId: string): number {
  const { capacity, active } = memberConfig(config, userId);
  if (!active) return 0;
  const days = businessDays(sprint.start, sprint.end);
  if (days === 0) return 0;
  const absent = Math.min(days, sprint.absences[userId] ?? 0);
  return round1((capacity * (days - absent)) / days);
}

export function teamCapacity(config: AppConfig, sprint: Sprint, memberIds: string[]): number {
  return round1(memberIds.reduce((sum, id) => sum + memberCapacity(config, sprint, id), 0));
}

export function sumPoints(tasks: Task[]): number {
  return round1(tasks.reduce((sum, t) => sum + (t.points ?? 0), 0));
}

/** Pontos por pessoa; tarefas com vários responsáveis dividem os pontos igualmente. */
export function pointsByPerson(tasks: Task[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const t of tasks) {
    const pts = t.points ?? 0;
    const people = t.assignees.length ? t.assignees : [UNASSIGNED];
    for (const p of people) out[p] = round1((out[p] ?? 0) + pts / people.length);
  }
  return out;
}

export function sprintTasks(tasks: Task[], sprintId: number): Task[] {
  return tasks.filter((t) => t.sprint === sprintId);
}

export function computeResult(tasks: Task[], sprint: Sprint): SprintResult {
  const inSprint = sprintTasks(tasks, sprint.id);
  const done = inSprint.filter((t) => t.completedAt);
  return {
    committed: sprint.committed ?? sumPoints(inSprint),
    delivered: sumPoints(done),
    perPerson: pointsByPerson(done),
    completedTasks: done.length,
    totalTasks: inSprint.length,
  };
}

/** Resultado gravado (sprints encerradas) ou calculado na hora (demais). */
export function resultOf(tasks: Task[], sprint: Sprint): SprintResult {
  return sprint.result ?? computeResult(tasks, sprint);
}

/** Média de pontos entregues nas últimas `n` sprints encerradas. */
export function velocity(config: AppConfig, n = 3): number | null {
  const closed = config.sprints
    .filter((s) => s.status === 'closed' && s.result)
    .sort((a, b) => b.end.localeCompare(a.end))
    .slice(0, n);
  if (closed.length === 0) return null;
  return round1(closed.reduce((sum, s) => sum + (s.result?.delivered ?? 0), 0) / closed.length);
}

export interface Burndown {
  days: string[];
  ideal: number[];
  remaining: (number | null)[];
  scope: number;
}

/** Pontos restantes por dia. A linha ideal só desce em dias úteis. */
export function burndown(tasks: Task[], sprint: Sprint, today: string = dateKey(new Date())): Burndown {
  const inSprint = sprintTasks(tasks, sprint.id);
  const scope = sumPoints(inSprint);
  const days = daysBetween(sprint.start, sprint.end);
  const totalBiz = days.filter(isBusinessDay).length || 1;

  let bizSeen = 0;
  const ideal = days.map((d) => {
    if (isBusinessDay(d)) bizSeen++;
    return round1(scope * (1 - bizSeen / totalBiz));
  });

  const remaining = days.map((d) => {
    if (d > today) return null;
    const done = inSprint.filter((t) => t.completedAt && dateKey(t.completedAt) <= d);
    return round1(scope - sumPoints(done));
  });

  return { days, ideal, remaining, scope };
}

export type LoadLevel = 'ok' | 'warn' | 'over' | 'none';

export function loadLevel(points: number, capacity: number): LoadLevel {
  if (capacity <= 0) return points > 0 ? 'over' : 'none';
  const ratio = points / capacity;
  if (ratio > 1) return 'over';
  if (ratio >= 0.9) return 'warn';
  return 'ok';
}

export function round1(n: number): number {
  return Math.round(n * 10) / 10;
}
