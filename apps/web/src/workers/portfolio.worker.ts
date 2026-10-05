import { calculatePortfolio, type PortfolioInput } from '../../../../packages/quantitative/portfolio';
self.onmessage = (event: MessageEvent<PortfolioInput>) => {
  try { self.postMessage({ result: calculatePortfolio(event.data) }); }
  catch (error) { self.postMessage({ error: error instanceof Error ? error.message : 'Falha no cálculo da carteira.' }); }
};
