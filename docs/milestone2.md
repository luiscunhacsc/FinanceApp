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

O processo mantém-se: `npm ci`, `npm run check`, `npm run test:e2e`; publicar `dist` como site estático. O Worker Yahoo não mudou. A compilação não publica nada nem ativa planos pagos. Siga [o guia de publicação gratuita](deployment.md).

Antes de substituir uma versão já utilizada, exporte um backup. Após publicar, aceite a atualização da PWA quando terminar as edições; a migração da base é transacional. Para desenvolvimento local, portas/origens diferentes mantêm bases distintas.
