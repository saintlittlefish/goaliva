const test = require('node:test');
const assert = require('node:assert/strict');
const { addTemplateSkill, defaultDrillConfig, validateDrillConfig, getDrillConfig, calculateDrillPoints, calculateLiveDrillPoints, resetSkillStats, scoreBandLabels, withDrillConfigs, buildDrillResults } = require('./drillScoring.ts');

test('adding a custom skill directly preserves the template and supplies default scoring', () => {
  const config = { targetAttempts: 10, scoreRules: [{ minSuccesses: 0, points: -2 }, { minSuccesses: 8, points: 100 }] };
  const original = { name: 'My template', focus: 'Forward', skills: ['Passing'], drills: { Passing: config } };
  const updated = addTemplateSkill(original, 'Crossing accuracy');
  assert.deepEqual(updated.skills, ['Passing', 'Crossing accuracy']);
  assert.deepEqual(updated.drills.Passing, config);
  assert.deepEqual(updated.drills['Crossing accuracy'], defaultDrillConfig());
  assert.equal(updated.name, original.name);
  assert.equal(updated.focus, original.focus);
  assert.deepEqual(original.skills, ['Passing']);
  assert.deepEqual(JSON.parse(JSON.stringify(updated)), updated);
});

test('adding an existing skill does not duplicate it or reset its custom scoring', () => {
  const config = { targetAttempts: 10, scoreRules: [{ minSuccesses: 0, points: -2 }] };
  const updated = addTemplateSkill({ skills: ['Crossing accuracy'], drills: { 'Crossing accuracy': config } }, 'Crossing accuracy');
  assert.deepEqual(updated.skills, ['Crossing accuracy']);
  assert.deepEqual(updated.drills['Crossing accuracy'], config);
});

test('reset clears only the selected skill and removes its final score', () => {
  const stats = { 'First Touch': { attempts: 15, successes: 9 }, Passing: { attempts: 15, successes: 15 } };
  const reset = resetSkillStats(stats, 'First Touch');
  assert.deepEqual(reset['First Touch'], { attempts: 0, successes: 0 });
  assert.equal(reset.Passing, stats.Passing);
  assert.deepEqual(stats['First Touch'], { attempts: 15, successes: 9 });
  const results = buildDrillResults({ skills: ['First Touch', 'Passing'] }, reset);
  assert.equal(results['First Touch'].completed, false);
  assert.equal(results['First Touch'].points, null);
  assert.equal(results.Passing.points, 20);
  assert.equal(Object.values(results).reduce((sum, result) => sum + (result.points ?? 0), 0), 20);
});

test('reset shows zero live points while the first unsuccessful attempt still uses its band', () => {
  const config = defaultDrillConfig();
  assert.equal(calculateLiveDrillPoints(0, 0, config), 0);
  assert.equal(calculateLiveDrillPoints(1, 0, config), -5);
  assert.equal(calculateLiveDrillPoints(15, 9, config), 5);
  assert.equal(calculateDrillPoints(0, config), -5);
});

test('reset is repeatable and allows counting from zero again', () => {
  const once = resetSkillStats({ Shooting: { attempts: 3, successes: 2 } }, 'Shooting');
  const twice = resetSkillStats(once, 'Shooting');
  assert.deepEqual(twice, once);
  const next = { ...twice, Shooting: { attempts: twice.Shooting.attempts + 1, successes: twice.Shooting.successes + 1 } };
  assert.deepEqual(next.Shooting, { attempts: 1, successes: 1 });
});

test('default target is 15 and all example scores match', () => {
  const config = defaultDrillConfig();
  assert.equal(config.targetAttempts, 15);
  for (const [successes, expected] of [[0, -5], [4, -5], [5, -5], [6, -5], [7, 0], [8, 0], [9, 5], [11, 5], [12, 10], [13, 10], [14, 15], [15, 20]]) {
    assert.equal(calculateDrillPoints(successes, config), expected, `${successes} successes`);
  }
});
test('preview makes every success range explicit', () => {
  assert.deepEqual(scoreBandLabels(defaultDrillConfig()), ['0–6 successes: -5 points', '7–8 successes: 0 points', '9–11 successes: +5 points', '12–13 successes: +10 points', '14 successes: +15 points', '15 successes: +20 points']);
});
test('custom targets, thresholds, negative and positive points work', () => {
  const config = { targetAttempts: 20, scoreRules: [{ minSuccesses: 15, points: 30 }, { minSuccesses: 0, points: -10 }, { minSuccesses: 10, points: 2 }] };
  assert.equal(validateDrillConfig(config), null);
  assert.equal(calculateDrillPoints(9, config), -10);
  assert.equal(calculateDrillPoints(10, config), 2);
  assert.equal(calculateDrillPoints(20, config), 30);
});
test('default bands stay valid for customized targets, including 1', () => {
  for (const target of [1, 2, 5, 10, 15, 20, 99, 999]) {
    const config = defaultDrillConfig(target);
    assert.equal(validateDrillConfig(config), null);
    assert.equal(calculateDrillPoints(0, config), -5);
    assert.equal(calculateDrillPoints(target, config), 20);
  }
});
test('invalid targets, points, gaps at zero, and duplicate thresholds are rejected', () => {
  for (const targetAttempts of [0, -1, 1.5, 1000, NaN]) assert.ok(validateDrillConfig({ ...defaultDrillConfig(), targetAttempts }));
  for (const scoreRules of [[], [{ minSuccesses: 1, points: 0 }], [{ minSuccesses: 0, points: 0 }, { minSuccesses: 0, points: 5 }], [{ minSuccesses: 0, points: NaN }], [{ minSuccesses: 0, points: 10000 }], [{ minSuccesses: 0, points: 0 }, { minSuccesses: 16, points: 5 }]]) assert.ok(validateDrillConfig({ targetAttempts: 15, scoreRules }));
});
test('legacy templates and newly added skills get independent defaults', () => {
  const template = withDrillConfigs({ skills: ['First Touch', 'Passing'] });
  assert.equal(template.drills['First Touch'].targetAttempts, 15);
  template.drills['First Touch'].scoreRules[0].points = -50;
  assert.equal(template.drills.Passing.scoreRules[0].points, -5);
  assert.equal(getDrillConfig({}, 'First Touch').scoreRules[0].points, -5);
});
test('different templates can score the same skill differently', () => {
  const custom = { targetAttempts: 10, scoreRules: [{ minSuccesses: 0, points: -2 }, { minSuccesses: 8, points: 100 }] };
  const a = withDrillConfigs({ skills: ['First Touch'], drills: { 'First Touch': custom } });
  const b = withDrillConfigs({ skills: ['First Touch'] });
  assert.equal(getDrillConfig(a, 'First Touch').targetAttempts, 10);
  assert.equal(getDrillConfig(b, 'First Touch').targetAttempts, 15);
});
test('completed drills earn points, incomplete and unattempted drills do not', () => {
  const results = buildDrillResults({ skills: ['First Touch', 'Passing', 'Shooting'] }, {
    'First Touch': { attempts: 15, successes: 9 }, Passing: { attempts: 8, successes: 7 },
  });
  assert.equal(results['First Touch'].points, 5);
  assert.equal(results['First Touch'].completed, true);
  assert.equal(results.Passing.points, null);
  assert.equal(results.Passing.completed, false);
  assert.equal(results.Shooting.points, null);
});
test('a completed zero-success drill earns the baseline penalty', () => {
  assert.equal(buildDrillResults({ skills: ['First Touch'] }, { 'First Touch': { attempts: 15, successes: 0 } })['First Touch'].points, -5);
});
test('rule snapshots and session results survive JSON persistence and later edits', () => {
  const template = withDrillConfigs({ skills: ['First Touch'] });
  const snapshot = withDrillConfigs(template);
  const results = buildDrillResults(snapshot, { 'First Touch': { attempts: 15, successes: 15 } });
  template.drills['First Touch'].scoreRules[5].points = 500;
  const saved = JSON.parse(JSON.stringify({ template: snapshot, results }));
  assert.equal(saved.results['First Touch'].points, 20);
  assert.equal(calculateDrillPoints(15, getDrillConfig(saved.template, 'First Touch')), 20);
});
test('invalid saved configurations fall back safely to defaults', () => {
  assert.equal(getDrillConfig({ drills: { Passing: { targetAttempts: 0, scoreRules: [] } } }, 'Passing').targetAttempts, 15);
});
test('removed skills lose config without changing remaining skills', () => {
  const template = withDrillConfigs({ skills: ['Passing', 'Shooting'] });
  const changed = withDrillConfigs({ ...template, skills: ['Passing'] });
  assert.equal(changed.drills.Shooting, undefined);
  assert.equal(changed.drills.Passing.targetAttempts, 15);
});
