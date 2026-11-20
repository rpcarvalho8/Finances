# IMPORT_FORMATS — estrutura dos ficheiros de origem (B1)

## Pipeline comum (B1a)

1. O utilizador escolhe formato, conta de destino e ficheiro em `/importar`.
2. **Pré-visualização** (`POST /api/import`, `mode=preview`): o servidor lê o ficheiro, ordena por data, calcula a chave de deduplicação de cada linha e diz o que é novo, o que já existe e que linhas têm erro. Nada é gravado.
3. **Importar** (`mode=commit`): o mesmo ficheiro é enviado outra vez com o SHA-256 da pré-visualização; o servidor volta a ler tudo (o cliente nunca envia linhas) e grava só as novas, numa transação, com um registo em `import_batches` (hash, contagens, erros, avisos). O ficheiro não é guardado.
4. Chave de deduplicação: hash de (data, data-valor, cêntimos, descrição normalizada, n.º de ocorrência desse conjunto no ficheiro). Reimportar o mesmo ficheiro ou um extrato sobreposto não duplica; dois movimentos iguais no mesmo dia ficam os dois. `UNIQUE(account_id, dedupe_key)` na BD é a última defesa.
5. Saldos: se o ficheiro trouxer saldo, verifica-se se encadeiam; se não, aviso ("pode faltar algum movimento"), sem bloquear.
6. Movimentos importados ficam sem categoria e como `expense`/`income` pelo sinal; transferências internas (B2) e categorias (B3) vêm depois.

Limites: 5 MB e 20 000 linhas por ficheiro. Novos formatos registam-se em `lib/import/registry.ts`; os conectores diretos da fase D vão alimentar o mesmo pipeline.


Só estrutura. **Nenhum valor real** aqui nem nas fixtures: os exemplos são inventados.
Fontes: cabeçalhos e capturas enviados pelo Rui em 2026-11-13 (não guardados no repo).

## ABANCA — conta conjunta (CSV)

- Extensão `.csv`, separador **vírgula**. Descrições podem conter vírgulas (ex.: `CONDOMINIO EXEMPLO, TRF. PERIODICO: 2`), logo o parser tem de respeitar aspas (RFC 4180). Encoding a detetar (UTF-8 com/sem BOM ou Windows-1252).
- 6 colunas, por esta ordem:

| # | Coluna | Formato | Uso |
| --- | --- | --- | --- |
| 1 | `Data` | `DD-MM-AAAA` | data de registo (não usar como data do movimento) |
| 2 | `Descritivo` | texto | descrição |
| 3 | `Saldo` | `1234.56 €` (ponto decimal, sufixo ` €`, ruído de vírgula flutuante) | saldo após o movimento (só validação) |
| 4 | `Montante` | `-12.34 €` / `12.34 €`, sinal menos nos débitos, ruído (`-12.340000000000002 €`) | valor; **o sinal nunca se perde** |
| 5 | `Data da operação` | `DD-MM-AAAA` | **data do movimento** |
| 6 | `Data valor` | `DD-MM-AAAA` | data-valor |

- Linhas fora de ordem cronológica (até com anos trocados). Ordenar por data da operação; não confiar na ordem do ficheiro.
- Conversão a cêntimos (`parseNoisyAmountToCents`): tirar ` €`, arredondar ao cêntimo **só** quando os dígitos a mais são ruído (< 0,001 cêntimo); um valor com cêntimos fracionários reais é rejeitado. Montante 0 é ignorado com aviso.
- Implementado na B1a: `lib/import/abanca.ts` (colunas lidas pelo nome, não pela posição). Fixtures sintéticas em `tests/fixtures/abanca/`.
- Saldos inconsistentes: avisar no relatório de importação, não bloquear.

## Cartão refeição (CSV)

- Cabeçalho com 3 linhas antes da tabela (a saltar).
- Colunas: `Data`, `Descrição`, `Valor`, `Saldo`.
- Vírgula decimal portuguesa; as linhas `Carregamento de ...` aparecem partidas em várias colunas (descrição fragmentada): reconstruir juntando as colunas excedentes à descrição e lendo valor/saldo das duas últimas colunas.
- Carregamentos = rendimento em espécie; gastos = alimentação. Conta própria, não é dinheiro livre.
- Implementado na B1b: `lib/import/pluxee.ts`. Regra: 1.ª célula = data (DD/MM/AAAA, DD-MM-AAAA ou AAAA-MM-DD), duas últimas = valor e saldo, o que está no meio = descrição (juntada com ", "). Se o ficheiro não pôs aspas e os valores vierem partidos na vírgula decimal (`-12`,`34`), reconstrói-se a partir das quatro últimas células. Separador `,` ou `;`.
- Montantes portugueses exatos (`1.234,56 €`), sem vírgula flutuante.
- Sinais: se o ficheiro tiver algum valor com sinal, usam-se os sinais; se não tiver nenhum, carregamentos são entradas e o resto gastos (com aviso na pré-visualização).
- Tipos: carregamento → `in_kind_income` (sem categoria); gasto → `expense` na categoria Alimentação; outra entrada (estorno) → `refund`.
- Vai para uma conta do tipo `meal_card` (criada na página Importar, "+ Nova conta"; a página propõe-na ao escolher este formato).
- **Por confirmar com um ficheiro real**: separador, aspas e formato da data. A pré-visualização não grava nada, por isso um formato diferente aparece como erros sem estragar dados.

## ActivoBank — PDF "Extrato combinado"

- Tabela de movimentos com colunas: `DATA LANC.` | `DATA VALOR` | `DESCRITIVO` | `DEBITO` | `CREDITO` | `SALDO`.
- Débito e crédito em **colunas separadas** (sem sinal): débito → negativo, crédito → positivo.
- Primeira linha `SALDO INICIAL` (só saldo).
- Datas `D.MM` **sem ano**: o ano vem do período do extrato no cabeçalho; um extrato que atravessa dezembro→janeiro tem de mudar de ano.
- Valores com ponto decimal; milhares com espaço (`1 556.00`).
- Cada secção começa por uma linha `<TIPO DE CONTA> | N. <número> | MOEDA: EUR` (ex.: `CONTA SIMPLES`), seguida de `EXTRATO DE AAAA/MM/DD A AAAA/MM/DD`. O ano de cada `D.MM` vem deste período: se o mês do movimento for maior que o mês final do período, pertence ao ano inicial (extratos dez→jan).
- A secção PoupeUp tem as mesmas colunas da conta simples.
- Transferências internas aparecem como `TRF DE PoupeUp - <nome da poupança>` / `TRF P/ PoupeUp ...`: candidatas a TRANSFERÊNCIA INTERNA (B2).
- O número de conta nunca é guardado em claro: só um identificador derivado (hash) para ligar o ficheiro à conta.
- Páginas de avisos a ignorar. Títulos das secções de títulos e depósito a prazo ainda por confirmar.
