// Formas mínimas dos recursos do Planner na Microsoft Graph (v1.0).

export interface GraphUser {
  id: string;
  displayName: string;
}

export interface PlannerPlan {
  id: string;
  title: string;
}

export interface PlannerBucket {
  id: string;
  name: string;
  orderHint: string;
}

export interface PlannerTask {
  id: string;
  planId: string;
  bucketId: string;
  title: string;
  percentComplete: number; // 0, 50 ou 100 no Planner Basic
  createdDateTime: string;
  completedDateTime: string | null;
  dueDateTime: string | null;
  orderHint: string;
  assignments: Record<string, unknown>;
  /** Rótulos aplicados: { category3: true } */
  appliedCategories?: Record<string, boolean>;
  '@odata.etag': string;
}

/** Nomes dos 25 rótulos do plano (category1..category25). */
export interface PlanDetails {
  categoryDescriptions: Record<string, string | null>;
  etag: string;
}

export interface TaskDetails {
  description: string;
  etag: string;
}

export interface TaskWithDetails extends PlannerTask {
  details: TaskDetails;
}

export interface TaskPatch {
  percentComplete?: number;
  /** userId -> atribuição (adicionar) ou null (remover). */
  assignments?: Record<string, { '@odata.type': string; orderHint: string } | null>;
  appliedCategories?: Record<string, boolean>;
}

/** Interface comum à Graph real e ao modo demonstração. */
export interface PlannerApi {
  readonly demo: boolean;
  me(): Promise<GraphUser>;
  listPlans(): Promise<PlannerPlan[]>;
  getPlan(planId: string): Promise<PlannerPlan>;
  listBuckets(planId: string): Promise<PlannerBucket[]>;
  listTasks(planId: string): Promise<TaskWithDetails[]>;
  getTask(taskId: string): Promise<PlannerTask>;
  getDetails(taskId: string): Promise<TaskDetails>;
  getPlanDetails(planId: string): Promise<PlanDetails>;
  /** Renomeia rótulos do plano. Lança ConflictError (412) se o etag estiver desatualizado. */
  updateCategories(planId: string, etag: string, names: Record<string, string>): Promise<PlanDetails>;
  /** Grava a descrição. Lança ConflictError (412) se o etag estiver desatualizado. */
  updateDescription(taskId: string, etag: string, description: string): Promise<TaskDetails>;
  updateTask(taskId: string, etag: string, patch: TaskPatch): Promise<PlannerTask>;
  createTask(planId: string, bucketId: string, title: string): Promise<PlannerTask>;
  getUsers(ids: string[]): Promise<GraphUser[]>;
}

export class ConflictError extends Error {
  constructor() {
    super('A tarefa foi alterada por outra pessoa. Tente de novo.');
  }
}
