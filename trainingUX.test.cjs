const test = require('node:test');
const assert = require('node:assert/strict');
const { logTrainingResult, undoTrainingResult, moveTemplateSkill, sessionsInPeriod, reportAccuracy, measuredMinutes, nextTrainingOpportunity, formatTrainingTime, validTrainingDraft } = require('./trainingUX.ts');

test('single successes and misses increment attempts once, with exact undo', () => {
  const first = logTrainingResult({}, {}, 'Touch', 15, 1, 1);
  const second = logTrainingResult(first.stats, first.history, 'Touch', 15, 1, 0);
  assert.deepEqual(second.stats.Touch, { attempts: 2, successes: 1 });
  const undone = undoTrainingResult(second.stats, second.history, 'Touch');
  assert.deepEqual(undone.stats.Touch, { attempts: 1, successes: 1 });
  assert.deepEqual(undoTrainingResult(undone.stats, undone.history, 'Touch').stats.Touch, { attempts: 0, successes: 0 });
});
test('batch logging and undo preserve all other skills', () => {
  const stats = { Passing: { attempts: 15, successes: 12 }, Touch: { attempts: 2, successes: 1 } };
  const logged = logTrainingResult(stats, {}, 'Touch', 15, 13, 8);
  assert.deepEqual(logged.stats.Touch, { attempts: 15, successes: 9 });
  assert.equal(logged.stats.Passing, stats.Passing);
  assert.deepEqual(undoTrainingResult(logged.stats, logged.history, 'Touch').stats.Touch, stats.Touch);
  assert.deepEqual(stats.Touch, { attempts: 2, successes: 1 });
});
test('invalid and over-target batch results cannot change the session', () => {
  for (const [attempts, successes] of [[0, 0], [16, 9], [5, 6], [5, -1], [1.5, 1], [5, 1.5]]) assert.equal(logTrainingResult({}, {}, 'Touch', 15, attempts, successes), null);
  assert.equal(logTrainingResult({ Touch: { attempts: 15, successes: 9 } }, {}, 'Touch', 15, 1, 1), null);
  assert.equal(undoTrainingResult({}, {}, 'Touch'), null);
});

test('custom skill names cannot collide with inherited dictionary properties', () => {
  for (const skill of ['constructor', '__proto__', 'toString']) {
    const result = logTrainingResult({}, {}, skill, 15, 1, 1);
    assert.deepEqual(result.stats[skill], { attempts: 1, successes: 1 });
    assert.deepEqual(undoTrainingResult(result.stats, result.history, skill).stats[skill], { attempts: 0, successes: 0 });
  }
});
test('reordering retains skill scoring and never mutates the original', () => {
  const template = { skills: ['Touch', 'Passing', 'Shooting'], drills: { Touch: { points: 10 } } };
  const moved = moveTemplateSkill(template, 0, 1);
  assert.deepEqual(moved.skills, ['Passing', 'Touch', 'Shooting']);
  assert.equal(moved.drills, template.drills);
  assert.deepEqual(template.skills, ['Touch', 'Passing', 'Shooting']);
  assert.equal(moveTemplateSkill(template, 0, -1), template);
});
const now = Date.parse('2026-10-06T12:00:00Z');
const session = (days, accuracy = 60) => ({ completedAt: new Date(now - days * 86400000).toISOString(), accuracy, minutes: 20, recipe: { id: 'one', name: 'One' } });
test('report periods exclude undated and future history except in explicit all-time history', () => {
  const undated = { ...session(1), completedAt: undefined };
  assert.equal(sessionsInPeriod([session(7), session(8), session(-1), undated], 7, now).length, 1);
  assert.equal(sessionsInPeriod([undated], null, now).length, 1);
});
test('report accuracy is weighted by attempts rather than averaging mismatched session sizes', () => {
  const a = { ...session(1), skillStats: { Touch: { attempts: 10, successes: 10 } } };
  const b = { ...session(2), skillStats: { Touch: { attempts: 90, successes: 0 } } };
  assert.equal(reportAccuracy([a, b]), 10);
  assert.equal(reportAccuracy([a, session(3, 0)]), 100);
  assert.equal(reportAccuracy([]), null);
  assert.equal(reportAccuracy([session(1, 50), session(2, 70)]), 60);
});
test('planned legacy minutes are not passed off as measured training', () => {
  assert.equal(measuredMinutes([session(1), { ...session(2), elapsedMs: 120000 }]), 2);
  assert.equal(formatTrainingTime(125000), '2:05');
  assert.equal(formatTrainingTime(-100), '0:00');
});

test('sessions with no logged attempts do not become invented zero-percent accuracy', () => {
  const empty = { ...session(1, 0), skillStats: { Touch: { attempts: 0, successes: 0 } } };
  assert.equal(reportAccuracy([empty]), null);
  assert.equal(reportAccuracy([empty, session(2, 70)]), 70);
});
test('opportunities use actual results and respect eligible position skills', () => {
  const templates = [{ id: 'gk', name: 'Goalkeeper', skills: ['Handling'] }, { id: 'fw', name: 'Forward', skills: ['Shooting'] }];
  const records = [{ ...session(1), skillStats: { Shooting: { attempts: 15, successes: 0 }, Handling: { attempts: 15, successes: 9 } } }];
  const result = nextTrainingOpportunity(templates, records, ['Handling']);
  assert.equal(result.skill, 'Handling'); assert.equal(result.accuracy, 60); assert.equal(result.template.id, 'gk');
});
test('sparse results do not produce a fabricated weak-skill recommendation', () => {
  const templates = [{ id: 'gk', name: 'Goalkeeper', skills: ['Handling'] }];
  const result = nextTrainingOpportunity(templates, [{ ...session(1), skillStats: { Handling: { attempts: 2, successes: 0 } } }], ['Handling']);
  assert.equal(result.skill, null); assert.equal(result.template.id, 'gk');
});
test('draft snapshots survive serialization and corrupted drafts are rejected', () => {
  const draft = { recipe: { id: 'one', name: 'One', minutes: 20, skills: ['Touch'] }, elapsedMs: 12000, index: 0, stats: { Touch: { attempts: 4, successes: 3 } }, history: { Touch: [{ attempts: 0, successes: 0 }] }, note: 'Practice', acknowledged: {} };
  assert.equal(validTrainingDraft(JSON.parse(JSON.stringify(draft))), true);
  for (const broken of [null, {}, { ...draft, index: 1 }, { ...draft, elapsedMs: -1 }, { ...draft, stats: { Touch: { attempts: 2, successes: 4 } } }, { ...draft, history: { Touch: 'wrong' } }, { ...draft, note: {} }]) assert.equal(validTrainingDraft(broken), false);
});
