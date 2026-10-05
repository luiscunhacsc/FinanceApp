import { z } from 'zod';
import { instrumentSchema, pointSchema, quoteSchema, symbolSchema, validProxyUrl, type HistoryPoint, type Instrument, type Quote } from '../domain';

export const marketPayloadSchema = z.object({
  instrument: instrumentSchema, quote: quoteSchema.optional(), history: z.array(pointSchema).max(2000),
  warnings: z.array(z.string().max(500)).max(20),
});
export type MarketPayload = z.infer<typeof marketPayloadSchema>;
export interface MarketDataProvider {
  readonly name: string;
  getMarketData(symbol: string): Promise<MarketPayload>;
}
export class YahooProvider implements MarketDataProvider {
  readonly name = 'Yahoo Finance';
  constructor(private proxyUrl: string, private fetcher: typeof fetch = globalThis.fetch.bind(globalThis)) {
    if (!proxyUrl || !validProxyUrl(proxyUrl)) throw new Error('Configure um endereço válido para o Worker.');
  }
  async getMarketData(symbol: string) {
    const normalized = symbolSchema.parse(symbol);
    const response = await this.fetcher(`${this.proxyUrl.replace(/\/$/, '')}/api/market?symbol=${encodeURIComponent(normalized)}`, { signal: AbortSignal.timeout(18000), credentials: 'omit', referrerPolicy: 'no-referrer' });
    if (!response.ok) {
      if (response.status === 429) throw new Error('Limite gratuito ou limite da fonte atingido. Tente mais tarde; os dados locais mantêm-se.');
      throw new Error(`A fonte não respondeu (${response.status}). O último preço conhecido foi mantido.`);
    }
    const raw = await response.text();
    if (raw.length > 2_000_000) throw new Error('Resposta demasiado grande.');
    const payload = marketPayloadSchema.parse(JSON.parse(raw));
    if (payload.instrument.symbol !== normalized || payload.quote && payload.quote.symbol !== normalized || payload.history.some(p => p.symbol !== normalized)) throw new Error('A fonte devolveu um símbolo diferente do pedido.');
    return payload;
  }
}
export class ImportedProvider implements MarketDataProvider {
  readonly name = 'Importação local';
  constructor(private data: { instruments: Instrument[]; quotes: Quote[]; history: HistoryPoint[] }) {}
  async getMarketData(symbol: string): Promise<MarketPayload> {
    const instrument = this.data.instruments.find(i => i.symbol === symbol);
    if (!instrument) throw new Error('Símbolo não encontrado na importação.');
    const quote = this.data.quotes.filter(q => q.symbol === symbol).sort((a, b) => b.source.asOf.localeCompare(a.source.asOf))[0];
    return marketPayloadSchema.parse({ instrument, quote, history: this.data.history.filter(p => p.symbol === symbol), warnings: [] });
  }
}
