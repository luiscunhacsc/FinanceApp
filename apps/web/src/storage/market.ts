import { YahooProvider } from '../../../../packages/data-sources';
import { db } from './db';

export async function refreshSymbol(symbol: string, proxyUrl: string): Promise<string[]> {
  const payload = await new YahooProvider(proxyUrl).getMarketData(symbol);
  await db.transaction('rw', [db.instruments, db.quotes, db.history], async () => {
    const old = await db.instruments.get(symbol);
    if (!old) throw new Error('Instrumento não encontrado.');
    const next = { ...old, ...Object.fromEntries(Object.entries(payload.instrument).filter(([, value]) => value !== undefined)), manualOverride: old.manualOverride, createdAt: old.createdAt };
    await db.instruments.put(next);
    if (payload.quote) await db.quotes.put(payload.quote);
    if (payload.history.length) await db.history.bulkPut(payload.history);
  });
  return payload.warnings;
}
