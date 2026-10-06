const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const ts = require('typescript');
const React = require('react');
const Renderer = require('react-test-renderer');
global.IS_REACT_ACT_ENVIRONMENT = true;

// Exercise actual screen components without changing any device/user data.
const data = new Map();
const alerts = [];
const backHandlers = [];
const appStateHandlers = [];
const ticks = new Map();
let tickId = 0;
let failHistorySave = false;
const originalInterval = global.setInterval, originalClear = global.clearInterval;
global.setInterval = callback => { const id = ++tickId; ticks.set(id, callback); return id; };
global.clearInterval = id => ticks.delete(id);
const storage = { getItem: async key => data.get(key) ?? null, setItem: async (key, value) => { if (failHistorySave && key === 'goaliva-state' && JSON.parse(value).sessions?.length) throw new Error('Simulated storage failure'); data.set(key, value); } };
const RN = {
  View: 'View', Text: 'Text', Image: 'Image', Pressable: 'Pressable', ScrollView: 'ScrollView', TextInput: 'TextInput', KeyboardAvoidingView: 'KeyboardAvoidingView',
  Platform: { OS: 'android' }, Share: { share: async () => ({}) },
  StyleSheet: { create: value => value, absoluteFill: { position: 'absolute', top: 0, bottom: 0, left: 0, right: 0 } },
  Alert: { alert: (title, message, buttons) => alerts.push({ title, message, buttons }) },
  AppState: { currentState: 'active', addEventListener: (_, callback) => { appStateHandlers.push(callback); return { remove: () => { const index = appStateHandlers.indexOf(callback); if (index >= 0) appStateHandlers.splice(index, 1); } }; } },
  BackHandler: { addEventListener: (_, callback) => { backHandlers.push(callback); return { remove: () => { const index = backHandlers.indexOf(callback); if (index >= 0) backHandlers.splice(index, 1); } }; } },
};
const originalLoad = Module._load;
Module._load = function(request, parent, main) {
  if (request === 'react-native') return RN;
  if (request === 'react-native-safe-area-context') return { SafeAreaProvider: 'SafeAreaProvider', SafeAreaView: 'SafeAreaView', useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) };
  if (request === 'expo-status-bar') return { StatusBar: 'StatusBar' };
  if (request === '@react-native-async-storage/async-storage') return { __esModule: true, default: storage };
  return originalLoad.call(this, request, parent, main);
};
for (const extension of ['.tsx', '.ts']) require.extensions[extension] = (module, path) => {
  const output = ts.transpileModule(fs.readFileSync(path, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText;
  module._compile(output, path);
};
require.extensions['.png'] = module => { module.exports = 'test-image'; };
const App = require('./App.tsx').default;
const { LiveSessionScreen } = require('./LiveSessionScreen.tsx');
const { TemplateEditorScreen } = require('./TemplateEditorScreen.tsx');
const { PlayerProfileEditor } = require('./PlayerProfileEditor.tsx');
const { SkillTrendReport } = require('./SkillTrendReport.tsx');
const { CustomSkillCreator } = require('./CustomSkillCreator.tsx');
const { defaultDrillConfig } = require('./drillScoring.ts');

const recipe = skills => ({ id: 'recipe-test', name: 'Test training', skills, minutes: 20, color: '#005437', focus: 'Forward', drills: Object.fromEntries(skills.map(skill => [skill, defaultDrillConfig()])) });
function seed(skills = ['First Touch']) {
  data.clear(); alerts.length = 0; failHistorySave = false;
  data.set('goaliva-state', JSON.stringify({ recipes: [recipe(skills)], sessions: [], customSkills: [], profileName: 'Player', position: 'Forward', profileAge: '', profileClub: '', onboardingCompleted: true, templateFocusVersion: 1, theme: 'Alpine Green' }));
}
const settle = () => new Promise(resolve => setImmediate(resolve));
async function mount() { let tree; await Renderer.act(async () => { tree = Renderer.create(React.createElement(App)); await settle(); }); return tree; }
async function unmount(tree) { await Renderer.act(async () => { tree.unmount(); await settle(); }); }
function text(node) { return node.findAllByType('Text').map(item => (Array.isArray(item.props.children) ? item.props.children : [item.props.children]).filter(value => ['string', 'number'].includes(typeof value)).join('')).join(' '); }
function button(root, label) { const found = root.findAllByType('Pressable').find(node => text(node) === label || node.props.accessibilityLabel === label); assert.ok(found, `Missing button: ${label}`); return found; }
async function press(root, label) { await Renderer.act(async () => { button(root, label).props.onPress(); await settle(); }); }
async function change(root, label, value) { await Renderer.act(async () => { const input = root.findAllByType('TextInput').find(node => node.props.accessibilityLabel === label); assert.ok(input, `Missing input: ${label}`); input.props.onChangeText(value); await settle(); }); }
async function confirm(label) { const alert = alerts.at(-1); assert.ok(alert, 'Expected a confirmation'); const action = alert.buttons.find(button => button.text === label); assert.ok(action, `Missing alert action ${label}`); await Renderer.act(async () => { action.onPress?.(); await settle(); }); }
async function start(tree) { await press(tree.root, 'Start training  →'); }
function assertNativeText(node) { if (!node) return; if (Array.isArray(node)) return node.forEach(assertNativeText); for (const child of node.children ?? []) { if (typeof child === 'string') assert.equal(node.type, 'Text', `Bare text in ${node.type}`); else assertNativeText(child); } }

test('live controls log and undo the exact last result, and stay outside the scroll content', async () => {
  seed(); const tree = await mount();
  try {
    await start(tree);
    await press(tree.root, 'Log a successful attempt'); await press(tree.root, 'Log a missed attempt');
    let live = tree.root.findByType(LiveSessionScreen);
    assert.equal(live.props.attempts, 2); assert.equal(live.props.successes, 1);
    const success = button(tree.root, 'Log a successful attempt');
    let parent = success.parent;
    while (parent && parent !== live) { assert.notEqual(parent.type, 'ScrollView', 'Logging control must be fixed, not scrolling'); parent = parent.parent; }
    await press(tree.root, 'Undo last entry');
    live = tree.root.findByType(LiveSessionScreen); assert.equal(live.props.attempts, 1); assert.equal(live.props.successes, 1);
    assertNativeText(tree.toJSON());
  } finally { await unmount(tree); }
});
test('recording a full set gives one-band points and undo reopens the drill', async () => {
  seed(); const tree = await mount();
  try {
    await start(tree); await press(tree.root, 'Enter set results');
    await change(tree.root, 'Successes in set', '9'); await press(tree.root, 'Record set');
    let live = tree.root.findByType(LiveSessionScreen);
    assert.equal(live.props.attempts, 15); assert.equal(live.props.total, 5); assert.equal(live.props.showResult, true);
    await press(tree.root, 'Review or correct result'); await press(tree.root, 'Undo last entry');
    live = tree.root.findByType(LiveSessionScreen);
    assert.equal(live.props.attempts, 0); assert.equal(live.props.estimate, 0); assert.equal(live.props.total, 0); assert.equal(live.props.showResult, false);
  } finally { await unmount(tree); }
});

test('rapid taps are all counted exactly once and capped at the attempt target', async () => {
  seed(); const tree = await mount();
  try {
    await start(tree);
    const success = button(tree.root, 'Log a successful attempt');
    await Renderer.act(async () => { for (let i = 0; i < 20; i++) success.props.onPress(); await settle(); });
    const live = tree.root.findByType(LiveSessionScreen);
    assert.equal(live.props.attempts, 15); assert.equal(live.props.successes, 15); assert.equal(live.props.total, 20);
  } finally { await unmount(tree); }
});
test('saved unfinished training resumes after an app restart, with Undo history', async () => {
  seed(); let tree = await mount();
  try {
    await start(tree); await press(tree.root, 'Log a successful attempt');
    await press(tree.root, '‹ Exit'); await confirm('Save & exit');
    assert.equal(JSON.parse(data.get('goaliva-live-draft')).stats['First Touch'].successes, 1);
    await unmount(tree); tree = await mount(); await press(tree.root, 'Resume session');
    assert.equal(tree.root.findByType(LiveSessionScreen).props.successes, 1);
    await press(tree.root, 'Undo last entry'); assert.equal(tree.root.findByType(LiveSessionScreen).props.attempts, 0);
  } finally { await unmount(tree); }
});
test('completed sessions store measured elapsed time and clear the resumable draft', async () => {
  seed(); const tree = await mount(); const realNow = Date.now;
  try {
    await start(tree);
    Date.now = () => realNow() + 120000;
    await Renderer.act(async () => { for (const tick of ticks.values()) tick(); await settle(); });
    await press(tree.root, 'Enter set results'); await change(tree.root, 'Successes in set', '9'); await press(tree.root, 'Record set');
    await press(tree.root, 'Save session & see total');
    const saved = JSON.parse(data.get('goaliva-state')).sessions[0];
    assert.equal(saved.totalPoints, 5); assert.ok(saved.elapsedMs >= 120000); assert.equal(saved.plannedMinutes, 20); assert.ok(saved.minutes < 3);
    assert.equal(JSON.parse(data.get('goaliva-live-draft')), null);
    assertNativeText(tree.toJSON());
  } finally { Date.now = realNow; await unmount(tree); }
});
test('template duration can be cleared, and reordering does not reset saved scoring', async () => {
  seed(['First Touch', 'Passing']); const tree = await mount();
  try {
    await press(tree.root, 'Templates'); await press(tree.root, 'Edit Test training');
    await change(tree.root, 'Session length in minutes', '');
    assert.equal(tree.root.findByType(TemplateEditorScreen).props.minutes, '');
    await change(tree.root, 'Session length in minutes', '25');
    const editor = tree.root.findByType(TemplateEditorScreen);
    const down = editor.findAllByType('Pressable').find(node => text(node) === '↓' && !node.props.disabled);
    await Renderer.act(async () => { down.props.onPress(); });
    assert.deepEqual(tree.root.findByType(TemplateEditorScreen).props.template.skills, ['Passing', 'First Touch']);
    await press(tree.root, 'Save template');
    const saved = JSON.parse(data.get('goaliva-state')).recipes[0];
    assert.equal(saved.minutes, 25); assert.equal(saved.drills['First Touch'].targetAttempts, 15);
  } finally { await unmount(tree); }
});
test('custom skill creation works in the editor with description and defaults', async () => {
  seed(); const tree = await mount();
  try {
    await press(tree.root, 'Templates'); await press(tree.root, 'Edit Test training'); await press(tree.root, '＋ Create a custom skill');
    await change(tree.root, 'New custom skill name', 'Crossing accuracy'); await change(tree.root, 'Custom skill description', 'Hit the marked target.');
    await press(tree.root, 'Create & add to template');
    const editor = tree.root.findByType(TemplateEditorScreen);
    assert.ok(editor.props.template.skills.includes('Crossing accuracy')); assert.equal(editor.props.template.drills['Crossing accuracy'].targetAttempts, 15);
    assert.equal(JSON.parse(data.get('goaliva-state')).customSkills[0].description, 'Hit the marked target.');
  } finally { await unmount(tree); }
});
test('profile changes are drafts until Save and update recommendations afterwards', async () => {
  seed(); const tree = await mount();
  try {
    await press(tree.root, 'Settings'); await press(tree.root, 'Profile & position');
    await change(tree.root, 'Player name', 'Updated Player');
    assert.equal(JSON.parse(data.get('goaliva-state')).profileName, 'Player');
    await press(tree.root.findByType(PlayerProfileEditor), 'Goalkeeper'); await press(tree.root, 'Save profile');
    const saved = JSON.parse(data.get('goaliva-state')); assert.equal(saved.profileName, 'Updated Player'); assert.equal(saved.position, 'Goalkeeper');
  } finally { await unmount(tree); }
});
test('skill charts default to accuracy and keep extra filters below the chart', async () => {
  seed(); const tree = await mount();
  try {
    await press(tree.root, 'Progress'); await press(tree.root, 'Explore skill charts');
    const report = tree.root.findByType(SkillTrendReport);
    assert.equal(report.findAllByType('Pressable').some(node => text(node).startsWith('Filters · Accuracy')), true);
    assert.equal(report.findAllByType('Pressable').some(node => text(node) === 'Points'), false);
    await press(report, 'Filters · Accuracy · All templates +'); await press(tree.root.findByType(SkillTrendReport), 'Points');
    assert.equal(tree.root.findByType(SkillTrendReport).findAllByType('Pressable').some(node => text(node).startsWith('Filters · Points')), true);
    assertNativeText(tree.toJSON());
  } finally { await unmount(tree); }
});

test('failed completion saving retains the live draft and can be retried safely', async () => {
  seed(); const tree = await mount();
  try {
    await start(tree); await press(tree.root, 'Enter set results'); await change(tree.root, 'Successes in set', '9'); await press(tree.root, 'Record set');
    failHistorySave = true;
    await press(tree.root, 'Save session & see total');
    assert.equal(alerts.at(-1).title, 'Could not save session');
    assert.equal(tree.root.findByType(LiveSessionScreen).props.attempts, 15);
    assert.equal(JSON.parse(data.get('goaliva-live-draft')).stats['First Touch'].attempts, 15);
    assert.equal(JSON.parse(data.get('goaliva-state')).sessions.length, 0);
    failHistorySave = false; await press(tree.root, 'Save session & see total');
    assert.equal(JSON.parse(data.get('goaliva-state')).sessions.length, 1);
    assert.equal(JSON.parse(data.get('goaliva-live-draft')), null);
  } finally { failHistorySave = false; await unmount(tree); }
});

test('reset is confirmed and only clears the current skill without advancing', async () => {
  seed(['First Touch', 'Passing']); const tree = await mount();
  try {
    await start(tree); await press(tree.root, 'Log a successful attempt'); await press(tree.root, 'Next skill ›'); await press(tree.root, 'Log a missed attempt');
    await press(tree.root, 'More'); await confirm('Reset current skill');
    assert.equal(alerts.at(-1).title, 'Reset this skill?'); await confirm('Reset skill');
    const live = tree.root.findByType(LiveSessionScreen);
    assert.equal(live.props.index, 1); assert.equal(live.props.attempts, 0); assert.equal(live.props.estimate, 0);
    await press(tree.root, '‹ Previous'); assert.equal(tree.root.findByType(LiveSessionScreen).props.successes, 1);
  } finally { await unmount(tree); }
});

test('hardware back follows the same save/exit flow and does not discard silently', async () => {
  seed(); const tree = await mount();
  try {
    await start(tree); await press(tree.root, 'Log a successful attempt');
    await Renderer.act(async () => { for (const handler of [...backHandlers].reverse()) if (handler()) break; await settle(); });
    assert.equal(alerts.at(-1).title, 'Leave training?');
    assert.ok(alerts.at(-1).buttons.some(button => button.text === 'Save & exit'));
    await confirm('Keep training'); assert.equal(tree.root.findByType(LiveSessionScreen).props.successes, 1);
  } finally { await unmount(tree); }
});

test('template back warns about changed values and leaves the saved version intact', async () => {
  seed(); const tree = await mount();
  try {
    await press(tree.root, 'Templates'); await press(tree.root, 'Edit Test training'); await change(tree.root, 'Session length in minutes', '45'); await press(tree.root.findByType(TemplateEditorScreen), '‹ Back');
    assert.equal(alerts.at(-1).title, 'Discard template changes?');
    await confirm('Keep editing'); assert.equal(tree.root.findByType(TemplateEditorScreen).props.minutes, '45');
    await press(tree.root.findByType(TemplateEditorScreen), '‹ Back'); await confirm('Discard changes');
    assert.equal(JSON.parse(data.get('goaliva-state')).recipes[0].minutes, 20);
  } finally { await unmount(tree); }
});

test('themes are clearly instant-save settings and remain selected on another screen', async () => {
  seed(); const tree = await mount();
  try {
    await press(tree.root, 'Settings'); await press(tree.root, 'Choose theme');
    const night = tree.root.findAllByType('Pressable').find(node => text(node).startsWith('Night Match'));
    assert.ok(night); await Renderer.act(async () => { night.props.onPress(); await settle(); });
    assert.equal(JSON.parse(data.get('goaliva-state')).theme, 'Night Match');
    await press(tree.root, 'Done'); await press(tree.root, 'Skill library');
    assert.equal(tree.root.findByType(CustomSkillCreator).props.palette.dark, true);
  } finally { await unmount(tree); }
});

test('completed history wins over a stale matching recovery draft after restart', async () => {
  seed(); const saved = JSON.parse(data.get('goaliva-state'));
  saved.sessions = [{ id: 'already-saved', recipe: recipe(['First Touch']), skills: ['First Touch'], minutes: 2, accuracy: 60, date: 'Today', completedAt: new Date().toISOString() }]; data.set('goaliva-state', JSON.stringify(saved));
  data.set('goaliva-live-draft', JSON.stringify({ id: 'already-saved', recipe: recipe(['First Touch']), stats: { 'First Touch': { attempts: 15, successes: 9 } }, history: {}, elapsedMs: 120000, index: 0, note: '', acknowledged: {} }));
  const tree = await mount();
  try { assert.equal(tree.root.findAllByType('Pressable').some(node => text(node) === 'Resume session'), false); assert.equal(JSON.parse(data.get('goaliva-state')).sessions.length, 1); }
  finally { await unmount(tree); }
});

test('phone backgrounding keeps session time while explicit Pause stops it', async () => {
  seed(); const tree = await mount(); const originalNow = Date.now; let now = originalNow();
  Date.now = () => now;
  try {
    await start(tree);
    now += 30000;
    await Renderer.act(async () => { RN.AppState.currentState = 'background'; for (const listener of appStateHandlers) listener('background'); await settle(); });
    now += 60000;
    await Renderer.act(async () => { RN.AppState.currentState = 'active'; for (const listener of appStateHandlers) listener('active'); await settle(); });
    assert.equal(tree.root.findByType(LiveSessionScreen).props.elapsedMs, 90000);
    await press(tree.root, 'More'); await confirm('Pause timer');
    assert.equal(tree.root.findByType(LiveSessionScreen).props.paused, true);
    now += 120000;
    await Renderer.act(async () => { for (const tick of ticks.values()) tick(); await settle(); });
    assert.equal(tree.root.findByType(LiveSessionScreen).props.elapsedMs, 90000);
    await press(tree.root, 'More'); await confirm('Resume timer');
    now += 5000;
    await Renderer.act(async () => { for (const tick of ticks.values()) tick(); await settle(); });
    assert.equal(tree.root.findByType(LiveSessionScreen).props.elapsedMs, 95000);
  } finally { Date.now = originalNow; RN.AppState.currentState = 'active'; await unmount(tree); }
});

test('back dismisses set entry without leaving the active session', async () => {
  seed(); const tree = await mount();
  try {
    await start(tree); await press(tree.root, 'Enter set results');
    await Renderer.act(async () => { for (const handler of [...backHandlers].reverse()) if (handler()) break; await settle(); });
    assert.equal(tree.root.findByType(LiveSessionScreen).props.attempts, 0);
    assert.equal(tree.root.findAllByType('TextInput').some(node => node.props.accessibilityLabel === 'Attempts in set'), false);
    assert.equal(alerts.length, 0);
  } finally { await unmount(tree); }
});

test('first-time setup starts with position and all questions remain skippable', async () => {
  data.clear(); alerts.length = 0; const tree = await mount();
  try {
    assert.equal(tree.root.findAllByType('Text').some(node => node.props.children === 'Where do you play?'), true);
    assert.equal(tree.root.findAllByType('TextInput').some(node => node.props.accessibilityLabel === 'Player name'), false);
    await press(tree.root, 'Skip this question');
    assert.ok(tree.root.findAllByType('TextInput').some(node => node.props.accessibilityLabel === 'Player name'));
    const skip = button(tree.root, 'Skip this question'); let parent = skip.parent;
    while (parent) { assert.notEqual(parent.type, 'ScrollView', 'Questionnaire actions should stay fixed'); parent = parent.parent; }
    await press(tree.root, 'Skip this question'); await press(tree.root, 'Skip this question'); await press(tree.root, 'Skip this question');
    const saved = JSON.parse(data.get('goaliva-state')); assert.equal(saved.onboardingCompleted, true); assert.equal(saved.position, '');
    assertNativeText(tree.toJSON());
  } finally { await unmount(tree); }
});
test.after(() => { global.setInterval = originalInterval; global.clearInterval = originalClear; Module._load = originalLoad; });
