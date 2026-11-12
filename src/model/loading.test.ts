import { describe, expect, it } from 'vitest';
import type { PlannerTask } from '../graph/types';
import { emptyConfig, type Sprint } from './appConfig';
import { tasksToLoad } from './loading';

function raw(id: string, percentComplete: number, completed: string | null = null): PlannerTask {
  return {
    id,
    planId: 'p',
    bucketId: 'b',
    title: id,
    percentComplete,
    createdDateTime: '',
    completedDateTime: completed,
    dueDateTime: null,
    orderHint: '',
    assignments: {},
    '@odata.etag': '',
  };
}

const sprint = (id: number, start: string, status: Sprint['status']): Sprint => ({
  id,
  name: `Sprint ${id}`,
  start,
  end: start,
  goal: '',
  status,
  absences: {},
});

describe('tasksToLoad', () => {
  it('carrega abertas e só as concluídas desde o início da sprint atual', () => {
    const config = {
      ...emptyConfig(),
      sprints: [sprint(1, '2026-10-19', 'closed'), sprint(2, '2026-11-02', 'active'), sprint(3, '2026-11-16', 'planned')],
    };
    const ids = tasksToLoad(
      [
        raw('aberta', 0),
        raw('andamento', 50),
        raw('concluida-antiga', 100, '2026-10-20T15:00:00Z'),
        raw('concluida-na-sprint', 100, '2026-11-04T15:00:00Z'),
      ],
      config,
    ).map((t) => t.id);
    expect(ids).toEqual(['aberta', 'andamento', 'concluida-na-sprint']);
  });

  it('no primeiro uso nenhuma concluída entra', () => {
    const ids = tasksToLoad([raw('a', 0), raw('b', 100, '2026-11-04T15:00:00Z')], emptyConfig()).map((t) => t.id);
    expect(ids).toEqual(['a']);
  });
});
