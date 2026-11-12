# CID Scrum no Power Apps — Passo 1: preparação

Neste passo você cria onde os dados ficam guardados (listas do SharePoint) e um app vazio já ligado ao Planner. No fim, me manda dois prints para eu escrever as telas sob medida.

Tempo estimado: 20–30 minutos.

---

## Parte A — Criar as listas no SharePoint

Use o site do SharePoint da sua equipe (o mesmo grupo do plano do Planner é o ideal, assim todos já têm acesso).

Para cada lista: **Novo → Lista → Lista em branco**, digite o nome e clique em **Criar**. Depois, em **+ Adicionar coluna**, crie as colunas da tabela.

> A coluna **Título** já vem pronta em toda lista; não apague. Na tabela abaixo está o que ela guarda em cada lista.
> Escreva os nomes das colunas **exatamente** como estão (sem acento onde não tem), porque as fórmulas vão usar esses nomes.

### Lista `CID_Estimativas`
Guarda os pontos e a sprint de cada tarefa do Planner.

| Coluna | Tipo | Observação |
|---|---|---|
| Título | (já existe) | ID da tarefa no Planner |
| Pontos | Número | casas decimais: 0 |
| Sprint | Número | número da sprint (vazio = backlog) |
| PlanoId | Linha única de texto | |

### Lista `CID_Sprints`

| Coluna | Tipo | Observação |
|---|---|---|
| Título | (já existe) | nome da sprint, ex.: "Sprint 1" |
| Numero | Número | 1, 2, 3… |
| Inicio | Data e hora | "Incluir hora": **Não** |
| Fim | Data e hora | "Incluir hora": **Não** |
| Objetivo | Várias linhas de texto | |
| Status | Escolha | opções: `Planejada`, `Ativa`, `Concluida` (padrão: Planejada) |
| Comprometido | Número | pontos no início da sprint |
| Entregue | Número | pontos concluídos (gravado ao concluir) |
| PlanoId | Linha única de texto | |

### Lista `CID_Equipe`

| Coluna | Tipo | Observação |
|---|---|---|
| Título | (já existe) | nome da pessoa |
| UsuarioId | Linha única de texto | ID da pessoa no Microsoft 365 (o app preenche) |
| Capacidade | Número | pontos por sprint |
| Ativo | Sim/Não | padrão: Sim |
| PlanoId | Linha única de texto | |

### Lista `CID_Ausencias`

| Coluna | Tipo | Observação |
|---|---|---|
| Título | (já existe) | pode ficar com o nome da pessoa |
| UsuarioId | Linha única de texto | |
| Sprint | Número | |
| Dias | Número | dias úteis de ausência |
| PlanoId | Linha única de texto | |

---

## Parte B — Criar o app e ligar os dados

1. Em **make.powerapps.com**: **+ Criar → Aplicativo em branco → Aplicativo de tela em branco**.
2. Nome: `CID Scrum`. Formato: **Tablet**. Clique em **Criar**.
3. No menu da esquerda, ícone **Dados** (cilindro) → **Adicionar dados**. Adicione um por um:
   - **Planner**
   - **Usuários do Office 365** (Office 365 Users)
   - **Grupos do Office 365** (Office 365 Groups)
   - **SharePoint** → escolha o site da equipe → marque as 4 listas `CID_…` → **Conectar**
4. Salve: **Arquivo → Salvar** (ou Ctrl+S).

Se algum desses der erro de permissão ou "política de dados" (DLP), me mande o print.

---

## Parte C — O teste que preciso ver

### Print 1: o que o conector do Planner oferece
1. Clique na tela (Screen1). Na barra de fórmulas, no topo, escolha a propriedade **OnVisible**.
2. Apague o que tiver e digite só: `Planner.`  (com o ponto)
3. Vai abrir uma lista com as funções disponíveis. **Tire um print dessa lista** (role se precisar, e mande mais de um print).
4. Apague o texto depois.

### Print 2: o link do plano
Abra o plano da equipe no Planner, copie o endereço da barra do navegador e me mande. Se aparecer um botão **"…" → Copiar link do plano**, mande esse também.

Com isso eu escrevo o **Passo 2**: as telas prontas para colar (Backlog, Estimativa, Planejamento, Sprint ativa e Produtividade).
