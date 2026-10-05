import { normalizeYahoo } from '../../../packages/data-sources/yahoo';
import { marketPayloadSchema } from '../../../packages/data-sources';
import { symbolSchema } from '../../../packages/domain';

export interface Env { ALLOWED_ORIGINS: string }
interface WorkerContext { waitUntil(promise: Promise<unknown>): void }
const json = (value: unknown, status = 200) => new Response(JSON.stringify(value), { status, headers: { 'Content-Type': 'application/json; charset=utf-8', 'X-Content-Type-Options': 'nosniff' } });
function cors(response: Response, origin: string): Response {
  const headers = new Headers(response.headers);
  headers.set('Access-Control-Allow-Origin', origin);
  headers.set('Vary', 'Origin');
  headers.set('Access-Control-Allow-Methods', 'GET, OPTIONS');
  headers.set('Access-Control-Allow-Headers', 'Content-Type');
  return new Response(response.body, { status: response.status, headers });
}
export async function handleRequest(request: Request, env: Env, context: WorkerContext, cache: Cache, fetcher: typeof fetch = fetch): Promise<Response> {
  const origin = request.headers.get('Origin') || '';
  const allowed = env.ALLOWED_ORIGINS.split(',').map(s => s.trim()).filter(Boolean);
  if (!origin || !allowed.includes(origin)) return json({ error: 'Origem não autorizada. Configure ALLOWED_ORIGINS.' }, 403);
  if (request.method === 'OPTIONS') return cors(new Response(null, { status: 204 }), origin);
  if (request.method !== 'GET') return cors(json({ error: 'Método não permitido.' }, 405), origin);
  const url = new URL(request.url);
  if (url.pathname === '/api/health') return cors(json({ ok: true, service: 'patrimonio-dados', version: 1 }), origin);
  if (url.pathname !== '/api/market') return cors(json({ error: 'Rota desconhecida.' }, 404), origin);
  const parsed = symbolSchema.safeParse(url.searchParams.get('symbol'));
  if (!parsed.success || [...url.searchParams.keys()].some(k => k !== 'symbol') || url.searchParams.getAll('symbol').length !== 1) return cors(json({ error: 'Pedido inválido.' }, 400), origin);
  const symbol = parsed.data;
  const cacheKey = new Request(`${url.origin}/cache/v1/${encodeURIComponent(symbol)}`);
  const cached = await cache.match(cacheKey);
  if (cached) return cors(cached, origin);
  try {
    const upstream = await fetcher(`https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=2y&interval=1d`, {
      headers: { 'Accept': 'application/json', 'User-Agent': 'PatrimonioPersonal/0.1' }, signal: AbortSignal.timeout(12000), redirect: 'manual',
    });
    if (!upstream.ok) return cors(json({ error: 'Fonte indisponível. Use os dados locais ou a introdução manual.' }, upstream.status === 429 ? 429 : 502), origin);
    if (!upstream.body) throw new Error('Resposta vazia.');
    const reader = upstream.body.getReader();
    const chunks: Uint8Array[] = []; let size = 0;
    while (true) {
      const { value, done } = await reader.read(); if (done) break;
      size += value.byteLength;
      if (size > 2_000_000) { await reader.cancel(); throw new Error('Resposta demasiado grande.'); }
      chunks.push(value);
    }
    const bytes = new Uint8Array(size); let offset = 0;
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
    const payload = marketPayloadSchema.parse(normalizeYahoo(JSON.parse(new TextDecoder().decode(bytes)), symbol));
    const response = json(payload);
    response.headers.set('Cache-Control', `public, max-age=${payload.instrument.kind === 'nav' ? 21600 : 900}`);
    context.waitUntil(cache.put(cacheKey, response.clone()));
    return cors(response, origin);
  } catch (error) {
    console.warn('market_data_unavailable', error instanceof Error ? error.message.slice(0, 300) : 'Erro desconhecido');
    return cors(json({ error: 'Não foi possível validar os dados da fonte. O último preço local mantém-se.' }, 502), origin);
  }
}
export default { fetch(request: Request, env: Env, context: WorkerContext) { return handleRequest(request, env, context, (caches as CacheStorage & { default: Cache }).default); } };
