# Dados locais e formatos

Esta página descreve o esquema original do Marco 1. A aplicação atual usa IndexedDB e backups versão 2; consulte [as novas entidades, migração e CSV de movimentos](milestone2.md). A versão 1 continua aceite na importação.

Base IndexedDB: `patrimonio-local`, versão 1. Tabelas:

| Tabela | Chave | Conteúdo |
| --- | --- | --- |
| instruments | symbol | Tipo de negociação, metadados opcionais com proveniência, prioridade manual, criação |
| quotes | id | Cotação, moeda, símbolo, comparação anterior opcional, origem e datas |
| history | id | Observação diária, fecho, fecho ajustado opcional, moeda, origem |
| settings | main | Tema, ocultação, proxy opcional, boas-vindas |

Fonte: nome, natureza (`observed`, `manual`, `imported`), instante de referência `asOf` e recolha `retrievedAt`. Timestamps ISO 8601 com fuso obrigatório. Na interface, horas em Europe/Lisbon. Datas de sessão do histórico calculadas no fuso informado pela fonte; não pelo fuso do computador.

O símbolo identifica a listagem neste marco. ISIN não é presumido. A futura distinção entre fundo, classes e múltiplas listagens terá migração explícita da base. `kind=nav` impede tratar o fundo como instrumento intradiário.

## Backup

JSON: `format=patrimonio-local`, `version=1`, `exportedAt`, `instruments`, `quotes`, `history`, `settings`. A validação rejeita versões desconhecidas, tipos inválidos, referências a instrumentos inexistentes e identificadores repetidos. Restauro integral e transacional, com pré-visualização e exportação do estado anterior. Limite de ficheiro na interface: 30 MB neste marco.

CSV de backup: UTF-8 com BOM, delimitador `;`, colunas `entity;payload`. Cada payload é JSON devidamente escapado segundo as regras CSV. Há um manifesto, uma configuração e linhas de instrumentos/cotações/histórico. Este formato conserva metadados aninhados e permite um round-trip integral. O CSV de cotações abaixo destina-se à edição manual numa folha de cálculo.

## CSV de cotações

Cabeçalho obrigatório: `symbol;as_of;price;currency;source`. Campos opcionais: `name;isin;ter_percent`. Pode usar vírgula como delimitador, com os valores decimais devidamente entre aspas. Aspas escapadas e campos multilinha são suportados.

- `symbol`: símbolo Yahoo, normalizado para maiúsculas.
- `as_of`: data e hora ISO com fuso; observações futuras são rejeitadas.
- `price`: valor positivo, aceitando vírgula decimal; não misturar ponto e vírgula no mesmo número.
- `currency`: código monetário ISO suportado, sem inferência a partir do símbolo.
- `source`: nome da origem efetivamente consultada pelo utilizador.
- `name`, `isin`: informação proveniente dessa fonte, quando disponível.
- `ter_percent`: percentagem anual; `0,20` converte para fração `0.002`.

O ficheiro-modelo não contém preços de exemplo. Uma importação inválida não grava parcialmente linhas. Repetições do mesmo símbolo e instante dentro do ficheiro são contadas; prevalece a última. Reimportar o mesmo instante substitui o registo importado, sem duplicar. A prioridade manual mantém-se.

## Privacidade e valores

Apenas símbolos e consultas públicas passam pelo proxy. A aplicação não envia o conteúdo da base para serviços externos. O modo de ocultação é visual, não cifra IndexedDB ou exportações. Evite partilhar ficheiros de backup.

Neste marco, cotações são valores numéricos de mercado. Montantes contabilísticos e quantidades de transações, no Marco 2, terão representação decimal e regras próprias de arredondamento.
