import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { PortfolioDB, createBackup, initialize, restoreBackup, saveManualQuote } from '../apps/web/src/storage/db';
let store: PortfolioDB;
beforeEach(async () => { store = new PortfolioDB(`test-${crypto.randomUUID()}`); await initialize(store); });
afterEach(async () => { await store.delete(); });
describe('Persistência e restauro', () => {
  it('inicializa apenas uma vez e conserva dados entre aberturas', async () => {
    await store.instruments.add({ symbol: 'TEST', kind: 'exchange', manualOverride: false, createdAt: new Date().toISOString() });
    store.close(); await store.open(); await initialize(store); expect(await store.instruments.count()).toBe(9);
  });
  it('guarda um preço manual e restaura integralmente', async () => {
    const instrument = (await store.instruments.get('VWCE.DE'))!;
    await saveManualQuote(instrument, 123.45, 'EUR', '2025-01-01T12:00:00Z', store);
    const backup = await createBackup(store); await store.quotes.clear(); await restoreBackup(backup, store);
    expect(await store.quotes.count()).toBe(1); expect((await store.instruments.get('VWCE.DE'))?.manualOverride).toBe(true);
    const restored = await createBackup(store); expect(restored.quotes).toEqual(backup.quotes); expect(restored.instruments).toEqual(backup.instruments);
  });
  it('um backup inválido não altera o estado', async () => {
    const backup = await createBackup(store);
    await expect(restoreBackup({ ...backup, instruments: [], version: 7 }, store)).rejects.toThrow();
    expect(await store.instruments.count()).toBe(8);
  });
  it('valida preço e moeda antes de escrever', async () => {
    const instrument = (await store.instruments.get('VWCE.DE'))!;
    await expect(saveManualQuote(instrument, -1, 'EUR', '2025-01-01T12:00:00Z', store)).rejects.toThrow();
    await expect(saveManualQuote(instrument, 100, 'XXX', '2025-01-01T12:00:00Z', store)).rejects.toThrow();
    expect(await store.quotes.count()).toBe(0);
  });
});
