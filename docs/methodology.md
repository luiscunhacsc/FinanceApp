# Metodologia — versão 0.1

O Marco 1 contém dados de instrumentos, não contabilidade de carteira. As fórmulas quantitativas de desempenho e risco serão implementadas e documentadas nos respetivos marcos, antes de serem expostas ao utilizador.

## Identidade e qualidade

Os oito símbolos iniciais são identificadores de consulta. O código não fixa nome, moeda, ISIN ou TER. A resposta deve confirmar o símbolo solicitado. Campos ausentes continuam ausentes. Moedas desconhecidas ou subunidades não normalizadas não são assumidas como unidades monetárias convencionais; o normalizador recusa os respetivos preços.

Observado significa recebido da fonte, não garantia de exatidão ou tempo real. Importado significa declarado num ficheiro do utilizador. Manual significa introduzido pelo utilizador. Dados estimados não são gerados neste marco. A data de metadados Yahoo é a da recolha, porque a resposta não informa data efetiva dos metadados.

## Seleção de preços

Se a prioridade manual estiver ativa e houver observações manuais, escolhe-se a manual mais recente. Caso contrário, escolhe-se a observação não manual mais recente, comparando o instante de referência; em empate, o instante de recolha. Desativar a prioridade não apaga observações manuais.

Uma falha de rede não substitui o preço por zero e não altera o instante da cotação anterior. A idade apresentada é `floor((agora − asOf) / 86 400 000)`, limitada inferiormente a zero. Não é uma contagem de sessões em atraso. Bolsa encerrada, feriados e publicação tardia de NAV não são interpretados como erros a partir dessa idade.

## NAV, séries e calendários

Para `0P0001PBB6.F` e instrumentos identificados pela fonte como mutual funds, prefere-se a última observação diária. Não se usa volume nem intradiário. Se não houver série diária, uma cotação com timestamp da fonte pode ser apresentada como NAV com a respetiva data; não se inventa uma hora de atualização.

As datas diárias usam o fuso do mercado fornecido pelo Yahoo. Sem fuso válido, a série diária fica indisponível. Os campos com preço nulo, negativo, zero, infinito ou instante futuro são ignorados. Feriados/lacunas não são preenchidos, nem se transforma ausência de observação em retorno zero.

Este marco não alinha instrumentos entre si. A regra prevista para valorização da carteira é transportar o último preço conhecido até à data, assinalando idade e sem preencher antes do início da série. Os módulos estatísticos usarão uma amostra e frequência comuns, sem introduzir retornos zero artificiais. Essas regras serão implementadas nos marcos correspondentes.

## Gráficos e variação

O gráfico usa fecho não ajustado, moeda original e datas disponíveis. Uma barra da sessão corrente pode ainda mudar. Desdobramentos e distribuições podem produzir quebras no preço; não interpretar o gráfico como retorno total. O fecho ajustado, quando fornecido, é preservado separadamente para análises futuras.

Variação entre observações: `r = preço / preço_anterior − 1`; a interface apresenta `100 × r` em percentagem. Para NAV, mostram-se as duas datas. Não se apresenta variação sem observação de comparação válida.

Mínimo e máximo do período são `min(preços)` e `max(preços)` da série recebida. Não são extremos históricos absolutos. O resumo recusa mistura de moedas. Não se converte silenciosamente valores para EUR.

## Testes

Fixtures sintéticas identificadas verificam precedência manual, identidade, moeda ausente, lacunas, NAV, limites do proxy, cache, falhas da fonte, normalização de percentagens, backup JSON/CSV, integridade referencial e persistência IndexedDB. Os testes de navegador verificam introdução de preços, ocultação, modo escuro, importação/restauro, gráfico, navegação móvel e recarga offline.

XIRR, TWR, drawdown, volatilidade e correlação terão testes com resultados conhecidos nos marcos de desempenho e risco. Nenhuma destas métricas é simulada ou anunciada como disponível na versão 0.1.
