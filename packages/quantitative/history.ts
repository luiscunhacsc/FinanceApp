import type { HistoryPoint } from '../domain';
export function summarizeHistory(points: HistoryPoint[]) {
  const ordered = [...points].sort((a, b) => a.date.localeCompare(b.date));
  if (!ordered.length) return null;
  if (new Set(ordered.map(p => p.currency)).size !== 1) throw new Error('Não é possível combinar moedas sem uma série cambial.');
  return { first: ordered[0], last: ordered.at(-1)!, min: Math.min(...ordered.map(p => p.close)), max: Math.max(...ordered.map(p => p.close)), count: ordered.length };
}
