// Rótulo "SPRINT-N" aplicado às tarefas da sprint N no Planner.
// O plano tem 25 rótulos (category1..category25); cada sprint usa um deles.

const SPRINT_LABEL_RE = /^SPRINT-\d+$/;
export const CATEGORY_KEYS = Array.from({ length: 25 }, (_, i) => `category${i + 1}`);

export type Categories = Record<string, string | null>;

export function sprintLabelName(sprintId: number): string {
  return `SPRINT-${sprintId}`;
}

export function findCategory(names: Categories, label: string): string | undefined {
  return CATEGORY_KEYS.find((k) => names[k]?.trim() === label);
}

export function freeCategory(names: Categories): string | undefined {
  return CATEGORY_KEYS.find((k) => !names[k]?.trim());
}

/**
 * Mudanças em appliedCategories para a tarefa ficar só com o rótulo da sprint `target`
 * (ou sem rótulo de sprint, se `target` for undefined). Rótulos que não são de sprint ficam como estão.
 */
export function labelPatch(applied: string[], names: Categories, target: string | undefined): Record<string, boolean> {
  const patch: Record<string, boolean> = {};
  for (const k of applied) {
    if (k !== target && SPRINT_LABEL_RE.test(names[k]?.trim() ?? '')) patch[k] = false;
  }
  if (target && !applied.includes(target)) patch[target] = true;
  return patch;
}
