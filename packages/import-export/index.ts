import { backupSchema, currencySchema, instrumentSchema, quoteSchema, symbolSchema, timestamp, type Backup, type Instrument, type Quote } from '../domain';
import { decimal } from '../domain/format';

export function parseCSV(input: string): string[][] {
  const text = input.replace(/^\uFEFF/, '');
  const delimiter = text.split(/\r?\n/, 1)[0].includes(';') ? ';' : ',';
  const rows: string[][] = []; let row: string[] = []; let field = ''; let quoted = false; let closed = false;
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (quoted) {
      if (char === '"' && text[i + 1] === '"') { field += '"'; i++; }
      else if (char === '"') { quoted = false; closed = true; }
      else field += char;
    } else if (char === '"' && field === '' && !closed) quoted = true;
    else if (char === delimiter) { row.push(field); field = ''; closed = false; }
    else if (char === '\n' || char === '\r') {
      if (char === '\r' && text[i + 1] === '\n') i++;
      row.push(field); if (row.some(v => v.length)) rows.push(row); row = []; field = ''; closed = false;
    } else {
      if (closed || char === '"') throw new Error('CSV inválido: aspas fora de posição.');
      field += char;
    }
  }
  if (quoted) throw new Error('CSV inválido: aspas por fechar.');
  row.push(field); if (row.some(v => v.length)) rows.push(row);
  return rows;
}
const csv = (rows: string[][]) => '\uFEFF' + rows.map(row => row.map(value => `"${value.replaceAll('"', '""')}"`).join(';')).join('\r\n');
export function backupToCSV(backup: Backup): string {
  return csv([
    ['entity', 'payload'],
    ['manifest', JSON.stringify({ format: backup.format, version: backup.version, exportedAt: backup.exportedAt })],
    ['settings', JSON.stringify(backup.settings)],
    ...backup.instruments.map(v => ['instrument', JSON.stringify(v)]),
    ...backup.quotes.map(v => ['quote', JSON.stringify(v)]),
    ...backup.history.map(v => ['history', JSON.stringify(v)]),
    ...backup.portfolios.map(v => ['portfolio', JSON.stringify(v)]),
    ...backup.transactions.map(v => ['transaction', JSON.stringify(v)]),
    ...backup.fxRates.map(v => ['fxRate', JSON.stringify(v)]),
    ...backup.watchlist.map(v => ['watchlist', JSON.stringify(v)]),
  ]);
}
export function backupFromText(text: string): Backup {
  if (text.trimStart().startsWith('{')) return backupSchema.parse(JSON.parse(text));
  const rows = parseCSV(text);
  if (rows[0]?.join('|') !== 'entity|payload') throw new Error('Este ficheiro não é um backup Património. Para preços, utilize Importar cotações.');
  const data: Record<string, unknown> = { instruments: [], quotes: [], history: [] }; let manifest = false; let settings = false;
  for (const row of rows.slice(1)) {
    if (row.length !== 2) throw new Error('Linha de backup CSV inválida.');
    const value = JSON.parse(row[1]);
    if (row[0] === 'manifest' && !manifest) {
      if (!value || Object.keys(value).sort().join(',') !== 'exportedAt,format,version') throw new Error('Manifesto inválido.');
      Object.assign(data, value); manifest = true;
      if (value.version === 2) { data.portfolios = []; data.transactions = []; data.fxRates = []; data.watchlist = []; }
    }
    else if (row[0] === 'settings' && !settings) { data.settings = value; settings = true; }
    else if (['instrument', 'quote', 'history', 'portfolio', 'transaction', 'fxRate', 'watchlist'].includes(row[0])) {
      const key = ({ instrument: 'instruments', quote: 'quotes', history: 'history', portfolio: 'portfolios', transaction: 'transactions', fxRate: 'fxRates', watchlist: 'watchlist' } as Record<string, string>)[row[0]];
      if (!Array.isArray(data[key])) throw new Error('Versão ou ordem do backup inválida.');
      (data[key] as unknown[]).push(value);
    } else throw new Error('Entidade inválida ou repetida no backup.');
  }
  if (!manifest || !settings) throw new Error('Backup incompleto.');
  return backupSchema.parse(data);
}
export function parseQuoteCSV(text: string, existing: Instrument[], now = new Date().toISOString()) {
  const rows = parseCSV(text);
  const header = rows[0]?.map(s => s.trim().toLowerCase());
  const required = ['symbol', 'as_of', 'price', 'currency', 'source'];
  const optional = ['name', 'isin', 'ter_percent'];
  if (!header || required.some(h => !header.includes(h)) || new Set(header).size !== header.length || header.some(h => ![...required, ...optional].includes(h))) throw new Error('Cabeçalho esperado: symbol;as_of;price;currency;source;name;isin;ter_percent');
  if (rows.length < 2) throw new Error('O ficheiro não contém cotações.');
  if (rows.length > 10001) throw new Error('Importe no máximo 10 000 linhas de cada vez.');
  const instruments = new Map(existing.map(i => [i.symbol, i])); const quotes = new Map<string, Quote>(); let duplicates = 0;
  for (const [index, row] of rows.slice(1).entries()) {
    try {
      if (row.length !== header.length) throw new Error('Número de colunas incorreto.');
      const cell = (name: string) => row[header.indexOf(name)]?.trim() || '';
      const symbol = symbolSchema.parse(cell('symbol'));
      const asOf = timestamp.parse(cell('as_of'));
      if (Date.parse(asOf) > Date.parse(now)) throw new Error('A data da cotação está no futuro.');
      const currency = currencySchema.parse(cell('currency').toUpperCase());
      const source = { name: cell('source'), nature: 'imported' as const, asOf, retrievedAt: now };
      const id = `${symbol}:import:${new Date(asOf).toISOString()}`;
      const quote = quoteSchema.parse({ id, symbol, price: decimal(cell('price')), currency, source });
      if (quotes.has(id)) duplicates++;
      quotes.set(id, quote);
      const old = instruments.get(symbol);
      instruments.set(symbol, instrumentSchema.parse({ ...old, symbol, kind: old?.kind ?? (symbol === '0P0001PBB6.F' ? 'nav' : 'exchange'), manualOverride: old?.manualOverride ?? false, createdAt: old?.createdAt ?? now,
        ...(cell('name') ? { name: { value: cell('name'), source } } : {}),
        ...(cell('isin') ? { isin: { value: cell('isin'), source } } : {}),
        ...(cell('ter_percent') ? { ter: { value: cell('ter_percent') === '0' ? 0 : decimal(cell('ter_percent')) / 100, source } } : {}),
        currency: { value: currency, source },
      }));
    } catch (error) { throw new Error(`Linha ${index + 2}: ${error instanceof Error ? error.message : 'Dados inválidos.'}`); }
  }
  return { instruments: [...instruments.values()].filter(i => [...quotes.values()].some(q => q.symbol === i.symbol)), quotes: [...quotes.values()], duplicates };
}
export function quoteTemplate(): string { return csv([['symbol', 'as_of', 'price', 'currency', 'source', 'name', 'isin', 'ter_percent']]); }
export function downloadFile(filename: string, content: string, type: string) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const anchor = document.createElement('a'); anchor.href = url; anchor.download = filename; anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
