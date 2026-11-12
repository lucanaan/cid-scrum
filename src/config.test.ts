import { describe, expect, it } from 'vitest';
import { plannerTaskUrl } from './config';

describe('plannerTaskUrl', () => {
  it('gera o mesmo link que o Planner usa para abrir a tarefa', () => {
    expect(plannerTaskUrl('dCwUIscl_U-XIqlk0W09PWUACjYO', 'Jtq6XYAcL0OrATQO_pq4lmUACMU0')).toBe(
      'https://planner.cloud.microsoft/ui/web/v1/plan/dCwUIscl_U-XIqlk0W09PWUACjYO/view/board/task/Jtq6XYAcL0OrATQO_pq4lmUACMU0?tid=20c9ecd1-bd49-44a3-b71a-c8903c2a09ef',
    );
  });
});
