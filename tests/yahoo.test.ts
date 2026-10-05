import { describe, expect, it, vi } from 'vitest';
import { normalizeYahoo } from '../packages/data-sources/yahoo';
import { marketPayloadSchema, YahooProvider } from '../packages/data-sources';
import { handleRequest } from '../apps/proxy/src';
const fixture = (symbol = 'VWCE.DE') => ({ chart: { result: [{ meta: { symbol, currency: 'EUR', longName: 'Nome sintético para teste', exchangeTimezoneName: 'Europe/Berlin', regularMarketPrice: 110, regularMarketTime: 1735900200 }, timestamp: [1735727400, 1735813800, 1735900200], indicators: { quote: [{ close: [100, null, 110] }], adjclose: [{ adjclose: [100, null, 110] }] } }], error: null } });
describe('Fonte Yahoo', () => {
  it('normaliza dados, ignora lacunas e não inventa ISIN ou TER', () => {
    const data = marketPayloadSchema.parse(normalizeYahoo(fixture(), 'VWCE.DE', '2025-01-04T12:00:00Z'));
    expect(data.history).toHaveLength(2); expect(data.instrument.isin).toBeUndefined(); expect(data.instrument.ter).toBeUndefined(); expect(data.quote?.price).toBe(110);
  });
  it('o fundo usa NAV diário em vez de suposto intradiário', () => {
    const data = fixture('0P0001PBB6.F'); data.chart.result[0].meta.regularMarketPrice = 999;
    const result = normalizeYahoo(data, '0P0001PBB6.F', '2025-01-04T12:00:00Z');
    expect(result.instrument.kind).toBe('nav'); expect(result.quote?.price).toBe(110); expect(result.quote?.previousClose).toBe(100); expect(result.quote?.previousAsOf).toBeDefined();
  });
  it('não aceita identidade diferente nem moeda ausente', () => {
    expect(() => normalizeYahoo(fixture('WRONG'), 'VWCE.DE')).toThrow('Identidade');
    const data = fixture(); data.chart.result[0].meta.currency = '';
    expect(normalizeYahoo(data, 'VWCE.DE').quote).toBeUndefined(); expect(normalizeYahoo(data, 'VWCE.DE').history).toEqual([]);
  });
  it('a indisponibilidade é devolvida ao chamador, sem fabricar fallback', async () => {
    const provider = new YahooProvider('https://example.workers.dev', vi.fn().mockResolvedValue(new Response(null, { status: 429 })));
    await expect(provider.getMarketData('VWCE.DE')).rejects.toThrow('Limite');
  });
});
describe('Proxy mínimo', () => {
  const env = { ALLOWED_ORIGINS: 'https://app.example' };
  const context = { waitUntil: vi.fn() };
  const cache = { match: vi.fn().mockResolvedValue(undefined), put: vi.fn().mockResolvedValue(undefined) } as unknown as Cache;
  const request = (path: string, origin = 'https://app.example') => new Request(`https://proxy.example${path}`, { headers: { Origin: origin } });
  it('recusa origens não autorizadas e pedidos que tentam alterar o destino', async () => {
    const fetcher = vi.fn();
    expect((await handleRequest(request('/api/market?symbol=VWCE.DE', 'https://evil.example'), env, context, cache, fetcher)).status).toBe(403);
    expect((await handleRequest(request('/api/market?symbol=VWCE.DE&url=https://evil.example'), env, context, cache, fetcher)).status).toBe(400);
    expect(fetcher).not.toHaveBeenCalled();
  });
  it('usa cache e aplica CORS à resposta', async () => {
    const fetcher = vi.fn().mockResolvedValue(Response.json(fixture()));
    const response = await handleRequest(request('/api/market?symbol=VWCE.DE'), env, context, cache, fetcher);
    expect(response.status).toBe(200); expect(response.headers.get('Access-Control-Allow-Origin')).toBe('https://app.example');
    expect(cache.put).toHaveBeenCalled(); expect(fetcher.mock.calls[0][0]).toMatch(/^https:\/\/query1.finance.yahoo.com\/v8\/finance\/chart\/VWCE.DE\?/);
    const cached = { match: vi.fn().mockResolvedValue(response.clone()), put: vi.fn() } as unknown as Cache;
    fetcher.mockClear(); await handleRequest(request('/api/market?symbol=VWCE.DE'), env, context, cached, fetcher); expect(fetcher).not.toHaveBeenCalled();
  });
  it('traduz falhas da fonte sem expor respostas internas', async () => {
    const fetcher = vi.fn().mockRejectedValue(new Error('internal secrets'));
    const response = await handleRequest(request('/api/market?symbol=VWCE.DE'), env, context, cache, fetcher);
    expect(response.status).toBe(502); expect(await response.text()).not.toContain('internal secrets');
  });
});
