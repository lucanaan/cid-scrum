// Quais tarefas do Planner o app carrega. Tarefas concluídas antigas ficam de fora:
// o histórico das sprints encerradas já está gravado no config (sprint.result).
import type { PlannerTask } from '../graph/types';
import type { AppConfig } from './appConfig';
import { dateKey } from './metrics';

/**
 * Abertas sempre entram. Concluídas só entram se foram concluídas a partir do início
 * da sprint ativa/planejada mais antiga (são as que contam no burndown da sprint atual).
 */
export function tasksToLoad(raw: PlannerTask[], config: AppConfig): PlannerTask[] {
  const starts = config.sprints.filter((s) => s.status !== 'closed').map((s) => s.start);
  const since = starts.length ? starts.reduce((a, b) => (a < b ? a : b)) : null;
  return raw.filter(
    (t) =>
      t.percentComplete < 100 || (since !== null && !!t.completedDateTime && dateKey(t.completedDateTime) >= since),
  );
}
