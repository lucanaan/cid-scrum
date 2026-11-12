import { describe, expect, it } from 'vitest';
import { findCategory, freeCategory, labelPatch, sprintLabelName } from './sprintLabel';

const names = { category1: 'Urgente', category2: 'SPRINT-1', category3: '', category4: 'SPRINT-2' };

describe('rótulo de sprint', () => {
  it('nomeia e encontra o rótulo', () => {
    expect(sprintLabelName(2)).toBe('SPRINT-2');
    expect(findCategory(names, 'SPRINT-2')).toBe('category4');
    expect(findCategory(names, 'SPRINT-9')).toBeUndefined();
  });

  it('acha o primeiro rótulo livre', () => {
    expect(freeCategory(names)).toBe('category3');
  });

  it('troca o rótulo de sprint sem mexer nos outros', () => {
    expect(labelPatch(['category1', 'category2'], names, 'category4')).toEqual({ category2: false, category4: true });
    expect(labelPatch(['category1', 'category4'], names, 'category4')).toEqual({});
    expect(labelPatch(['category1', 'category4'], names, undefined)).toEqual({ category4: false });
  });
});
