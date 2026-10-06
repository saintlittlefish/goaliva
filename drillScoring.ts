export type ScoreRule = { minSuccesses: number; points: number };
export type DrillConfig = { targetAttempts: number; scoreRules: ScoreRule[] };
export type DrillResult = { attempts: number; successes: number; targetAttempts: number; completed: boolean; points: number | null };

export function resetSkillStats(stats: Record<string, { attempts: number; successes: number }>, skill: string): Record<string, { attempts: number; successes: number }> {
  return { ...stats, [skill]: { attempts: 0, successes: 0 } };
}

export function calculateLiveDrillPoints(attempts: number, successes: number, config: DrillConfig): number {
  // No attempts means no provisional score yet. Final scoring bands are unchanged.
  return attempts > 0 ? calculateDrillPoints(successes, config) : 0;
}

export function defaultDrillConfig(targetAttempts = 15): DrillConfig {
  const target = Number.isInteger(targetAttempts) && targetAttempts >= 1 && targetAttempts <= 999 ? targetAttempts : 15;
  const defaults: ScoreRule[] = [
    { minSuccesses: 0, points: -5 }, { minSuccesses: 7, points: 0 },
    { minSuccesses: 9, points: 5 }, { minSuccesses: 12, points: 10 },
    { minSuccesses: 14, points: 15 }, { minSuccesses: 15, points: 20 },
  ];
  // Keep thresholds reachable for shorter targets. When rounded thresholds collide,
  // use the higher band; zero successes always retains the baseline penalty.
  const bands = new Map<number, number>();
  for (const rule of defaults) {
    const threshold = rule.minSuccesses ? Math.max(1, Math.round(rule.minSuccesses * target / 15)) : 0;
    bands.set(threshold, rule.points);
  }
  return { targetAttempts: target, scoreRules: Array.from(bands, ([minSuccesses, points]) => ({ minSuccesses, points })) };
}

export function validateDrillConfig(config: DrillConfig): string | null {
  if (!Number.isInteger(config.targetAttempts) || config.targetAttempts < 1 || config.targetAttempts > 999) return 'Target attempts must be a whole number from 1 to 999.';
  if (!config.scoreRules.length) return 'Add at least one scoring rule.';
  const thresholds = new Set<number>();
  for (const rule of config.scoreRules) {
    if (!rule || typeof rule !== 'object') return 'Every scoring band needs a success threshold and points.';
    if (!Number.isInteger(rule.minSuccesses) || rule.minSuccesses < 0 || rule.minSuccesses > config.targetAttempts) return 'Success thresholds must be whole numbers between 0 and the attempt target.';
    if (!Number.isInteger(rule.points) || Math.abs(rule.points) > 9999) return 'Points must be whole numbers from -9999 to 9999.';
    if (thresholds.has(rule.minSuccesses)) return 'Each success threshold must be unique.';
    thresholds.add(rule.minSuccesses);
  }
  if (!thresholds.has(0)) return 'Include a rule starting at 0 successes so every result has a score.';
  return null;
}

export function getDrillConfig(template: { drills?: Record<string, DrillConfig> }, skill: string): DrillConfig {
  const config = template.drills?.[skill];
  if (!config || !Array.isArray(config.scoreRules) || validateDrillConfig(config)) return defaultDrillConfig();
  return { targetAttempts: config.targetAttempts, scoreRules: config.scoreRules.map(rule => ({ ...rule })).sort((a, b) => a.minSuccesses - b.minSuccesses) };
}

export function withDrillConfigs<T extends { skills: string[]; drills?: Record<string, DrillConfig> }>(template: T): T & { drills: Record<string, DrillConfig> } {
  return { ...template, drills: Object.fromEntries(template.skills.map(skill => [skill, getDrillConfig(template, skill)])) };
}

export function addTemplateSkill<T extends { skills: string[]; drills?: Record<string, DrillConfig> }>(template: T, skill: string): T & { drills: Record<string, DrillConfig> } {
  return withDrillConfigs({ ...template, skills: template.skills.includes(skill) ? [...template.skills] : [...template.skills, skill] });
}

export function calculateDrillPoints(successes: number, config: DrillConfig): number {
  const rules = [...config.scoreRules].sort((a, b) => a.minSuccesses - b.minSuccesses);
  return rules.reduce((points, rule) => successes >= rule.minSuccesses ? rule.points : points, 0);
}

export function scoreBandLabels(config: DrillConfig): string[] {
  const rules = [...config.scoreRules].sort((a, b) => a.minSuccesses - b.minSuccesses);
  return rules.map((rule, index) => {
    const upper = index + 1 < rules.length ? rules[index + 1].minSuccesses - 1 : config.targetAttempts;
    const range = upper === rule.minSuccesses ? String(upper) : `${rule.minSuccesses}–${upper}`;
    return `${range} successes: ${rule.points > 0 ? '+' : ''}${rule.points} points`;
  });
}

export function buildDrillResults(template: { skills: string[]; drills?: Record<string, DrillConfig> }, stats: Record<string, { attempts: number; successes: number }>): Record<string, DrillResult> {
  return Object.fromEntries(template.skills.map(skill => {
    const config = getDrillConfig(template, skill);
    const result = stats[skill] ?? { attempts: 0, successes: 0 };
    const completed = result.attempts >= config.targetAttempts;
    return [skill, { ...result, targetAttempts: config.targetAttempts, completed, points: completed ? calculateDrillPoints(result.successes, config) : null }];
  }));
}
