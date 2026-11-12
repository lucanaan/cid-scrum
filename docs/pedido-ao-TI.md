# Pedido à DTI: registro de aplicativo no Microsoft Entra ID

**Assunto:** Registro de aplicativo (SPA) para integração com o Microsoft Planner

Olá, equipe da DTI,

Estou montando uma ferramenta interna para a minha equipe planejar sprints e estimar tarefas por pontos, usando os planos que já temos no **Microsoft Planner**. A ferramenta é uma página web estática: não tem servidor, banco de dados nem segredo armazenado. Cada pessoa entra com a própria conta Microsoft 365 e o app só acessa o que essa pessoa já consegue ver e editar no Planner.

Para isso, preciso que vocês criem um **registro de aplicativo** no Microsoft Entra ID com as configurações abaixo.

## 1. Registro do aplicativo

Caminho: **entra.microsoft.com → Identidade → Aplicativos → Registros de aplicativo → Novo registro**

| Campo | Valor |
|---|---|
| Nome | `CID Scrum` (ou o padrão de nomes de vocês) |
| Tipos de conta com suporte | **Contas somente neste diretório organizacional** (locatário único) |
| URI de redirecionamento: plataforma | **Aplicativo de página única (SPA)** |
| URI de redirecionamento: URL | `https://lucanaan.github.io/cid-scrum/` |

Depois de criar, em **Autenticação → Aplicativo de página única**, adicionar também a URL de desenvolvimento:

- `http://localhost:5173/`

Não é preciso habilitar nenhuma opção de "fluxo implícito" (o app usa o fluxo de código de autorização com PKCE, que é o padrão para SPA).

## 2. Permissões de API

Caminho: **Permissões de API → Adicionar uma permissão → Microsoft Graph → Permissões delegadas**

| Permissão | Tipo | Exige consentimento do administrador? | Para quê |
|---|---|---|---|
| `Tasks.ReadWrite` | Delegada | Não | Ler as tarefas dos planos e gravar os pontos e a sprint na descrição de cada tarefa |
| `User.ReadBasic.All` | Delegada | Não | Mostrar o nome dos responsáveis pelas tarefas |
| `User.Read` | Delegada | Não | Login (já vem por padrão) |

- **Nenhuma permissão de aplicativo** (application permissions).
- **Nenhum segredo nem certificado** (é um cliente público/SPA).
- Se a política do locatário bloqueia o consentimento de usuários, peço que cliquem em **"Conceder consentimento do administrador para <organização>"**. Isso evita que cada pessoa da equipe veja a tela de consentimento.

## 3. O que preciso receber de volta

Na página **Visão geral** do registro:

- **ID do aplicativo (cliente)** (Client ID)
- **ID do diretório (locatário)** (Tenant ID)

Nenhum dos dois é segredo. Eles ficam na configuração pública da página.

## Resumo de segurança

- O app age **somente em nome do usuário logado** (permissões delegadas). Ele não acessa nada que a pessoa já não acesse no Planner.
- Não existe backend: as chamadas vão direto do navegador para `graph.microsoft.com`.
- O app só altera a **descrição** das tarefas (acrescenta marcações como `[pts:5] [sprint:12]` na primeira linha), o **progresso** e os **responsáveis** das tarefas, e cria uma tarefa de configuração ("⚙ Config Sprints") em cada plano usado.
- Se precisarem desativar o acesso, basta desabilitar ou excluir o registro do aplicativo.

Se for preciso restringir quem pode usar o app, dá para ativar **"Atribuição necessária"** no aplicativo empresarial correspondente e incluir só os membros da minha equipe.

Obrigado!
