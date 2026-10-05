import { instrumentSchema, quoteSchema } from '../../../../packages/domain';
import type { YahooPlan } from '../../../../packages/import-export/yahoo';
import { db } from './db';
import { saveTransactions } from './ledger';

export async function saveYahooPlan(plan: YahooPlan, store = db) {
  await store.transaction('rw', [store.instruments, store.quotes, store.transactions, store.portfolios], async () => {
    for (const symbol of plan.symbols) if (!await store.instruments.get(symbol)) await store.instruments.put(instrumentSchema.parse({ symbol, kind: symbol === '0P0001PBB6.F' ? 'nav' : 'exchange', manualOverride: false, createdAt: new Date().toISOString() }));
    await saveTransactions(plan.transactions, store);
    for (const quote of plan.quotes) {
      const old = await store.quotes.get(quote.id);
      if (old && (old.price !== quote.price || old.currency !== quote.currency)) throw new Error(`${quote.symbol}: a cotação deste instante já existe com outro preço ou moeda.`);
      await store.quotes.put(quoteSchema.parse(quote));
    }
  });
}
