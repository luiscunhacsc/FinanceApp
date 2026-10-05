import { currencySchema, isoDate, quoteSchema, symbolSchema, type Quote } from '../domain';
import { inputDecimal, lisbonDay, transactionDefaults, transactionSchema, type Transaction } from '../domain/ledger';
import { parseCSV } from './index';

const required = ['Symbol', 'Trade Date', 'Purchase Price', 'Quantity', 'Commission', 'Comment', 'Transaction Type'];
export interface YahooRow { line: number; symbol: string; day: string; kind: 'buy' | 'sell'; quantity: string; price: string; fee: string | null; note: string }
export interface YahooSnapshot { symbol: string; price: number; at: string }
export interface YahooFile { rows: YahooRow[]; snapshots: YahooSnapshot[]; warnings: string[]; symbols: string[] }
export interface YahooOptions { portfolioId: string; currencies: Record<string, string>; fees: Record<number, string>; fxRates: Record<number, string>; blankFeesAreZero: boolean; confirmConventions: boolean; includeQuotes: boolean }
export interface YahooPlan { transactions: Transaction[]; quotes: Quote[]; symbols: string[]; duplicates: number }

export function isYahooCSV(text: string) { const header = parseCSV(text)[0]; return !!header && required.every(key => header.map(v => v.trim()).includes(key)); }
function positive(value: string) { const result = inputDecimal(value); if (Number(result) <= 0) throw new Error('Quantidade e preço têm de ser positivos.'); return result; }
function tradeDay(value: string) {
  if (!/^\d{8}$/.test(value)) throw new Error('Trade Date deve usar AAAAMMDD.');
  return isoDate.parse(`${value.slice(0, 4)}-${value.slice(4, 6)}-${value.slice(6)}`);
}
export function yahooQuoteInstant(day: string, time: string) {
  const date = isoDate.parse(day.replaceAll('/', '-'));
  const match = /^(\d{2}):(\d{2})(?::(\d{2}))?\s+(UTC|GMT|CET|CEST)$/.exec(time);
  if (!match || Number(match[1]) > 23 || Number(match[2]) > 59 || Number(match[3] ?? '0') > 59) throw new Error('Hora/fuso de cotação não reconhecido (UTC, GMT, CET ou CEST).');
  const offset = ({ UTC: 'Z', GMT: 'Z', CET: '+01:00', CEST: '+02:00' })[match[4] as 'UTC'];
  return new Date(`${date}T${match[1]}:${match[2]}:${match[3] ?? '00'}${offset}`).toISOString();
}
export function parseYahooCSV(text: string, now = new Date().toISOString()): YahooFile {
  const csv = parseCSV(text); const header = csv[0]?.map(v => v.trim());
  if (!header || new Set(header).size !== header.length || !required.every(key => header.includes(key))) throw new Error('Cabeçalho Yahoo não reconhecido. Exporte as transações com Transaction Type.');
  if (csv.length < 2 || csv.length > 10001) throw new Error('Importe entre 1 e 10 000 linhas.');
  const rows: YahooRow[] = []; const snapshots = new Map<string, YahooSnapshot>(); const warnings = new Set<string>();
  for (const [index, row] of csv.slice(1).entries()) {
    const line = index + 2;
    try {
      if (row.length !== header.length) throw new Error('Número de colunas incorreto.');
      const cell = (key: string) => row[header.indexOf(key)]?.trim() ?? '';
      const symbol = symbolSchema.parse(cell('Symbol')); const type = cell('Transaction Type');
      if (type !== 'BUY' && type !== 'SELL') throw new Error(`Tipo ${type || 'vazio'} não suportado. Esta importação aceita BUY e SELL, sem vendas a descoberto.`);
      const day = tradeDay(cell('Trade Date'));
      if (day < '1900-01-01' || day > lisbonDay(now)) throw new Error('Data da operação fora do intervalo permitido.');
      const note = cell('Comment'); if (note.length > 700) throw new Error('Comentário demasiado longo (máximo 700 caracteres).');
      rows.push({ line, symbol, day, kind: type === 'BUY' ? 'buy' : 'sell', quantity: positive(cell('Quantity')), price: positive(cell('Purchase Price')), fee: cell('Commission') === '' ? null : inputDecimal(cell('Commission')), note });
      if (cell('High Limit') || cell('Low Limit')) warnings.add('High Limit e Low Limit não são importados como alertas.');
      let snapshot: YahooSnapshot | undefined;
      try {
        const at = yahooQuoteInstant(cell('Date'), cell('Time'));
        if (Date.parse(at) > Date.parse(now)) throw new Error('Data da cotação no futuro.');
        snapshot = { symbol, price: Number(positive(cell('Current Price'))), at };
      } catch { warnings.add(`${symbol}: cotação não importável por falta de preço, data ou fuso reconhecido. As transações continuam disponíveis.`); }
      if (snapshot) {
        const key = `${symbol}:${snapshot.at}`; const old = snapshots.get(key);
        if (old && old.price !== snapshot.price) throw new Error('Cotações contraditórias para o mesmo símbolo e instante.');
        snapshots.set(key, snapshot);
      }
    } catch (error) { throw new Error(`Linha ${line}: ${error instanceof Error ? error.message : 'Dados inválidos.'}`); }
  }
  return { rows, snapshots: [...snapshots.values()], warnings: [...warnings], symbols: [...new Set(rows.map(r => r.symbol))] };
}
const comparison = (t: Transaction) => JSON.stringify([t.portfolioId, t.symbol, t.at, t.kind, t.quantity, t.price, t.fee, t.currency, t.fxRate]);
async function digest(text: string) { return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))), b => b.toString(16).padStart(2, '0')).join(''); }
export async function buildYahooPlan(file: YahooFile, options: YahooOptions, existing: Transaction[], now = new Date().toISOString()): Promise<YahooPlan> {
  if (!options.confirmConventions) throw new Error('Confirme as convenções de data e preço da venda.');
  if (!options.portfolioId) throw new Error('Escolha a carteira de destino.');
  const currencies = Object.fromEntries(file.symbols.map(symbol => [symbol, currencySchema.parse(options.currencies[symbol]?.trim().toUpperCase())]));
  const occurrences = new Map<string, number>(); const transactions: Transaction[] = []; let duplicates = 0;
  const byId = new Map(existing.map(t => [t.id, t]));
  // Preços atuais, linha, comentários e ordem do ficheiro não alteram a identidade financeira.
  const hashes = await Promise.all(file.rows.map(row => digest(JSON.stringify([options.portfolioId, row.symbol, row.day, row.kind, row.quantity, row.price, row.fee]))));
  let order = existing.reduce((max, t) => Math.max(max, t.order), 0);
  for (const [index, row] of file.rows.entries()) {
    const hash = hashes[index]; const count = (occurrences.get(hash) ?? 0) + 1; occurrences.set(hash, count);
    const id = `yahoo1:${hash}:${count}`; const currency = currencies[row.symbol];
    const fee = row.fee ?? (options.fees[row.line]?.trim() ? inputDecimal(options.fees[row.line]) : options.blankFeesAreZero ? '0' : undefined);
    if (fee === undefined) throw new Error(`Linha ${row.line}: indique a comissão em falta ou confirme que é zero.`);
    if (currency !== 'EUR' && !options.fxRates[row.line]?.trim()) throw new Error(`Linha ${row.line}: indique o câmbio de execução EUR/${currency}.`);
    const old = byId.get(id);
    const t = transactionSchema.parse({ ...transactionDefaults, id, portfolioId: options.portfolioId, symbol: row.symbol, kind: row.kind, quantity: row.quantity, price: row.price, fee, currency,
      fxRate: currency === 'EUR' ? '1' : inputDecimal(options.fxRates[row.line]), at: `${row.day}T12:00:00.000Z`, order: old?.order ?? ++order, createdAt: now, origin: 'imported',
      note: `Yahoo CSV · data sem hora; 12:00 UTC convencional · moeda confirmada${row.fee === null ? '; comissão confirmada pelo utilizador' : ''}${row.note ? ` · ${row.note}` : ''}` });
    if (old) { if (comparison(old) !== comparison(t)) throw new Error(`Linha ${row.line}: movimento Yahoo já importado com moeda, comissão ou câmbio diferentes. Edite o registo existente.`); duplicates++; continue; }
    if (existing.some(e => !e.id.startsWith('yahoo1:') && e.portfolioId === t.portfolioId && e.symbol === t.symbol && e.kind === t.kind && lisbonDay(e.at) === row.day && inputDecimal(e.quantity) === t.quantity && inputDecimal(e.price) === t.price)) throw new Error(`Linha ${row.line}: existe um movimento semelhante registado por outra via. Reconcilie-o antes de importar para evitar duplicação.`);
    transactions.push(t);
  }
  transactions.sort((a, b) => Date.parse(a.at) - Date.parse(b.at) || a.order - b.order);
  const quotes = options.includeQuotes ? file.snapshots.map(q => quoteSchema.parse({ id: `yahoo-csv:${q.symbol}:${q.at}`, symbol: q.symbol, price: q.price, currency: currencies[q.symbol], source: { name: 'Yahoo Finance · CSV; moeda confirmada pelo utilizador', nature: 'imported', asOf: q.at, retrievedAt: now } })) : [];
  return { transactions, quotes, symbols: file.symbols, duplicates };
}
