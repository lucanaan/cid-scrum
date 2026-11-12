# Sprints do Planner

Complemento ao **Microsoft Planner Basic** para a equipe:

- **Backlog**: tarefas do Planner com pontos, filtros e destaque para as que ainda não têm estimativa.
- **Estimativa por pontos**: estimativa rápida comparando com tarefas já estimadas.
- **Planejamento de sprint**: escolher as tarefas, somar os pontos, comparar com a capacidade (descontando ausências) e com a velocidade média, ver a carga de cada pessoa e iniciar a sprint.
- **Sprint ativa**: quadro por status (sincronizado com o progresso no Planner) e burndown.
- **Produtividade**: comprometido × entregue por sprint, taxa de entrega e pontos por pessoa.

Tudo fica gravado no próprio Planner: não há servidor nem banco de dados.

| O quê | Onde fica |
|---|---|
| Pontos e sprint da tarefa | Primeira linha da descrição: `[pts:5] [sprint:12]` |
| Rótulo visível no Planner | Rótulo `SPRINT-12`, criado num dos 25 rótulos livres do plano e trocado quando a tarefa muda de sprint |
| Sprints, capacidade e histórico | Tarefa concluída `⚙ Config Sprints (não apague)` no plano |

## Testar sem conta (modo demonstração)

```bash
npm install
npm run dev
```

Abra http://localhost:5173/?demo=1. Enquanto o Client ID não estiver configurado, o app abre sempre no modo demonstração.

## Conectar ao Planner

1. Envie [`docs/pedido-ao-TI.md`](docs/pedido-ao-TI.md) para a DTI. Ela cria o registro no Entra ID e devolve o **Client ID** e o **Tenant ID**.
2. Para rodar localmente, copie `.env.example` para `.env.local` e preencha os dois IDs.
3. Para publicar, siga as instruções da seção abaixo.

## Publicar no GitHub Pages

1. Crie um repositório chamado `planner-sprints` no GitHub e envie este código para a branch `main`.
2. Em **Settings → Pages → Build and deployment**, escolha **GitHub Actions**.
3. Em **Settings → Secrets and variables → Actions → Variables**, crie `VITE_CLIENT_ID` e `VITE_TENANT_ID`.
4. Cada push na `main` publica o app em `https://<usuario>.github.io/planner-sprints/`. Essa URL precisa estar no registro do Entra (está no pedido à DTI).

## Desenvolvimento

```bash
npm test       # testes das tags e das métricas
npm run build  # checagem de tipos + build
```

- `src/graph/planner.ts`: chamadas à Microsoft Graph (paginação, `$batch`, etag, retry em 429)
- `src/graph/mock.ts`: Graph simulada do modo demonstração
- `src/model/`: tags na descrição, configuração das sprints e cálculos das métricas
- `src/pages/`: uma tela por aba
