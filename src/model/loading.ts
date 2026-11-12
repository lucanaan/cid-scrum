// Quais tarefas do Planner o app carrega. Tarefas concluídas antigas ficam de fora:
// o histórico das sprints encerradas já está gravado no config (sprint.result).
import type { PlannerTask } from '../graph/types';
import type { AppConfig } from './appConfig';
import { findCategory, sprintLabelName, type Categories } from './sprintLabel';

export function tasksToLoad(raw: PlannerTask[], config: AppConfig, categories: Categories): PlannerTask[] {
  // Rótulos das sprints que ainda importam (ativa e planejadas).
  const currentLabels = new Set(
    config.sprints
      .filter((s) => s.status !== 'closed')
      .map((s) => findCategory(categories, sprintLabelName(s.id)))
      .filter((k): k is string => !!k),
  );
  return raw.filter(
    (t) =>
      t.percentComplete < 100 ||
      Object.entries(t.appliedCategories ?? {}).some(([k, on]) => on && currentLabels.has(k)),
  );
}
