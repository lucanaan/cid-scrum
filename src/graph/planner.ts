import { getToken } from '../auth/msal';
import {
  ConflictError,
  type GraphUser,
  type PlannerApi,
  type PlannerBucket,
  type PlannerPlan,
  type PlannerTask,
  type TaskDetails,
  type TaskPatch,
  type PlanDetails,
} from './types';

const GRAPH = 'https://graph.microsoft.com/v1.0';
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function graphFetch(path: string, init: RequestInit = {}, attempt = 0): Promise<Response> {
  const token = await getToken();
  const res = await fetch(path.startsWith('http') ? path : GRAPH + path, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...(init.headers ?? {}),
    },
  });
  if ((res.status === 429 || res.status === 503) && attempt < 4) {
    const wait = Number(res.headers.get('Retry-After')) || 2 ** attempt;
    await sleep(wait * 1000);
    return graphFetch(path, init, attempt + 1);
  }
  if (res.status === 412) throw new ConflictError();
  if (!res.ok) {
    let msg = `${res.status} ${res.statusText}`;
    try {
      msg = (await res.json()).error?.message ?? msg;
    } catch {
      /* corpo vazio */
    }
    throw new Error(`Graph: ${msg}`);
  }
  return res;
}

async function getJson<T>(path: string): Promise<T> {
  return (await graphFetch(path)).json();
}

/** Segue `@odata.nextLink` até o fim. */
async function getAll<T>(path: string): Promise<T[]> {
  const out: T[] = [];
  let next: string | undefined = path;
  while (next) {
    const page: { value: T[]; '@odata.nextLink'?: string } = await getJson(next);
    out.push(...page.value);
    next = page['@odata.nextLink'];
  }
  return out;
}

interface BatchResponse {
  id: string;
  status: number;
  headers?: Record<string, string>;
  body: unknown;
}

const PARALLEL_BATCHES = 3;

/**
 * GETs em lote ($batch aceita até 20 por chamada), com até 3 lotes ao mesmo tempo.
 * Itens que voltam 429/503 são repetidos depois do Retry-After pedido pelo servidor.
 * `onChunk` recebe os resultados de cada lote assim que chegam.
 */
async function batchGet(urls: string[], onChunk?: (results: Map<string, unknown>) => void): Promise<Map<string, unknown>> {
  const results = new Map<string, unknown>();
  let pending = urls.map((url, i) => ({ id: String(i), url }));
  for (let attempt = 0; pending.length && attempt < 6; attempt++) {
    const retry: typeof pending = [];
    let wait = 0;
    const chunks: (typeof pending)[] = [];
    for (let i = 0; i < pending.length; i += 20) chunks.push(pending.slice(i, i + 20));

    const runChunk = async (chunk: typeof pending) => {
      const res = await graphFetch('/$batch', {
        method: 'POST',
        body: JSON.stringify({ requests: chunk.map((r) => ({ id: r.id, method: 'GET', url: r.url })) }),
      });
      const { responses } = (await res.json()) as { responses: BatchResponse[] };
      const got = new Map<string, unknown>();
      for (const r of responses) {
        const req = chunk.find((c) => c.id === r.id)!;
        if (r.status === 429 || r.status === 503) {
          retry.push(req);
          wait = Math.max(wait, Number(r.headers?.['Retry-After'] ?? r.headers?.['retry-after']) || 2 ** attempt);
        } else if (r.status < 300) {
          got.set(req.url, r.body);
          results.set(req.url, r.body);
        }
      }
      if (got.size) onChunk?.(got);
    };

    // Fila simples: PARALLEL_BATCHES lotes em andamento por vez.
    let next = 0;
    await Promise.all(
      Array.from({ length: Math.min(PARALLEL_BATCHES, chunks.length) }, async () => {
        while (next < chunks.length) await runChunk(chunks[next++]);
      }),
    );

    pending = retry;
    if (pending.length) await sleep(Math.min(wait, 30) * 1000);
  }
  return results;
}

function toDetails(body: { description?: string; '@odata.etag': string }): TaskDetails {
  return { description: body.description ?? '', etag: body['@odata.etag'] };
}

export class GraphPlannerApi implements PlannerApi {
  readonly demo = false;
  private userCache = new Map<string, GraphUser>();

  me(): Promise<GraphUser> {
    return getJson('/me?$select=id,displayName');
  }

  listPlans(): Promise<PlannerPlan[]> {
    return getAll('/me/planner/plans?$select=id,title');
  }

  getPlan(planId: string): Promise<PlannerPlan> {
    return getJson(`/planner/plans/${encodeURIComponent(planId)}?$select=id,title`);
  }

  listBuckets(planId: string): Promise<PlannerBucket[]> {
    return getAll(`/planner/plans/${encodeURIComponent(planId)}/buckets`);
  }

  listTasks(planId: string): Promise<PlannerTask[]> {
    return getAll<PlannerTask>(`/planner/plans/${encodeURIComponent(planId)}/tasks`);
  }

  async loadDetails(
    taskIds: string[],
    onProgress: (loaded: Map<string, TaskDetails>, done: number, total: number) => void,
  ): Promise<void> {
    const url = (id: string) => `/planner/tasks/${id}/details`;
    const idByUrl = new Map(taskIds.map((id) => [url(id), id]));
    let done = 0;
    await batchGet([...idByUrl.keys()], (chunk) => {
      const loaded = new Map<string, TaskDetails>();
      for (const [u, body] of chunk) {
        loaded.set(idByUrl.get(u)!, toDetails(body as { description?: string; '@odata.etag': string }));
      }
      done += loaded.size;
      onProgress(loaded, done, taskIds.length);
    });
  }

  getTask(taskId: string): Promise<PlannerTask> {
    return getJson(`/planner/tasks/${taskId}`);
  }

  async getPlanDetails(planId: string): Promise<PlanDetails> {
    const body = await getJson<{ categoryDescriptions?: Record<string, string | null>; '@odata.etag': string }>(
      `/planner/plans/${encodeURIComponent(planId)}/details`,
    );
    return { categoryDescriptions: body.categoryDescriptions ?? {}, etag: body['@odata.etag'] };
  }

  async updateCategories(planId: string, etag: string, names: Record<string, string>): Promise<PlanDetails> {
    const res = await graphFetch(`/planner/plans/${encodeURIComponent(planId)}/details`, {
      method: 'PATCH',
      headers: { 'If-Match': etag, Prefer: 'return=representation' },
      body: JSON.stringify({ categoryDescriptions: names }),
    });
    if (res.status === 204) return this.getPlanDetails(planId);
    const body = await res.json();
    return { categoryDescriptions: body.categoryDescriptions ?? {}, etag: body['@odata.etag'] };
  }

  async getDetails(taskId: string): Promise<TaskDetails> {
    return toDetails(await getJson(`/planner/tasks/${taskId}/details`));
  }

  async updateDescription(taskId: string, etag: string, description: string): Promise<TaskDetails> {
    const res = await graphFetch(`/planner/tasks/${taskId}/details`, {
      method: 'PATCH',
      headers: { 'If-Match': etag, Prefer: 'return=representation' },
      body: JSON.stringify({ description }),
    });
    return res.status === 204 ? this.getDetails(taskId) : toDetails(await res.json());
  }

  async updateTask(taskId: string, etag: string, patch: TaskPatch): Promise<PlannerTask> {
    const res = await graphFetch(`/planner/tasks/${taskId}`, {
      method: 'PATCH',
      headers: { 'If-Match': etag, Prefer: 'return=representation' },
      body: JSON.stringify(patch),
    });
    return res.status === 204 ? getJson(`/planner/tasks/${taskId}`) : res.json();
  }

  async createTask(planId: string, bucketId: string, title: string): Promise<PlannerTask> {
    const res = await graphFetch('/planner/tasks', {
      method: 'POST',
      body: JSON.stringify({ planId, bucketId, title }),
    });
    return res.json();
  }

  async getUsers(ids: string[]): Promise<GraphUser[]> {
    const missing = ids.filter((id) => !this.userCache.has(id));
    if (missing.length) {
      const urls = missing.map((id) => `/users/${id}?$select=id,displayName`);
      const found = await batchGet(urls);
      missing.forEach((id, i) => {
        const u = found.get(urls[i]) as GraphUser | undefined;
        this.userCache.set(id, u ?? { id, displayName: 'Usuário desconhecido' });
      });
    }
    return ids.map((id) => this.userCache.get(id)!);
  }
}
