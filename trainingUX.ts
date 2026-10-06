export type Counts = { attempts: number; successes: number };
export type AttemptHistory = Record<string, Counts[]>;

export function logTrainingResult(stats: Record<string, Counts>, history: AttemptHistory, skill: string, target: number, attempts: number, successes: number) {
  const previous = Object.prototype.hasOwnProperty.call(stats, skill) ? stats[skill] : { attempts: 0, successes: 0 };
  if (!Number.isInteger(attempts) || !Number.isInteger(successes) || attempts < 1 || successes < 0 || successes > attempts || previous.attempts + attempts > target) return null;
  const snapshots = Object.prototype.hasOwnProperty.call(history, skill) ? history[skill] : [];
  return { stats: { ...stats, [skill]: { attempts: previous.attempts + attempts, successes: previous.successes + successes } }, history: { ...history, [skill]: [...snapshots, { ...previous }] } };
}
export function undoTrainingResult(stats: Record<string, Counts>, history: AttemptHistory, skill: string) {
  const snapshots = Object.prototype.hasOwnProperty.call(history, skill) ? history[skill] : [];
  if (!snapshots.length) return null;
  return { stats: { ...stats, [skill]: { ...snapshots[snapshots.length - 1] } }, history: { ...history, [skill]: snapshots.slice(0, -1) } };
}
export function moveTemplateSkill<T extends { skills: string[] }>(template: T, index: number, direction: -1 | 1): T {
  const destination = index + direction;
  if (index < 0 || index >= template.skills.length || destination < 0 || destination >= template.skills.length) return template;
  const skills = [...template.skills];
  [skills[index], skills[destination]] = [skills[destination], skills[index]];
  return { ...template, skills };
}
export type ReportSession = { completedAt?: string; accuracy: number; minutes: number; elapsedMs?: number; skillStats?: Record<string, Counts>; recipe: { id: string; name: string } };
export function sessionsInPeriod<T extends ReportSession>(sessions: T[], days: number | null, now = Date.now()): T[] {
  if (days === null) return [...sessions];
  return sessions.filter(session => { const at = Date.parse(session.completedAt ?? ''); return Number.isFinite(at) && at >= now - days * 86400000 && at <= now; });
}
export function reportAccuracy(sessions: ReportSession[]): number | null {
  const stats = sessions.flatMap(session => Object.values(session.skillStats ?? {}));
  const attempts = stats.reduce((sum, item) => sum + item.attempts, 0);
  if (attempts) return Math.round(stats.reduce((sum, item) => sum + item.successes, 0) / attempts * 100);
  const legacy = sessions.filter(session => !session.skillStats);
  return legacy.length ? Math.round(legacy.reduce((sum, session) => sum + session.accuracy, 0) / legacy.length) : null;
}
export function measuredMinutes(sessions: ReportSession[]): number {
  return sessions.reduce((sum, session) => sum + (typeof session.elapsedMs === 'number' && session.elapsedMs >= 0 ? session.elapsedMs / 60000 : 0), 0);
}
export function nextTrainingOpportunity<T extends { id: string; name: string; skills: string[] }>(templates: T[], sessions: ReportSession[], eligibleSkills: string[]) {
  let counts: Record<string, Counts> = {};
  for (const session of sessions) for (const [skill, stats] of Object.entries(session.skillStats ?? {})) {
    if (!eligibleSkills.includes(skill)) continue;
    const previous = Object.prototype.hasOwnProperty.call(counts, skill) ? counts[skill] : { attempts: 0, successes: 0 };
    counts = { ...counts, [skill]: { attempts: previous.attempts + stats.attempts, successes: previous.successes + stats.successes } };
  }
  const weakest = Object.entries(counts).filter(([skill, stats]) => stats.attempts >= 10 && templates.some(template => template.skills.includes(skill)))
    .sort((a, b) => a[1].successes / a[1].attempts - b[1].successes / b[1].attempts)[0];
  if (!weakest) return { template: templates.find(template => template.skills.length), skill: null, accuracy: null, attempts: 0 };
  return { template: templates.find(template => template.skills.includes(weakest[0])), skill: weakest[0], accuracy: Math.round(weakest[1].successes / weakest[1].attempts * 100), attempts: weakest[1].attempts };
}
export function formatTrainingTime(elapsedMs: number): string {
  const seconds = Math.max(0, Math.floor(elapsedMs / 1000));
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
}
export function validTrainingDraft(value: unknown): boolean {
  if (!value || typeof value !== 'object') return false;
  const draft = value as { recipe?: { id?: string; name?: string; minutes?: number; skills?: string[] }; elapsedMs?: number; index?: number; stats?: Record<string, Counts>; history?: AttemptHistory; note?: string; acknowledged?: Record<string, boolean> };
  if (!draft.recipe?.id || typeof draft.recipe.name !== 'string' || !Number.isInteger(draft.recipe.minutes) || draft.recipe.minutes! <= 0 || !Array.isArray(draft.recipe.skills) || !draft.recipe.skills.length || !draft.recipe.skills.every(skill => typeof skill === 'string') || new Set(draft.recipe.skills).size !== draft.recipe.skills.length || typeof draft.elapsedMs !== 'number' || !Number.isFinite(draft.elapsedMs) || draft.elapsedMs < 0 || !Number.isInteger(draft.index) || draft.index! < 0 || draft.index! >= draft.recipe.skills.length || !draft.stats || typeof draft.stats !== 'object' || Array.isArray(draft.stats)) return false;
  const validCounts = (stats: Counts) => stats && Number.isInteger(stats.attempts) && stats.attempts >= 0 && Number.isInteger(stats.successes) && stats.successes >= 0 && stats.successes <= stats.attempts;
  if (!Object.values(draft.stats).every(validCounts)) return false;
  if (draft.note !== undefined && typeof draft.note !== 'string') return false;
  if (draft.history !== undefined && (!draft.history || typeof draft.history !== 'object' || !Object.values(draft.history).every(entries => Array.isArray(entries) && entries.every(validCounts)))) return false;
  if (draft.acknowledged !== undefined && (!draft.acknowledged || typeof draft.acknowledged !== 'object' || !Object.values(draft.acknowledged).every(value => typeof value === 'boolean'))) return false;
  return true;
}
