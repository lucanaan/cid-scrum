# CID Scrum

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

Abra http://localhost:5173/?demo=1. Sem o `?demo=1`, o app pede login com a conta Microsoft.

## Conectar ao Planner

O registro no Entra ID foi criado pela DTI (veja [`docs/pedido-ao-TI.md`](docs/pedido-ao-TI.md)). O **Client ID** e o **Tenant ID** ficam em [`.env`](.env); não são segredos.

## Publicar no GitHub Pages

1. Crie um repositório chamado `cid-scrum` no GitHub e envie este código para a branch `main`.
2. Em **Settings → Pages → Build and deployment**, escolha **GitHub Actions**.
3. Cada push na `main` publica o app em `https://lucanaan.github.io/cid-scrum/`. Essa URL precisa estar no registro do Entra (está no pedido à DTI).

## Desenvolvimento

```bash
npm test       # testes das tags e das métricas
npm run build  # checagem de tipos + build
```

- `src/graph/planner.ts`: chamadas à Microsoft Graph (paginação, `$batch`, etag, retry em 429)
- `src/graph/mock.ts`: Graph simulada do modo demonstração
- `src/model/`: tags na descrição, configuração das sprints e cálculos das métricas
- `src/pages/`: uma tela por aba
