# Marco 2 — Carteiras, transações e painel

## Utilizar

1. Abra **Carteiras e transações** e crie uma carteira. Pode usar uma carteira por corretora ou objetivo.
2. Registe uma **Entrada de dinheiro** em EUR, na data efetiva.
3. Registe a **Compra**, indicando instrumento, unidades, preço, moeda e comissão. O dinheiro é debitado do saldo existente. Não é criado um reforço adicional.
4. Consulte/introduza a cotação do instrumento. **Visão geral** passa a mostrar património, capital líquido, resultado, dinheiro e posições.
5. Para vender, escolha FIFO ou um lote específico. Abra os lotes no painel para consultar unidades originais/remanescentes, custos e afetações de vendas.

Os movimentos podem ser alterados e eliminados. A sequência inteira é validada antes da gravação: eliminar uma entrada necessária a uma compra ou uma compra necessária a uma venda é bloqueado. Para corrigir vários movimentos dependentes, comece pelos últimos. Não há saldos negativos nem vendas a descoberto.

Se não tem histórico completo, use **Posição inicial**. Indique o custo de aquisição e, separadamente, o valor de mercado em EUR na data em que começa o acompanhamento. Não é gerada uma cotação e a rendibilidade anterior não é reconstruída. Precisa de uma cotação real/manual para valorar essa posição no painel.

Cada carteira tem uma conta de dinheiro em EUR neste marco. Transações noutras moedas exigem câmbio de execução explícito. A aplicação não suporta saldos de numerário em moeda estrangeira nesta entrega. Para valorar uma posição cotada noutra moeda, use **Câmbios manuais**: indique EUR por unidade da moeda, instante e fonte. A taxa de execução nunca serve de substituto silencioso da taxa de valorização.

**Lista de observação** é independente das posições e do catálogo de instrumentos. Adicionar um símbolo à observação não cria unidades ou movimentos.

## Regras de cálculo

| Medida | Regra |
| --- | --- |
| Compra bruta EUR | arredondar a cêntimos(unidades × preço × câmbio de execução) |
| Comissão EUR | arredondar a cêntimos(comissão original × câmbio de execução) |
| Custo do lote | compra bruta + comissão de compra |
| Receita líquida da venda | venda bruta − comissão de venda |
| Ganho realizado | receita líquida − custo dos lotes vendidos |
| Preço médio em EUR | custo remanescente / unidades remanescentes |
| Valor de mercado | arredondar a cêntimos(unidades × cotação do ETF/fundo × câmbio de valorização) |
| Ganho não realizado | valor de mercado − custo remanescente |
| Património | soma das posições valorizadas + dinheiro |
| Capital líquido | entradas − levantamentos + valores de abertura; transferências contam apenas no âmbito individual |
| Resultado desde o início | património − capital líquido |
| Variação monetária diária | património de hoje − património de ontem − fluxos externos líquidos do dia |
| Peso | valor da posição / património, incluindo dinheiro |

Rendimentos recebidos entram no saldo e no resultado; não são reforços. Despesas autónomas saem do saldo e do resultado. As comissões de compra entram no custo e as de venda reduzem a receita: o total informativo de comissões não é deduzido novamente.

Transferências são um único registo com duas carteiras, aplicadas atomicamente. A origem perde montante + comissão e o destino recebe o montante. O fluxo anula-se no consolidado; a comissão mantém-se como despesa.

O motor usa BigInt à escala 10¹². Montantes/quantidades de entrada são strings decimais com até 12 casas. Multiplicações/divisões arredondam ao mais próximo, afastando meios de zero. Dinheiro liquidado é arredondado a cêntimos. Custo vendido é proporcional à fração de cada lote; a última venda recebe todo o custo residual. Resultados internos podem conservar mais casas que a apresentação em cêntimos.

Nos movimentos empatados pelo instante, a ordem de registo é o segundo critério e o identificador é o desempate final. FIFO usa a ordem efetiva das compras, dentro da mesma carteira e símbolo. Não é uma regra fiscal.

Posição inicial: o custo de aquisição suporta ganhos por lote; o valor declarado de abertura suporta fluxos e resultado de acompanhamento. Portanto, ganhos realizados + não realizados + rendimentos − despesas podem diferir do resultado desde o início pela valorização anterior incluída na posição inicial.

## Datas, lacunas e qualidade

Grelha diária em Europe/Lisbon. Movimentos são aplicados por data/hora. A valorização usa a última observação até ao dia, sem preencher antes da primeira observação e sem interpolar. Hoje representa os dados disponíveis agora; os restantes dias são snapshots de final do dia. Preços/NAV e câmbios transportados ficam identificados na tabela diária e nos tooltips. Datas e fontes por posição são sempre visíveis.

Não usamos o preço de uma compra como preço de mercado de dias posteriores. Se faltar preço ou câmbio, património, resultado, ganhos não realizados agregados e pesos ficam indisponíveis; existe um subtotal conhecido explicitamente identificado. O gráfico deixa lacunas. A cotação é sempre do próprio instrumento, nunca reconstruída pelas holdings.

Esta reconstrução usa séries históricas disponíveis atualmente; não é um arquivo point-in-time de publicações e revisões. Eventos societários, como desdobramentos, ainda não são aplicados automaticamente. As quantidades e movimentos devem estar reconciliados com o extrato. TWR, XIRR e taxas de desempenho não fazem parte desta entrega.

As convenções distinguem fluxos externos de resultados, sem declaração de conformidade GIPS. Referência conceptual: [GIPS, input data and calculation methodology](https://www.gipsstandards.org/standards/gips-standards-for-firms/gips-standards-handbook-for-firms/).

## CSV e backups

No ecrã de transações, descarregue o modelo e mantenha as colunas pela ordem indicada. Use identificadores únicos e estáveis. Crie primeiro as carteiras e adicione os símbolos ao catálogo. A data `at` é ISO 8601 com hora e fuso. Campos numéricos aceitam vírgula ou ponto decimal; não use ambos. Use ponto e vírgula como separador.

`kind`: deposit, withdrawal, buy, sell, fee, income, transfer ou opening. Para operações de dinheiro: amount em EUR. Para compras/vendas: symbol, quantity, price, currency, fx_rate e fee. Para transferências: to_portfolio. Para vendas específicas: lot_id. Para posições iniciais: opening_value total em EUR. As colunas opcionais podem ficar vazias; o template não contém transações fictícias.

Linhas repetidas com o mesmo ID e conteúdo são ignoradas. IDs com conteúdo diferente bloqueiam a importação, sem substituir movimentos silenciosamente. A pré-visualização mostra totais, duplicados e até 20 linhas. Importação só grava depois de validar a sequência completa. Notas que poderiam ser interpretadas como fórmulas são neutralizadas ao exportar para folhas de cálculo e recuperadas na reimportação.

IndexedDB passa da versão 1 para 2, preservando instrumentos, cotações, histórico e preferências. São acrescentadas tabelas portfolios, transactions, fxRates e watchlist. Backups JSON/CSV versão 2 incluem todas as tabelas. Backups versão 1 continuam aceites; o restauro cria listas vazias nas novas tabelas, com confirmação prévia. As aplicações antigas não conseguem ler backups versão 2. Limite de backup na interface: 30 MB; CSV de movimentos: 10 MB e 10 000 linhas.

## Publicação

O formato Yahoo Finance é reconhecido pelo mesmo botão de importação de movimentos, como descrito abaixo. Não requer uma API ou uma conta Yahoo ligada à aplicação.

O processo mantém-se: `npm ci`, `npm run check`, `npm run test:e2e`; publicar `dist` como site estático. O Worker Yahoo não mudou. A compilação não publica nada nem ativa planos pagos. Siga [o guia de publicação gratuita](deployment.md).

Antes de substituir uma versão já utilizada, exporte um backup. Após publicar, aceite a atualização da PWA quando terminar as edições; a migração da base é transacional. Para desenvolvimento local, portas/origens diferentes mantêm bases distintas.

## Importação do Yahoo Finance

1. Crie a carteira de destino e registe ou importe as entradas de dinheiro reais com as respetivas datas. O CSV analisado de My Portfolio contém operações, mas não depósitos nem levantamentos. O importador nunca inventa reforços para cobrir compras.
2. Escolha **Importar movimentos CSV** e selecione o ficheiro Yahoo original. Não precisa de renomear colunas nem converter o separador.
3. Confirme a moeda dos preços por símbolo. Pode aplicar um código a todos, se for efetivamente o mesmo. A moeda não é deduzida do nome ou sufixo; só pode vir dos metadados já guardados ou da confirmação explícita do utilizador. Esta confirmação não cria metadados de identidade do instrumento.
4. Preencha comissões vazias ou confirme explicitamente que as restantes são zero. Zero escrito no ficheiro e campo vazio são tratados de forma diferente. Para moeda estrangeira, indique o câmbio de execução de cada operação, em EUR por unidade da moeda; o ficheiro não fornece essas taxas.
5. Reveja os preços, em especial nas vendas, e aceite a convenção de datas. Clique em **Validar importação Yahoo**. Se faltar saldo, registe as entradas reais anteriores e volte a importar. Vendas excessivas também bloqueiam a importação.
6. Reveja novos movimentos, duplicados, cotações e saldo final, e confirme. Os novos instrumentos, movimentos e cotações são guardados numa única transação IndexedDB; uma falha não deixa gravações parciais.

### Mapeamento e limites

| Campo Yahoo | Tratamento |
| --- | --- |
| Symbol | Símbolo; instrumentos novos ficam sem nome, ISIN ou TER até obter esses dados de uma fonte |
| Transaction Type | BUY → compra; SELL → venda; quantidade positiva em ambos; outros tipos são rejeitados |
| Trade Date | AAAAMMDD → data da operação; 12:00 UTC é uma hora convencional, identificada na nota, não uma hora de execução conhecida |
| Purchase Price | Preço unitário da operação; nas linhas SELL, o utilizador confirma que é o preço da venda |
| Quantity | Unidades, incluindo frações; preserva até 12 casas decimais |
| Commission | Comissão na moeda confirmada; vazio exige preenchimento ou confirmação explícita de zero |
| Comment | Texto preservado na nota, nunca executado; até 700 caracteres para permitir a informação de proveniência |
| Current Price, Date, Time | Cotação independente, importação opcional; não substitui o preço de execução |
| Open, High, Low, Volume, Change | Não são usados para reconstruir desempenho ou histórico diário |
| High Limit, Low Limit | Não criam alertas; valores presentes geram aviso |

As operações são ordenadas cronologicamente; empates no mesmo dia preservam a ordem das linhas do CSV. Como não existe hora de execução, confirme a ordem de compras e vendas desse dia antes de importar. As vendas usam FIFO; não existe correspondência de lotes no ficheiro. As datas introduzidas pelo utilizador no Yahoo são preservadas, incluindo fins de semana, sem serem deslocadas para um dia de bolsa.

Cotações reconhecem fusos explícitos UTC/GMT, CET (+01:00) e CEST (+02:00). Datas/horas ou fusos não reconhecidos impedem a importação dessa cotação, com aviso, mas não invalidam operações válidas. Cotações repetidas iguais são reduzidas a uma observação por símbolo/instante; valores contraditórios bloqueiam o ficheiro. A data do NAV do PPR mantém-se, mesmo sendo anterior às restantes. Uma cotação atual não preenche automaticamente os dias históricos. Câmbios de valorização continuam separados dos câmbios de execução.

O Yahoo não fornece um identificador por transação neste formato. O importador usa SHA-256 do conteúdo financeiro original (carteira, símbolo, dia, tipo, quantidade, preço e comissão) mais a ocorrência de linhas idênticas. Reordenar linhas ou atualizar cotações/comentários não duplica movimentos já importados. Duas operações financeiras iguais mantêm duas ocorrências. Moeda/câmbio/comissão preenchidos na revisão não alteram a identidade: diferenças em reimportações são bloqueadas como conflitos.

**Não é sincronização:** alterar data, preço, quantidade, tipo ou comissão no Yahoo pode produzir uma identidade nova. Linhas removidas não eliminam transações locais. É necessário reconciliar estas alterações. Movimentos semelhantes previamente registados por outra via são bloqueados para evitar duplicação; não se tenta adivinhar se são a mesma operação. Alterações de comentários a movimentos já importados não substituem as notas locais. Cotações existentes com outro preço/moeda no mesmo instante também geram conflito.

O importador lê apenas o ficheiro local, sem enviar o seu conteúdo a serviços externos. CSV pessoal não faz parte dos testes nem é incorporado na aplicação. Os testes usam dados sintéticos. Para inspecionar apenas a estrutura de um ficheiro sem importar dados: `node scripts/inspect-yahoo.mjs caminho/portfolio.csv`.
