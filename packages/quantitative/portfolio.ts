import type { HistoryPoint, Instrument, Quote } from '../domain';
import { lisbonDay, type FxRate, type Portfolio, type Transaction } from '../domain/ledger';
import { cents, decimalText, divide, fixed, multiply } from './decimal';
import { applyTransaction, emptyLedger, serializeLots, sortedTransactions, type LedgerState } from './ledger';

export interface PortfolioInput { portfolios: Portfolio[]; transactions: Transaction[]; instruments: Instrument[]; quotes: Quote[]; history: HistoryPoint[]; fxRates: FxRate[]; selected: string; now: string }
type Mark = { date: string; price: number; currency: string; at: string; source: string; nature: string };
export interface PositionView { symbol: string; quantity: string; cost: string; averageCost: string; value: string | null; unrealized: string | null; weight: number | null; quote?: Mark; fx?: { rate: string; at: string; source: string }; missing?: string }
export interface TimelinePoint { date: string; value: string | null; flows: string; profit: string | null; carried: boolean; manual: boolean }
export interface PortfolioResult { cash: string; value: string | null; knownValue: string; invested: string; realized: string; unrealized: string | null; income: string; expenses: string; fees: string; profit: string | null; daily: string | null; initialBasisDifference: string; positions: PositionView[]; timeline: TimelinePoint[]; lots: ReturnType<typeof serializeLots>; allocations: { transactionId: string; lotId: string; quantity: string; cost: string }[]; missing: number }
function latest<T extends { date: string }>(list: T[], day: string): T | undefined {
  let left = 0; let right = list.length;
  while (left < right) { const mid = (left + right) >>> 1; if (list[mid].date <= day) left = mid + 1; else right = mid; }
  return list[left - 1];
}
export function calculatePortfolio(input: PortfolioInput): PortfolioResult {
  const today = lisbonDay(input.now);
  const selected = input.selected === 'all' ? input.portfolios.map(p => p.id) : [input.selected];
  const instruments = new Map(input.instruments.map(i => [i.symbol, i]));
  const marks = new Map<string, Mark[]>(); const manuals = new Map<string, Mark[]>();
  const push = (map: Map<string, Mark[]>, symbol: string, mark: Mark) => map.set(symbol, [...(map.get(symbol) ?? []), mark]);
  for (const p of input.history) if (Date.parse(p.source.asOf) <= Date.parse(input.now)) push(marks, p.symbol, { date: p.date, price: p.close, currency: p.currency, at: p.source.asOf, source: p.source.name, nature: p.source.nature });
  for (const q of input.quotes) if (Date.parse(q.source.asOf) <= Date.parse(input.now)) push(q.source.nature === 'manual' ? manuals : marks, q.symbol, { date: lisbonDay(q.source.asOf), price: q.price, currency: q.currency, at: q.source.asOf, source: q.source.name, nature: q.source.nature });
  for (const list of [...marks.values(), ...manuals.values()]) list.sort((a, b) => a.date.localeCompare(b.date) || Date.parse(a.at) - Date.parse(b.at));
  const rates = new Map<string, Array<FxRate & { date: string }>>();
  for (const rate of input.fxRates) if (Date.parse(rate.at) <= Date.parse(input.now)) rates.set(rate.currency, [...(rates.get(rate.currency) ?? []), { ...rate, date: lisbonDay(rate.at) }]);
  for (const list of rates.values()) list.sort((a, b) => a.date.localeCompare(b.date) || Date.parse(a.at) - Date.parse(b.at) || Date.parse(a.createdAt) - Date.parse(b.createdAt));
  const sum = (map: Map<string, bigint>) => selected.reduce((n, id) => n + (map.get(id) ?? 0n), 0n);
  function valueAt(state: LedgerState, day: string) {
    const grouped = new Map<string, { quantity: bigint; cost: bigint }>();
    for (const lot of state.lots) if (selected.includes(lot.portfolioId) && lot.quantity > 0n) {
      const position = grouped.get(lot.symbol) ?? { quantity: 0n, cost: 0n };
      grouped.set(lot.symbol, { quantity: position.quantity + lot.quantity, cost: position.cost + lot.cost });
    }
    let known = sum(state.cash); let missing = 0; let unrealized = 0n; let carried = false; let manual = false;
    const positions: PositionView[] = [];
    for (const [symbol, position] of grouped) {
      const forced = instruments.get(symbol)?.manualOverride ? latest(manuals.get(symbol) ?? [], day) : undefined;
      const quote = forced ?? latest(marks.get(symbol) ?? [], day);
      const rate = quote && quote.currency !== 'EUR' ? latest(rates.get(quote.currency) ?? [], day) : undefined;
      const fx = quote?.currency === 'EUR' ? fixed('1') : rate ? fixed(rate.rate) : undefined;
      const value = quote && fx ? cents(multiply(multiply(position.quantity, fixed(quote.price)), fx)) : null;
      if (value === null) missing++; else { known += value; unrealized += value - position.cost; }
      carried ||= !!quote && quote.date !== day || !!rate && rate.date !== day;
      manual ||= !!quote && quote.nature !== 'observed' || !!rate;
      positions.push({ symbol, quantity: decimalText(position.quantity), cost: decimalText(position.cost), averageCost: decimalText(divide(position.cost, position.quantity)), value: value === null ? null : decimalText(value), unrealized: value === null ? null : decimalText(value - position.cost), weight: null, quote, fx: rate ? { rate: rate.rate, at: rate.at, source: rate.source } : undefined, missing: !quote ? 'Sem preço até esta data' : !fx ? `Sem câmbio ${quote.currency} → EUR até esta data` : undefined });
    }
    if (!missing && known > 0n) for (const p of positions) p.weight = Number(p.value) / Number(decimalText(known));
    return { positions, known, missing, value: missing ? null : known, unrealized: missing ? null : unrealized, carried, manual };
  }
  const transactions = sortedTransactions(input.transactions.filter(t => Date.parse(t.at) <= Date.parse(input.now)));
  const relevant = transactions.filter(t => selected.includes(t.portfolioId) || !!t.toPortfolioId && selected.includes(t.toPortfolioId));
  const state = emptyLedger(input.portfolios); const timeline: TimelinePoint[] = [];
  const days = transactions.map(t => lisbonDay(t.at));
  let cursor = 0;
  if (relevant.length) {
    const start = lisbonDay(relevant[0].at); const end = Date.parse(today + 'T00:00:00Z');
    for (let time = Date.parse(start + 'T00:00:00Z'); time <= end; time += 86400000) {
      const day = new Date(time).toISOString().slice(0, 10);
      while (cursor < transactions.length && days[cursor] <= day) applyTransaction(state, transactions[cursor++]);
      const value = valueAt(state, day); const flows = sum(state.flows);
      timeline.push({ date: day, value: value.value === null ? null : decimalText(value.value), flows: decimalText(flows), profit: value.value === null ? null : decimalText(value.value - flows), carried: value.carried, manual: value.manual });
    }
  }
  const current = valueAt(state, today); const flows = sum(state.flows); const previous = timeline.at(-2);
  return {
    cash: decimalText(sum(state.cash)), value: current.value === null ? null : decimalText(current.value), knownValue: decimalText(current.known), invested: decimalText(flows), realized: decimalText(sum(state.realized)), unrealized: current.unrealized === null ? null : decimalText(current.unrealized), income: decimalText(sum(state.income)), expenses: decimalText(sum(state.expenses)), fees: decimalText(sum(state.fees)), initialBasisDifference: decimalText(sum(state.initialBasisDifference)),
    profit: current.value === null ? null : decimalText(current.value - flows),
    daily: current.value !== null && previous?.value !== null && previous?.value !== undefined ? decimalText(current.value - fixed(previous.value) - (flows - fixed(previous.flows))) : null,
    positions: current.positions, missing: current.missing, timeline, lots: serializeLots(state, selected), allocations: state.allocations.filter(a => relevant.some(t => t.id === a.transactionId)).map(a => ({ ...a, quantity: decimalText(a.quantity), cost: decimalText(a.cost) })),
  };
}
