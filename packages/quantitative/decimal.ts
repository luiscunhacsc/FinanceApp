const SCALE = 1_000_000_000_000n;
export function fixed(value: string | number): bigint {
  const text = String(value);
  // Dados de mercado podem chegar em notação científica. A contabilidade recebe strings validadas.
  const normalized = /e/i.test(text) ? Number(text).toFixed(12) : text;
  const negative = normalized.startsWith('-');
  const [whole, fraction = ''] = normalized.replace(/^-/, '').split('.');
  const result = BigInt(whole) * SCALE + BigInt((fraction + '000000000000').slice(0, 12));
  return negative ? -result : result;
}
export function divideRound(a: bigint, b: bigint): bigint {
  if (!b) throw new Error('Divisão por zero.');
  const negative = (a < 0n) !== (b < 0n); const n = a < 0n ? -a : a; const d = b < 0n ? -b : b;
  const q = (n + d / 2n) / d; return negative ? -q : q;
}
export const multiply = (a: bigint, b: bigint) => divideRound(a * b, SCALE);
export const divide = (a: bigint, b: bigint) => divideRound(a * SCALE, b);
export const cents = (value: bigint) => divideRound(value, 10_000_000_000n) * 10_000_000_000n;
export function decimalText(value: bigint): string {
  const sign = value < 0n ? '-' : ''; const abs = value < 0n ? -value : value;
  const fraction = (abs % SCALE).toString().padStart(12, '0').replace(/0+$/, '');
  return sign + (abs / SCALE).toString() + (fraction ? '.' + fraction : '');
}
