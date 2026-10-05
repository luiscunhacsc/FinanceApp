import { describe, expect, it } from 'vitest';
import { transactionDefaults, transactionSchema, type Portfolio, type Transaction } from '../packages/domain/ledger';
import { replayLedger } from '../packages/quantitative/ledger';
import { decimalText, fixed } from '../packages/quantitative/decimal';
import { calculatePortfolio, type PortfolioInput } from '../packages/quantitative/portfolio';
import { parseTransactionsCSV, transactionsToCSV } from '../packages/import-export/transactions';
import { initialInstruments } from '../packages/domain';

const portfolios: Portfolio[] = [{ id: 'a', name: 'Principal', createdAt: '2025-01-01T00:00:00Z' }, { id: 'b', name: 'PPR', createdAt: '2025-01-01T00:00:00Z' }];
function tx(id: string, kind: Transaction['kind'], fields: Partial<Transaction> = {}): Transaction { return transactionSchema.parse({ ...transactionDefaults, id, kind, portfolioId: 'a', at: '2025-01-01T12:00:00Z', order: Number(id.replace(/\D/g, '')) || 0, createdAt: '2025-01-01T12:00:00Z', origin: 'manual', ...fields }); }
const deposit = tx('1', 'deposit', { amount: '3000' });
const buy = tx('2', 'buy', { symbol: 'VWCE.DE', quantity: '10', price: '100', fee: '10' });
const buy2 = tx('3', 'buy', { symbol: 'VWCE.DE', quantity: '10', price: '120', fee: '10' });
const sell = tx('4', 'sell', { symbol: 'VWCE.DE', quantity: '15', price: '150', fee: '15' });
const source = (at: string) => ({ name: 'Fixture sintética', nature: 'observed' as const, asOf: at, retrievedAt: '2025-01-03T12:00:00Z' });
function input(transactions: Transaction[], overrides: Partial<PortfolioInput> = {}): PortfolioInput { return { portfolios, transactions, instruments: initialInstruments(), quotes: [{ id: 'q', symbol: 'VWCE.DE', price: 150, currency: 'EUR', source: source('2025-01-01T17:00:00Z') }], history: [], fxRates: [], selected: 'all', now: '2025-01-03T18:00:00Z', ...overrides }; }

describe('Contabilidade decimal e lotes', () => {
  it('reconcilia FIFO, comissões, caixa e resultado com valores conhecidos', () => {
    const state = replayLedger(portfolios, [sell, buy2, deposit, buy]);
    expect(decimalText(state.cash.get('a')!)).toBe('3015');
    expect(decimalText(state.realized.get('a')!)).toBe('620');
    expect(decimalText(state.lots[1].cost)).toBe('605');
    expect(decimalText(state.lots[1].quantity)).toBe('5');
    const result = calculatePortfolio(input([deposit, buy, buy2, sell]));
    expect(result).toMatchObject({ value: '3765', invested: '3000', profit: '765', realized: '620', unrealized: '145', fees: '35' });
  });
  it('uma venda selecionada consome exclusivamente o lote pedido', () => {
    const chosen = tx('4', 'sell', { symbol: 'VWCE.DE', quantity: '5', price: '150', fee: '5', lotId: '3' });
    const state = replayLedger(portfolios, [deposit, buy, buy2, chosen]);
    expect(state.allocations[0].lotId).toBe('3'); expect(decimalText(state.realized.get('a')!)).toBe('140'); expect(decimalText(state.lots[0].quantity)).toBe('10');
  });
  it('frações e últimas parcelas preservam a quantidade e todo o custo', () => {
    const transactions = [tx('1', 'deposit', { amount: '1' }), tx('2', 'buy', { symbol: 'VWCE.DE', quantity: '0.3', price: '1' }), tx('3', 'sell', { symbol: 'VWCE.DE', quantity: '0.1', price: '1' }), tx('4', 'sell', { symbol: 'VWCE.DE', quantity: '0.2', price: '1' })];
    const state = replayLedger(portfolios, transactions); expect(state.lots[0].quantity).toBe(0n); expect(state.lots[0].cost).toBe(0n); expect(state.realized.get('a')).toBe(0n); expect(state.cash.get('a')).toBe(fixed('1'));
  });
  it('rejeita vendas excessivas, lotes errados e compras sem saldo', () => {
    expect(() => replayLedger(portfolios, [buy])).toThrow('Saldo insuficiente');
    expect(() => replayLedger(portfolios, [deposit, buy, sell])).toThrow('quantidade insuficiente');
    expect(() => replayLedger(portfolios, [deposit, buy, tx('3', 'sell', { symbol: 'VWCE.DE', quantity: '1', price: '100', lotId: 'inexistente' })])).toThrow('lote');
  });
  it('rejeita campos incompatíveis e câmbio EUR diferente de 1', () => {
    expect(() => tx('1', 'buy', { symbol: 'VWCE.DE', quantity: '1', price: '100', fxRate: '.9' })).toThrow();
    expect(() => tx('1', 'deposit', { amount: '100', symbol: 'VWCE.DE' })).toThrow();
  });
  it('neutraliza transferências consolidadas e conserva a comissão', () => {
    const data = [tx('1', 'deposit', { amount: '1000' }), tx('2', 'transfer', { amount: '400', fee: '2', toPortfolioId: 'b' })];
    expect(calculatePortfolio(input(data))).toMatchObject({ value: '998', invested: '1000', profit: '-2' });
    expect(calculatePortfolio(input(data, { selected: 'a' }))).toMatchObject({ value: '598', invested: '600', profit: '-2' });
    expect(calculatePortfolio(input(data, { selected: 'b' }))).toMatchObject({ value: '400', invested: '400', profit: '0' });
  });
  it('rendimentos não são reforços; despesas não são levantamentos', () => {
    const data = [deposit, tx('2', 'income', { amount: '12' }), tx('3', 'fee', { amount: '2' }), tx('4', 'withdrawal', { amount: '100' })];
    expect(calculatePortfolio(input(data))).toMatchObject({ value: '2910', invested: '2900', profit: '10', income: '12', expenses: '2' });
  });
  it('separa o custo original da valorização de abertura', () => {
    const opening = tx('1', 'opening', { symbol: 'VWCE.DE', quantity: '10', price: '100', openingValue: '1400' });
    expect(calculatePortfolio(input([opening]))).toMatchObject({ value: '1500', invested: '1400', profit: '100', unrealized: '500', initialBasisDifference: '400', cash: '0' });
  });
});
describe('Valorização e calendários', () => {
  it('não preenche o passado com uma cotação futura nem calcula total parcial como completo', () => {
    const result = calculatePortfolio(input([deposit, buy], { quotes: [{ id: 'q', symbol: 'VWCE.DE', price: 150, currency: 'EUR', source: source('2025-01-03T17:00:00Z') }] }));
    expect(result.timeline[0].value).toBeNull(); expect(result.timeline[1].value).toBeNull(); expect(result.timeline[2].value).toBe('3490');
    const missing = calculatePortfolio(input([deposit, buy], { quotes: [] })); expect(missing.value).toBeNull(); expect(missing.knownValue).toBe('1990'); expect(missing.positions[0].weight).toBeNull();
  });
  it('usa o último NAV conhecido e assinala transporte para outra data', () => {
    const result = calculatePortfolio(input([deposit, buy])); expect(result.timeline[1].carried).toBe(true); expect(result.timeline[1].value).toBe(result.timeline[0].value); expect(result.daily).toBe('0');
  });
  it('a variação diária exclui entradas e saídas', () => {
    const data = [deposit, buy, tx('5', 'deposit', { at: '2025-01-03T12:00:00Z', amount: '1000' })];
    const result = calculatePortfolio(input(data)); expect(result.daily).toBe('0'); expect(result.profit).toBe('490');
  });
  it('câmbio da transação não é utilizado como câmbio de valorização', () => {
    const data = [deposit, tx('2', 'buy', { symbol: 'VWCE.DE', quantity: '10', price: '100', currency: 'USD', fxRate: '0.8' })];
    const quotes = [{ id: 'q', symbol: 'VWCE.DE', price: 100, currency: 'USD', source: source('2025-01-01T17:00:00Z') }];
    expect(calculatePortfolio(input(data, { quotes })).value).toBeNull();
    const result = calculatePortfolio(input(data, { quotes, fxRates: [{ id: 'fx', currency: 'USD', rate: '0.9', at: '2025-01-02T12:00:00Z', source: 'Fixture sintética', createdAt: '2025-01-02T12:00:00Z' }] }));
    expect(result.value).toBe('3100'); expect(result.unrealized).toBe('100'); expect(result.timeline[0].value).toBeNull();
  });
});
describe('CSV de movimentos', () => {
  it('faz round-trip e ignora reimportação idêntica', () => {
    const data = [deposit, buy, buy2, sell]; const csv = transactionsToCSV(data, portfolios);
    const first = parseTransactionsCSV(csv, portfolios, [], ['VWCE.DE']); expect(first.transactions).toHaveLength(4);
    expect(replayLedger(portfolios, first.transactions).cash.get('a')).toBe(fixed('3015'));
    const repeated = parseTransactionsCSV(csv, portfolios, first.transactions, ['VWCE.DE']); expect(repeated.duplicates).toBe(4); expect(repeated.transactions).toHaveLength(0);
  });
  it('bloqueia conflitos e sequências inválidas, antes de gravar', () => {
    expect(() => parseTransactionsCSV(transactionsToCSV([{ ...deposit, amount: '4000' }], portfolios), portfolios, [deposit], ['VWCE.DE'])).toThrow('dados diferentes');
    expect(() => parseTransactionsCSV(transactionsToCSV([buy], portfolios), portfolios, [], ['VWCE.DE'])).toThrow('Saldo insuficiente');
  });
  it('protege fórmulas na exportação sem alterar a nota na reimportação', () => {
    const item = { ...deposit, note: '=1+1' }; const csv = transactionsToCSV([item], portfolios); expect(csv).toContain("'=1+1"); expect(parseTransactionsCSV(csv, portfolios, [], []).transactions[0].note).toBe('=1+1');
  });
  it('exige moeda e câmbio explícitos em compras em moeda estrangeira', () => {
    const foreign = { ...buy, currency: 'USD', fxRate: '0.9' };
    const csv = transactionsToCSV([deposit, foreign], portfolios);
    expect(() => parseTransactionsCSV(csv.replace('"USD";"0.9"', '"USD";""'), portfolios, [], ['VWCE.DE'])).toThrow('câmbio de execução');
    expect(() => parseTransactionsCSV(csv.replace('"USD";"0.9"', '"";"0.9"'), portfolios, [], ['VWCE.DE'])).toThrow('moeda da transação');
    expect(parseTransactionsCSV(csv, portfolios, [], ['VWCE.DE']).transactions[1].fxRate).toBe('0.9');
  });
});
