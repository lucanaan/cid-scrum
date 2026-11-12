// Valores do registro no Microsoft Entra ID (enviados pelo TI).
// Ficam no arquivo .env (não são segredos).
export const CLIENT_ID = (import.meta.env.VITE_CLIENT_ID as string | undefined)?.trim() ?? '';
export const TENANT_ID = (import.meta.env.VITE_TENANT_ID as string | undefined)?.trim() ?? '';

export const GRAPH_SCOPES = ['Tasks.ReadWrite', 'User.ReadBasic.All'];

export const isConfigured = CLIENT_ID !== '' && TENANT_ID !== '';

/** Modo demonstração: `?demo=1` na URL, ou automático enquanto o TI não enviar os IDs. */
export const isDemo = new URLSearchParams(globalThis.location?.search ?? '').has('demo') || !isConfigured;

/** Link direto para a tarefa no Planner (formato do Planner novo, planner.cloud.microsoft). */
export function plannerTaskUrl(planId: string, taskId: string): string {
  return `https://planner.cloud.microsoft/ui/web/v1/plan/${encodeURIComponent(planId)}/view/board/task/${encodeURIComponent(taskId)}?tid=${TENANT_ID}`;
}
