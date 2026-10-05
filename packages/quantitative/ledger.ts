import { type Transaction, type Portfolio } from '../domain/ledger';
import { cents, decimalText, divideRound, fixed, multiply } from './decimal';

export interface Lot { id: string; portfolioId: string; symbol: string; at: string; quantity: bigint; cost: bigint; originalQuantity: bigint; originalCost: bigint }
export interface Allocation { transactionId: string; lotId: string; quantity: bigint; cost: bigint }
export interface LedgerState { cash: Map<string, bigint>; flows: Map<string, bigint>; realized: Map<string, bigint>; income: Map<string, bigint>; expenses: Map<string, bigint>; fees: Map<string, bigint>; lots: Lot[]; allocations: Allocation[]; initialBasisDifference: Map<string, bigint> }
export const transactionGross = (t: Transaction) => cents(multiply(multiply(fixed(t.quantity), fixed(t.price)), fixed(t.fxRate)));
export const transactionFee = (t: Transaction) => cents(multiply(fixed(t.fee), fixed(t.fxRate)));
export function emptyLedger(portfolios: Portfolio[]): LedgerState {
  const balances = () => new Map(portfolios.map(p => [p.id, 0n]));
  return { cash: balances(), flows: balances(), realized: balances(), income: balances(), expenses: balances(), fees: balances(), initialBasisDifference: balances(), lots: [], allocations: [] };
}
const add = (map: Map<string, bigint>, id: string, value: bigint) => map.set(id, (map.get(id) ?? 0n) + value);
export function applyTransaction(state: LedgerState, t: Transaction) {
  if (!state.cash.has(t.portfolioId) || t.toPortfolioId && !state.cash.has(t.toPortfolioId)) throw new Error('Carteira inexistente.');
  const id = t.portfolioId; const amount = cents(fixed(t.amount)); const gross = transactionGross(t); const fee = transactionFee(t);
  if (t.kind === 'deposit') { add(state.cash, id, amount); add(state.flows, id, amount); }
  if (t.kind === 'withdrawal') { add(state.cash, id, -amount); add(state.flows, id, -amount); }
  if (t.kind === 'income') { add(state.cash, id, amount); add(state.income, id, amount); }
  if (t.kind === 'fee') { add(state.cash, id, -amount); add(state.expenses, id, amount); add(state.fees, id, amount); }
  if (t.kind === 'transfer') {
    add(state.cash, id, -amount - fee); add(state.cash, t.toPortfolioId!, amount);
    add(state.flows, id, -amount); add(state.flows, t.toPortfolioId!, amount);
    add(state.expenses, id, fee); add(state.fees, id, fee);
  }
  if (t.kind === 'buy' || t.kind === 'opening') {
    if (t.kind === 'buy') add(state.cash, id, -gross - fee);
    else { const value = cents(fixed(t.openingValue)); add(state.flows, id, value); add(state.initialBasisDifference, id, value - gross - fee); }
    add(state.fees, id, fee);
    state.lots.push({ id: t.id, portfolioId: id, symbol: t.symbol!, at: t.at, quantity: fixed(t.quantity), cost: gross + fee, originalQuantity: fixed(t.quantity), originalCost: gross + fee });
  }
  if (t.kind === 'sell') {
    let remaining = fixed(t.quantity); let allocatedCost = 0n;
    const eligible = state.lots.filter(l => l.portfolioId === id && l.symbol === t.symbol && l.quantity > 0n && (!t.lotId || l.id === t.lotId));
    for (const lot of eligible) {
      if (!remaining) break;
      const quantity = remaining < lot.quantity ? remaining : lot.quantity;
      const cost = quantity === lot.quantity ? lot.cost : divideRound(lot.cost * quantity, lot.quantity);
      // A última parcela recebe todo o custo residual; nenhuma fração desaparece.
      lot.quantity -= quantity; lot.cost -= cost; remaining -= quantity; allocatedCost += cost;
      state.allocations.push({ transactionId: t.id, lotId: lot.id, quantity, cost });
    }
    if (remaining) throw new Error(`${t.symbol}: quantidade insuficiente${t.lotId ? ' no lote selecionado' : ''}.`);
    add(state.cash, id, gross - fee); add(state.realized, id, gross - fee - allocatedCost); add(state.fees, id, fee);
  }
  if (state.cash.get(id)! < 0n) throw new Error(`Saldo insuficiente em ${t.at.slice(0, 10)}. Registe uma entrada de dinheiro antes deste movimento.`);
}
export function sortedTransactions(transactions: Transaction[]) { return [...transactions].sort((a, b) => Date.parse(a.at) - Date.parse(b.at) || a.order - b.order || a.id.localeCompare(b.id)); }
export function replayLedger(portfolios: Portfolio[], transactions: Transaction[]): LedgerState {
  const state = emptyLedger(portfolios);
  if (new Set(transactions.map(t => t.id)).size !== transactions.length) throw new Error('Identificadores de transação repetidos.');
  for (const t of sortedTransactions(transactions)) applyTransaction(state, t);
  return state;
}
export function serializeLots(state: LedgerState, selected: string[]) {
  return state.lots.filter(l => selected.includes(l.portfolioId)).map(l => ({ ...l, quantity: decimalText(l.quantity), cost: decimalText(l.cost), originalQuantity: decimalText(l.originalQuantity), originalCost: decimalText(l.originalCost) }));
}
