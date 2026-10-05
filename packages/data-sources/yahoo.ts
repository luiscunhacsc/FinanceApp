import { currencySchema, symbolSchema, type HistoryPoint, type Instrument, type Quote, type Source } from '../domain';
import type { MarketPayload } from './index';

type YahooChart = { chart?: { error?: unknown; result?: Array<{
  meta?: Record<string, unknown>; timestamp?: number[];
  indicators?: { quote?: Array<{ close?: Array<number | null> }>; adjclose?: Array<{ adjclose?: Array<number | null> }> };
}> } };
const positive = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value) && value > 0;
const text = (value: unknown): string | undefined => typeof value === 'string' && value.trim() ? value.trim() : undefined;
export function normalizeYahoo(raw: unknown, requested: string, retrievedAt = new Date().toISOString()): MarketPayload {
  const symbol = symbolSchema.parse(requested);
  const data = raw as YahooChart;
  const result = data?.chart?.result?.[0];
  if (!result?.meta || data.chart?.error) throw new Error('Símbolo indisponível na fonte.');
  const meta = result.meta;
  if (typeof meta.symbol !== 'string' || meta.symbol.toUpperCase() !== symbol) throw new Error('Identidade do símbolo não confirmada pela fonte.');
  const nav = symbol === '0P0001PBB6.F' || meta.instrumentType === 'MUTUALFUND';
  const currency = currencySchema.safeParse(meta.currency);
  const origin: Source = { name: 'Yahoo Finance', nature: 'observed', asOf: retrievedAt, retrievedAt };
  const field = (value: unknown) => text(value) ? { value: text(value)!, source: origin } : undefined;
  const instrument: Instrument = { symbol, kind: nav ? 'nav' : 'exchange', manualOverride: false, createdAt: retrievedAt,
    name: field(meta.longName) || field(meta.shortName), currency: currency.success ? { value: currency.data, source: origin } : undefined,
    exchange: field(meta.fullExchangeName) || field(meta.exchangeName), timezone: field(meta.exchangeTimezoneName) };
  const warnings: string[] = ['ISIN e TER não disponibilizados por esta resposta da fonte.'];
  if (!currency.success) warnings.push('Moeda ausente ou não suportada. Preços não utilizados para evitar conversões incorretas.');
  const history: HistoryPoint[] = [];
  const timeZone = text(meta.exchangeTimezoneName);
  let formatter: Intl.DateTimeFormat | undefined;
  try { if (timeZone) formatter = new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }); } catch { /* A série fica indisponível sem calendário identificável. */ }
  if (!formatter) warnings.push('Fuso horário ausente ou inválido: histórico diário indisponível.');
  if (currency.success && formatter) {
    const closes = result.indicators?.quote?.[0]?.close ?? [];
    const adjusted = result.indicators?.adjclose?.[0]?.adjclose ?? [];
    for (const [index, epoch] of (result.timestamp ?? []).entries()) {
      const close = closes[index];
      if (!positive(close) || !positive(epoch)) continue;
      const instant = new Date(epoch * 1000);
      if (!Number.isFinite(instant.getTime()) || instant.getTime() > Date.parse(retrievedAt)) continue;
      const parts = formatter.formatToParts(instant);
      const component = (type: string) => parts.find(p => p.type === type)?.value;
      const date = `${component('year')}-${component('month')}-${component('day')}`;
      history.push({ id: `${symbol}:yahoo:${date}`, symbol, date, close,
        adjustedClose: positive(adjusted[index]) ? adjusted[index]! : undefined, currency: currency.data,
        source: { ...origin, asOf: instant.toISOString() } });
    }
  }
  let quote: Quote | undefined;
  if (currency.success) {
    const last = history.at(-1);
    const previous = history.at(-2);
    if (nav && last) quote = { id: `${symbol}:yahoo:latest`, symbol, price: last.close, currency: currency.data, previousClose: previous?.close, previousAsOf: previous?.source.asOf, source: last.source };
    else if (positive(meta.regularMarketPrice) && positive(meta.regularMarketTime) && meta.regularMarketTime * 1000 <= Date.parse(retrievedAt)) {
      const asOf = new Date(meta.regularMarketTime * 1000).toISOString();
      const dateParts = formatter?.formatToParts(new Date(asOf));
      const quoteDate = dateParts ? ['year', 'month', 'day'].map(type => dateParts.find(p => p.type === type)?.value).join('-') : undefined;
      const prior = quoteDate ? history.filter(p => p.date < quoteDate).at(-1) : undefined;
      quote = { id: `${symbol}:yahoo:latest`, symbol, price: meta.regularMarketPrice, currency: currency.data, source: { ...origin, asOf },
        previousClose: prior?.close ?? (positive(meta.previousClose) ? meta.previousClose : undefined), previousAsOf: prior?.source.asOf };
    } else if (last) quote = { id: `${symbol}:yahoo:latest`, symbol, price: last.close, currency: currency.data, source: last.source, previousClose: previous?.close, previousAsOf: previous?.source.asOf };
  }
  if (!quote) warnings.push('Sem cotação utilizável na resposta.');
  return { instrument, quote, history: [...new Map(history.map(p => [p.date, p])).values()], warnings };
}
