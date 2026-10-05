import { afterEach, expect, it } from 'vitest';
import { buildYahooPlan, isYahooCSV, parseYahooCSV, yahooQuoteInstant, type YahooOptions } from '../packages/import-export/yahoo';
import { transactionDefaults, type Transaction } from '../packages/domain/ledger';
import { PortfolioDB, initialize, createBackup, restoreBackup } from '../apps/web/src/storage/db';
import { savePortfolio, saveTransactions } from '../apps/web/src/storage/ledger';
import { saveYahooPlan } from '../apps/web/src/storage/yahoo';
const now = '2025-10-05T18:00:00Z';
const header = 'Symbol,Current Price,Date,Time,Change,Open,High,Low,Volume,Trade Date,Purchase Price,Quantity,Commission,High Limit,Low Limit,Comment,Transaction Type';
// Exclusivamente dados sintéticos. Nunca copiar o CSV pessoal para o repositório.
const row = (fields: Record<string, string> = {}) => {
  const values: Record<string, string> = { Symbol: 'TEST.DE', 'Current Price': '14', Date: '2025/10/03', Time: '17:35 CEST', 'Trade Date': '20250901', 'Purchase Price': '10', Quantity: '10', Commission: '2', Comment: 'Exemplo sintético', 'Transaction Type': 'BUY', ...fields };
  return header.split(',').map(key => `"${(values[key] ?? '').replaceAll('"', '""')}"`).join(',');
};
const csv = (...rows: string[]) => header + '\r\n' + rows.join('\r\n');
const options: YahooOptions = { portfolioId: 'a', currencies: { 'TEST.DE': 'EUR', '0P0001PBB6.F': 'EUR' }, fees: {}, fxRates: {}, blankFeesAreZero: false, confirmConventions: true, includeQuotes: true };
const deposit = (portfolioId: string): Transaction => ({ ...transactionDefaults, id: 'funding', portfolioId, kind: 'deposit', amount: '1000', at: '2025-01-01T00:00:00Z', createdAt: now, origin: 'manual', order: 1 });

it('deteta Yahoo, lê BOM/CRLF/aspas e mantém comentários como texto', () => {
  const text = '\uFEFF' + csv(row({ Comment: '=HYPERLINK("https://example.test", "texto, não instruções")\nSegunda linha' }));
  expect(isYahooCSV(text)).toBe(true); expect(isYahooCSV('id;portfolio\n1;a')).toBe(false);
  expect(parseYahooCSV(text, now).rows[0].note).toContain('texto, não instruções');
});
it('separa execução de cotação, preserva frações e NAV atrasado sem volume', async () => {
  const file = parseYahooCSV(csv(row(), row({ Symbol: '0P0001PBB6.F', Quantity: '2.5', 'Purchase Price': '4', 'Current Price': '5', Date: '2025/09/30', Time: '22:00 CEST', Commission: '0' })), now);
  const plan = await buildYahooPlan(file, options, [], now);
  expect(plan.transactions[0]).toMatchObject({ price: '10', quantity: '10', fee: '2', at: '2025-09-01T12:00:00.000Z', origin: 'imported' });
  expect(plan.quotes[0]).toMatchObject({ price: 14, source: { nature: 'imported', asOf: '2025-10-03T15:35:00.000Z' } });
  expect(plan.quotes[1].source.asOf).toBe('2025-09-30T20:00:00.000Z'); expect(plan.transactions[1].quantity).toBe('2.5');
  expect(plan.transactions.every(t => t.kind === 'buy')).toBe(true);
});
it('exige confirmação, moeda, comissão vazia e câmbio estrangeiro', async () => {
  const file = parseYahooCSV(csv(row({ Commission: '' })), now);
  await expect(buildYahooPlan(file, { ...options, confirmConventions: false }, [], now)).rejects.toThrow('Confirme');
  await expect(buildYahooPlan(file, { ...options, currencies: {} }, [], now)).rejects.toThrow();
  await expect(buildYahooPlan(file, options, [], now)).rejects.toThrow('comissão em falta');
  const explicit = { ...options, fees: { 2: '3,50' }, currencies: { 'TEST.DE': 'USD' } };
  await expect(buildYahooPlan(file, explicit, [], now)).rejects.toThrow('câmbio');
  expect((await buildYahooPlan(file, { ...explicit, fxRates: { 2: '0,9' } }, [], now)).transactions[0]).toMatchObject({ fee: '3.5', fxRate: '0.9' });
  expect((await buildYahooPlan(file, { ...options, blankFeesAreZero: true }, [], now)).transactions[0].fee).toBe('0');
});
it('reimportação mantém identidade com linhas reordenadas, novas cotações e multiplicidade', async () => {
  const first = await buildYahooPlan(parseYahooCSV(csv(row(), row(), row({ Quantity: '2' })), now), options, [], now);
  const again = parseYahooCSV(csv(row({ Quantity: '2', 'Current Price': '15' }), row({ 'Current Price': '15' }), row({ 'Current Price': '15' })), now);
  const repeated = await buildYahooPlan(again, options, first.transactions, now); expect(repeated.duplicates).toBe(3); expect(repeated.transactions).toHaveLength(0);
  const additional = await buildYahooPlan(parseYahooCSV(csv(row(), row(), row(), row({ Quantity: '2' })), now), options, first.transactions, now);
  expect(additional.transactions).toHaveLength(1); expect(new Set(first.transactions.map(t => t.id)).size).toBe(3);
  await expect(buildYahooPlan(again, { ...options, currencies: { 'TEST.DE': 'USD' }, fxRates: { 2: '0.9', 3: '0.9', 4: '0.9' } }, first.transactions, now)).rejects.toThrow('já importado');
});
it('bloqueia correspondências por outra via, datas inválidas, tipo desconhecido e quantidade negativa', async () => {
  const file = parseYahooCSV(csv(row()), now); const plan = await buildYahooPlan(file, options, [], now);
  await expect(buildYahooPlan(file, options, [{ ...plan.transactions[0], id: 'manual' }], now)).rejects.toThrow('outra via');
  expect(() => parseYahooCSV(csv(row({ 'Trade Date': '20250230' })), now)).toThrow('Linha 2');
  expect(() => parseYahooCSV(csv(row({ 'Transaction Type': 'SELL_SHORT' })), now)).toThrow('não suportado');
  expect(() => parseYahooCSV(csv(row({ Quantity: '-2' })), now)).toThrow();
  expect(() => parseYahooCSV(csv(row({ 'Trade Date': '20261001' })), now)).toThrow('intervalo');
});
it('não presume fusos desconhecidos, não usa cotação futura e rejeita snapshots contraditórios', () => {
  expect(yahooQuoteInstant('2025/01/03', '17:35 CET')).toBe('2025-01-03T16:35:00.000Z');
  const invalid = parseYahooCSV(csv(row({ Time: '17:35 XYZ' })), now); expect(invalid.snapshots).toHaveLength(0); expect(invalid.warnings).toHaveLength(1);
  expect(parseYahooCSV(csv(row({ Date: '2026/01/01' })), now).snapshots).toHaveLength(0);
  expect(() => parseYahooCSV(csv(row(), row({ 'Current Price': '16' })), now)).toThrow('contraditórias');
});
const stores: PortfolioDB[] = []; afterEach(async () => { await Promise.all(stores.splice(0).map(db => db.delete())); });
it('grava compras/vendas e cotações atomicamente, sem inventar fundos, e conserva backup', async () => {
  const db = new PortfolioDB(`yahoo-${crypto.randomUUID()}`); stores.push(db); await initialize(db); const id = await savePortfolio('Importação', undefined, db);
  const file = parseYahooCSV(csv(row({ 'Trade Date': '20250902', Quantity: '3', 'Purchase Price': '12', Commission: '1', 'Transaction Type': 'SELL' }), row()), now);
  const plan = await buildYahooPlan(file, { ...options, portfolioId: id }, [], now);
  expect(plan.transactions.map(t => t.kind)).toEqual(['buy', 'sell']);
  await expect(saveYahooPlan(plan, db)).rejects.toThrow('Saldo insuficiente');
  expect(await db.transactions.count()).toBe(0); expect(await db.quotes.count()).toBe(0); expect(await db.instruments.get('TEST.DE')).toBeUndefined();
  await saveTransactions([deposit(id)], db); await saveYahooPlan(plan, db);
  expect(await db.transactions.count()).toBe(3); expect(await db.quotes.count()).toBe(1);
  expect(await db.instruments.get('TEST.DE')).not.toHaveProperty('name');
  const restored = await createBackup(db); await restoreBackup(restored, db); expect(await db.transactions.count()).toBe(3);
  const repeat = await buildYahooPlan(file, { ...options, portfolioId: id }, await db.transactions.toArray(), now); await saveYahooPlan(repeat, db); expect(await db.transactions.count()).toBe(3);
});
it('conflito de cotação e venda excessiva não deixam gravações parciais', async () => {
  const db = new PortfolioDB(`yahoo-conflict-${crypto.randomUUID()}`); stores.push(db); await initialize(db); const id = await savePortfolio('Importação', undefined, db); await saveTransactions([deposit(id)], db);
  const make = async (text: string) => buildYahooPlan(parseYahooCSV(text, now), { ...options, portfolioId: id }, await db.transactions.toArray(), now);
  await expect(saveYahooPlan(await make(csv(row({ 'Transaction Type': 'SELL' }))), db)).rejects.toThrow('quantidade insuficiente');
  const buy = await make(csv(row())); await saveYahooPlan(buy, db);
  const conflict = await make(csv(row({ 'Trade Date': '20250902', 'Current Price': '15' })));
  await expect(saveYahooPlan(conflict, db)).rejects.toThrow('outro preço'); expect(await db.transactions.count()).toBe(2);
});
