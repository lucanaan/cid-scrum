import { describe, expect, it } from 'vitest';
import { emptyConfig, type Sprint } from './appConfig';
import {
  burndown,
  businessDays,
  computeResult,
  dateKey,
  dueForSprintEnd,
  sameDay,
  loadLevel,
  memberCapacity,
  pointsByPerson,
  velocity,
} from './metrics';
import type { Task } from './task';

function task(p: Partial<Task>): Task {
  return {
    id: Math.random().toString(36),
    title: 't',
    bucketId: 'b',
    assignees: [],
    percentComplete: 0,
    createdAt: '2026-11-01T12:00:00Z',
    completedAt: null,
    dueAt: null,
    orderHint: '',
    description: '',
    etag: '',
    detailsEtag: '',
    ...p,
  };
}

// 2026-11-02 é segunda-feira; duas semanas = 10 dias úteis.
const sprint: Sprint = {
  id: 1,
  name: 'Sprint 1',
  start: '2026-11-02',
  end: '2026-11-15',
  goal: '',
  status: 'active',
  absences: { ana: 5 },
};

describe('métricas', () => {
  it('conta dias úteis', () => {
    expect(businessDays('2026-11-02', '2026-11-15')).toBe(10);
  });

  it('desconta ausências da capacidade', () => {
    const config = { ...emptyConfig(), members: { ana: { capacity: 10, active: true } } };
    expect(memberCapacity(config, sprint, 'ana')).toBe(5);
    expect(memberCapacity(config, sprint, 'bob')).toBe(8); // capacidade padrão
  });

  it('divide pontos entre responsáveis', () => {
    const load = pointsByPerson([
      task({ points: 6, assignees: ['ana', 'bob'] }),
      task({ points: 2, assignees: ['ana'] }),
      task({ points: 1 }),
    ]);
    expect(load).toEqual({ ana: 5, bob: 3, '': 1 });
  });

  it('calcula resultado e velocidade', () => {
    const tasks = [
      task({ points: 5, sprint: 1, assignees: ['ana'], completedAt: '2026-11-05T12:00:00', percentComplete: 100 }),
      task({ points: 3, sprint: 1, assignees: ['bob'] }),
      task({ points: 8, sprint: 2 }),
    ];
    const r = computeResult(tasks, { ...sprint, committed: 10 });
    expect(r).toMatchObject({ committed: 10, delivered: 5, completedTasks: 1, totalTasks: 2 });
    expect(r.perPerson).toEqual({ ana: 5 });

    const config = emptyConfig();
    config.sprints = [
      { ...sprint, id: 1, end: '2026-10-01', status: 'closed', result: { ...r, delivered: 10 } },
      { ...sprint, id: 2, end: '2026-10-15', status: 'closed', result: { ...r, delivered: 20 } },
      { ...sprint, id: 3, status: 'active' },
    ];
    expect(velocity(config)).toBe(15);
    expect(velocity(emptyConfig())).toBeNull();
  });

  it('gera burndown com linha ideal só nos dias úteis', () => {
    const tasks = [
      task({ points: 4, sprint: 1, completedAt: '2026-11-03T12:00:00', percentComplete: 100 }),
      task({ points: 6, sprint: 1 }),
    ];
    const b = burndown(tasks, sprint, '2026-11-04');
    expect(b.scope).toBe(10);
    expect(b.days).toHaveLength(14);
    expect(b.remaining.slice(0, 4)).toEqual([10, 6, 6, null]);
    expect(b.ideal[0]).toBe(9);
    expect(b.ideal[5]).toBe(b.ideal[4]); // sábado não desce
    expect(b.ideal[13]).toBe(0);
  });

  it('classifica a carga', () => {
    expect(loadLevel(5, 10)).toBe('ok');
    expect(loadLevel(9, 10)).toBe('warn');
    expect(loadLevel(11, 10)).toBe('over');
    expect(loadLevel(0, 0)).toBe('none');
  });

  it('data de conclusão cai no último dia da sprint', () => {
    const iso = dueForSprintEnd('2026-11-15');
    expect(dateKey(iso)).toBe('2026-11-15');
    expect(sameDay(iso, '2026-11-15')).toBe(true);
    expect(sameDay(iso, '2026-11-16')).toBe(false);
    expect(sameDay(null, '2026-11-15')).toBe(false);
  });
});
