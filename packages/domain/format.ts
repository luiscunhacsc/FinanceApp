export const dateTime = (value: string) => new Intl.DateTimeFormat('pt-PT', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Lisbon' }).format(new Date(value));
export const date = (value: string) => new Intl.DateTimeFormat('pt-PT', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'UTC' }).format(new Date(value));
export const money = (value: number, currency = 'EUR', hidden = false) => hidden ? '••••••' : new Intl.NumberFormat('pt-PT', { style: 'currency', currency, useGrouping: 'always', minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value);
export const percent = (value: number, hidden = false) => hidden ? '•••' : new Intl.NumberFormat('pt-PT', { style: 'percent', minimumFractionDigits: 2, maximumFractionDigits: 2, signDisplay: 'exceptZero' }).format(value);
export const decimal = (text: string): number => {
  const clean = text.trim().replace(/[\s\u00a0\u202f]/g, '');
  if (!/^\d+(?:[,.]\d+)?$/.test(clean)) throw new Error('Use um número positivo, por exemplo 123,45 (sem separador de milhares).');
  const result = Number(clean.replace(',', '.'));
  if (!Number.isFinite(result) || result <= 0) throw new Error('O valor tem de ser superior a zero.');
  return result;
};
