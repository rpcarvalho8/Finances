# Ligações diretas a bancos e corretoras — análise

_17-11-2026 · complemento à Tarefa 0 (`docs/ANALISE_CLAUDE.md`). Decisão do Rui: ficheiros primeiro (fase B), depois ligações (fase D)._

## Resumo

Dá para ligar diretamente os três bancos, a OKX e, com uma limitação, quase tudo o resto:

| Fonte | Ligação direta? | Como |
|---|---|---|
| ABANCA | Sim (PSD2) | Agregador open banking, só leitura |
| ActivoBank (incl. PoupeUp) | Sim (PSD2) | Agregador open banking, só leitura |
| Revolut | Sim (PSD2) | Agregador open banking, só leitura |
| Pluxee (cartão refeição) | **Não** | Importação do ficheiro exportado (já planeada na B1b) |
| OKX | Sim | API oficial com chave **só de leitura** |
| XTB | **Não** | A XTB desligou a API a 14-03-2025; importação do relatório exportado do xStation |
| Outras no futuro | Depende | Conector novo no mesmo registo (ver desenho) |

A importação de ficheiros continua necessária: serve a Pluxee e a XTB, e é o plano B quando uma ligação falha ou o consentimento expira.

## 1. Bancos via PSD2 (ABANCA, ActivoBank, Revolut)

- A PSD2 obriga os bancos a dar acesso de leitura (contas, saldos, movimentos) a prestadores autorizados (AISP). Uma app caseira não pode pedir licença AISP; usa um **agregador** que já a tem.
- **Enable Banking** (recomendado): os termos (atualizados a 09-01-2026) dizem que o uso em produção é **gratuito para uso pessoal de particulares, apenas para contas do próprio utilizador**, e não para fins comerciais. Encaixa no Finance OS a correr no teu PC. Cada pessoa (tu e a Ana) liga as suas próprias contas.
- **GoCardless Bank Account Data** (ex-Nordigen), que era a opção gratuita habitual: os registos novos estão fechados (Firefly III e outros projetos confirmam). Fica de fora.
- Tink, Plaid, Yapily: comerciais, pagos, pensados para empresas. Fora de escala para uso doméstico.
- A confirmar no painel do Enable Banking antes de programar: que ABANCA Portugal, ActivoBank e Revolut aparecem na lista de bancos de PT e que a conta PoupeUp é devolvida como conta separada.
- Limitações reais:
  - O consentimento expira (normalmente 180 dias); depois é preciso reautorizar no banco. A app avisa antes.
  - O histórico disponível na primeira sincronização é limitado (varia por banco, muitas vezes 90 dias a 2 anos). O histórico antigo entra por ficheiro.
  - Só leitura: não há pagamentos nem transferências (e não queremos — regra "a IA nunca executa operações").
  - Os dados passam pelo Enable Banking (Finlândia, regulado). É uma terceira parte com acesso aos movimentos.

## 2. Pluxee (cartão refeição)

Os cartões refeição ficam fora da PSD2 (exceção de "rede limitada"), por isso não há obrigação de API e a Pluxee não publica uma. Fica o importador de ficheiro (B1b, formato que já me enviaste). Se a Pluxee vier a ter exportação melhor ou API, entra como conector novo.

## 3. Investimentos

- **OKX**: API oficial. Crias uma chave com permissão **Read** apenas (sem Trade nem Withdraw), com passphrase e **lista de IPs** (o IP de casa). A app lê saldos, posições e histórico. Se a chave fosse roubada, não dava para mover dinheiro.
- **XTB**: a própria XTB diz que "As of March 14, 2025, the XTB API service … has been disabled" e não há API oficial de substituição. Bibliotecas de terceiros que ainda falam com o xStation não são suportadas pela XTB; não as recomendo (credenciais completas da conta, risco de bloqueio). Solução: importar o relatório de histórico/posições exportado do xStation (preciso de um exemplo de ficheiro, só cabeçalhos).
- **Outras no futuro** (Trading 212, Binance, Kraken, IBKR…): entram pelo mesmo registo de conectores, sempre com chaves só de leitura quando a plataforma o permitir.

## 4. Desenho: conectores plugáveis

Um conector é um módulo que declara o que sabe fazer e devolve dados normalizados. O resto da app (deduplicação, categorias, dashboard) não sabe de onde vieram.

```
lib/connectors/
  types.ts        // interface Connector
  registry.ts     // lista de conectores disponíveis
  enablebanking/  // ABANCA, ActivoBank, Revolut (e outros bancos PSD2)
  okx/
  files/          // abanca-csv, pluxee-csv, activobank-pdf, xtb-report (B1)
```

```ts
interface Connector {
  id: string                       // 'enablebanking', 'okx', 'file:pluxee'
  kind: 'bank' | 'meal_card' | 'broker' | 'exchange'
  auth: 'psd2_consent' | 'api_key' | 'file'
  capabilities: Array<'accounts' | 'balances' | 'movements' | 'positions'>
  fetch(conn: Connection, since: string): Promise<NormalizedBatch>  // só leitura
}
```

- Todos devolvem o mesmo `NormalizedBatch` (contas, movimentos em cêntimos + moeda, posições), que passa pelo mesmo pipeline da importação de ficheiros da B1: chave de deduplicação, pré-visualização na primeira vez, relatório de erros. Por isso a B1a (framework de importação) é a base dos conectores também.
- Tabelas novas: `connections` (agregado, dono, conector, estado, consentimento até, última sincronização), `connection_secrets` (cifrados) e `sync_runs` (registo de cada sincronização).
- Adicionar uma plataforma nova = escrever um módulo e registá-lo; sem mexer no esquema.

## 5. Segurança

Hoje a sincronização bancária e o guardar chaves estão desligados (A2) precisamente porque não havia onde guardar segredos com segurança. Antes de qualquer conector:

1. **Cofre de segredos**: chaves e tokens cifrados na BD com AES-256-GCM; a chave-mestra fica fora da BD e fora do git (variável de ambiente ou ficheiro com permissões 600 no PC). Backup da BD sem a chave-mestra não expõe segredos.
2. **Só leitura sempre**: escopos AIS apenas; chaves de corretora sem Trade/Withdraw; a app recusa uma chave OKX que tenha permissões a mais (dá para verificar pela API).
3. **Servidor apenas**: segredos nunca chegam ao browser; só membros autenticados do agregado gerem as ligações; cada pessoa vê o estado mas só o dono revoga.
4. **IP whitelist** na OKX; chave privada da aplicação Enable Banking guardada como segredo, não no repositório.
5. **Registo de sincronizações** e alerta quando o consentimento está a expirar ou falha.
6. A IA continua sem acesso a segredos e sem executar nada.
7. O PC passa a falar com a internet (Enable Banking, OKX). Continua sem portas abertas para fora: as ligações são de saída. O redirecionamento do consentimento volta para `localhost`.

## 6. Onde entra no plano

Proposta: manter a fase B como está (ficheiros) e acrescentar a fase D a seguir.

| Passo | O quê | Depende de |
|---|---|---|
| B1a | Framework de importação + ABANCA CSV (já planeado) | A4b |
| B1b | Pluxee | B1a |
| B1c | ActivoBank PDF (histórico antigo + plano B) | B1a |
| **D0** | Cofre de segredos + tabelas `connections`/`sync_runs` + interface `Connector` | B1a |
| **D1** | Enable Banking: ABANCA, ActivoBank, Revolut (consentimento, sincronização, aviso de expiração) | D0 |
| **D2** | OKX só leitura (saldos, posições, histórico) | D0, B4 |
| **D3** | XTB por ficheiro exportado | B1a, B4 |

Revolut entra só pela D1 (não preciso de ficheiro dele).

## 7. O que preciso de ti

1. **Aceitas usar o Enable Banking** (gratuito para uso pessoal; os teus dados bancários passam por eles) para ABANCA, ActivoBank e Revolut? A alternativa é ficar só com ficheiros.
2. **Ordem**: B1 (ficheiros) primeiro e depois D (ligações), como proposto? Ou saltar para D1 logo a seguir à B1a?
3. Quando chegarmos à D1: criar uma conta no painel do Enable Banking (é em teu nome, por ser uso pessoal) e registar a aplicação. Eu guio-te passo a passo.
4. Para a XTB: um exemplo do relatório exportado do xStation, só os cabeçalhos (sem valores).

## Fontes

- XTB, "Do you offer API?" (atualizado 14-03-2025): https://www.xtb.com/int/help-center/our-platforms-1/do-you-offer-api-1
- Enable Banking, Terms of Service (09-01-2026): https://enablebanking.com/terms
- Firefly III, GoCardless (registos fechados): https://docs.firefly-iii.org/how-to/data-importer/import/gocardless/
- Alternativas ao GoCardless: https://dev.to/johnfrandsen/gocardless-bank-account-data-alternatives-what-to-use-when-signups-are-disabled-326d
- OKX, chaves API com permissão de leitura e IP whitelist: https://rotki.com/integrations/okx
