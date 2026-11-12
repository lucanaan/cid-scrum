import { describe, expect, it } from 'vitest';
import type { PlannerTask } from '../graph/types';
import { emptyConfig, type Sprint } from './appConfig';
import { tasksToLoad } from './loading';

function raw(id: string, percentComplete: number, labels: string[] = []): PlannerTask {
  return {
    id,
    planId: 'p',
    bucketId: 'b',
    title: id,
    percentComplete,
    createdDateTime: '',
    completedDateTime: null,
    dueDateTime: null,
    orderHint: '',
    assignments: {},
    appliedCategories: Object.fromEntries(labels.map((l) => [l, true])),
    '@odata.etag': '',
  };
}

const sprint = (id: number, status: Sprint['status']): Sprint => ({
  id,
  name: `Sprint ${id}`,
  start: '2026-11-02',
  end: '2026-11-15',
  goal: '',
  status,
  absences: {},
});

describe('tasksToLoad', () => {
  const categories = { category1: 'Urgente', category2: 'SPRINT-1', category3: 'SPRINT-2', category4: 'SPRINT-3' };
  const config = { ...emptyConfig(), sprints: [sprint(1, 'closed'), sprint(2, 'active'), sprint(3, 'planned')] };

  it('carrega abertas e só as concluídas das sprints atuais', () => {
    const ids = tasksToLoad(
      [
        raw('aberta', 0),
        raw('andamento', 50, ['category2']),
        raw('concluida-antiga', 100),
        raw('concluida-sprint-encerrada', 100, ['category2']),
        raw('concluida-sprint-ativa', 100, ['category3', 'category1']),
        raw('concluida-sprint-planejada', 100, ['category4']),
        raw('concluida-outro-rotulo', 100, ['category1']),
      ],
      config,
      categories,
    ).map((t) => t.id);
    expect(ids).toEqual(['aberta', 'andamento', 'concluida-sprint-ativa', 'concluida-sprint-planejada']);
  });

  it('no primeiro uso nenhuma concluída entra', () => {
    const ids = tasksToLoad([raw('a', 0), raw('b', 100, ['category3'])], emptyConfig(), categories).map((t) => t.id);
    expect(ids).toEqual(['a']);
  });
});
