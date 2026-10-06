const test = require('node:test');
const assert = require('node:assert/strict');
const { THEME_NAMES, THEME_PALETTES, resolveThemeName } = require('./appThemes.ts');
const luminance = hex => {
  const channels = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255).map(c => c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
};
const contrast = (a, b) => { const values = [luminance(a), luminance(b)].sort((x, y) => y - x); return (values[0] + 0.05) / (values[1] + 0.05); };
test('reference themes plus the retained fifth option exist, green first', () => {
  assert.deepEqual(THEME_NAMES, ['Alpine Green', 'Ocean Blue', 'Sunset Energy', 'Night Match', 'Golden Hour']);
});
test('saved theme names migrate without losing the selected color family', () => {
  assert.equal(resolveThemeName('Cobalt Blue'), 'Ocean Blue');
  assert.equal(resolveThemeName('Sunset Coral'), 'Sunset Energy');
  assert.equal(resolveThemeName('Night Pitch'), 'Night Match');
  for (const name of THEME_NAMES) assert.equal(resolveThemeName(name), name);
  assert.equal(resolveThemeName('unknown'), 'Alpine Green');
});
test('all text and gradient button color roles have readable contrast', () => {
  for (const [name, p] of Object.entries(THEME_PALETTES)) {
    for (const background of [p.background, p.surface, p.mint]) assert.ok(contrast(p.ink, background) >= 4.5, `${name} body text`);
    for (const background of p.buttonGradient) assert.ok(contrast(p.onAccent, background) >= 4.5, `${name} button text: ${contrast(p.onAccent, background)}`);
    assert.ok(contrast(p.onPrimary, p.primary) >= 4.5, `${name} selected chip text`);
    for (const background of p.heroGradient) assert.ok(contrast(p.heroMuted, background) >= 4.5, `${name} hero text`);
  }
});
test('night colors are purple/cyan rather than the former green/gold palette', () => {
  const night = THEME_PALETTES['Night Match'];
  assert.equal(night.dark, true);
  assert.equal(night.accent, '#38E9ED');
  assert.equal(night.surface, '#171536');
  assert.equal(THEME_PALETTES['Ocean Blue'].primary, '#0064FF');
  assert.equal(THEME_PALETTES['Sunset Energy'].accent, '#FF663F');
});
