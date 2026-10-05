import { z } from 'zod';

// Strings decimais canónicas; os cálculos contabilísticos usam BigInt, nunca parseFloat.
export const decimalString = z.string().regex(/^\d{1,12}(?:\.\d{1,12})?$/, 'Use um decimal positivo com até 12 casas.');
const currency = z.string().regex(/^[A-Z]{3}$/).refine(v => Intl.supportedValuesOf('currency').includes(v), 'Moeda inválida.');
const instant = z.string().datetime({ offset: true });
export const portfolioSchema = z.object({ id: z.string().min(1).max(100), name: z.string().trim().min(1).max(80), createdAt: instant }).strict();
export const transactionKinds = ['deposit', 'withdrawal', 'buy', 'sell', 'fee', 'income', 'transfer', 'opening'] as const;
export const transactionSchema = z.object({
  id: z.string().min(1).max(100), portfolioId: z.string().min(1).max(100), kind: z.enum(transactionKinds), at: instant,
  order: z.number().int().nonnegative(), createdAt: instant, origin: z.enum(['manual', 'imported']),
  symbol: z.string().regex(/^[A-Z0-9^][A-Z0-9.^=_-]{0,39}$/).optional(),
  quantity: decimalString, price: decimalString, fee: decimalString, amount: decimalString, currency,
  fxRate: decimalString, openingValue: decimalString,
  toPortfolioId: z.string().min(1).max(100).optional(), lotId: z.string().min(1).max(100).optional(),
  note: z.string().max(1000),
}).strict().superRefine((t, ctx) => {
  const fail = (message: string) => ctx.addIssue({ code: 'custom', message });
  if (Date.parse(t.at) < Date.parse('1900-01-01T00:00:00Z') || Date.parse(t.at) > Date.now()) fail('Use uma data de movimento entre 1900 e o momento atual.');
  if (Number(t.fxRate) <= 0 || t.currency === 'EUR' && Number(t.fxRate) !== 1) fail('EUR exige câmbio 1; outras moedas exigem câmbio positivo.');
  const trade = ['buy', 'sell', 'opening'].includes(t.kind);
  if (trade && (!t.symbol || Number(t.quantity) <= 0 || Number(t.price) <= 0)) fail('Indique símbolo, quantidade e preço positivos.');
  if (trade && Number(t.amount) !== 0) fail('Compras e vendas usam quantidade × preço, sem montante adicional.');
  if (!trade && (Number(t.amount) <= 0 || Number(t.quantity) !== 0 || Number(t.price) !== 0 || t.symbol || t.currency !== 'EUR')) fail('Movimentos de dinheiro exigem montante em EUR, sem instrumento ou quantidade.');
  if (!trade && t.kind !== 'transfer' && Number(t.fee) !== 0) fail('Registe despesas autónomas como Comissão/despesa.');
  if (t.kind === 'transfer' && (!t.toPortfolioId || t.toPortfolioId === t.portfolioId)) fail('Escolha uma carteira de destino diferente.');
  if (t.kind !== 'transfer' && t.toPortfolioId) fail('Só uma transferência pode ter carteira de destino.');
  if (t.kind !== 'sell' && t.lotId) fail('Só uma venda pode selecionar um lote.');
  if (t.kind === 'opening' ? Number(t.openingValue) <= 0 : Number(t.openingValue) !== 0) fail('A posição inicial exige valor de mercado em EUR na data de início.');
});
export const fxSchema = z.object({ id: z.string().min(1).max(100), currency, rate: decimalString.refine(v => Number(v) > 0), at: instant, source: z.string().trim().min(1).max(200), createdAt: instant }).strict().refine(v => v.currency !== 'EUR', 'EUR tem câmbio fixo 1.');
export type Portfolio = z.infer<typeof portfolioSchema>;
export type Transaction = z.infer<typeof transactionSchema>;
export type FxRate = z.infer<typeof fxSchema>;
export const kindLabel: Record<Transaction['kind'], string> = { deposit: 'Entrada de dinheiro', withdrawal: 'Levantamento', buy: 'Compra', sell: 'Venda', fee: 'Comissão / despesa', income: 'Rendimento recebido', transfer: 'Transferência', opening: 'Posição inicial' };
export const transactionDefaults = { quantity: '0', price: '0', fee: '0', amount: '0', currency: 'EUR', fxRate: '1', openingValue: '0', note: '' };
export function inputDecimal(value: string): string {
  const normal = value.trim().replace(/[\s\u00a0\u202f]/g, '').replace(',', '.');
  decimalString.parse(normal);
  const [whole, fraction = ''] = normal.split('.');
  return BigInt(whole).toString() + (fraction.replace(/0+$/, '') ? '.' + fraction.replace(/0+$/, '') : '');
}
export function lisbonDay(instant: string) {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Lisbon', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date(instant));
  return ['year', 'month', 'day'].map(k => parts.find(p => p.type === k)!.value).join('-');
}
