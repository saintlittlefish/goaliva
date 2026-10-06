const test = require('node:test');
const assert = require('node:assert/strict');
const { inferTemplateFocus, isPosition, rankTemplates, POSITIONS } = require('./templateRelevance.ts');

const templates = [
  { id: 'all', focus: 'All positions', skills: ['Passing', 'First Touch'] },
  { id: 'fwd', focus: 'Forward', skills: ['Shooting', '1v1 Moves'] },
  { id: 'mid', focus: 'Midfielder', skills: ['Passing', 'First Touch'] },
  { id: 'def', focus: 'Defender', skills: ['Defensive Footwork', 'Passing'] },
  { id: 'gk', focus: 'Goalkeeper', skills: ['Handling', 'Goalkeeper Footwork'] },
];

test('every position gets its matching template first', () => {
  for (const position of POSITIONS) {
    const ranked = rankTemplates(templates, position);
    assert.equal(ranked[0].focus, position);
    assert.equal(ranked[1].focus, 'All positions');
  }
});
test('changing position immediately changes recommendation and list order', () => {
  assert.equal(rankTemplates(templates, 'Forward')[0].id, 'fwd');
  assert.equal(rankTemplates(templates, 'Goalkeeper')[0].id, 'gk');
  assert.deepEqual(templates.map(t => t.id), ['all', 'fwd', 'mid', 'def', 'gk']);
});
test('skipping position preserves library order and handles an empty library', () => {
  assert.deepEqual(rankTemplates(templates, ''), templates);
  assert.deepEqual(rankTemplates([], 'Forward'), []);
});
test('exact focus wins even when a mismatched template contains more relevant skills', () => {
  const ranked = rankTemplates([
    { id: 'wrong', focus: 'Defender', skills: ['Shooting', '1v1 Moves', 'Weak Foot', 'First Touch'] },
    { id: 'match', focus: 'Forward', skills: ['Custom drill'] },
  ], 'Forward');
  assert.equal(ranked[0].id, 'match');
});
test('skill relevance breaks ties, equal scores retain saved order', () => {
  const ranked = rankTemplates([
    { id: 'a', focus: 'Forward', skills: ['First Touch'] },
    { id: 'b', focus: 'Forward', skills: ['Shooting'] },
    { id: 'c', focus: 'Forward', skills: ['Shooting'] },
  ], 'Forward');
  assert.deepEqual(ranked.map(t => t.id), ['b', 'c', 'a']);
});
test('legacy templates gain a focus without overwriting explicit choices', () => {
  assert.equal(inferTemplateFocus({ id: 'technical', skills: [] }), 'Midfielder');
  assert.equal(inferTemplateFocus({ id: 'complete', skills: ['Shooting'] }), 'All positions');
  assert.equal(inferTemplateFocus({ id: 'custom', skills: ['Handling'] }), 'Goalkeeper');
  assert.equal(inferTemplateFocus({ id: 'custom', skills: ['Passing'] }), 'Midfielder');
  assert.equal(inferTemplateFocus({ id: 'custom', skills: ['Unknown'] }), 'All positions');
  assert.equal(inferTemplateFocus({ id: 'weak', skills: ['Shooting'], focus: 'Defender' }), 'Defender');
});
test('skipped or unrecognized positions are not silently assigned', () => {
  assert.equal(isPosition(''), false);
  assert.equal(isPosition('Striker'), false);
  assert.equal(isPosition('Goalkeeper'), true);
});
