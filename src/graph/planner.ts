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
  type TaskWithDetails,
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
  body: unknown;
}

/** GETs em lote ($batch aceita até 20 por chamada). Repete os itens que voltarem 429. */
async function batchGet(urls: string[]): Promise<Map<string, unknown>> {
  const results = new Map<string, unknown>();
  let pending = urls.map((url, i) => ({ id: String(i), url }));
  for (let attempt = 0; pending.length && attempt < 5; attempt++) {
    const retry: typeof pending = [];
    for (let i = 0; i < pending.length; i += 20) {
      const chunk = pending.slice(i, i + 20);
      const res = await graphFetch('/$batch', {
        method: 'POST',
        body: JSON.stringify({ requests: chunk.map((r) => ({ id: r.id, method: 'GET', url: r.url })) }),
      });
      const { responses } = (await res.json()) as { responses: BatchResponse[] };
      for (const r of responses) {
        const req = chunk.find((c) => c.id === r.id)!;
        if (r.status === 429 || r.status === 503) retry.push(req);
        else if (r.status < 300) results.set(req.url, r.body);
      }
    }
    pending = retry;
    if (pending.length) await sleep(2000 * (attempt + 1));
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

  async listTasks(planId: string): Promise<TaskWithDetails[]> {
    const tasks = await getAll<PlannerTask>(`/planner/plans/${encodeURIComponent(planId)}/tasks`);
    const urls = tasks.map((t) => `/planner/tasks/${t.id}/details`);
    const details = await batchGet(urls);
    return tasks.map((t, i) => {
      const body = details.get(urls[i]) as { description?: string; '@odata.etag': string } | undefined;
      // Sem detalhes (falha no lote) a tarefa entra sem etag; gravações vão buscar de novo.
      return { ...t, details: body ? toDetails(body) : { description: '', etag: '' } };
    });
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
