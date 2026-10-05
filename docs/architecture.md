# Arquitetura do Marco 1

Extensão no Marco 2: `packages/domain/ledger.ts` define as entidades contabilísticas, `packages/quantitative/decimal.ts` e `ledger.ts` reconciliam os movimentos com BigInt e `portfolio.ts` calcula o painel num Web Worker. `apps/web/src/features/portfolio` contém as vistas de carteira, transações e observação. A base local tem migração para versão 2. Veja [as regras e limites atuais](milestone2.md).

React e TypeScript apresentam a interface; Vite produz ficheiros estáticos. O service worker gerado por Workbox pré-carrega os recursos da aplicação, incluindo o módulo de gráficos. A atualização exige confirmação na interface. Não se guardam respostas de APIs em caches genéricas do service worker: os dados validados persistem explicitamente em IndexedDB.

`packages/domain` define os contratos Zod, tipos, proveniência, formatação e seleção de preços. `packages/data-sources` contém a interface MarketDataProvider, os adaptadores Yahoo/importação e o normalizador Yahoo. `packages/import-export` trata CSV, backups e validação. `packages/quantitative` contém o resumo de séries deste marco.

`apps/web/src/storage` encapsula IndexedDB com Dexie. A inicialização e o restauro usam transações. As consultas reativas atualizam a interface depois de gravar. Falhas de consulta não modificam preços locais. Preços manuais são observações separadas: a prioridade é uma preferência do instrumento, não uma substituição destrutiva dos dados da fonte.

O Web Worker calcula os extremos do histórico em detalhe e fornece o ponto de entrada para os motores quantitativos futuros. O gráfico ECharts é carregado apenas quando necessário. Não usa suavização que sugira preços não observados.

O Worker Cloudflare é independente do site. Só aceita GET/OPTIONS, símbolos validados e origens configuradas. O destino, intervalo e período Yahoo são fixos; nenhuma chave secreta é colocada no frontend. Cache pública de dados de mercado, sem base de dados, sem dados pessoais, sem cron. Os cabeçalhos CORS são aplicados depois da leitura da cache.

O funcionamento gratuito depende de manter a conta no plano Free. Não existem bindings de produtos pagos, chamadas a APIs pagas ou subscrições criadas pelo projeto. O fallback local está sempre disponível.

## Limites do marco

O gráfico representa preços de um instrumento na moeda original, não valor da carteira, retorno total ou comparação cambial. A primeira fonte fornece até dois anos de histórico diário. A carteira começa sem transações nem saldos inventados. Os restantes módulos não são apresentados como funcionais.
