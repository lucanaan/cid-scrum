import type { TaskWithDetails } from '../graph/types';
import { parseTags, type PokerState } from './tags';

/** Tarefa do Planner já com as tags do app interpretadas. */
export interface Task {
  id: string;
  title: string;
  bucketId: string;
  assignees: string[];
  /** Rótulos aplicados (category1..category25). */
  categories: string[];
  percentComplete: number;
  createdAt: string;
  completedAt: string | null;
  dueAt: string | null;
  orderHint: string;
  points?: number;
  sprint?: number;
  poker?: PokerState;
  description: string;
  etag: string;
  detailsEtag: string;
}

export function toTask(raw: TaskWithDetails): Task {
  const { tags } = parseTags(raw.details.description);
  return {
    id: raw.id,
    title: raw.title,
    bucketId: raw.bucketId,
    assignees: Object.keys(raw.assignments ?? {}),
    categories: Object.entries(raw.appliedCategories ?? {})
      .filter(([, on]) => on)
      .map(([k]) => k),
    percentComplete: raw.percentComplete,
    createdAt: raw.createdDateTime,
    completedAt: raw.percentComplete === 100 ? raw.completedDateTime ?? raw.createdDateTime : null,
    dueAt: raw.dueDateTime,
    orderHint: raw.orderHint,
    points: tags.points,
    sprint: tags.sprint,
    poker: tags.poker,
    description: raw.details.description,
    etag: raw['@odata.etag'],
    detailsEtag: raw.details.etag,
  };
}

export type Status = 'todo' | 'doing' | 'done';

export function statusOf(task: Pick<Task, 'percentComplete'>): Status {
  if (task.percentComplete >= 100) return 'done';
  if (task.percentComplete > 0) return 'doing';
  return 'todo';
}

export const STATUS_PERCENT: Record<Status, number> = { todo: 0, doing: 50, done: 100 };
export const STATUS_LABEL: Record<Status, string> = {
  todo: 'Não iniciada',
  doing: 'Em andamento',
  done: 'Concluída',
};
