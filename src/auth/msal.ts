import {
  InteractionRequiredAuthError,
  PublicClientApplication,
  type AccountInfo,
} from '@azure/msal-browser';
import { CLIENT_ID, GRAPH_SCOPES, TENANT_ID } from '../config';

let pca: PublicClientApplication | null = null;

/** Dentro de um iframe (ex.: site da CID) a Microsoft não abre o login; usamos uma janela popup. */
export const embedded = (() => {
  try {
    return window.self !== window.top;
  } catch {
    return true;
  }
})();

function redirectUri(): string {
  // Endereço da própria página (ex.: https://lucanaan.github.io/cid-scrum/), igual ao registrado no Entra.
  // Calculado em tempo de execução para o mesmo build servir no GitHub Pages, GitLab Pages ou localhost.
  return location.origin + location.pathname.replace(/index\.html$/, '');
}

/** Inicializa o MSAL e conclui um login por redirecionamento, se houver. */
export async function initAuth(): Promise<AccountInfo | null> {
  pca = new PublicClientApplication({
    auth: {
      clientId: CLIENT_ID,
      authority: `https://login.microsoftonline.com/${TENANT_ID}`,
      redirectUri: redirectUri(),
    },
    cache: { cacheLocation: 'localStorage' },
  });
  await pca.initialize();
  const result = await pca.handleRedirectPromise();
  const account = result?.account ?? pca.getAllAccounts()[0] ?? null;
  if (account) pca.setActiveAccount(account);
  return account;
}

/** Faz login. Embutido, abre popup e devolve a conta; fora dele, sai da página (redirecionamento). */
export async function login(): Promise<AccountInfo | null> {
  if (!embedded) {
    await pca!.loginRedirect({ scopes: GRAPH_SCOPES });
    return null;
  }
  const r = await pca!.loginPopup({ scopes: GRAPH_SCOPES });
  pca!.setActiveAccount(r.account);
  return r.account;
}

export async function logout(): Promise<void> {
  if (embedded) {
    await pca!.logoutPopup({ postLogoutRedirectUri: redirectUri() });
    location.reload();
  } else {
    await pca!.logoutRedirect({ postLogoutRedirectUri: redirectUri() });
  }
}

/** Erro de popup bloqueado (iframe sem permissão de abrir janelas, ou bloqueador do navegador). */
export function isPopupBlocked(e: unknown): boolean {
  const code = (e as { errorCode?: string })?.errorCode ?? '';
  return /popup_window_error|empty_window_error|popup/i.test(code);
}

export async function getToken(): Promise<string> {
  const account = pca!.getActiveAccount();
  if (!account) throw new Error('Não autenticado');
  try {
    const r = await pca!.acquireTokenSilent({ scopes: GRAPH_SCOPES, account });
    return r.accessToken;
  } catch (e) {
    if (e instanceof InteractionRequiredAuthError) {
      if (embedded) return (await pca!.acquireTokenPopup({ scopes: GRAPH_SCOPES, account })).accessToken;
      await pca!.acquireTokenRedirect({ scopes: GRAPH_SCOPES, account });
    }
    throw e;
  }
}
