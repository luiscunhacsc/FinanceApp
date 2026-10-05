# Validação do Marco 1

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
