import { z } from 'zod';
import { portfolioSchema, transactionSchema, fxSchema } from './ledger';

export const SYMBOLS = ['VGLA.DE', 'VWCE.DE', 'VWCG.DE', 'VUAA.DE', 'SXR8.DE', 'QDVE.DE', 'SMH.MI', '0P0001PBB6.F'];
export const symbolSchema = z.string().trim().toUpperCase().regex(/^[A-Z0-9^][A-Z0-9.^=_-]{0,39}$/, 'Símbolo inválido.');
export const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(v => Number.isFinite(Date.parse(v)) && new Date(v).toISOString().slice(0, 10) === v, 'Data inválida.');
export const timestamp = z.string().datetime({ offset: true });
export const currencySchema = z.string().regex(/^[A-Z]{3}$/).refine(v => Intl.supportedValuesOf('currency').includes(v), 'Moeda ISO 4217 não reconhecida.');
export const sourceSchema = z.object({
  name: z.string().trim().min(1).max(200),
  nature: z.enum(['observed', 'manual', 'imported']),
  asOf: timestamp,
  retrievedAt: timestamp,
}).strict();
const textField = z.object({ value: z.string().trim().min(1).max(300), source: sourceSchema }).strict();
export const instrumentSchema = z.object({
  symbol: symbolSchema,
  kind: z.enum(['exchange', 'nav']),
  name: textField.optional(),
  isin: z.object({ value: z.string().regex(/^[A-Z]{2}[A-Z0-9]{9}\d$/), source: sourceSchema }).strict().optional(),
  currency: z.object({ value: currencySchema, source: sourceSchema }).strict().optional(),
  ter: z.object({ value: z.number().finite().min(0).max(1), source: sourceSchema }).strict().optional(),
  exchange: textField.optional(),
  timezone: textField.optional(),
  manualOverride: z.boolean(),
  createdAt: timestamp,
}).strict();
export const quoteSchema = z.object({
  id: z.string().min(1).max(200), symbol: symbolSchema,
  price: z.number().finite().positive(), currency: currencySchema,
  previousClose: z.number().finite().positive().optional(),
  previousAsOf: timestamp.optional(),
  source: sourceSchema,
}).strict();
export const pointSchema = z.object({
  id: z.string().min(1).max(200), symbol: symbolSchema, date: isoDate,
  close: z.number().finite().positive(), adjustedClose: z.number().finite().positive().optional(),
  currency: currencySchema, source: sourceSchema,
}).strict();
export function validProxyUrl(value: string): boolean {
  if (!value) return true;
  try {
    const url = new URL(value);
    return (url.protocol === 'https:' || (url.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(url.hostname))) && !url.username && !url.password && !url.search && !url.hash && (url.pathname === '/' || url.pathname === '');
  } catch { return false; }
}
export const settingsSchema = z.object({
  id: z.literal('main'), theme: z.enum(['light', 'dark', 'system']), hideValues: z.boolean(),
  proxyUrl: z.string().refine(validProxyUrl, 'Use o endereço HTTPS do Worker, sem caminho ou parâmetros.'),
  onboardingDone: z.boolean(),
}).strict();
const legacyBackupSchema = z.object({
  format: z.literal('patrimonio-local'), version: z.literal(1), exportedAt: timestamp,
  instruments: z.array(instrumentSchema).max(1000), quotes: z.array(quoteSchema).max(100000),
  history: z.array(pointSchema).max(500000), settings: settingsSchema,
}).strict().superRefine((data, ctx) => {
  const symbols = new Set(data.instruments.map(i => i.symbol));
  if (symbols.size !== data.instruments.length) ctx.addIssue({ code: 'custom', message: 'Símbolos duplicados.' });
  for (const [key, records] of [['quotes', data.quotes], ['history', data.history]] as const) {
    if (new Set(records.map(r => r.id)).size !== records.length) ctx.addIssue({ code: 'custom', message: `Identificadores duplicados em ${key}.` });
    if (records.some(r => !symbols.has(r.symbol))) ctx.addIssue({ code: 'custom', message: `Instrumento desconhecido em ${key}.` });
  }
});
const currentBackupSchema = z.object({
  format: z.literal('patrimonio-local'), version: z.literal(2), exportedAt: timestamp,
  instruments: z.array(instrumentSchema).max(1000), quotes: z.array(quoteSchema).max(100000),
  history: z.array(pointSchema).max(500000), settings: settingsSchema,
  portfolios: z.array(portfolioSchema).max(100), transactions: z.array(transactionSchema).max(100000),
  fxRates: z.array(fxSchema).max(100000), watchlist: z.array(symbolSchema).max(1000),
}).strict().superRefine((data, ctx) => {
  const symbols = new Set(data.instruments.map(i => i.symbol));
  const portfolios = new Set(data.portfolios.map(p => p.id));
  const fail = (message: string) => ctx.addIssue({ code: 'custom', message });
  if (symbols.size !== data.instruments.length || portfolios.size !== data.portfolios.length || new Set(data.watchlist).size !== data.watchlist.length) fail('Identificadores repetidos.');
  for (const records of [data.quotes, data.history, data.transactions, data.fxRates]) if (new Set(records.map(r => r.id)).size !== records.length) fail('Identificadores de registos repetidos.');
  if ([...data.quotes, ...data.history].some(r => !symbols.has(r.symbol)) || data.watchlist.some(s => !symbols.has(s))) fail('Instrumento desconhecido.');
  if (data.transactions.some(t => !portfolios.has(t.portfolioId) || t.toPortfolioId && !portfolios.has(t.toPortfolioId) || t.symbol && !symbols.has(t.symbol))) fail('Referência de transação inexistente.');
});
export const backupSchema = z.union([currentBackupSchema, legacyBackupSchema.transform(data => ({ ...data, version: 2 as const, portfolios: [], transactions: [], fxRates: [], watchlist: [] }))]);
export type Instrument = z.infer<typeof instrumentSchema>;
export type Quote = z.infer<typeof quoteSchema>;
export type HistoryPoint = z.infer<typeof pointSchema>;
export type Settings = z.infer<typeof settingsSchema>;
export type Backup = z.infer<typeof backupSchema>;
export type Source = z.infer<typeof sourceSchema>;
export const defaultSettings: Settings = { id: 'main', theme: 'system', hideValues: false, proxyUrl: '', onboardingDone: false };
export const initialInstruments = (): Instrument[] => SYMBOLS.map(symbol => ({ symbol, kind: symbol === '0P0001PBB6.F' ? 'nav' : 'exchange', manualOverride: false, createdAt: new Date().toISOString() }));

export function selectQuote(instrument: Instrument, quotes: Quote[]): Quote | undefined {
  const matching = quotes.filter(q => q.symbol === instrument.symbol);
  const manual = matching.filter(q => q.source.nature === 'manual');
  const eligible = instrument.manualOverride && manual.length ? manual : matching.filter(q => q.source.nature !== 'manual');
  return eligible.sort((a, b) => Date.parse(b.source.asOf) - Date.parse(a.source.asOf) || Date.parse(b.source.retrievedAt) - Date.parse(a.source.retrievedAt))[0];
}
export function quoteAge(quote: Quote, now = Date.now()): number {
  return Math.max(0, Math.floor((now - Date.parse(quote.source.asOf)) / 86400000));
}
export const natureLabel = (nature: Source['nature']) => ({ observed: 'Observado', manual: 'Manual', imported: 'Importado' })[nature];
