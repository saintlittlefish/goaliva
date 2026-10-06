export type ThemePalette = {
  primary: string; background: string; surface: string; mint: string;
  accent: string; ink: string; muted: string; line: string; onPrimary: string;
  onAccent: string; hero: string; heroMuted: string;
  buttonGradient: readonly [string, string]; heroGradient: readonly [string, string];
  dark: boolean;
};

// Color roles follow the supplied four-theme design board. Golden Hour is retained
// as the fifth option from the existing library rather than deleting a user choice.
export const THEME_PALETTES: Record<string, ThemePalette> = {
  'Alpine Green': {
    primary: '#005437', background: '#E9F8EF', surface: '#F9FFF1', mint: '#BEF0D5',
    accent: '#FFE05A', ink: '#062F25', muted: '#42695B', line: '#9DDDBB',
    onPrimary: '#FFFFFF', onAccent: '#FFFFFF', hero: '#003B2C', heroMuted: '#C4EEDB',
    buttonGradient: ['#00482F', '#007148'], heroGradient: ['#00281E', '#005437'], dark: false,
  },
  'Ocean Blue': {
    primary: '#0064FF', background: '#E8F4FF', surface: '#FAFDFF', mint: '#D4E9FF',
    accent: '#00C4EE', ink: '#051D56', muted: '#365D91', line: '#A5CDFF',
    onPrimary: '#FFFFFF', onAccent: '#FFFFFF', hero: '#032B75', heroMuted: '#CAE3FF',
    buttonGradient: ['#0052EE', '#0068F5'], heroGradient: ['#001744', '#043E96'], dark: false,
  },
  'Sunset Energy': {
    primary: '#682065', background: '#FFF0E9', surface: '#FFF9F5', mint: '#FFD7C9',
    accent: '#FF663F', ink: '#361032', muted: '#795067', line: '#FFB29D',
    onPrimary: '#FFFFFF', onAccent: '#35102F', hero: '#3B103B', heroMuted: '#FFDAD1',
    buttonGradient: ['#FF8550', '#FF6545'], heroGradient: ['#2E102F', '#601B53'], dark: false,
  },
  'Night Match': {
    primary: '#AF91FF', background: '#070B1B', surface: '#171536', mint: '#29235C',
    accent: '#38E9ED', ink: '#F8F7FF', muted: '#C3BCEB', line: '#6350B6',
    onPrimary: '#100A25', onAccent: '#100A25', hero: '#211747', heroMuted: '#D5CDF5',
    buttonGradient: ['#A178FF', '#38E9ED'], heroGradient: ['#372067', '#151331'], dark: true,
  },
  'Golden Hour': {
    primary: '#70551F', background: '#FFF8E7', surface: '#FFFCF2', mint: '#F9E8B4',
    accent: '#EDBA4F', ink: '#382B12', muted: '#756039', line: '#E8CF8C',
    onPrimary: '#FFFFFF', onAccent: '#382B12', hero: '#594318', heroMuted: '#F5E6BE',
    buttonGradient: ['#F2CB70', '#EDBA4F'], heroGradient: ['#392C11', '#70551F'], dark: false,
  },
};
export const THEME_NAMES = Object.keys(THEME_PALETTES);
export function resolveThemeName(name: string): string {
  const aliases: Record<string, string> = { 'Cobalt Blue': 'Ocean Blue', 'Sunset Coral': 'Sunset Energy', 'Night Pitch': 'Night Match' };
  const resolved = aliases[name] ?? name;
  return THEME_PALETTES[resolved] ? resolved : 'Alpine Green';
}
