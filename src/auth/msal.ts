import {
  InteractionRequiredAuthError,
  PublicClientApplication,
  type AccountInfo,
} from '@azure/msal-browser';
import { CLIENT_ID, GRAPH_SCOPES, TENANT_ID } from '../config';

let pca: PublicClientApplication | null = null;

function redirectUri(): string {
  // Raiz do app (ex.: https://usuario.github.io/planner-sprints/), igual à registrada no Entra.
  return new URL(import.meta.env.BASE_URL, location.origin).href;
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
