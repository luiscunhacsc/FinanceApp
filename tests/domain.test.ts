import { describe, expect, it } from 'vitest';
import { backupSchema, defaultSettings, initialInstruments, selectQuote, symbolSchema, validProxyUrl, type Quote } from '../packages/domain';
import { dateTime, decimal, money } from '../packages/domain/format';
import { backupFromText, backupToCSV, parseCSV, parseQuoteCSV } from '../packages/import-export';
import { summarizeHistory } from '../packages/quantitative/history';
const source = { name: 'Dados sintéticos de teste', nature: 'observed' as const, asOf: '2025-01-01T12:00:00Z', retrievedAt: '2025-01-02T12:00:00Z' };
const quote: Quote = { id: 'test', symbol: 'VWCE.DE', price: 100, currency: 'EUR', source };
const backup = { format: 'patrimonio-local', version: 1, exportedAt: source.asOf, instruments: initialInstruments(), quotes: [quote], history: [], settings: defaultSettings };
describe('Dados e precedência', () => {
  it('formata milhares e anos de quatro dígitos em português', () => { expect(money(1234.56).replace(/\s/g, ' ')).toBe('1 234,56 €'); expect(dateTime('2025-01-02T12:00:00Z')).toContain('02/01/2025'); });
  it('não preenche metadados dos oito símbolos', () => { const items = initialInstruments(); expect(items).toHaveLength(8); expect(items.every(i => !i.name && !i.currency && !i.isin && !i.ter)).toBe(true); expect(items.at(-1)?.kind).toBe('nav'); });
  it('normaliza símbolos e rejeita caminhos', () => { expect(symbolSchema.parse(' vwce.de ')).toBe('VWCE.DE'); expect(symbolSchema.safeParse('../segredo').success).toBe(false); });
  it('preserva a prioridade manual mesmo com cotação posterior', () => {
    const instrument = initialInstruments().find(i => i.symbol === 'VWCE.DE')!;
    const manual: Quote = { ...quote, id: 'manual', price: 90, source: { ...source, nature: 'manual' } };
    const remote: Quote = { ...quote, price: 120, source: { ...source, asOf: '2025-02-01T12:00:00Z' } };
    expect(selectQuote({ ...instrument, manualOverride: true }, [remote, manual])?.price).toBe(90);
    expect(selectQuote(instrument, [manual, remote])?.price).toBe(120);
  });
  it('recusa URLs com credenciais, caminhos, parâmetros ou HTTP remoto', () => {
    for (const url of ['https://user:pass@host.com', 'https://site.com/api', 'https://site.com?key=x', 'http://site.com']) expect(validProxyUrl(url)).toBe(false);
    expect(validProxyUrl('https://personal.workers.dev')).toBe(true); expect(validProxyUrl('http://127.0.0.1:8787')).toBe(true);
  });
  it('lê decimais portugueses sem aceitar valores ambíguos', () => { expect(decimal('1 234,56')).toBe(1234.56); expect(() => decimal('1.234,56')).toThrow(); expect(() => decimal('Infinity')).toThrow(); expect(() => decimal('0')).toThrow(); });
});
describe('Backup e CSV', () => {
  it('faz round-trip completo JSON e CSV', () => {
    const parsed = backupSchema.parse(backup);
    expect(backupFromText(JSON.stringify(parsed))).toEqual(parsed);
    expect(backupFromText(backupToCSV(parsed))).toEqual(parsed);
  });
  it('rejeita versões desconhecidas, referências partidas e identificadores repetidos', () => {
    expect(() => backupSchema.parse({ ...backup, version: 2 })).toThrow();
    expect(() => backupSchema.parse({ ...backup, instruments: [] })).toThrow();
    expect(() => backupSchema.parse({ ...backup, quotes: [quote, quote] })).toThrow();
  });
  it('lê aspas escapadas, campos multilinha e decimais com vírgula', () => {
    expect(parseCSV('a;b\r\n"linha\nseguinte";"com ""aspas"""')).toEqual([['a', 'b'], ['linha\nseguinte', 'com "aspas"']]);
    expect(() => parseCSV('a;b\n"incompleto;b')).toThrow();
    const parsed = parseQuoteCSV('symbol;as_of;price;currency;source\nVWCE.DE;2025-01-01T12:00:00Z;100,50;EUR;Fonte de teste', initialInstruments());
    expect(parsed.quotes[0].price).toBe(100.5); expect(parsed.quotes[0].source.nature).toBe('imported');
  });
  it('identifica duplicados e valida antes de gravar', () => {
    const row = 'VWCE.DE;2025-01-01T12:00:00Z;100;EUR;Teste';
    const result = parseQuoteCSV(`symbol;as_of;price;currency;source\n${row}\n${row}`, initialInstruments());
    expect(result.quotes).toHaveLength(1); expect(result.duplicates).toBe(1);
    expect(() => parseQuoteCSV('symbol;as_of;price;currency;source\nVWCE.DE;2099-01-01T00:00:00Z;100;EUR;Teste', [])).toThrow('futuro');
  });
  it('não inventa metadados numa importação e normaliza TER em percentagem', () => {
    const result = parseQuoteCSV('symbol;as_of;price;currency;source;ter_percent\nVWCE.DE;2025-01-01T12:00:00Z;100;EUR;Documento de teste;0,20', []);
    expect(result.instruments[0].name).toBeUndefined(); expect(result.instruments[0].ter?.value).toBe(.002);
  });
});
describe('Resumo do histórico no worker', () => {
  it('ordena datas, obtém extremos e rejeita mistura de moedas', () => {
    const first = { id: '1', symbol: 'TEST', date: '2025-01-01', close: 80, currency: 'EUR', source };
    const last = { ...first, id: '2', date: '2025-01-02', close: 100 };
    expect(summarizeHistory([last, first])).toMatchObject({ min: 80, max: 100, count: 2, first, last });
    expect(() => summarizeHistory([first, { ...last, currency: 'USD' }])).toThrow('moedas');
    expect(summarizeHistory([])).toBeNull();
  });
});
