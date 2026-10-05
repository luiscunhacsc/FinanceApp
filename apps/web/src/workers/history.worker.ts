import { summarizeHistory } from '../../../../packages/quantitative/history';
import type { HistoryPoint } from '../../../../packages/domain';
self.onmessage = (event: MessageEvent<{ id: number; points: HistoryPoint[] }>) => {
  try { self.postMessage({ id: event.data.id, result: summarizeHistory(event.data.points) }); }
  catch (error) { self.postMessage({ id: event.data.id, error: error instanceof Error ? error.message : 'Não foi possível calcular.' }); }
};
