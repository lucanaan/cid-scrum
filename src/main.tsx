import { StrictMode, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { App, Backdrop, EntryArt } from './App';
import { initAuth, isPopupBlocked, login } from './auth/msal';
import { isDemo } from './config';
import { MockPlannerApi } from './graph/mock';
import { GraphPlannerApi } from './graph/planner';
import type { GraphUser, PlannerApi } from './graph/types';
import { StoreProvider } from './store';
import './styles.css';

type Boot =
  | { state: 'loading' }
  | { state: 'login' }
  | { state: 'error'; message: string }
  | { state: 'ready'; api: PlannerApi; me: GraphUser };

function Root() {
  const [boot, setBoot] = useState<Boot>({ state: 'loading' });
  const [popupBlocked, setPopupBlocked] = useState(false);

  const startApp = async () => {
    const api = new GraphPlannerApi();
    setBoot({ state: 'ready', api, me: await api.me() });
  };

  const signIn = async () => {
    setPopupBlocked(false);
    try {
      // Embutido, o login abre num popup e o app segue aqui mesmo; fora dele, a página é redirecionada.
      if (await login()) await startApp();
    } catch (e) {
      if (isPopupBlocked(e)) setPopupBlocked(true);
      else setBoot({ state: 'error', message: e instanceof Error ? e.message : String(e) });
    }
  };

  useEffect(() => {
    (async () => {
      try {
        if (isDemo) {
          const api = new MockPlannerApi();
          setBoot({ state: 'ready', api, me: await api.me() });
          return;
        }
        const account = await initAuth();
        if (!account) return setBoot({ state: 'login' });
        await startApp();
      } catch (e) {
        setBoot({ state: 'error', message: e instanceof Error ? e.message : String(e) });
      }
    })();
  }, []);

  if (boot.state === 'ready') {
    return (
      <StoreProvider api={boot.api} me={boot.me}>
        <App />
      </StoreProvider>
    );
  }

  return (
    <div className="center-page">
      <Backdrop />
      <section className="card stack" style={{ gap: 14 }}>
        <EntryArt />
        <h1>CID Scrum</h1>
        {boot.state === 'loading' && <p className="muted">Carregando…</p>}
        {boot.state === 'login' && (
          <>
            <p className="muted">
              Estimativas por pontos, planejamento de sprints e produtividade da equipe, usando as tarefas do Microsoft
              Planner.
            </p>
            <div className="row">
              <button className="primary" onClick={signIn}>
                Entrar com a conta Microsoft
              </button>
            </div>
            {popupBlocked && (
              <p className="error" style={{ margin: 0 }}>
                <span>
                  A janela de login foi bloqueada. Permita popups para este site ou{' '}
                  <a href={location.href} target="_blank" rel="noopener">
                    abra o CID Scrum em uma nova aba
                  </a>
                  .
                </span>
              </p>
            )}
          </>
        )}
        {boot.state === 'error' && (
          <>
            <div className="error">{boot.message}</div>
            <div className="row">
              <button onClick={() => location.reload()}>Tentar de novo</button>
            </div>
          </>
        )}
      </section>
    </div>
  );
}

// Esta página também é o retorno do login por popup (modo embutido): nesse caso ela só
// repassa a resposta para a janela do app e fecha, sem carregar o app.
const isAuthPopup = !!window.opener && /[?#&](code|error)=/.test(location.search + location.hash);

if (isAuthPopup) {
  import('@azure/msal-browser/redirect-bridge')
    .then((m) => m.broadcastResponseToMainFrame())
    .catch(() => window.close());
} else {
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <Root />
    </StrictMode>,
  );
}
