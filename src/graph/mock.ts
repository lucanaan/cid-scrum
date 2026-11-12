// Modo demonstração: imita a Graph em memória (salva no localStorage) para usar o app
// antes de o TI criar o registro no Entra.
import { CONFIG_TASK_TITLE, emptyConfig, serializeConfig, type Sprint } from '../model/appConfig';
import { dateKey } from '../model/metrics';
import { parseTags, updateTags, writeTags } from '../model/tags';
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

const STORAGE_KEY = 'planner-sprints-demo-v2';
const PLAN: PlannerPlan = { id: 'demo-plan', title: 'Equipe de Produto (demo)' };

const USERS: GraphUser[] = [
  { id: 'u-me', displayName: 'Você' },
  { id: 'u-bruno', displayName: 'Bruno Lima' },
  { id: 'u-carla', displayName: 'Carla Souza' },
  { id: 'u-diego', displayName: 'Diego Alves' },
  { id: 'u-eva', displayName: 'Eva Martins' },
];

const BUCKETS: PlannerBucket[] = [
  { id: 'b-backlog', name: 'Backlog', orderHint: '1' },
  { id: 'b-melhorias', name: 'Melhorias', orderHint: '2' },
  { id: 'b-bugs', name: 'Bugs', orderHint: '3' },
  { id: 'b-infra', name: 'Infraestrutura', orderHint: '4' },
];

const TITLES = [
  'Tela de login com SSO', 'Exportar relatório em PDF', 'Corrigir timeout na busca',
  'Migrar banco para nova versão', 'Filtro por data no dashboard', 'Notificações por e-mail',
  'Ajustar layout no celular', 'Cache das consultas de clientes', 'Revisar permissões de acesso',
  'Integração com ERP', 'Paginação na lista de pedidos', 'Logs estruturados na API',
  'Corrigir cálculo de frete', 'Importar planilha de produtos', 'Tela de cadastro de fornecedores',
  'Monitoramento de erros', 'Atualizar dependências', 'Documentar API pública',
  'Testes automatizados do checkout', 'Ajustar fuso horário nos relatórios', 'Busca por CPF/CNPJ',
  'Backup automático diário', 'Melhorar performance da home', 'Histórico de alterações do pedido',
  'Corrigir duplicidade de notas', 'Dashboard de vendas por região', 'Upload de anexos no chamado',
  'Configurar ambiente de homologação', 'Validação de endereço por CEP', 'Modo escuro',
  'Relatório de comissões', 'Corrigir erro ao salvar rascunho', 'Fila de processamento de pedidos',
  'Auditoria de acessos', 'Tradução para inglês', 'Limite de tentativas de login',
  'Cupom de desconto no carrinho', 'Painel de estoque mínimo', 'Remover código legado de pagamentos',
  'Alertas de SLA no atendimento', 'Gráfico de churn mensal', 'Revisar textos de onboarding',
];

interface Store {
  planDetails: PlanDetails;
  tasks: PlannerTask[];
  details: Record<string, TaskDetails>;
  etagSeq: number;
}

function rng(seed: number) {
  return () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296;
    return seed / 4294967296;
  };
}

function addDays(d: Date, n: number): Date {
  const out = new Date(d);
  out.setDate(out.getDate() + n);
  return out;
}

function seed(): Store {
  const rand = rng(42);
  const pick = <T,>(arr: readonly T[]) => arr[Math.floor(rand() * arr.length)];
  const store: Store = {
    planDetails: { categoryDescriptions: { category1: 'Urgente', category2: 'Cliente' }, etag: '' },
    tasks: [],
    details: {},
    etagSeq: 1,
  };
  const etag = () => `W/"demo-${store.etagSeq++}"`;

  // Sprints de 2 semanas; a ativa começou na segunda-feira da semana passada.
  const today = new Date();
  today.setHours(12, 0, 0, 0);
  const monday = addDays(today, -((today.getDay() + 6) % 7) - 7);
  const sprints: Sprint[] = [];
  for (let i = 0; i < 5; i++) {
    const start = addDays(monday, (i - 3) * 14);
    sprints.push({
      id: i + 1,
      name: `Sprint ${i + 1}`,
      start: dateKey(start),
      end: dateKey(addDays(start, 13)),
      goal: ['Login e cadastros', 'Relatórios', 'Performance', 'Integração ERP', 'Checkout'][i],
      status: i < 3 ? 'closed' : i === 3 ? 'active' : 'planned',
      absences: i === 3 ? { 'u-diego': 3 } : i === 4 ? { 'u-eva': 5 } : {},
    });
  }

  const points = [1, 2, 3, 3, 5, 5, 8, 13];
  TITLES.forEach((title, i) => {
    const id = `t-${i + 1}`;
    // 8 tarefas por sprint encerrada/ativa; o resto fica no backlog.
    const sprint = i < 32 ? sprints[Math.floor(i / 8)] : undefined;
    const assignee = sprint || rand() < 0.4 ? pick(USERS).id : undefined;
    const estimated = sprint || rand() < 0.6;
    let percent = 0;
    let completed: Date | null = null;
    if (sprint?.status === 'closed') {
      percent = rand() < 0.85 ? 100 : 50;
    } else if (sprint?.status === 'active') {
      const r = rand();
      percent = r < 0.4 ? 100 : r < 0.7 ? 50 : 0;
    }
    if (percent === 100 && sprint) {
      const startD = new Date(sprint.start + 'T12:00:00');
      const span = sprint.status === 'active' ? Math.max(1, Math.round((today.getTime() - startD.getTime()) / 864e5)) : 13;
      completed = addDays(startD, Math.floor(rand() * (span + 1)));
      if (completed > today) completed = today;
    }
    store.tasks.push({
      id,
      planId: PLAN.id,
      bucketId: pick(BUCKETS).id,
      title,
      percentComplete: percent,
      createdDateTime: addDays(monday, -60 + i).toISOString(),
      completedDateTime: completed?.toISOString() ?? null,
      dueDateTime: null,
      orderHint: String(i),
      assignments: assignee ? { [assignee]: {} } : {},
      '@odata.etag': etag(),
    });
    store.details[id] = {
      description: writeTags('', { points: estimated ? pick(points) : undefined, sprint: sprint?.id }),
      etag: etag(),
    };
  });

  // Rótulos SPRINT-N, como o app aplicaria ao mover as tarefas.
  sprints.forEach((s, i) => (store.planDetails.categoryDescriptions[`category${i + 3}`] = `SPRINT-${s.id}`));
  store.planDetails.etag = etag();
  for (const t of store.tasks) {
    const { tags } = parseTags(store.details[t.id].description);
    if (tags.sprint) t.appliedCategories = { [`category${tags.sprint + 2}`]: true };
    if (rand() < 0.1) t.appliedCategories = { ...t.appliedCategories, category1: true };
  }

  // Tarefas não concluídas das sprints encerradas voltaram para o backlog, sem rótulo de sprint.
  for (const t of store.tasks) {
    const { tags } = parseTags(store.details[t.id].description);
    const s = sprints.find((x) => x.id === tags.sprint);
    if (s?.status === 'closed' && t.percentComplete < 100) {
      store.details[t.id].description = updateTags(store.details[t.id].description, { sprint: undefined });
      t.appliedCategories = {};
    }
  }

  const config = emptyConfig();
  config.members = {
    'u-me': { capacity: 8, active: true },
    'u-bruno': { capacity: 10, active: true },
    'u-carla': { capacity: 10, active: true },
    'u-diego': { capacity: 8, active: true },
    'u-eva': { capacity: 6, active: true },
  };
  // Resultados das sprints encerradas, com histórico um pouco variado.
  const delivered = [29, 34, 31];
  sprints.forEach((s, i) => {
    if (s.status === 'closed') {
      s.committed = delivered[i] + [6, 3, 5][i];
      s.result = {
        committed: s.committed,
        delivered: delivered[i],
        perPerson: {
          'u-me': Math.round(delivered[i] * 0.2),
          'u-bruno': Math.round(delivered[i] * 0.25),
          'u-carla': Math.round(delivered[i] * 0.25),
          'u-diego': Math.round(delivered[i] * 0.18),
          'u-eva': delivered[i] - Math.round(delivered[i] * 0.2) - 2 * Math.round(delivered[i] * 0.25) - Math.round(delivered[i] * 0.18),
        },
        completedTasks: 7 + i,
        totalTasks: 9 + i,
      };
    }
  });
  const active = sprints.find((s) => s.status === 'active')!;
  active.committed = store.tasks.reduce((sum, t) => {
    const tags = parseTags(store.details[t.id].description).tags;
    return tags.sprint === active.id ? sum + (tags.points ?? 0) : sum;
  }, 0);
  config.sprints = sprints;

  const cfgId = 't-config';
  store.tasks.push({
    id: cfgId,
    planId: PLAN.id,
    bucketId: BUCKETS[0].id,
    title: CONFIG_TASK_TITLE,
    percentComplete: 100,
    createdDateTime: monday.toISOString(),
    completedDateTime: monday.toISOString(),
    dueDateTime: null,
    orderHint: 'z',
    assignments: {},
    '@odata.etag': etag(),
  });
  store.details[cfgId] = { description: serializeConfig(config), etag: etag() };
  return store;
}

function load(): Store {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {
    /* sem localStorage: começa do zero */
  }
  return seed();
}

const delay = () => new Promise((r) => setTimeout(r, 120));

export class MockPlannerApi implements PlannerApi {
  readonly demo = true;
  private store = load();

  static reset() {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      /* ignora */
    }
  }

  private save() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.store));
    } catch {
      /* ignora */
    }
  }

  private etag() {
    return `W/"demo-${this.store.etagSeq++}"`;
  }

  async me() {
    await delay();
    return USERS[0];
  }

  async listPlans() {
    await delay();
    return [PLAN];
  }

  async getPlan(planId: string) {
    await delay();
    if (planId !== PLAN.id) throw new Error('Plano não encontrado');
    return PLAN;
  }

  async listBuckets() {
    await delay();
    return BUCKETS;
  }

  async listTasks(): Promise<PlannerTask[]> {
    await delay();
    return this.store.tasks.map((t) => ({ ...t }));
  }

  /** Lotes de 5 com atraso, para o demo mostrar a faixa de progresso. */
  async loadDetails(
    taskIds: string[],
    onProgress: (loaded: Map<string, TaskDetails>, done: number, total: number) => void,
  ) {
    for (let i = 0; i < taskIds.length; i += 5) {
      await new Promise((r) => setTimeout(r, 250));
      const ids = taskIds.slice(i, i + 5);
      onProgress(new Map(ids.map((id) => [id, { ...this.store.details[id] }])), i + ids.length, taskIds.length);
    }
  }

  async getTask(taskId: string) {
    await delay();
    return { ...this.store.tasks.find((t) => t.id === taskId)! };
  }

  async getPlanDetails() {
    await delay();
    return structuredClone(this.store.planDetails);
  }

  async updateCategories(_planId: string, etag: string, names: Record<string, string>) {
    await delay();
    if (this.store.planDetails.etag !== etag) throw new ConflictError();
    Object.assign(this.store.planDetails.categoryDescriptions, names);
    this.store.planDetails.etag = this.etag();
    this.save();
    return structuredClone(this.store.planDetails);
  }

  async getDetails(taskId: string) {
    await delay();
    return { ...this.store.details[taskId] };
  }

  async updateDescription(taskId: string, etag: string, description: string) {
    await delay();
    const d = this.store.details[taskId];
    if (d.etag !== etag) throw new ConflictError();
    this.store.details[taskId] = { description, etag: this.etag() };
    this.save();
    return { ...this.store.details[taskId] };
  }

  async updateTask(taskId: string, etag: string, patch: TaskPatch) {
    await delay();
    const t = this.store.tasks.find((x) => x.id === taskId)!;
    if (t['@odata.etag'] !== etag) throw new ConflictError();
    if (patch.percentComplete !== undefined) {
      t.percentComplete = patch.percentComplete;
      t.completedDateTime = patch.percentComplete === 100 ? new Date().toISOString() : null;
    }
    for (const [k, on] of Object.entries(patch.appliedCategories ?? {})) {
      t.appliedCategories = { ...t.appliedCategories, [k]: on };
    }
    for (const [id, a] of Object.entries(patch.assignments ?? {})) {
      if (a) t.assignments = { ...t.assignments, [id]: a };
      else t.assignments = Object.fromEntries(Object.entries(t.assignments).filter(([k]) => k !== id));
    }
    t['@odata.etag'] = this.etag();
    this.save();
    return { ...t };
  }

  async createTask(planId: string, bucketId: string, title: string) {
    await delay();
    const task: PlannerTask = {
      id: `t-${Date.now()}`,
      planId,
      bucketId,
      title,
      percentComplete: 0,
      createdDateTime: new Date().toISOString(),
      completedDateTime: null,
      dueDateTime: null,
      orderHint: String(Date.now()),
      assignments: {},
      '@odata.etag': this.etag(),
    };
    this.store.tasks.push(task);
    this.store.details[task.id] = { description: '', etag: this.etag() };
    this.save();
    return task;
  }

  async getUsers(ids: string[]) {
    await delay();
    return ids.map((id) => USERS.find((u) => u.id === id) ?? { id, displayName: id });
  }
}
