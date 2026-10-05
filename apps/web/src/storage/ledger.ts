import { db, type PortfolioDB } from './db';
import { transactionSchema, portfolioSchema, type Transaction } from '../../../../packages/domain/ledger';
import { replayLedger } from '../../../../packages/quantitative/ledger';

export async function saveTransactions(incoming: Transaction[], store = db, replace = false) {
  const parsed = incoming.map(t => transactionSchema.parse(t));
  if (parsed.some(t => Date.parse(t.at) > Date.now() || Date.parse(t.at) < Date.parse('1900-01-01T00:00:00Z'))) throw new Error('Use datas entre 1900 e o momento atual.');
  await store.transaction('rw', [store.transactions, store.portfolios, store.instruments], async () => {
    const portfolios = await store.portfolios.toArray(); const existing = await store.transactions.toArray();
    const symbols = new Set((await store.instruments.toArray()).map(i => i.symbol));
    if (parsed.some(t => t.symbol && !symbols.has(t.symbol))) throw new Error('Adicione primeiro o símbolo em Instrumentos.');
    if (!replace && parsed.some(t => existing.some(e => e.id === t.id))) throw new Error('Uma transação já existe. Reveja os duplicados.');
    let nextOrder = existing.reduce((max, t) => Math.max(max, t.order), 0);
    const ordered = parsed.map(t => ({ ...t, order: existing.find(old => old.id === t.id)?.order ?? ++nextOrder }));
    const ids = new Set(ordered.map(t => t.id));
    replayLedger(portfolios, [...existing.filter(t => !ids.has(t.id)), ...ordered]);
    await store.transactions.bulkPut(ordered);
  });
}
export async function removeTransaction(id: string, store = db) {
  await store.transaction('rw', [store.transactions, store.portfolios], async () => {
    const remaining = (await store.transactions.toArray()).filter(t => t.id !== id);
    replayLedger(await store.portfolios.toArray(), remaining);
    await store.transactions.delete(id);
  });
}
export async function savePortfolio(name: string, id?: string, store: PortfolioDB = db) {
  const existing = id ? await store.portfolios.get(id) : undefined;
  const portfolio = portfolioSchema.parse({ id: id ?? crypto.randomUUID(), name, createdAt: existing?.createdAt ?? new Date().toISOString() });
  await store.transaction('rw', store.portfolios, async () => {
    if ((await store.portfolios.toArray()).some(p => p.id !== portfolio.id && p.name.toLocaleLowerCase('pt-PT') === portfolio.name.toLocaleLowerCase('pt-PT'))) throw new Error('Já existe uma carteira com este nome.');
    await store.portfolios.put(portfolio);
  });
  return portfolio.id;
}
export async function removePortfolio(id: string, store = db) {
  await store.transaction('rw', [store.transactions, store.portfolios], async () => {
    if ((await store.transactions.toArray()).some(t => t.portfolioId === id || t.toPortfolioId === id)) throw new Error('Esta carteira tem movimentos. Remova-os primeiro, se pretender eliminá-la.');
    await store.portfolios.delete(id);
  });
}
