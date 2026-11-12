import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from 'react';
import { ConflictError, type TaskPatch, type GraphUser, type PlannerApi, type PlannerBucket, type PlannerPlan } from './graph/types';
import {
  CONFIG_TASK_TITLE,
  emptyConfig,
  parseConfig,
  serializeConfig,
  type AppConfig,
} from './model/appConfig';
import { parseTags, updateTags, type Tags } from './model/tags';
import { STATUS_PERCENT, toTask, type Status, type Task } from './model/task';

interface State {
  plan: PlannerPlan | null;
  buckets: PlannerBucket[];
  tasks: Task[];
  config: AppConfig;
  configTaskId: string | null;
  users: Record<string, GraphUser>;
  loading: boolean;
  error: string | null;
}

interface Store extends State {
  api: PlannerApi;
  me: GraphUser;
  /** Pessoas da equipe: com capacidade configurada ou responsáveis por alguma tarefa. */
  memberIds: string[];
  /** Todas as pessoas conhecidas (inclusive inativas), em ordem fixa; define a cor de cada uma. */
  allMemberIds: string[];
  openPlan(plan: PlannerPlan): Promise<void>;
  closePlan(): void;
  refresh(): Promise<void>;
  setTags(taskId: string, patch: Partial<Tags>): Promise<void>;
  /** Altera as tags a partir do valor atual no Planner (para não perder votos de outras pessoas). */
  mutateTags(taskId: string, fn: (current: Tags) => Partial<Tags>): Promise<void>;
  setTagsMany(taskIds: string[], patch: Partial<Tags>): Promise<void>;
  setStatus(taskId: string, status: Status): Promise<void>;
  /** Troca os responsáveis da tarefa por uma única pessoa (ou nenhuma). */
  setAssignee(taskId: string, userId: string | null): Promise<void>;
  updateConfig(fn: (c: AppConfig) => AppConfig): Promise<AppConfig>;
  /** Lê a descrição atual de uma tarefa (usado pelo poker) e atualiza o estado local. */
  reloadTask(taskId: string): Promise<Task | undefined>;
  reloadConfig(): Promise<AppConfig>;
  userName(id: string): string;
  clearError(): void;
}

const Ctx = createContext<Store | null>(null);

export function useStore(): Store {
  const s = useContext(Ctx);
  if (!s) throw new Error('useStore fora do StoreProvider');
  return s;
}

const PLAN_KEY = 'planner-sprints-plan';

export function rememberedPlanId(): string | null {
  try {
    return localStorage.getItem(PLAN_KEY);
  } catch {
    return null;
  }
}

const initial: State = {
  plan: null,
  buckets: [],
  tasks: [],
  config: emptyConfig(),
  configTaskId: null,
  users: {},
  loading: false,
  error: null,
};

/** Repete leitura + gravação quando outra pessoa alterou a tarefa no meio do caminho. */
async function withRetry<T>(fn: () => Promise<T>, attempts = 4): Promise<T> {
  for (let i = 0; ; i++) {
    try {
      return await fn();
    } catch (e) {
      if (!(e instanceof ConflictError) || i >= attempts - 1) throw e;
      await new Promise((r) => setTimeout(r, 300 + Math.random() * 500));
    }
  }
}

export function StoreProvider({ api, me, children }: { api: PlannerApi; me: GraphUser; children: ReactNode }) {
  const [state, setState] = useState<State>(initial);
  const tasksRef = useRef(state.tasks);
  tasksRef.current = state.tasks;

  const fail = useCallback((e: unknown) => {
    setState((s) => ({ ...s, loading: false, error: e instanceof Error ? e.message : String(e) }));
  }, []);

  const load = useCallback(
    async (plan: PlannerPlan) => {
      setState((s) => ({ ...s, plan, loading: true, error: null }));
      try {
        const [buckets, raw] = await Promise.all([api.listBuckets(plan.id), api.listTasks(plan.id)]);
        let cfgRaw = raw.find((t) => t.title === CONFIG_TASK_TITLE);
        let config = cfgRaw ? parseConfig(cfgRaw.details.description) : emptyConfig();
        if (!cfgRaw) {
          if (!buckets.length) throw new Error('O plano não tem nenhum bucket. Crie um no Planner primeiro.');
          const created = await api.createTask(plan.id, buckets[0].id, CONFIG_TASK_TITLE);
          const details = await api.getDetails(created.id);
          await api.updateDescription(created.id, details.etag, serializeConfig(config));
          // Concluída, ela fica escondida em "Tarefas concluídas" no quadro do Planner.
          await api.updateTask(created.id, created['@odata.etag'], { percentComplete: 100 });
          cfgRaw = { ...created, details };
          config = emptyConfig();
        }
        const tasks = raw.filter((t) => t.id !== cfgRaw!.id).map(toTask);
        const ids = new Set<string>(Object.keys(config.members));
        tasks.forEach((t) => t.assignees.forEach((a) => ids.add(a)));
        ids.add(me.id);
        const users = Object.fromEntries((await api.getUsers([...ids])).map((u) => [u.id, u]));
        try {
          localStorage.setItem(PLAN_KEY, plan.id);
        } catch {
          /* ignora */
        }
        setState({ plan, buckets, tasks, config, configTaskId: cfgRaw.id, users, loading: false, error: null });
      } catch (e) {
        fail(e);
      }
    },
    [api, me.id, fail],
  );

  const replaceTask = (task: Task) =>
    setState((s) => ({ ...s, tasks: s.tasks.map((t) => (t.id === task.id ? task : t)) }));

  const reloadTask = useCallback(
    async (taskId: string) => {
      const details = await api.getDetails(taskId);
      const base = tasksRef.current.find((t) => t.id === taskId);
      if (!base) return undefined;
      const updated = toTask({ ...rawOf(base), details });
      replaceTask(updated);
      return updated;
    },
    [api],
  );

  const writeDescription = useCallback(
    async (taskId: string, fn: (desc: string) => string) => {
      await withRetry(async () => {
        const current = await api.getDetails(taskId);
        const next = fn(current.description);
        const details =
          next === current.description ? current : await api.updateDescription(taskId, current.etag, next);
        setState((s) => ({
          ...s,
          tasks: s.tasks.map((t) => (t.id === taskId ? toTask({ ...rawOf(t), details }) : t)),
        }));
      });
    },
    [api],
  );

  const mutateTags = useCallback(
    (taskId: string, fn: (current: Tags) => Partial<Tags>) =>
      writeDescription(taskId, (d) => updateTags(d, fn(parseTags(d).tags))).catch((e) => {
        fail(e);
        throw e;
      }),
    [writeDescription, fail],
  );

  const setTags = useCallback((taskId: string, patch: Partial<Tags>) => mutateTags(taskId, () => patch), [mutateTags]);

  const setTagsMany = useCallback(
    async (taskIds: string[], patch: Partial<Tags>) => {
      // Poucas por vez, para não esbarrar no limite de requisições da Graph.
      for (let i = 0; i < taskIds.length; i += 4) {
        await Promise.all(taskIds.slice(i, i + 4).map((id) => writeDescription(id, (d) => updateTags(d, patch))));
      }
    },
    [writeDescription],
  );

  const patchTask = useCallback(
    async (taskId: string, patch: TaskPatch) => {
      const task = tasksRef.current.find((t) => t.id === taskId);
      if (!task) return;
      try {
        const raw = await api.updateTask(taskId, task.etag, patch);
        replaceTask(toTask({ ...raw, details: { description: task.description, etag: task.detailsEtag } }));
      } catch (e) {
        fail(e instanceof ConflictError ? new Error('A tarefa mudou no Planner. Clique em Atualizar e tente de novo.') : e);
      }
    },
    [api, fail],
  );

  const setStatus = useCallback(
    (taskId: string, status: Status) => patchTask(taskId, { percentComplete: STATUS_PERCENT[status] }),
    [patchTask],
  );

  const setAssignee = useCallback(
    (taskId: string, userId: string | null) => {
      const task = tasksRef.current.find((t) => t.id === taskId);
      if (!task) return Promise.resolve();
      const assignments: TaskPatch['assignments'] = {};
      for (const a of task.assignees) if (a !== userId) assignments[a] = null;
      if (userId && !task.assignees.includes(userId)) {
        assignments[userId] = { '@odata.type': '#microsoft.graph.plannerAssignment', orderHint: ' !' };
      }
      return patchTask(taskId, { assignments });
    },
    [patchTask],
  );

  const reloadConfig = useCallback(async () => {
    if (!state.configTaskId) return state.config;
    const d = await api.getDetails(state.configTaskId);
    const config = parseConfig(d.description);
    setState((s) => ({ ...s, config }));
    return config;
  }, [api, state.configTaskId, state.config]);

  const updateConfig = useCallback(
    async (fn: (c: AppConfig) => AppConfig) => {
      const id = state.configTaskId;
      if (!id) throw new Error('Configuração não carregada');
      try {
        return await withRetry(async () => {
          const current = await api.getDetails(id);
          const next = fn(parseConfig(current.description));
          await api.updateDescription(id, current.etag, serializeConfig(next));
          setState((s) => ({ ...s, config: next }));
          return next;
        });
      } catch (e) {
        fail(e);
        throw e;
      }
    },
    [api, state.configTaskId, fail],
  );

  const store = useMemo<Store>(() => {
    const ids = new Set<string>(Object.keys(state.config.members));
    state.tasks.forEach((t) => t.assignees.forEach((a) => ids.add(a)));
    const allMemberIds = [...ids].sort((a, b) =>
      (state.users[a]?.displayName ?? a).localeCompare(state.users[b]?.displayName ?? b),
    );
    const memberIds = allMemberIds.filter((id) => state.config.members[id]?.active !== false);
    return {
      ...state,
      api,
      me,
      memberIds,
      allMemberIds,
      openPlan: load,
      closePlan: () => {
        try {
          localStorage.removeItem(PLAN_KEY);
        } catch {
          /* ignora */
        }
        setState(initial);
      },
      refresh: async () => {
        if (state.plan) await load(state.plan);
      },
      setTags,
      mutateTags,
      setTagsMany,
      setStatus,
      setAssignee,
      updateConfig,
      reloadTask,
      reloadConfig,
      userName: (id: string) => (id === '' ? 'Sem responsável' : state.users[id]?.displayName ?? 'Carregando…'),
      clearError: () => setState((s) => ({ ...s, error: null })),
    };
  }, [state, api, me, load, setTags, mutateTags, setTagsMany, setStatus, setAssignee, updateConfig, reloadTask, reloadConfig]);

  return <Ctx.Provider value={store}>{children}</Ctx.Provider>;
}

/** Reconstrói o formato da Graph a partir da Task para reaplicar toTask com novos detalhes. */
function rawOf(t: Task) {
  return {
    id: t.id,
    planId: '',
    bucketId: t.bucketId,
    title: t.title,
    percentComplete: t.percentComplete,
    createdDateTime: t.createdAt,
    completedDateTime: t.completedAt,
    dueDateTime: t.dueAt,
    orderHint: t.orderHint,
    assignments: Object.fromEntries(t.assignees.map((a) => [a, {}])),
    '@odata.etag': t.etag,
  };
}
