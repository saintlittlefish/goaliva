import type { DrillResult } from './drillScoring';

export type TrendSession = {
  completedAt?: string;
  recipe: { id: string; name: string };
  drillResults?: Record<string, DrillResult>;
  skillStats?: Record<string, { attempts: number; successes: number }>;
};
export type TrendMetric = 'Points' | 'Accuracy';
export type TrendRange = '7D' | '30D' | '90D' | '1Y' | 'All';
export type TrendPoint = { timestamp: number; value: number; template: string; attempts: number; successes: number };

export function skillTrend(sessions: TrendSession[], skill: string, metric: TrendMetric, range: TrendRange, now = Date.now(), templateId = ''): TrendPoint[] {
  const days = { '7D': 7, '30D': 30, '90D': 90, '1Y': 365, All: Infinity }[range];
  const start = now - days * 86400000;
  return sessions.flatMap(session => {
    const timestamp = session.completedAt ? Date.parse(session.completedAt) : NaN;
    if (!Number.isFinite(timestamp) || timestamp < start || timestamp > now || (templateId && session.recipe.id !== templateId)) return [];
    const result = session.drillResults?.[skill];
    const stats = result ?? session.skillStats?.[skill];
    if (!stats || stats.attempts <= 0) return [];
    if (metric === 'Points' && (!result?.completed || result.points === null || !Number.isFinite(result.points))) return [];
    const value = metric === 'Points' ? result!.points! : Math.round(stats.successes / stats.attempts * 100);
    return [{ timestamp, value, template: session.recipe.name, attempts: stats.attempts, successes: stats.successes }];
  }).sort((a, b) => a.timestamp - b.timestamp);
}
