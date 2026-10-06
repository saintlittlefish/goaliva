export const POSITIONS = ['Forward', 'Midfielder', 'Defender', 'Goalkeeper'] as const;
export type PlayerPosition = typeof POSITIONS[number];
export type TemplateFocus = PlayerPosition | 'All positions';
export const TEMPLATE_FOCUSES: readonly TemplateFocus[] = ['All positions', ...POSITIONS];

export type FocusedTemplate = { id: string; skills: string[]; focus: TemplateFocus };
const legacyFocus: Record<string, TemplateFocus> = {
  complete: 'All positions', weak: 'Forward', technical: 'Midfielder',
};
const positionSkills: Record<PlayerPosition, readonly string[]> = {
  Forward: ['Shooting', '1v1 Moves', 'Weak Foot', 'First Touch'],
  Midfielder: ['Passing', 'First Touch', 'Ball Mastery', 'Weak Foot'],
  Defender: ['Defensive Footwork', 'Passing', 'First Touch', '1v1 Moves'],
  Goalkeeper: ['Handling', 'Goalkeeper Footwork', 'Distribution', 'Passing'],
};

export function isPosition(value: unknown): value is PlayerPosition {
  return POSITIONS.some(position => position === value);
}

// Only migrate missing focus; an explicitly chosen focus always wins.
export function inferTemplateFocus(template: { id: string; skills: string[]; focus?: unknown }): TemplateFocus {
  if (TEMPLATE_FOCUSES.some(focus => focus === template.focus)) return template.focus as TemplateFocus;
  if (legacyFocus[template.id]) return legacyFocus[template.id];
  if (template.skills.some(skill => ['Handling', 'Goalkeeper Footwork', 'Distribution'].includes(skill))) return 'Goalkeeper';
  if (template.skills.includes('Defensive Footwork')) return 'Defender';
  if (template.skills.includes('Shooting')) return 'Forward';
  if (template.skills.includes('Passing')) return 'Midfielder';
  return 'All positions';
}

export function templateRelevance(template: FocusedTemplate, position: PlayerPosition | ''): number {
  if (!position) return 0;
  const focusScore = template.focus === position ? 100 : template.focus === 'All positions' ? 50 : 0;
  // Skills break ties within a focus group, never outrank an exact position match.
  return focusScore + positionSkills[position].reduce((score, skill, index) => score + (template.skills.includes(skill) ? 4 - index : 0), 0);
}

export function rankTemplates<T extends FocusedTemplate>(templates: readonly T[], position: PlayerPosition | ''): T[] {
  return templates.map((template, index) => ({ template, index }))
    .sort((a, b) => templateRelevance(b.template, position) - templateRelevance(a.template, position) || a.index - b.index)
    .map(item => item.template);
}
