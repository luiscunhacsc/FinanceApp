# Validação

## Marco 2 — versão 0.2.0

Verificado em 05/10/2026, em Windows.

- `npm run check`: 43 testes unitários/de integração aprovados; TypeScript validado; compilação de produção e service worker gerados.
- Casos de resultado conhecido para caixa, FIFO, lote selecionado, comissões, vendas fracionadas, transferências, posições iniciais e valorização. Verificação de datas sem antecipação de preços, câmbios em falta e neutralização dos fluxos na variação monetária diária.
- Testes de migração de uma base IndexedDB versão 1, backups completos versão 2, aceitação de backups anteriores e alterações inválidas sem perda de movimentos.
- CSV: reimportação idêntica, conflitos, proteção de fórmulas e rejeição de compras sem moeda ou sem câmbio de execução em moeda estrangeira.
- `npm run test:e2e`: 8 percursos aprovados em Chromium. Os quatro percursos anteriores continuam aprovados; os novos cobrem carteira/compra/venda parcial/lotes/privacidade, saldo insuficiente/eliminação inválida, CSV/duplicados/transferências/observação e painel móvel.
- Inspeção visual do painel com posições, gráfico e saldos em 1440 px, nos temas claro e escuro, e em 390 px. No telemóvel, a largura do documento é 390 px; as tabelas têm deslocamento horizontal próprio. Nenhum erro de página foi registado no percurso visual.
- Capturas reproduzíveis com `node scripts/portfolio-preview.mjs` enquanto `npm run preview` estiver ativo. O perfil é isolado e os dados sintéticos ficam identificados; não são acrescentados à base do utilizador.

Os avisos não bloqueantes da compilação referem-se a módulos JavaScript acima de 500 kB e anotações de comentários na dependência Zod. O módulo de gráficos tem cerca de 531 kB antes de compressão (180 kB comprimido), é carregado quando necessário e fica disponível na cache offline. O service worker inclui 18 ficheiros, cerca de 1,18 MiB.

Aplicação e proxy repostos localmente nas portas 4173 e 8787. Nenhum serviço foi publicado e nenhum plano pago foi ativado. O proxy não foi alterado neste marco; os testes de navegador simulam a fonte de cotações. As consultas reais documentadas abaixo pertencem à validação do Marco 1.

## Marco 1 — registo da entrega anterior

Verificado em 05/10/2026, em Windows com Node.js 24.21.0.

- `npm run check`: 23 testes unitários/de integração aprovados; TypeScript validado; aplicação de produção e service worker gerados.
- `npm run test:e2e`: 4 percursos completos aprovados em Chromium: preço manual/persistência/privacidade/backup, CSV/restauro/offline, navegação móvel e consulta/histórico/prioridade manual.
- Inspeção visual em 1440 px e 390 px, com temas claro/escuro. A página inicial móvel tem largura de conteúdo de 390 px para viewport de 390 px; a tabela mantém deslocamento horizontal próprio.
- `npm run proxy:check`: Worker compilado em dry-run, sem publicação.
- Auditoria npm após a atualização do Vitest: zero vulnerabilidades reportadas.
- Consulta pública direta: os oito símbolos obrigatórios responderam com identidade, nome, moeda e tipo de instrumento.
- Consulta real pelo runtime local do Worker: `VWCE.DE` respondeu HTTP 200 com 503 observações; `0P0001PBB6.F` respondeu HTTP 200 com 469 observações e tipo NAV. O último NAV disponível tinha data de 30/09/2026, conservada na resposta. Estes números são evidência desta verificação, não valores fixos da aplicação.

Os testes de navegador usam dados sintéticos identificados, em contextos isolados. Não criam posições ou saldos na base do utilizador. As capturas locais podem ser regeneradas com `node scripts/preview-check.mjs` enquanto `npm run preview` estiver ativo.

A compilação avisa sobre o tamanho do módulo de gráficos ECharts (aproximadamente 532 kB antes de compressão; 181 kB comprimido). Esse módulo é carregado apenas quando um gráfico é aberto e é incluído na cache offline. O aviso não impede a compilação.

Não foi feita uma publicação externa. O funcionamento no serviço Cloudflare alojado depende da configuração da origem autorizada e da disponibilidade do Yahoo nesse ambiente; a API é não oficial. Existe alternativa local com importação e preços manuais.
