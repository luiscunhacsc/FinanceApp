import Dexie, { type EntityTable } from 'dexie';
import { backupSchema, defaultSettings, initialInstruments, instrumentSchema, quoteSchema, type Backup, type HistoryPoint, type Instrument, type Quote, type Settings } from '../../../../packages/domain';
import { type Portfolio, type Transaction, type FxRate } from '../../../../packages/domain/ledger';
import { replayLedger } from '../../../../packages/quantitative/ledger';

export class PortfolioDB extends Dexie {
  instruments!: EntityTable<Instrument, 'symbol'>;
  quotes!: EntityTable<Quote, 'id'>;
  history!: EntityTable<HistoryPoint, 'id'>;
  settings!: EntityTable<Settings, 'id'>;
  portfolios!: EntityTable<Portfolio, 'id'>;
  transactions!: EntityTable<Transaction, 'id'>;
  fxRates!: EntityTable<FxRate, 'id'>;
  watchlist!: EntityTable<{ symbol: string }, 'symbol'>;
  constructor(name = 'patrimonio-local') {
    super(name);
    this.version(1).stores({ instruments: 'symbol', quotes: 'id, symbol, [symbol+source.nature]', history: 'id, symbol, [symbol+date]', settings: 'id' });
    this.version(2).stores({ portfolios: 'id', transactions: 'id, portfolioId, at, symbol', fxRates: 'id, currency, at', watchlist: 'symbol' });
  }
}
export const db = new PortfolioDB();
export async function initialize(store = db) {
  await store.transaction('rw', [store.settings, store.instruments], async () => {
    if (!await store.settings.get('main')) {
      await store.settings.put(defaultSettings);
      await store.instruments.bulkPut(initialInstruments());
    }
  });
}
export async function createBackup(store = db): Promise<Backup> {
  return store.transaction('r', store.tables, async () => backupSchema.parse({
    format: 'patrimonio-local', version: 2, exportedAt: new Date().toISOString(),
    instruments: await store.instruments.toArray(), quotes: await store.quotes.toArray(),
    history: await store.history.toArray(), settings: await store.settings.get('main'),
    portfolios: await store.portfolios.toArray(), transactions: await store.transactions.toArray(), fxRates: await store.fxRates.toArray(), watchlist: (await store.watchlist.toArray()).map(i => i.symbol),
  }));
}
export async function restoreBackup(input: unknown, store = db) {
  const backup = backupSchema.parse(input);
  replayLedger(backup.portfolios, backup.transactions);
  await store.transaction('rw', store.tables, async () => {
    for (const table of store.tables) await table.clear();
    await store.instruments.bulkPut(backup.instruments); await store.quotes.bulkPut(backup.quotes);
    await store.history.bulkPut(backup.history); await store.settings.put(backup.settings);
    await store.portfolios.bulkPut(backup.portfolios); await store.transactions.bulkPut(backup.transactions); await store.fxRates.bulkPut(backup.fxRates); await store.watchlist.bulkPut(backup.watchlist.map(symbol => ({ symbol })));
  });
}
export async function saveManualQuote(instrument: Instrument, price: number, currency: string, asOf: string, store = db) {
  const quote = quoteSchema.parse({ id: crypto.randomUUID(), symbol: instrument.symbol, price, currency,
    source: { name: 'Introdução manual', nature: 'manual', asOf, retrievedAt: new Date().toISOString() } });
  await store.transaction('rw', [store.instruments, store.quotes], async () => {
    await store.quotes.put(quote);
    await store.instruments.put(instrumentSchema.parse({ ...instrument, manualOverride: true }));
  });
}
