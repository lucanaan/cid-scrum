import { StrictMode, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { initAuth, login } from './auth/msal';
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
        const api = new GraphPlannerApi();
        setBoot({ state: 'ready', api, me: await api.me() });
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
      <section className="card stack" style={{ gap: 14 }}>
        <h1>Sprints do Planner</h1>
        {boot.state === 'loading' && <p className="muted">Carregando…</p>}
        {boot.state === 'login' && (
          <>
            <p className="muted">
              Estimativas por pontos, planejamento de sprints e produtividade da equipe, usando as tarefas do Microsoft
              Planner.
            </p>
            <div className="row">
              <button className="primary" onClick={login}>
                Entrar com a conta Microsoft
              </button>
              <a href="?demo=1">Ver demonstração</a>
            </div>
          </>
        )}
        {boot.state === 'error' && (
          <>
            <div className="error">{boot.message}</div>
            <div className="row">
              <button onClick={() => location.reload()}>Tentar de novo</button>
              <a href="?demo=1">Ver demonstração</a>
            </div>
          </>
        )}
      </section>
    </div>
  );
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Root />
  </StrictMode>,
);
