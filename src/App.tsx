import { useEffect, useState } from 'react';
import { MockPlannerApi } from './graph/mock';
import type { PlannerPlan } from './graph/types';
import { isConfigured } from './config';
import { logout } from './auth/msal';
import { rememberedPlanId, useStore } from './store';
import { Backlog } from './pages/Backlog';
import { Estimate } from './pages/Estimate';
import { Planning } from './pages/Planning';
import { ActiveSprint } from './pages/ActiveSprint';
import { Productivity } from './pages/Productivity';
import { Team } from './pages/Team';

const TABS = [
  { id: 'backlog', label: 'Backlog', Page: Backlog },
  { id: 'estimativa', label: 'Estimativa', Page: Estimate },
  { id: 'planejamento', label: 'Planejamento', Page: Planning },
  { id: 'sprint', label: 'Sprint ativa', Page: ActiveSprint },
  { id: 'produtividade', label: 'Produtividade', Page: Productivity },
  { id: 'equipe', label: 'Equipe', Page: Team },
] as const;

function useHashTab() {
  const read = () => TABS.find((t) => `#${t.id}` === location.hash)?.id ?? 'backlog';
  const [tab, setTab] = useState<string>(read);
  useEffect(() => {
    const on = () => setTab(read());
    addEventListener('hashchange', on);
    return () => removeEventListener('hashchange', on);
  }, []);
  return [tab, (id: string) => (location.hash = id)] as const;
}

export function App() {
  const { plan, loading, error, clearError } = useStore();
  if (!plan) return <PlanPicker />;
  return (
    <>
      <Header />
      <main>
        <DemoBanner />
        {error && (
          <div className="error" role="alert">
            <span className="grow">{error}</span>
            <button className="small" onClick={clearError}>
              Fechar
            </button>
          </div>
        )}
        {loading ? <div className="card empty-state">Carregando tarefas do Planner…</div> : <CurrentTab />}
      </main>
    </>
  );
}

function CurrentTab() {
  const [tab] = useHashTab();
  const { Page } = TABS.find((t) => t.id === tab)!;
  return <Page />;
}

function Header() {
  const { plan, me, api, refresh, closePlan, loading } = useStore();
  const [tab, setTab] = useHashTab();
  return (
    <header className="app-header">
      <div className="header-row">
        <span className="plan-title">{plan?.title}</span>
        <button className="small ghost" onClick={closePlan} title="Trocar de plano">
          Trocar
        </button>
        <span className="spacer" />
        <button className="small" onClick={refresh} disabled={loading} title="Recarregar dados do Planner">
          ↻ Atualizar
        </button>
        <span className="faint">{me.displayName}</span>
        {!api.demo && (
          <button className="small ghost" onClick={logout}>
            Sair
          </button>
        )}
      </div>
      <nav className="tabs">
        {TABS.map((t) => (
          <button key={t.id} className={tab === t.id ? 'active' : ''} onClick={() => setTab(t.id)}>
            {t.label}
          </button>
        ))}
      </nav>
    </header>
  );
}

function DemoBanner() {
  const { api } = useStore();
  if (!api.demo) return null;
  return (
    <div className="banner">
      <span className="grow">
        <strong>Modo demonstração.</strong> Dados fictícios, salvos só neste navegador.
        {!isConfigured && ' O app se conecta ao Planner assim que a DTI enviar o Client ID e o Tenant ID.'}
      </span>
      <button
        className="small"
        onClick={() => {
          MockPlannerApi.reset();
          location.reload();
        }}
      >
        Restaurar dados de exemplo
      </button>
    </div>
  );
}

/** Extrai o ID do plano de um link do Planner (ou aceita o ID puro). */
function parsePlanId(input: string): string {
  const s = input.trim();
  const m = s.match(/plan\/([A-Za-z0-9_-]{20,})/) ?? s.match(/[?&]planId=([A-Za-z0-9_-]+)/);
  return m ? m[1] : s;
}

function PlanPicker() {
  const { api, openPlan, error } = useStore();
  const [plans, setPlans] = useState<PlannerPlan[] | null>(null);
  const [link, setLink] = useState('');
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    api
      .listPlans()
      .then((p) => {
        if (!alive) return;
        setPlans(p);
        const remembered = rememberedPlanId();
        const found = p.find((x) => x.id === remembered);
        if (found) openPlan(found);
        else if (p.length === 1 && !remembered) openPlan(p[0]);
        else if (remembered) api.getPlan(remembered).then(openPlan).catch(() => undefined);
      })
      .catch((e) => alive && (setPlans([]), setMsg(String(e.message ?? e))));
    return () => {
      alive = false;
    };
  }, [api, openPlan]);

  const openByLink = async () => {
    setMsg(null);
    try {
      await openPlan(await api.getPlan(parsePlanId(link)));
    } catch {
      setMsg('Não encontrei esse plano. Confira o link e se você é membro dele.');
    }
  };

  return (
    <div className="center-page">
      <section className="card stack" style={{ gap: 14 }}>
        <h1>Escolha o plano do Planner</h1>
        {(error || msg) && <div className="error">{error ?? msg}</div>}
        {plans === null ? (
          <p className="muted">Buscando seus planos…</p>
        ) : (
          <div className="task-list">
            {plans.map((p) => (
              <button key={p.id} className="task-item clickable" style={{ textAlign: 'left' }} onClick={() => openPlan(p)}>
                <span className="title">{p.title}</span>
                <span className="faint">Abrir →</span>
              </button>
            ))}
            {plans.length === 0 && <p className="muted">Nenhum plano encontrado na sua conta.</p>}
          </div>
        )}
        <details>
          <summary>O plano não aparece? Cole o link dele</summary>
          <div className="row" style={{ marginTop: 8 }}>
            <input
              className="grow"
              placeholder="https://planner.cloud.microsoft/.../plan/..."
              value={link}
              onChange={(e) => setLink(e.target.value)}
            />
            <button className="primary" disabled={!link.trim()} onClick={openByLink}>
              Abrir
            </button>
          </div>
        </details>
      </section>
    </div>
  );
}
