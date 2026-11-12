// Valores do registro no Microsoft Entra ID (enviados pelo TI).
// Em desenvolvimento vêm de .env.local; no GitHub Pages, das variáveis do repositório.
export const CLIENT_ID = (import.meta.env.VITE_CLIENT_ID as string | undefined)?.trim() ?? '';
export const TENANT_ID = (import.meta.env.VITE_TENANT_ID as string | undefined)?.trim() ?? '';

export const GRAPH_SCOPES = ['Tasks.ReadWrite', 'User.ReadBasic.All'];

export const isConfigured = CLIENT_ID !== '' && TENANT_ID !== '';

/** Modo demonstração: `?demo=1` na URL, ou automático enquanto o TI não enviar os IDs. */
export const isDemo = new URLSearchParams(location.search).has('demo') || !isConfigured;
