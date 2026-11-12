import {
  InteractionRequiredAuthError,
  PublicClientApplication,
  type AccountInfo,
} from '@azure/msal-browser';
import { CLIENT_ID, GRAPH_SCOPES, TENANT_ID } from '../config';

let pca: PublicClientApplication | null = null;

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

export async function login(): Promise<void> {
  await pca!.loginRedirect({ scopes: GRAPH_SCOPES });
}

export async function logout(): Promise<void> {
  await pca!.logoutRedirect({ postLogoutRedirectUri: redirectUri() });
}

export async function getToken(): Promise<string> {
  const account = pca!.getActiveAccount();
  if (!account) throw new Error('Não autenticado');
  try {
    const r = await pca!.acquireTokenSilent({ scopes: GRAPH_SCOPES, account });
    return r.accessToken;
  } catch (e) {
    if (e instanceof InteractionRequiredAuthError) {
      await pca!.acquireTokenRedirect({ scopes: GRAPH_SCOPES, account });
    }
    throw e;
  }
}
