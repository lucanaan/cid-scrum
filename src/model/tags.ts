// Tags que o app grava na descrição das tarefas do Planner.
// Ficam juntas na primeira linha, por exemplo: "[pts:5] [sprint:12]".
// O resto da descrição (o texto escrito pelas pessoas) é preservado.

export const POKER_VALUES = ['1', '2', '3', '5', '8', '13', '21', '?', 'c'] as const;
export type PokerValue = (typeof POKER_VALUES)[number];

export interface PokerState {
  revealed: boolean;
  votes: Record<string, PokerValue>; // userId -> voto
}

export interface Tags {
  points?: number;
  sprint?: number;
  poker?: PokerState;
}

const TAG_RE = /\[(pts|sprint|poker):([^\]\n]*)\][ \t]*/g;

export function parseTags(description: string | null | undefined): { tags: Tags; body: string } {
  const text = description ?? '';
  const tags: Tags = {};
  for (const m of text.matchAll(TAG_RE)) {
    const [, key, value] = m;
    if (key === 'pts') {
      const n = Number(value);
      if (Number.isFinite(n) && n >= 0) tags.points = n;
    } else if (key === 'sprint') {
      const n = parseInt(value, 10);
      if (Number.isInteger(n)) tags.sprint = n;
    } else if (key === 'poker') {
      tags.poker = parsePoker(value);
    }
  }
  const body = text.replace(TAG_RE, '').replace(/^[ \t]*\r?\n/, '');
  return { tags, body };
}

export function writeTags(description: string | null | undefined, tags: Tags): string {
  const { body } = parseTags(description);
  const parts: string[] = [];
  if (tags.points !== undefined) parts.push(`[pts:${tags.points}]`);
  if (tags.sprint !== undefined) parts.push(`[sprint:${tags.sprint}]`);
  if (tags.poker) parts.push(`[poker:${formatPoker(tags.poker)}]`);
  if (parts.length === 0) return body;
  return body ? `${parts.join(' ')}\n${body}` : parts.join(' ');
}

/** Aplica mudanças parciais às tags; `undefined` em uma chave presente remove a tag. */
export function updateTags(description: string | null | undefined, patch: Partial<Tags>): string {
  const { tags } = parseTags(description);
  const next: Tags = { ...tags };
  for (const key of Object.keys(patch) as (keyof Tags)[]) {
    if (patch[key] === undefined) delete next[key];
    else (next as Record<string, unknown>)[key] = patch[key];
  }
  return writeTags(description, next);
}

// Formato: "r=0;<userId>=5;<userId>=?"
function parsePoker(value: string): PokerState {
  const state: PokerState = { revealed: false, votes: {} };
  for (const part of value.split(';')) {
    const [k, v] = part.split('=');
    if (!k || v === undefined) continue;
    if (k === 'r') state.revealed = v === '1';
    else if ((POKER_VALUES as readonly string[]).includes(v)) state.votes[k] = v as PokerValue;
  }
  return state;
}

function formatPoker(p: PokerState): string {
  return [`r=${p.revealed ? 1 : 0}`, ...Object.entries(p.votes).map(([k, v]) => `${k}=${v}`)].join(';');
}
