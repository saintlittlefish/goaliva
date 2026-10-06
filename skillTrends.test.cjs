const test = require('node:test');
const assert = require('node:assert/strict');
const { skillTrend } = require('./skillTrends.ts');
const now = Date.parse('2026-10-02T20:00:00Z');
const day = 86400000;
const session = (days, points = 5, completed = true, id = 'one') => ({ completedAt: new Date(now - days * day).toISOString(), recipe: { id, name: id }, drillResults: { Shooting: { attempts: completed ? 15 : 6, successes: completed ? 9 : 3, targetAttempts: 15, completed, points: completed ? points : null } } });
test('points sorted chronologically, including zero and negative scores', () => {
  assert.deepEqual(skillTrend([session(0, 0), session(3, -5), session(1, 20)], 'Shooting', 'Points', '7D', now).map(p => p.value), [-5, 20, 0]);
});
test('period boundaries inclusive; future and outside-period data excluded', () => {
  assert.equal(skillTrend([session(7), session(7.01), session(-1)], 'Shooting', 'Points', '7D', now).length, 1);
  assert.equal(skillTrend([session(31), session(100)], 'Shooting', 'Points', '90D', now).length, 1);
  assert.equal(skillTrend([session(365), session(366)], 'Shooting', 'Points', '1Y', now).length, 1);
  assert.equal(skillTrend([session(999)], 'Shooting', 'Points', 'All', now).length, 1);
});
test('incomplete results not scored; accuracy still available', () => {
  assert.equal(skillTrend([session(1, 5, false)], 'Shooting', 'Points', 'All', now).length, 0);
  assert.equal(skillTrend([session(1, 5, false)], 'Shooting', 'Accuracy', 'All', now)[0].value, 50);
});
test('template filter and skill isolation', () => {
  assert.equal(skillTrend([session(1), session(2, 10, true, 'two')], 'Shooting', 'Points', 'All', now, 'two')[0].value, 10);
  assert.equal(skillTrend([session(1)], 'Passing', 'Points', 'All', now).length, 0);
});
test('missing and invalid dates never invented; no-attempt sessions excluded', () => {
  const older = session(1); delete older.completedAt;
  const invalid = { ...session(1), completedAt: 'invalid' };
  const empty = { ...session(1), drillResults: { Shooting: { attempts: 0, successes: 0, completed: false, points: null } } };
  assert.deepEqual(skillTrend([older, invalid, empty], 'Shooting', 'Accuracy', 'All', now), []);
});
test('same-day distinct sessions retained with recorded scoring snapshots', () => {
  const results = skillTrend([session(0.1, 100), session(0.2, -10)], 'Shooting', 'Points', '30D', now);
  assert.deepEqual(results.map(p => p.value), [-10, 100]);
});
test('timestamped legacy attempt data has accuracy, not retroactive points', () => {
  const legacy = { completedAt: new Date(now).toISOString(), recipe: { id: 'one', name: 'one' }, skillStats: { Shooting: { attempts: 10, successes: 7 } } };
  assert.equal(skillTrend([legacy], 'Shooting', 'Accuracy', 'All', now)[0].value, 70);
  assert.equal(skillTrend([legacy], 'Shooting', 'Points', 'All', now).length, 0);
});
