# ANALISE_CLAUDE — Tarefa 0 (análise antes de código)

- **Data:** 2026-11-01
- **Base analisada:** `main` em `4880d7f` (depois dos PR #1 e #2).
- **Âmbito:** só documentação. Nenhum ficheiro de `app/`, `lib/`, `components/` ou `scripts/` foi alterado.
- **Fontes:** `docs/PROJECT_STATE.md`, `DECISIONS.md`, `BACKLOG.md`, `SECURITY_AUDIT.md`, leitura do código e execução num clone limpo (resultados na secção 0).
- **Regra respeitada:** este documento não contém dados pessoais reais (IBAN, moradas, valores de salário, extratos, saldos ou valores do crédito). Os números financeiros do briefing ficam fora do git.

---

## 0. Verificação feita agora num clone limpo

| Comando | Resultado | Notas |
| --- | --- | --- |
| `npm ci --legacy-peer-deps` | exit 0 | |
| `npx tsc --noEmit` | exit 0 | Barra fraca: `strict: false`, muitos `any`. |
| `npm audit --omit=dev` | exit 1 | **7 vulnerabilidades (1 crítica, 6 altas)** em `next`, `postcss` (via next), `zod`, `ws`, `form-data`, `nanoid`, `source-map-js`. |
| `npm run build` | **exit 1** | Compila, depois falha em "collecting page data" de `/api/goals`: `Failed to connect to database: ./data/finance.db`. Aviso `Invalid next.config.js options` (`serverExternalPackages` não existe em Next 14). |
| `npm run db:init` | (não corrido) | `scripts/init-db.ts` não existe (confirmado com `ls`). |
| lint / testes | não existem | Não há script `lint` nem `test` no `package.json`. |

O estado descrito em `PROJECT_STATE.md` continua correto, com uma atualização: o `npm audit` de produção mostra agora 7 problemas, e a lista do `next` inclui **"Authorization Bypass in Next.js Middleware" (GHSA-f82v-jwr5-mffw)**. Isto pesa diretamente na A3 (ver secção C).

---

## A) O que se aproveita e o que se substitui

### Aproveitar

| O quê | Evidência | Porquê |
| --- | --- | --- |
| Stack Next.js (App Router) + React + Tailwind + Recharts | `package.json`, `app/layout.tsx`, `components/UI.tsx` | Funciona e chega para uma app de 2 utilizadores. Mudar de stack não traz valor. |
| SQLite local via `@libsql/client` | `lib/db.ts` | Adequado a uma app local-first de um agregado (DB-D03: manter). |
| Componentes visuais `StatCard`, `TxnRow`, `CategoryBar`, `SectionTitle`, `fmt` (pt-PT) | `components/UI.tsx` | Reaproveitam-se no novo painel. `TxnRow` já mostra sinal e cor corretamente. |
| `Sidebar` e layout geral | `components/Sidebar.tsx`, `app/layout.tsx` | Esqueleto de navegação útil (a lista de links muda). |
| Lista de nomes de categorias | `scripts/seed.ts` (só os nomes: Habitação, Alimentação, Saúde, Transportes, Transferências, etc.) | Taxonomia inicial razoável; passa para uma tabela de categorias + regras editáveis. |
| A ideia do categorizador por palavras-chave | `app/api/import/route.ts` `categorize()` | A lógica passa a regras em BD (B2); o código atual não se mantém. |
| `zod`, `date-fns`, `papaparse` (já instalados, nunca usados) | `package.json` + grep sem imports | Úteis para validação de entrada, datas e CSV com aspas. `zod` precisa de upgrade (advisory). |
| Rota `sync/bank/init` com falha fechada | `app/api/sync/bank/init/route.ts` | Fica parada até D1; a validação de env e PEM é boa base. |
| `.gitignore` endurecido e pack `/docs` | PR #2 | Mantém-se; acrescenta-se `private-data/`. |

### Substituir

| O quê | Evidência | Porquê |
| --- | --- | --- |
| Esquema em `lib/db.ts` | Dinheiro em `REAL` em todas as tabelas; `owner TEXT` livre; `createClient()` ao importar o módulo | Viola "cêntimos inteiros + moeda" e "owner por IDs"; o cliente ao importar quebra o build. Substituir por migrações versionadas (A4). |
| Importador `/api/import` | Ver secção C, riscos R1–R4 | Tem erros que corrompem valores; reescrever como importadores por plataforma com pré-visualização (B1). |
| Todas as rotas `app/api/**` | Nenhuma valida sessão nem input; `owner` vem do cliente (ex.: `POST /api/transactions`, `GET /api/goals?owner=`) | Mantêm-se os URLs onde fizer sentido, mas cada handler passa a usar uma camada comum: sessão → membro do agregado → validação zod → query. |
| Páginas `/rui`, `/ana`, `/conjunta` | Rendimentos fixos no código (`const INCOME = …`), orçamentos fixos, itens de habitação fixos | Passam a um único painel com vista Rui / Ana / conjunto (UX-D01: as rotas antigas ficam como aliases). |
| Dashboard `/` | Soma qualquer valor positivo como receita; receita da conjunta fixa no código (`inc:` em `app/page.tsx`) | Transferências internas inflacionam receitas e despesas. O cálculo passa para o motor (C1), não para a página. |
| `/api/ai-advisor` | SQL dentro da rota; salários fixos no prompt; sem auth | **Desligar** já (A2) e só voltar em D2 com contexto minimizado. |
| `/api/settings/api-keys` e o formulário em `/settings` | Guarda passwords de corretora e chaves em claro | Com a estratégia "CSV/PDF primeiro" não é preciso guardar chaves: **remover** (A2). A chave Anthropic passa só para env. |
| `/api/sync/bank/callback` | `Math.abs`, `owner='rui'` fixo, `DELETE FROM bank_accounts`, token em claro, `state` não validado | Reescrever em D1; até lá, desligado. |
| `scripts/seed.ts` | Dados de aspeto real + `DELETE FROM accounts/transactions/...` | Seed sintético; nunca correr contra a BD real (ver R9). |

### Apagar (depois de UX-D02 aprovado; ganho de clareza, sem perda)

`app/investments/` (duplicado de `/investimentos`), `app/lumeu/page.tsx` (cópia de `components/BusinessPages/LumeuPage.tsx`), `app/finance/` + `actions.ts` (chama `/api/finances`, que não existe, e tabelas que não existem), `app/lib/db-server.ts` (nunca importado), `test-init.js` (esquema morto), e uma das duas libs de Open Banking (`app/lib/gocardless.ts` se OB-D01 = Enable Banking).

### Fora do objetivo atual (pergunta Q5)

Os módulos de negócio (LUMEU, Condomínio, Trade) não aparecem no objetivo do briefing. `TradePage` e `CondoFlowPage` são **dados fictícios**. Proposta: esconder do menu e não migrar até decisão.

---

## B) Ordem de prioridade: confirmação, correções, tamanho e dependências

Concordo com a lógica Fase A → B → C → D. Proponho **quatro correções**:

1. **A2 não consegue "proteger" `/api/backup` sem a A3.** Em A2 a rota é **desligada** e o backup passa a um script local (`npm run db:backup`). Idem para `/api/ai-advisor` e `/api/settings/api-keys`.
2. **A ferramenta de migrações vem antes da autenticação.** A3 precisa das tabelas `users` e `sessions`. Divido A4 em **A4a** (migrações + backup + reversão + users/households/sessions) antes de A3, e **A4b** (contas e movimentos tipados, cêntimos) depois.
3. **O upgrade do Next é maior do que "o último 14.2.x".** O `npm audit` propõe `next@14.2.35`, mas a gama afetada do `next` vai até 16.3.0-preview: parte dos advisories não fecha na linha 14. Recomendo ir primeiro para 14.2.35 (fecha o bypass de middleware e é pequeno) e tratar Next 15/16 como tarefa própria (SEC-D04).
4. **Dividir B1 por plataforma** e trazer a B2 (transferências internas) para antes do painel: sem ela o painel mostra despesas duplicadas.

### Ordem proposta

| # | Tarefa | Tam. | Depende de | Nota |
| --- | --- | --- | --- | --- |
| A1 | QA-001 + BUILD-001: scripts `lint`, `typecheck`, `test` (Vitest), `build`; CI no GitHub Actions; cliente BD preguiçoso; corrigir `next.config.js`; `db:init` que só cria tabelas | M | — | Aceitação: os 4 comandos passam em CI limpo sem `data/finance.db`. |
| A2 | SEC: Next 14.2.35, seed sintético + tirar valores pessoais fixos do código (páginas, `ai-advisor`, defaults de `budgets`), desligar `/api/backup`, `/api/ai-advisor`, `/api/settings/api-keys` e o callback bancário, apagar chaves guardadas na BD, `private-data/` no `.gitignore`, `.claude/settings.local.json` fora do git | M | A1, SEC-D03, SEC-D04 | Pode partir-se em 2 PRs (deps / desligar rotas + seed). |
| A4a | Migrações `migrations/*.sql` + `scripts/migrate.ts` com backup automático antes e script de reversão; tabelas `users`, `households`, `household_members`, `sessions` | M | A1, DB-D01, DB-D02, Q1 | |
| A3 | AUTH-001/002: login, sessão no servidor, verificação em **cada** handler (middleware só redireciona), testes de 401/403 | M | A4a, AUTH-D01, AUTH-D02, Q2, Q3 | Proposta para AUTH-D01 abaixo. |
| A4b | Contas e movimentos tipados (tipos da secção 7 do handoff), dinheiro em cêntimos + moeda, `owner` → IDs, testes de isolamento | L | A3, Q1 | Se não houver dados reais a preservar (Q1), é criação limpa (passa a M). |
| B1a | Importador comum (hash do ficheiro, chave do movimento, pré-visualização, relatório de erros) + ABANCA CSV | M | A4b | Fixtures sintéticas com os defeitos da secção 4. |
| B1b | Cartão refeição CSV | S | B1a | |
| B2 | CAT-001: categorias + regras editáveis, transferências internas, MOVIMENTO_SEGURO, fila de revisão (MB WAY) | M | B1a | |
| B3 | DASH-001: evolução de despesas, por categoria, receitas, taxa de poupança; vistas Rui / Ana / conjunto; filtro mês/ano | M | B2 | Primeiro valor completo com dados reais. |
| B1c | ActivoBank PDF "Extrato combinado" | L | B1a | PDF é o mais frágil; precisa de biblioteca de extração e de amostras de estrutura (Q6). |
| B1d | Revolut PDF | M | B1c | Conta quase parada: prioridade baixa. |
| B4 | INV-001: posições e evolução + importador XTB (Excel, 3 folhas, UTC) + trading agregado | L | B1a, B2 | |
| C1 | ENGINE-001: motor determinístico + plano de amortização por fases de taxa | M/L | A4b | Pode correr em paralelo com B (só funções puras + testes). |
| C2 | INSIGHT-001 | M | C1, B3 | |
| C3 | IRS-001/002: FIFO, câmbio, comissões, exportação | L | B4, IRS-D01, confirmação das regras na AT | |
| D1 | PROV-001 / OB-001 | L | SEC-004, OB-D01, A3 | |
| D2 | AI-001 | M | C1, AI-D01, A3 | |
| D3 | PLAN-001 | M | C1 | Taxas como parâmetros com fonte e data. |

S = até meio dia; M = 1–2 dias; L = 3–5 dias (estimativas de trabalho efetivo, cada uma com PR próprio).

### Proposta para AUTH-D01 (para o Rui decidir)

**Recomendo:** password por pessoa, hash com `scrypt` do Node (sem dependências nativas), sessão aleatória guardada na tabela `sessions` (só o hash do token), cookie `HttpOnly; Secure; SameSite=Lax`, expiração deslizante, limite de tentativas de login, verificação de `Origin` nos pedidos que alteram dados. Os utilizadores criam-se com um script local que pede a password no terminal (nunca valores por defeito em env, ao contrário do `setup-ubuntu.sh` atual). O middleware só serve para redirecionar para o login; **a autorização é sempre verificada no handler**, por causa do advisory de bypass de middleware.

Alternativas: Auth.js com credenciais (mais dependências e sessões JWT, mais difícil revogar); proteção só por rede (Tailscale ou reverse proxy com basic auth). A proteção por rede é um bom complemento, não um substituto.

---

## C) Riscos técnicos e de segurança novos (além do `SECURITY_AUDIT.md`)

Proponho registá-los no `SECURITY_AUDIT.md` como SEC-A17 em diante quando a Fase A arrancar.

| ID | Sev. | Risco | Evidência |
| --- | --- | --- | --- |
| R1 | **Crítico (dados)** | O importador apaga **todos os pontos** antes de converter: `replace(/\./g,'')`. Um CSV com ponto decimal (o ABANCA traz ruído do tipo `-12.340000000000002`) fica `-12340000000000002`. Os valores são corrompidos sem erro. | `app/api/import/route.ts`, cálculo de `amountStr` |
| R2 | Alto (dados) | Perda silenciosa: o `INSERT … SELECT … FROM categories c, accounts a WHERE …` não insere nada se a categoria ou a conta do `owner` não existir, mas o contador `imported++` sobe na mesma. Numa BD criada só com `initDB()` (sem seed) **nada é gravado** e o ecrã diz que importou. O mesmo padrão existe em `POST /api/transactions`. | `app/api/import/route.ts`, `app/api/transactions/route.ts` |
| R3 | Alto (dados) | A deduplicação por `(data, descrição, valor, owner)` descarta movimentos legítimos iguais no mesmo dia (dois cafés, duas portagens). Não há hash de ficheiro. | `app/api/import/route.ts` |
| R4 | Médio (dados) | O importador lê a coluna 0 como data (no ABANCA é "Data", não "Data da operação"); formatos `aa` de 2 dígitos caem no ramo errado; `split(';')` parte descrições com `;` entre aspas. Qualquer valor positivo vira "Receita", incluindo transferências internas. | `app/api/import/route.ts` |
| R5 | Alto | O callback OAuth **não valida `state`**: a rota `init` gera `state: randomUUID()` mas não o guarda, e o `callback` lê-o e ignora-o. Permite injetar a ligação bancária de outra pessoa (login CSRF). | `init/route.ts`, `callback/route.ts` |
| R6 | Médio | O callback coloca `error.message` (que pode conter o corpo da resposta do provider) no URL de redirecionamento. Fica no histórico do browser e nos logs. `/api/backup` devolve `String(e)` com caminhos do sistema. | `callback/route.ts`, `backup/route.ts` |
| R7 | Alto (privacidade) | Há valores pessoais fixos **no código da app**, não só no seed: salários no prompt de `ai-advisor`, defaults de rendimento em `settings/budgets`, `INCOME` em `/rui`, `/ana`, `/conjunta`, itens de habitação em `/conjunta`. O SEC-D03 tem de cobrir estes ficheiros, não só `scripts/seed.ts`. | ficheiros citados |
| R8 | Médio | **Correção ao SEC-A16:** o `.claude/settings.local.json` não está vazio; autoriza `sqlite3 *`, `npm run *`, `next build *` e `npx tsc *`. Um agente com esta config pode correr `npm run db:seed`, que faz `DELETE` em contas, categorias, investimentos, metas e movimentos. | `.claude/settings.local.json`, `scripts/seed.ts` |
| R9 | Alto (dados) | O seed é o **único** caminho que hoje cria as tabelas (`db:init` aponta para um ficheiro inexistente). Quem quiser "inicializar a BD" numa máquina com dados reais apaga-os. A A1 tem de criar um `db:init` não destrutivo **antes** de qualquer outra coisa tocar na BD. | `package.json`, `scripts/seed.ts` |
| R10 | Médio | Sem validação de input em nenhuma rota (`zod` instalado e não usado): `limit` sem teto em `GET /api/transactions`, `type` e `owner` arbitrários, ficheiro de import sem limite de tamanho (lido todo em memória). | `app/api/**` |
| R11 | Médio | Quando houver cookies de sessão, todas as rotas `POST/PUT/DELETE` ficam expostas a CSRF se não houver verificação de `Origin` ou token. Deve entrar na A3, não depois. | desenho da A3 |
| R12 | Médio | `/api/ai-advisor` aceita `question` sem limite e sem rate-limit: quem chegar à porta gasta a chave Anthropic. O modelo fixo (`claude-sonnet-4-20250514`) pode já ter sido descontinuado; confirmar antes de D2. | `app/api/ai-advisor/route.ts` |
| R13 | Baixo | "Mês atual" calculado em UTC (`toISOString().slice(0,7)`): na primeira hora de cada mês em Lisboa no verão, mostra o mês anterior. Relevante para o XTB (datas em UTC) e para o IRS (ano fiscal). Regra: guardar datas de movimento como data local `YYYY-MM-DD` e timestamps em UTC, com fuso explícito no importador. | `app/page.tsx`, `ai-advisor/route.ts` |
| R14 | Baixo | O seed coloca a conta pessoal da Ana no ABANCA e o importador escolhe o banco pelo `owner` (`conjunta` → ABANCA, resto → ActivoBank). Não bate com o briefing (Ana no ActivoBank). O banco tem de ser escolhido por conta, não por pessoa. | `scripts/seed.ts`, `components/UI.tsx` `ImportCSV` |
| R15 | Processo | O briefing e o handoff contêm valores reais (crédito, PPR, saldos, rendimentos). O briefing refere `docs/FINANCIAL_PLAN.md` (que não existe no repo). Se for criado, só pode ter método e parâmetros, **nunca os números reais**; esses ficam em `private-data/`. | briefing, secção 5 D3 |
| R16 | Processo | Os PDFs bancários exigem uma biblioteca de extração de PDF, que é nova superfície de ataque (ficheiros não confiáveis). Correr só no servidor local, com limite de tamanho e de páginas, e sem gravar o PDF original na BD. | B1c |
| R17 | Baixo | A linha Next 14 já não recebe todas as correções (ver secção 0). Fica uma dívida que leva a uma migração para 15/16 depois da Fase A. | `npm audit` |

---

## D) Perguntas ao Rui que bloqueiam tarefas

1. **Q1 — Há dados reais em `data/finance.db` no teu PC que não existam nos extratos?** Se não houver, criamos o esquema novo do zero e reimportamos (A4b passa de L para M e o risco de migração desaparece). *Bloqueia A4a/A4b.*
2. **Q2 — Onde corre a app?** Só no teu PC (localhost), na rede de casa, ou acessível de fora (Tailscale, VPS)? E aceitas a proposta de AUTH-D01 (password por pessoa + sessão no servidor)? *Bloqueia A3 e OPS-D01.*
3. **Q3 — O que cada um vê?** A Ana vê as tuas contas pessoais e tu as dela, ou cada um vê só as suas + a conjunta? *Bloqueia A3 (AUTH-D02).*
4. **Q4 — Aprovas SEC-D03 e SEC-D04?** Seed sintético + retirar do código os valores pessoais fixos (R7), e Next 14.2.35 agora com 15/16 depois. *Bloqueia A2.*
5. **Q5 — O que desligamos já?** Proposta: desligar AI Advisor, guardar chaves de corretoras e ligação bancária até às fases C/D; esconder LUMEU / Condomínio / Trade do menu. Concordas? *Bloqueia o âmbito da A2.*
6. **Q6 — Estrutura dos ficheiros, sem dados.** Para as fixtures sintéticas preciso só da **linha de cabeçalho** do CSV ABANCA e do CSV do cartão refeição, e da lista de secções e colunas do PDF ActivoBank (podes copiar à mão, sem valores). *Bloqueia B1.*

(SEC-004, a rotação da chave Enable Banking, continua pendente mas só bloqueia D1.)

---

## E) Menor "primeiro valor visível"

**Proposta: um relatório local, logo a seguir à A1, que não precisa de autenticação nem de BD.**

- **O quê:** `npm run report:abanca -- private-data/abanca.csv` lê o CSV da conta conjunta e imprime (e grava em `private-data/report.html`) uma tabela de **despesas por categoria por mês**, com transferências internas e movimentos de seguro excluídos e uma lista dos movimentos "por rever".
- **Porque é o menor:** corre só no teu PC, não abre nenhuma porta, não envia nada para fora e não grava nada na BD. Não depende de A2–A4.
- **Porque não é trabalho deitado fora:** o parser (datas nos dois formatos, arredondamento a cêntimos, sinal preservado, dedupe por chave) e as regras de categorização são exatamente os módulos que a B1a e a B2 vão usar dentro da app, já com testes sobre fixtures sintéticas.
- **Tamanho:** S/M, um PR depois da A1. Depende só da Q6 (cabeçalho do CSV).

**Alternativa**, se preferires que o primeiro valor seja já na app: fechar A1 → A2 → A4a → A3 e depois B1a + B2 mínima + B3 mínima só para a conta conjunta. É mais seguro de mostrar a outras pessoas, mas chega 1–2 semanas mais tarde.

---

## Próximo passo

Não começo a Fase A sem aprovação. Depois do teu OK (e do Grok Bot) à ordem da secção B e das respostas Q1–Q6 que já tiveres, o primeiro PR é a **A1 (QA-001 + BUILD-001)**, que não depende de nenhuma pergunta.
