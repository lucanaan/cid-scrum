// Configuração do app (sprints, capacidade da equipe, sessão de poker).
// Fica em JSON na descrição de uma tarefa especial do plano, marcada como concluída
// para não poluir o quadro do Planner.

export const CONFIG_TASK_TITLE = '⚙ Config Sprints (não apague)';

export type SprintStatus = 'planned' | 'active' | 'closed';

export interface SprintResult {
  committed: number;
  delivered: number;
  perPerson: Record<string, number>; // userId -> pontos entregues
  completedTasks: number;
  totalTasks: number;
}

export interface Sprint {
  id: number;
  name: string;
  start: string; // AAAA-MM-DD
  end: string; // AAAA-MM-DD (inclusive)
  goal: string;
  status: SprintStatus;
  absences: Record<string, number>; // userId -> dias úteis de ausência
  committed?: number; // pontos no início da sprint
  result?: SprintResult; // gravado ao encerrar
}

export interface MemberConfig {
  capacity: number; // pontos por sprint de 2 semanas (10 dias úteis)
  active: boolean;
}

export interface AppConfig {
  version: 1;
  sprints: Sprint[];
  members: Record<string, MemberConfig>;
  defaultCapacity: number;
  pokerTaskId?: string;
}

export function emptyConfig(): AppConfig {
  return { version: 1, sprints: [], members: {}, defaultCapacity: 8 };
}

export function parseConfig(description: string): AppConfig {
  const base = emptyConfig();
  const start = description.indexOf('{');
  if (start < 0) return base;
  try {
    const raw = JSON.parse(description.slice(start)) as Partial<AppConfig>;
    return {
      ...base,
      ...raw,
      version: 1,
      sprints: Array.isArray(raw.sprints) ? raw.sprints : [],
      members: raw.members && typeof raw.members === 'object' ? raw.members : {},
    };
  } catch {
    return base;
  }
}

export function serializeConfig(config: AppConfig): string {
  return (
    'Configuração usada pelo app de sprints. Não edite à mão.\n' + JSON.stringify(config)
  );
}

export function memberConfig(config: AppConfig, userId: string): MemberConfig {
  return config.members[userId] ?? { capacity: config.defaultCapacity, active: true };
}

export function nextSprintId(config: AppConfig): number {
  return config.sprints.reduce((max, s) => Math.max(max, s.id), 0) + 1;
}
