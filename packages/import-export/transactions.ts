import { parseCSV } from './index';
import { inputDecimal, transactionDefaults, transactionSchema, type Portfolio, type Transaction } from '../domain/ledger';
import { replayLedger } from '../quantitative/ledger';
const columns = ['id', 'portfolio', 'at', 'kind', 'symbol', 'quantity', 'price', 'currency', 'fx_rate', 'fee', 'amount', 'to_portfolio', 'lot_id', 'opening_value', 'note'];
const escape = (value: string) => `"${(/^[=+\-@\t\r]/.test(value) ? "'" + value : value).replaceAll('"', '""')}"`;
const encode = (rows: string[][]) => '\uFEFF' + rows.map(r => r.map(escape).join(';')).join('\r\n');
export function transactionsToCSV(transactions: Transaction[], portfolios: Portfolio[]) {
  const name = (id: string | undefined) => id ? portfolios.find(p => p.id === id)?.name ?? id : '';
  return encode([columns, ...transactions.map(t => [t.id, name(t.portfolioId), t.at, t.kind, t.symbol ?? '', t.quantity, t.price, t.currency, t.fxRate, t.fee, t.amount, name(t.toPortfolioId), t.lotId ?? '', t.openingValue, t.note])]);
}
export const transactionsTemplate = () => encode([columns]);
const comparable = (t: Transaction) => JSON.stringify([t.id, t.portfolioId, t.kind, new Date(t.at).toISOString(), t.symbol ?? '', inputDecimal(t.quantity), inputDecimal(t.price), inputDecimal(t.fee), inputDecimal(t.amount), t.currency, inputDecimal(t.fxRate), inputDecimal(t.openingValue), t.toPortfolioId ?? '', t.lotId ?? '', t.note]);
export function parseTransactionsCSV(text: string, portfolios: Portfolio[], existing: Transaction[], symbols: string[]) {
  const rows = parseCSV(text); const header = rows[0];
  if (!header || header.join('|') !== columns.join('|')) throw new Error('Use o modelo de transações, mantendo todas as colunas pela ordem indicada.');
  if (rows.length < 2 || rows.length > 10001) throw new Error('O CSV deve conter entre 1 e 10 000 movimentos.');
  const byId = new Map(existing.map(t => [t.id, t])); const pending: Transaction[] = []; let duplicates = 0;
  let order = Math.max(0, ...existing.map(t => t.order));
  const portfolioId = (name: string) => { const matches = portfolios.filter(p => p.name === name || p.id === name); if (matches.length !== 1) throw new Error(`Carteira não identificada: ${name}. Crie-a primeiro.`); return matches[0].id; };
  for (const [index, row] of rows.slice(1).entries()) {
    try {
      if (row.length !== columns.length) throw new Error('Número de colunas incorreto.');
      const cell = (name: string) => { const v = row[columns.indexOf(name)].trim(); return /^'[=+\-@\t\r]/.test(v) ? v.slice(1) : v; };
      const trade = ['buy', 'sell', 'opening'].includes(cell('kind'));
      if (trade && !cell('currency')) throw new Error('Indique a moeda da transação.');
      if (trade && cell('currency') !== 'EUR' && !cell('fx_rate')) throw new Error('Indique o câmbio de execução para a moeda estrangeira.');
      const transaction = transactionSchema.parse({ ...transactionDefaults, id: cell('id'), portfolioId: portfolioId(cell('portfolio')), at: cell('at'), kind: cell('kind'), symbol: cell('symbol') || undefined,
        quantity: inputDecimal(cell('quantity') || '0'), price: inputDecimal(cell('price') || '0'), fee: inputDecimal(cell('fee') || '0'), amount: inputDecimal(cell('amount') || '0'), currency: cell('currency') || 'EUR', fxRate: inputDecimal(cell('fx_rate') || '1'), openingValue: inputDecimal(cell('opening_value') || '0'),
        toPortfolioId: cell('to_portfolio') ? portfolioId(cell('to_portfolio')) : undefined, lotId: cell('lot_id') || undefined, note: cell('note'), order: ++order, origin: 'imported', createdAt: new Date().toISOString() });
      if (Date.parse(transaction.at) > Date.now()) throw new Error('Data futura.');
      if (transaction.symbol && !symbols.includes(transaction.symbol)) throw new Error('Adicione primeiro o símbolo em Instrumentos.');
      const old = byId.get(transaction.id);
      if (old) { if (comparable(old) !== comparable(transaction)) throw new Error(`O identificador ${transaction.id} já existe com dados diferentes.`); duplicates++; continue; }
      byId.set(transaction.id, transaction); pending.push(transaction);
    } catch (error) { throw new Error(`Linha ${index + 2}: ${error instanceof Error ? error.message : 'Dados inválidos.'}`); }
  }
  replayLedger(portfolios, [...existing, ...pending]);
  return { transactions: pending, duplicates };
}
