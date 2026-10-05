import Dexie from 'dexie';
import { afterEach, beforeEach, expect, it } from 'vitest';
import { PortfolioDB, initialize, createBackup, restoreBackup } from '../apps/web/src/storage/db';
import { savePortfolio, saveTransactions, removeTransaction } from '../apps/web/src/storage/ledger';
import { defaultSettings, initialInstruments } from '../packages/domain';
import { transactionDefaults, type Transaction } from '../packages/domain/ledger';
import { backupFromText, backupToCSV } from '../packages/import-export';
let db: PortfolioDB;
beforeEach(async () => { db = new PortfolioDB(`ledger-${crypto.randomUUID()}`); await initialize(db); });
afterEach(async () => db.delete());
const movement = (id: string, portfolioId: string, fields: Partial<Transaction> = {}): Transaction => ({ ...transactionDefaults, id, portfolioId, kind: 'deposit', amount: '1000', order: 1, at: '2025-01-01T12:00:00Z', createdAt: '2025-01-01T12:00:00Z', origin: 'manual', ...fields });
it('migra uma base real da versão 1 sem perder preços ou preferências', async () => {
  const name = `migration-${crypto.randomUUID()}`; const old = new Dexie(name);
  old.version(1).stores({ instruments: 'symbol', quotes: 'id, symbol, [symbol+source.nature]', history: 'id, symbol, [symbol+date]', settings: 'id' });
  await old.table('settings').put({ ...defaultSettings, hideValues: true }); await old.table('instruments').bulkPut(initialInstruments()); old.close();
  const next = new PortfolioDB(name); await next.open(); expect((await next.settings.get('main'))?.hideValues).toBe(true); expect(await next.instruments.count()).toBe(8); expect(await next.transactions.count()).toBe(0); await next.delete();
});
it('backup versão 2 restaura carteiras, movimentos, câmbios e observação', async () => {
  const id = await savePortfolio('Principal', undefined, db); await saveTransactions([movement('1', id)], db); await db.watchlist.put({ symbol: 'VWCE.DE' });
  await db.fxRates.put({ id: 'rate', currency: 'USD', rate: '0.9', at: '2025-01-01T12:00:00Z', source: 'Fixture', createdAt: '2025-01-01T12:00:00Z' });
  const backup = await createBackup(db); await restoreBackup(backupFromText(backupToCSV(backup)), db);
  expect(await db.transactions.count()).toBe(1); expect(await db.watchlist.count()).toBe(1); expect(await db.fxRates.count()).toBe(1); expect(backup.version).toBe(2);
});
it('aceita backup antigo e valida referências e saldo antes de restaurar', async () => {
  const now = new Date().toISOString(); const legacy = { format: 'patrimonio-local', version: 1, exportedAt: now, instruments: initialInstruments(), quotes: [], history: [], settings: defaultSettings };
  await restoreBackup(legacy, db); expect(await db.portfolios.count()).toBe(0);
  const id = await savePortfolio('Principal', undefined, db); await saveTransactions([movement('1', id)], db); const backup = await createBackup(db);
  await expect(restoreBackup({ ...backup, transactions: [movement('2', id, { kind: 'withdrawal', amount: '2000' })] }, db)).rejects.toThrow('Saldo insuficiente'); expect(await db.transactions.count()).toBe(1);
});
it('edições e remoções inválidas preservam a sequência original atomicamente', async () => {
  const id = await savePortfolio('Principal', undefined, db); const deposit = movement('1', id); const buy = movement('2', id, { kind: 'buy', symbol: 'VWCE.DE', quantity: '5', price: '100', amount: '0', order: 2 });
  await saveTransactions([deposit, buy], db);
  await expect(removeTransaction('1', db)).rejects.toThrow('Saldo insuficiente');
  await expect(saveTransactions([{ ...deposit, amount: '100' }], db, true)).rejects.toThrow('Saldo insuficiente');
  expect((await db.transactions.get('1'))?.amount).toBe('1000'); expect(await db.transactions.count()).toBe(2);
});
