import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, AppState, BackHandler, Image, KeyboardAvoidingView, Platform, Pressable, ScrollView, Share, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaProvider, SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { POSITIONS, TEMPLATE_FOCUSES, inferTemplateFocus, isPosition, rankTemplates, type PlayerPosition, type TemplateFocus } from './templateRelevance';

import { THEME_NAMES, THEME_PALETTES, resolveThemeName, type ThemePalette } from './appThemes';
import { ThemeGradient } from './ThemeGradient';
import { PlayerProfileEditor } from './PlayerProfileEditor';
import { SkillLibraryScreen } from './SkillLibraryScreen';
import { TemplateEditorScreen } from './TemplateEditorScreen';
import { LiveSessionScreen } from './LiveSessionScreen';
import { formatTrainingTime, logTrainingResult, undoTrainingResult, validTrainingDraft, sessionsInPeriod, reportAccuracy, measuredMinutes, nextTrainingOpportunity, moveTemplateSkill, type AttemptHistory } from './trainingUX';
import { SkillTrendReport } from './SkillTrendReport';
import { sessionLengthInput, parseSessionMinutes } from './sessionLength';
import { CustomSkillCreator } from './CustomSkillCreator';
import { DrillScoringEditor } from './DrillScoringEditor';
import { addTemplateSkill, buildDrillResults, calculateLiveDrillPoints, resetSkillStats, getDrillConfig, scoreBandLabels, withDrillConfigs, type DrillConfig, type DrillResult } from './drillScoring';

type Skill = string;
type CustomSkill = { id: string; name: string; icon: string; description?: string };
type Recipe = { id: string; name: string; skills: Skill[]; minutes: number; color: string; focus: TemplateFocus; drills?: Record<string, DrillConfig> };
type SkillStats = { attempts: number; successes: number };
type Session = { id?: string; elapsedMs?: number; plannedMinutes?: number; completedAt?: string; recipe: Recipe; date: string; minutes: number; accuracy: number; skills: Skill[]; skillStats?: Record<string, SkillStats>; note?: string; totalPoints?: number; drillResults?: Record<string, DrillResult> };

const C = { ink: '#1B2924', muted: '#66756E', green: '#163E31', mint: '#E9EEEB', cream: '#F5F6F3', yellow: '#C7A86B', coral: '#9B665B', blue: '#526D86', line: '#E0E6E1', white: '#FFFFFF' };
const ALL_SKILLS: Skill[] = ['Ball Mastery', 'First Touch', 'Shooting', 'Weak Foot', 'Passing', '1v1 Moves', 'Defensive Footwork', 'Handling', 'Goalkeeper Footwork', 'Distribution'];
const icons: Record<string, string> = { 'Ball Mastery': '◉', 'First Touch': '◇', Shooting: '◎', 'Weak Foot': '↗', Passing: '⇄', '1v1 Moves': '✦', 'Defensive Footwork': '↔', Handling: '◈', 'Goalkeeper Footwork': '↔', Distribution: '⇄' };
const skillDescriptions: Record<string, string> = { 'Defensive Footwork': 'Practice controlled lateral steps, jockeying, and recovery to stay balanced in one-on-one situations.', Handling: 'Practice clean catches and securing the ball using controlled service from a partner.', 'Goalkeeper Footwork': 'Practice short adjustment steps and getting set in line with the ball before a catch.', Distribution: 'Practice accurate throws and passes to a target to start the next phase of play.', 'Ball Mastery': 'Improve close control, rhythm, and confidence with the ball at your feet.', 'First Touch': 'Build a softer first touch so you can receive and play faster under pressure.', Shooting: 'Practice clean striking, accuracy, and finishing technique.', 'Weak Foot': 'Give your non-dominant foot more confidence for passes, shots, and control.', Passing: 'Sharpen weight, timing, and accuracy when connecting with teammates.', '1v1 Moves': 'Develop changes of direction and moves that help you beat a defender.' };
const customIconOptions = ['◇', '◎', '↗', '⇄', '✦', '★', '◉', '△'];
let activeTheme: ThemePalette = THEME_PALETTES['Alpine Green'];

const starterRecipes: Recipe[] = [
  { id: 'complete', name: 'Complete Player', skills: ['Ball Mastery', 'First Touch', 'Passing', 'Shooting'], minutes: 20, color: C.coral, focus: 'All positions' },
  { id: 'weak', name: 'Weak Foot Focus', skills: ['Weak Foot', 'First Touch', 'Shooting'], minutes: 15, color: C.blue, focus: 'Forward' },
  { id: 'technical', name: 'Technical Flow', skills: ['Ball Mastery', '1v1 Moves', 'Passing'], minutes: 18, color: C.green, focus: 'Midfielder' },
  { id: 'forward-finishing', name: 'Forward Finishing', skills: ['First Touch', '1v1 Moves', 'Shooting'], minutes: 20, color: C.green, focus: 'Forward' },
  { id: 'midfield-control', name: 'Midfield Control', skills: ['First Touch', 'Passing', 'Weak Foot'], minutes: 18, color: C.green, focus: 'Midfielder' },
  { id: 'defender-foundation', name: 'Defender Foundation', skills: ['Defensive Footwork', 'First Touch', 'Passing'], minutes: 18, color: C.green, focus: 'Defender' },
  { id: 'goalkeeper-foundation', name: 'Goalkeeper Foundation', skills: ['Handling', 'Goalkeeper Footwork', 'Distribution'], minutes: 20, color: C.green, focus: 'Goalkeeper' },
];


function Button({ children, onPress, variant = 'primary', disabled = false }: { children: React.ReactNode; onPress: () => void; variant?: 'primary' | 'ghost' | 'soft'; disabled?: boolean }) {
  return <Pressable accessibilityRole="button" disabled={disabled} accessibilityState={{ disabled }} onPress={onPress} style={({ pressed }) => [styles.button, { backgroundColor: variant === 'primary' ? activeTheme.buttonGradient[0] : variant === 'soft' ? activeTheme.mint : 'transparent', borderColor: activeTheme.line }, variant === 'ghost' && styles.ghostButton, variant === 'soft' && styles.softButton, pressed && styles.pressed, disabled && { opacity: 0.4 }]}>{variant === 'primary' && <ThemeGradient colors={activeTheme.buttonGradient} />}<Text style={[styles.buttonText, { color: variant === 'primary' ? activeTheme.onAccent : activeTheme.ink }]}>{children}</Text></Pressable>;
}

function SkillPill({ skill, active, onPress, icon }: { skill: Skill; active?: boolean; onPress?: () => void; icon?: string }) {
  return <Pressable onPress={onPress} style={[styles.skillPill, { backgroundColor: active ? activeTheme.primary : activeTheme.surface, borderColor: activeTheme.line }, active && styles.activeSkillPill]}><Text style={[styles.skillIcon, active && styles.activeSkillText]}>{icon ?? icons[skill] ?? '•'}</Text><Text style={[styles.skillPillText, { color: active ? activeTheme.onPrimary : activeTheme.ink }, active && styles.activeSkillText]}>{skill}</Text></Pressable>;
}
export default function App() {
  const [customSkills, setCustomSkills] = useState<CustomSkill[]>([]);
  const [tab, setTab] = useState<'Today' | 'Recipes' | 'Progress' | 'More'>('Today');
  const [recipes, setRecipes] = useState<Recipe[]>(() => starterRecipes.map(withDrillConfigs));
  const [sessions, setSessions] = useState<Session[]>([]);
  const [editing, setEditing] = useState<Recipe | null>(null);
  const [sessionMinutesDraft, setSessionMinutesDraft] = useState('');
  const [scoringSkill, setScoringSkill] = useState<string | null>(null);
  const [active, setActive] = useState<Recipe | null>(null);
  const [currentSkillIndex, setCurrentSkillIndex] = useState(0);
  const [skillStats, setSkillStats] = useState<Record<string, SkillStats>>({});
  const [attemptHistory, setAttemptHistory] = useState<AttemptHistory>({});
  const trainingData = useRef<{ stats: Record<string, SkillStats>; history: AttemptHistory }>({ stats: {}, history: {} });
  const [elapsedMs, setElapsedMs] = useState(0);
  const [timerPaused, setTimerPaused] = useState(false);
  const [sessionRunId, setSessionRunId] = useState('');
  const savingRun = useRef(false);
  const [savingSession, setSavingSession] = useState(false);
  type TrainingDraft = { id?: string; recipe: Recipe; stats: Record<string, SkillStats>; history: AttemptHistory; elapsedMs: number; index: number; note: string; paused?: boolean; acknowledged: Record<string, boolean> };
  const [resumeDraft, setResumeDraft] = useState<TrainingDraft | null>(null);
  const [storageNotice, setStorageNotice] = useState<string | null>(null);
  const draftWrites = useRef<Promise<unknown>>(Promise.resolve());
  const [searchTemplates, setSearchTemplates] = useState('');
  const [templateNotice, setTemplateNotice] = useState('');
  const [reportDays, setReportDays] = useState<number | null>(30);
  const [expandedResultSkill, setExpandedResultSkill] = useState<string | null>(null);
  const originalEdit = useRef<string>('');
  const { attempts, successes } = skillStats[active?.skills[currentSkillIndex] ?? ''] ?? { attempts: 0, successes: 0 };
  const [note, setNote] = useState('');
  const [resetSkillNotice, setResetSkillNotice] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(false);

  const [skillDraft, setSkillDraft] = useState('');
  const [customIconDraft, setCustomIconDraft] = useState('★');
  const [editingCustomSkillId, setEditingCustomSkillId] = useState<string | null>(null);
  const [skillInfo, setSkillInfo] = useState<string | null>(null);
  const [reportDetail, setReportDetail] = useState<string | null>(null);
  const [selectedSession, setSelectedSession] = useState<Session | null>(null);
  const [trendSkill, setTrendSkill] = useState<string | null>(null);
  const [skillSummary, setSkillSummary] = useState<string | null>(null);
  const [acknowledgedSkills, setAcknowledgedSkills] = useState<Record<string, boolean>>({});
  const [reportView, setReportView] = useState<'best' | 'recent' | 'next' | null>(null);
  const [settingsPanel, setSettingsPanel] = useState<'profile' | 'theme' | 'skills' | null>(null);
  const [profileName, setProfileName] = useState('');
  const [position, setPosition] = useState<PlayerPosition | ''>('');
  const [profileAge, setProfileAge] = useState('');
  const [profileClub, setProfileClub] = useState('');
  const [onboardingCompleted, setOnboardingCompleted] = useState(false);
  const [onboardingStep, setOnboardingStep] = useState(0);
  const ageValid = !profileAge || (Number(profileAge) >= 1 && Number(profileAge) <= 120);
  const [theme, setTheme] = useState('Alpine Green');
  const [themePalette, setThemePalette] = useState<ThemePalette>(THEME_PALETTES['Alpine Green']);
  activeTheme = themePalette;
  styles = useMemo(() => createStyles(themePalette), [themePalette]);
  const [skillFilter, setSkillFilter] = useState<Skill | null>(null);

  useEffect(() => {
    const listener = BackHandler.addEventListener('hardwareBackPress', () => {
      if (savingRun.current) return true;
      if (trendSkill) { setTrendSkill(null); return true; }
      if (skillSummary) { setSkillSummary(null); return true; }
      if (selectedSession) { setSelectedSession(null); return true; }
      if (scoringSkill) return false;
      if (reportView) { setReportView(null); return true; }
      if (settingsPanel) { if (settingsPanel === 'profile' || settingsPanel === 'skills') return false; setSettingsPanel(null); return true; }
      if (editing) { closeTemplateEditor(); return true; }
      if (active) return false;
      if (!onboardingCompleted && onboardingStep > 0) { setOnboardingStep(onboardingStep - 1); return true; }
      return false;
    });
    return () => listener.remove();
  }, [trendSkill, skillSummary, selectedSession, scoringSkill, reportView, settingsPanel, editing, sessionMinutesDraft, active, skillStats, attemptHistory, elapsedMs, note, currentSkillIndex, acknowledgedSkills, timerPaused, sessionRunId, onboardingCompleted, onboardingStep]);

  const weekSessions = sessionsInPeriod(sessions, 7);
  const weeklyMinutes = measuredMinutes(weekSessions);
  const weekAccuracy = reportAccuracy(weekSessions);
  const periodSessions = sessionsInPeriod(sessions, reportDays);
  const recentAccuracy = reportAccuracy(periodSessions);
  const periodLabel = reportDays === null ? 'All time' : `Last ${reportDays} days`;
  const avgAccuracy = sessions.length ? Math.round(sessions.reduce((sum, s) => sum + s.accuracy, 0) / sessions.length) : 0;
  const rankedRecipes = useMemo(() => rankTemplates(recipes, position), [recipes, position]);
  const focusRecipe = rankedRecipes.find(template => template.skills.length > 0);
  const latestScoredSession = sessions.find(session => session.drillResults);
  const bestAccuracy = Math.max(...sessions.map((session) => session.accuracy), 0);
  const customIconMap = Object.fromEntries(customSkills.map((skill) => [skill.name, skill.icon === '⚽' ? '◉' : skill.icon]));
  const describeSkill = (skill: string) => customSkills.find(item => item.name === skill)?.description || (Object.prototype.hasOwnProperty.call(skillDescriptions, skill) ? skillDescriptions[skill] : 'Your custom skill. Log each attempt and keep your notes specific.');
  const availableSkills = [...ALL_SKILLS, ...customSkills.map((skill) => skill.name)];
  const getSkillIcon = (skill: Skill) => { const value = customIconMap[skill] ?? icons[skill]; return typeof value === 'string' ? value : '◇'; };
  const themeOptions = THEME_NAMES;
  const themePalettes = THEME_PALETTES;
  const positionSkills = position === 'Goalkeeper' ? ['Handling', 'Goalkeeper Footwork', 'Distribution', 'Passing'] : position === 'Defender' ? ['Defensive Footwork', 'Passing', 'First Touch', '1v1 Moves'] : position === 'Forward' ? ['Shooting', '1v1 Moves', 'Weak Foot', 'First Touch'] : position === 'Midfielder' ? ['Passing', 'First Touch', 'Ball Mastery', 'Weak Foot'] : availableSkills;
  const relevantSkills = Array.from(new Set([...positionSkills, ...rankedRecipes.filter(template => !position || template.focus === position || template.focus === 'All positions').flatMap(template => template.skills.filter(skill => customSkills.some(custom => custom.name === skill)))]));
  const opportunity = nextTrainingOpportunity(rankedRecipes, periodSessions, relevantSkills);
  const opportunityCopy = opportunity.skill ? `${opportunity.skill}: ${opportunity.accuracy}% across ${opportunity.attempts} recorded attempts. Try ${opportunity.template?.name}.` : `Not enough recorded attempts for a performance recommendation yet. ${opportunity.template?.name ?? 'Create a template'} is recommended ${position ? 'for your ' + position.toLowerCase() + ' position' : 'from your training library'}.`;

  useEffect(() => {
    Promise.all([AsyncStorage.getItem('goaliva-state'), AsyncStorage.getItem('goaliva-live-draft')]).then(([raw, draftRaw]) => {
      try { const draft = JSON.parse(draftRaw || 'null'); const storedSessions = JSON.parse(raw || '{}').sessions; if (validTrainingDraft(draft) && !(draft.id && Array.isArray(storedSessions) && storedSessions.some((session: Session) => session.id === draft.id))) setResumeDraft({ ...draft, recipe: withDrillConfigs(draft.recipe), history: draft.history ?? {}, acknowledged: draft.acknowledged ?? {}, note: draft.note ?? '' }); } catch { /* Preserve main history even if a draft is damaged. */ }
      if (!raw) return;
      try {
        const saved = JSON.parse(raw);
        if (Array.isArray(saved.recipes)) {
          const migrated: Recipe[] = saved.recipes.map((recipe: Recipe) => withDrillConfigs({ ...recipe, focus: inferTemplateFocus(recipe) }));
          // Introduce the position library once, while preserving edits and later deletions.
          if (!saved.templateFocusVersion && migrated.length) {
            for (const template of starterRecipes.slice(3)) if (!migrated.some(item => item.id === template.id)) migrated.push(withDrillConfigs(template));
          }
          setRecipes(migrated);
        }
        if (Array.isArray(saved.sessions)) setSessions(saved.sessions);
        if (Array.isArray(saved.customSkills)) setCustomSkills(saved.customSkills);
        if (typeof saved.profileName === 'string') setProfileName(saved.profileName);
        if (isPosition(saved.position)) setPosition(saved.position);
        if (typeof saved.profileAge === 'string') setProfileAge(saved.profileAge);
        if (typeof saved.profileClub === 'string') setProfileClub(saved.profileClub);
        // Existing installations keep their profile; only first-time users see setup.
        setOnboardingCompleted(saved.onboardingCompleted !== false);
        if (typeof saved.theme === 'string') { const restoredTheme = resolveThemeName(saved.theme); setTheme(restoredTheme); setThemePalette(themePalettes[restoredTheme]); }
      } catch { /* Ignore corrupted local data and keep starter content. */ }
    }).catch(() => undefined).finally(() => setHydrated(true));
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    const value = JSON.stringify({ recipes, sessions, customSkills, profileName, position, profileAge, profileClub, onboardingCompleted, templateFocusVersion: 1, theme });
    // Queue history before draft cleanup so a completed session cannot disappear
    // between two independent asynchronous storage writes.
    draftWrites.current = draftWrites.current.catch(() => undefined).then(() => AsyncStorage.setItem('goaliva-state', value)).catch(() => setStorageNotice('Could not save your changes. Keep the app open and try again.'));
  }, [hydrated, recipes, sessions, customSkills, profileName, position, profileAge, profileClub, onboardingCompleted, theme]);
  useEffect(() => {
    if (!active || timerPaused) return;
    let last = Date.now();
    const update = () => { const now = Date.now(); setElapsedMs(value => value + Math.max(0, now - last)); last = now; };
    const timer = setInterval(update, 1000);
    // Screen locking must not stop a player's workout timer. Reconcile the
    // wall-clock gap when JS resumes, rather than substituting planned minutes.
    const listener = AppState.addEventListener('change', update);
    return () => { clearInterval(timer); listener.remove(); };
  }, [active?.id, timerPaused]);
  useEffect(() => {
    if (active && hydrated) setResumeDraft({ id: sessionRunId, recipe: active, stats: skillStats, history: attemptHistory, elapsedMs, index: currentSkillIndex, note, paused: timerPaused, acknowledged: acknowledgedSkills });
  }, [active, hydrated, skillStats, attemptHistory, elapsedMs, currentSkillIndex, note, acknowledgedSkills, sessionRunId, timerPaused]);
  useEffect(() => {
    if (!hydrated) return;
    const value = JSON.stringify(resumeDraft);
    draftWrites.current = draftWrites.current.catch(() => undefined).then(() => AsyncStorage.setItem('goaliva-live-draft', value)).then(() => setStorageNotice(null)).catch(() => setStorageNotice('Could not save your practice draft. Keep this screen open and try again.'));
  }, [resumeDraft, hydrated]);

  const currentDrillConfig = active ? getDrillConfig(active, active.skills[currentSkillIndex]) : getDrillConfig({}, '');
  const currentDrillComplete = attempts >= currentDrillConfig.targetAttempts;
  const currentDrillPoints = calculateLiveDrillPoints(attempts, successes, currentDrillConfig);
  const liveResults = active ? buildDrillResults(active, { ...skillStats, [active.skills[currentSkillIndex]]: { attempts, successes } }) : {};
  const liveTotalPoints = Object.values(liveResults).reduce((sum, result) => sum + (result.points ?? 0), 0);

  useEffect(() => {
    const skill = active?.skills[currentSkillIndex];
    if (skill && currentDrillComplete && !acknowledgedSkills[skill]) {
      setAcknowledgedSkills(previous => ({ ...previous, [skill]: true }));
      setSkillSummary(skill);
    }
  }, [active, currentSkillIndex, currentDrillComplete, acknowledgedSkills]);

  const startSession = (recipe: Recipe) => {
    if (!recipe.skills.length) { Alert.alert('Add a skill', 'Edit this template and add at least one skill before training.'); return; }
    if (resumeDraft && !active) { Alert.alert('Unfinished session', 'Resume or discard your unfinished session before starting another.', [{ text: 'Cancel', style: 'cancel' }, { text: 'Resume', onPress: resumeSession }, { text: 'Discard & start', style: 'destructive', onPress: () => { setResumeDraft(null); startFreshSession(recipe); } }]); return; }
    startFreshSession(recipe);
  };
  const startFreshSession = (recipe: Recipe) => {
    const emptyStats = Object.fromEntries(recipe.skills.map((skill) => [skill, { attempts: 0, successes: 0 }]));
    setSkillSummary(null); setAcknowledgedSkills({}); setResetSkillNotice(null);
    trainingData.current = { stats: emptyStats, history: {} };
    setElapsedMs(0); setTimerPaused(false); setAttemptHistory({}); setSessionRunId(`session-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);
    setActive(withDrillConfigs(recipe)); setSkillStats(emptyStats); setCurrentSkillIndex(0); setNote('');
  };
  const resumeSession = () => {
    if (!resumeDraft) return;
    trainingData.current = { stats: resumeDraft.stats, history: resumeDraft.history };
    setSessionRunId(resumeDraft.id || `session-${Date.now()}`); setActive(resumeDraft.recipe); setSkillStats(resumeDraft.stats); setAttemptHistory(resumeDraft.history);
    setElapsedMs(resumeDraft.elapsedMs); setTimerPaused(false); setCurrentSkillIndex(resumeDraft.index); setNote(resumeDraft.note); setAcknowledgedSkills({ ...resumeDraft.acknowledged, [resumeDraft.recipe.skills[resumeDraft.index]]: false }); setSkillSummary(null);
  };
  const leaveSession = () => {
    if (savingRun.current) return;
    Alert.alert('Leave training?', 'Your completed sessions stay in your history.', [
      { text: 'Keep training', style: 'cancel' },
      { text: 'Save & exit', onPress: () => { if (active) setResumeDraft({ id: sessionRunId, recipe: active, stats: skillStats, history: attemptHistory, elapsedMs, index: currentSkillIndex, note, paused: timerPaused, acknowledged: acknowledgedSkills }); setSkillSummary(null); setActive(null); setTab('Today'); } },
      { text: 'Discard session', style: 'destructive', onPress: () => { setActive(null); setSkillSummary(null); setResumeDraft(null); } },
    ]);
  };
  const finishSession = () => {
    if (!active) return;
    const finalStats = { ...trainingData.current.stats };
    const totals = Object.values(finalStats).reduce((sum, stats) => ({ attempts: sum.attempts + stats.attempts, successes: sum.successes + stats.successes }), { attempts: 0, successes: 0 });
    const accuracy = totals.attempts ? Math.round((totals.successes / totals.attempts) * 100) : 0;
    const drillResults = buildDrillResults(active, finalStats);
    const totalPoints = Object.values(drillResults).reduce((sum, result) => sum + (result.points ?? 0), 0);
    const save = async () => {
      if (savingRun.current) return;
      savingRun.current = true; setSavingSession(true);
      const completedAt = new Date().toISOString();
      const savedSession: Session = { id: sessionRunId, recipe: withDrillConfigs(active), date: new Date(completedAt).toLocaleDateString(), completedAt, minutes: elapsedMs / 60000, elapsedMs, plannedMinutes: active.minutes, accuracy, skills: [...active.skills], skillStats: finalStats, note, totalPoints, drillResults };
      try {
        await draftWrites.current.catch(() => undefined);
        // Commit history durably before clearing the only recoverable draft.
        await AsyncStorage.setItem('goaliva-state', JSON.stringify({ recipes, sessions: [savedSession, ...sessions], customSkills, profileName, position, profileAge, profileClub, onboardingCompleted, templateFocusVersion: 1, theme }));
        setSessions(previous => [savedSession, ...previous]);
        setSkillSummary(null); setActive(null); setResumeDraft(null); setTab('Progress'); setExpandedResultSkill(null); setSelectedSession(savedSession);
      } catch {
        setStorageNotice('Session was not saved. Your practice draft is kept; please retry.');
        Alert.alert('Could not save session', 'Your attempts are still here. Keep the app open and try saving again.');
      } finally { savingRun.current = false; setSavingSession(false); }
    };
    const unfinished = Object.values(drillResults).filter(result => !result.completed).length;
    if (unfinished) {
      Alert.alert('Finish before all targets are reached?', `${unfinished} drill(s) are incomplete. Your attempts will be saved, but incomplete drills receive no final points.`, [{ text: 'Keep training', style: 'cancel' }, { text: 'Save partial session', onPress: save }]);
    } else save();
  };
  const openTemplateEditor = (recipe: Recipe) => {
    setTemplateNotice('');
    setSessionMinutesDraft(String(recipe.minutes));
    originalEdit.current = JSON.stringify({ ...recipe, skills: [...recipe.skills] });
    setEditing({ ...recipe, skills: [...recipe.skills] });
  };
  const closeTemplateEditor = () => {
    if (!editing) return;
    const original = JSON.parse(originalEdit.current || '{}');
    const dirty = JSON.stringify(editing) !== originalEdit.current || sessionMinutesDraft !== String(original.minutes);
    if (dirty) Alert.alert('Discard template changes?', 'Your last saved template will stay unchanged. New skills already created in your library are kept.', [{ text: 'Keep editing', style: 'cancel' }, { text: 'Discard changes', style: 'destructive', onPress: () => { setEditing(null); setScoringSkill(null); } }]);
    else setEditing(null);
  };
  const saveRecipe = () => {
    if (!editing || editing.skills.length === 0) { Alert.alert('Add a skill', 'A training template needs at least one skill.'); return; }
    if (!editing.name.trim()) { Alert.alert('Name your template', 'Enter a template name before saving.'); return; }
    const minutes = parseSessionMinutes(sessionMinutesDraft);
    if (minutes === null) { Alert.alert('Enter a session length', 'Session length must be a whole number of minutes greater than zero.'); return; }
    const exists = recipes.some((r) => r.id === editing.id);
    const savedTemplate = withDrillConfigs({ ...editing, name: editing.name.trim(), minutes });
    setRecipes(exists ? recipes.map((r) => r.id === editing.id ? savedTemplate : r) : [...recipes, savedTemplate]);
    setTemplateNotice(`${savedTemplate.name} saved.`); setSearchTemplates(''); setSkillFilter(null);
    setEditing(null); setScoringSkill(null); setTab('Recipes');
  };
  const isCustomTemplate = (recipe: Recipe) => !starterRecipes.some(starter => starter.id === recipe.id);
  const deleteTemplate = (recipe: Recipe) => {
    if (!isCustomTemplate(recipe) || !recipes.some(saved => saved.id === recipe.id)) return;
    Alert.alert('Delete template?', `Delete “${recipe.name}” from your saved templates? Your completed sessions and reports will be kept.`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete template', style: 'destructive', onPress: () => {
        setRecipes(previous => previous.filter(saved => saved.id !== recipe.id));
        setTemplateNotice(`${recipe.name} deleted. Completed sessions and reports are kept.`);
        if (editing?.id === recipe.id) { setEditing(null); setScoringSkill(null); }
      } },
    ]);
  };
  const addSkill = (skill: Skill) => setEditing(previous => previous ? addTemplateSkill(previous, skill) : previous);
  const createCustomSkillInTemplate = (rawName: string, icon: string, description = ''): boolean => {
    if (!editing) return false;
    const name = rawName.trim();
    if (!name) return false;
    if ([...availableSkills, ...editing.skills].some(skill => skill.trim().toLowerCase() === name.toLowerCase())) {
      Alert.alert('Skill already exists', 'Choose this skill from the list, or enter a different name.');
      return false;
    }
    setCustomSkills(previous => [...previous, { id: `custom-${Date.now()}`, name, icon, description }]);
    setEditing(previous => previous ? addTemplateSkill(previous, name) : previous);
    return true;
  };
  const removeSkill = (skill: Skill) => editing && setEditing(withDrillConfigs({ ...editing, skills: editing.skills.filter((s) => s !== skill) }));
  const createLibrarySkill = (name: string, icon: string, description: string): boolean => {
    if (availableSkills.some(skill => skill.trim().toLowerCase() === name.trim().toLowerCase())) return false;
    setCustomSkills(previous => [...previous, { id: `custom-${Date.now()}`, name: name.trim(), icon, description }]); return true;
  };
  const updateLibrarySkill = (id: string, name: string, icon: string, description: string): boolean => {
    const previous = customSkills.find(skill => skill.id === id);
    if (!previous || availableSkills.some(skill => skill !== previous.name && skill.trim().toLowerCase() === name.trim().toLowerCase())) return false;
    setCustomSkills(skills => skills.map(skill => skill.id === id ? { ...skill, name: name.trim(), icon, description } : skill));
    if (previous.name !== name.trim()) setRecipes(templates => templates.map(template => withDrillConfigs({ ...template, skills: template.skills.map(skill => skill === previous.name ? name.trim() : skill), drills: { ...template.drills, [name.trim()]: getDrillConfig(template, previous.name) } })));
    return true;
  };
  const deleteCustomSkill = (skill: CustomSkill) => Alert.alert('Delete shared skill?', `${skill.name} will be removed from your library and saved templates. Completed sessions are kept.`, [{ text: 'Cancel', style: 'cancel' }, { text: 'Delete skill', style: 'destructive', onPress: () => { setCustomSkills(previous => previous.filter(item => item.id !== skill.id)); setRecipes(previous => previous.map(recipe => withDrillConfigs({ ...recipe, skills: recipe.skills.filter(name => name !== skill.name) }))); } }]);
  const chooseTheme = (name: string) => { const resolved = resolveThemeName(name); setTheme(resolved); setThemePalette(themePalettes[resolved]); };
  const exportProgress = async () => {
    const message = `Goaliva progress\\n\\nSessions: ${sessions.length}\\nMeasured minutes: ${Math.round(measuredMinutes(sessions))}\\nAverage accuracy: ${avgAccuracy}%\\n\\nTrain bright. Play right.`;
    try { await Share.share({ title: 'Goaliva progress', message }); } catch { Alert.alert('Export unavailable', 'Your progress could not be shared right now.'); }
  };
  const resetLiveSession = (skill = active?.skills[currentSkillIndex]) => {
    if (!active || !skill || !active.skills.includes(skill)) return;
    const stats = resetSkillStats(trainingData.current.stats, skill), history = { ...trainingData.current.history, [skill]: [] };
    trainingData.current = { stats, history }; setSkillStats(stats); setAttemptHistory(history);
    setAcknowledgedSkills(previous => ({ ...previous, [skill]: false }));
    setSkillSummary(null);
    setResetSkillNotice(`${skill} reset: 0 attempts, 0 successes, 0 points. Other skills are unchanged.`);
  };
  const goToSkill = (index: number) => { if (!active || index === currentSkillIndex || index < 0 || index >= active.skills.length) return; setResetSkillNotice(null); setCurrentSkillIndex(index); };
  const logAttempt = (count: number, successful: number) => {
    if (!active || savingRun.current) return;
    const skill = active.skills[currentSkillIndex];
    const updated = logTrainingResult(trainingData.current.stats, trainingData.current.history, skill, currentDrillConfig.targetAttempts, count, successful);
    if (!updated) return;
    trainingData.current = updated;
    setSkillStats(updated.stats); setAttemptHistory(updated.history); setResetSkillNotice(null);
  };
  const undoAttempt = () => {
    if (!active) return;
    const skill = active.skills[currentSkillIndex], updated = undoTrainingResult(trainingData.current.stats, trainingData.current.history, skill);
    if (!updated) return;
    trainingData.current = updated;
    setSkillStats(updated.stats); setAttemptHistory(updated.history);
    setAcknowledgedSkills(previous => ({ ...previous, [skill]: false })); setSkillSummary(null); setResetSkillNotice('Last entry undone.');
  };
  const requestReset = () => Alert.alert('Reset this skill?', 'Only this skill’s attempts, successes and points will be cleared.', [{ text: 'Cancel', style: 'cancel' }, { text: 'Reset skill', style: 'destructive', onPress: () => resetLiveSession() }]);
  const skillAccuracy = (skill: Skill) => { const values = sessions.map((session) => session.skillStats?.[skill]).filter((stats): stats is SkillStats => Boolean(stats && stats.attempts > 0)); if (values.length) { const totals = values.reduce((sum, stats) => ({ attempts: sum.attempts + stats.attempts, successes: sum.successes + stats.successes }), { attempts: 0, successes: 0 }); return Math.round((totals.successes / totals.attempts) * 100); } const legacy = sessions.filter((session) => session.skills.includes(skill)); return legacy.length ? Math.round(legacy.reduce((sum, session) => sum + session.accuracy, 0) / legacy.length) : 0; };

  const renderHeader = (eyebrow: string, title: string, caption?: string) => (
    <View style={headerStyles.container}>
      <View style={headerStyles.brandRow}>
        <Image
          source={require('./store-assets/goaliva-play-icon-dark-green-512.png')}
          style={headerStyles.logo}
          resizeMode="contain"
          accessible={false}
        />
        <Text style={[headerStyles.eyebrow, { color: themePalette.muted }]}>{eyebrow}</Text>
      </View>
      <Text style={[headerStyles.title, { color: themePalette.ink }]}>{title}</Text>
      {caption ? <Text style={[headerStyles.caption, { color: themePalette.muted }]}>{caption}</Text> : null}
    </View>
  );

  const renderToday = () => <ScrollView contentContainerStyle={styles.page} showsVerticalScrollIndicator={false}>
    {renderHeader('GOALIVA · TRAINING JOURNAL', 'Ready to train?', 'Your drills. Your pace. Measurable progress.')}
    {resumeDraft && !active && <View style={styles.moreCard}><Text style={styles.moreTitle}>Resume training</Text><Text style={styles.moreCopy}>{resumeDraft.recipe.name} · Skill {resumeDraft.index + 1}/{resumeDraft.recipe.skills.length} · {formatTrainingTime(resumeDraft.elapsedMs)} active time</Text><Button onPress={resumeSession}>Resume session</Button></View>}
    {storageNotice && <Text accessibilityLiveRegion="polite" style={styles.moreCopy}>{storageNotice}</Text>}
    <View style={styles.focusCard}>
      <ThemeGradient colors={themePalette.heroGradient} />
      <View style={styles.focusTop}><Text style={styles.focusEyebrow}>{position ? 'RECOMMENDED FOR YOU' : 'YOUR NEXT SESSION'}</Text><Text style={styles.focusTarget}>↗</Text></View>
      <Text style={styles.focusTitle}>{focusRecipe?.name ?? 'Build your first session'}</Text>
      <Text style={styles.focusCopy}>{focusRecipe ? focusRecipe.skills.join('  ·  ') : 'Combine the skills you want to work on.'}</Text>
      <View style={styles.focusMeta}><Text style={styles.focusMetaText}>{focusRecipe?.minutes ?? 20} MIN</Text><View style={styles.focusMetaDot} /><Text style={styles.focusMetaText}>{focusRecipe?.skills.length ?? 0} SKILLS</Text><Text style={styles.focusMetaTag}>{focusRecipe?.focus.toUpperCase() ?? 'ALL POSITIONS'}</Text></View>
      <Button onPress={() => focusRecipe ? startSession(focusRecipe) : setTab('Recipes')}>{focusRecipe ? 'Start training  →' : 'Create a template  →'}</Button>
    </View>
    <View style={styles.statRow}><View style={[styles.statCard, { backgroundColor: themePalette.surface, borderColor: themePalette.line }]}><Text style={[styles.statNumber, { color: themePalette.ink }]}>{sessionsInPeriod(sessions, 7).length}</Text><Text style={[styles.statLabel, { color: themePalette.muted }]}>Sessions · 7D</Text></View><View style={[styles.statCard, { backgroundColor: themePalette.surface, borderColor: themePalette.line }]}><Text style={[styles.statNumber, { color: themePalette.ink }]}>{Math.round(weeklyMinutes)}</Text><Text style={[styles.statLabel, { color: themePalette.muted }]}>Active min · 7D</Text></View><View style={[styles.statCard, { backgroundColor: themePalette.surface, borderColor: themePalette.line }]}><Text style={[styles.statNumber, { color: themePalette.ink }]}>{weekAccuracy === null ? '—' : `${weekAccuracy}%`}</Text><Text style={[styles.statLabel, { color: themePalette.muted }]}>Accuracy · 7D</Text></View></View>
    {position && <Text style={[styles.moreCopy, { marginBottom: 12 }]}>Recommended for your {position.toLowerCase()} position.</Text>}<SectionTitle title="Recently used templates" action="See all" onPress={() => setTab('Recipes')} />
    {rankedRecipes.filter(recipe => sessions.some(session => session.recipe.id === recipe.id)).sort((a, b) => sessions.findIndex(session => session.recipe.id === a.id) - sessions.findIndex(session => session.recipe.id === b.id)).slice(0, 3).map((recipe) => <RecipeRow key={recipe.id} recipe={recipe} skillIcon={getSkillIcon(recipe.skills[0])} onStart={() => startSession(recipe)} onEdit={() => openTemplateEditor(recipe)} onDelete={isCustomTemplate(recipe) ? () => deleteTemplate(recipe) : undefined} />)}
    {!sessions.some(session => recipes.some(recipe => recipe.id === session.recipe.id)) && <Text style={styles.moreCopy}>Start your recommended session, or browse the template library.</Text>}
    <View style={[styles.quoteCard, { backgroundColor: themePalette.mint }]}><Text style={styles.quote}>Train Bright. Play Right.</Text></View>
  </ScrollView>;

  const renderRecipes = () => {
    const visible = rankedRecipes.filter(recipe => (!skillFilter || recipe.skills.includes(skillFilter)) && `${recipe.name} ${recipe.skills.join(' ')} ${recipe.focus}`.toLowerCase().includes(searchTemplates.toLowerCase()));
    const row = (recipe: Recipe) => <RecipeRow key={recipe.id} recipe={recipe} skillIcon={getSkillIcon(recipe.skills[0])} onStart={() => startSession(recipe)} onEdit={() => openTemplateEditor(recipe)} onDelete={isCustomTemplate(recipe) ? () => deleteTemplate(recipe) : undefined} onCopy={() => openTemplateEditor({ ...withDrillConfigs(recipe), id: `recipe-${Date.now()}`, name: `${recipe.name} copy` })} large />;
    return <ScrollView contentContainerStyle={styles.page} keyboardShouldPersistTaps="handled">
      {renderHeader('YOUR TRAINING LIBRARY', 'Templates', position ? `Ordered for your ${position.toLowerCase()} position.` : 'Your combinations and suggested starting points.')}
      {templateNotice && <Text accessibilityLiveRegion="polite" style={[styles.moreCopy, { marginBottom: 12 }]}>{templateNotice}</Text>}
      <Button onPress={() => openTemplateEditor({ id: `recipe-${Date.now()}`, name: 'My New Template', skills: ['Ball Mastery'], minutes: 20, color: C.green, focus: position || 'All positions' })}>Create a template</Button>
      <TextInput accessibilityLabel="Search templates" value={searchTemplates} onChangeText={setSearchTemplates} placeholder="Search by template, skill or focus" placeholderTextColor={themePalette.muted} style={[styles.textInput, { marginTop: 16 }]} />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>{[null, ...availableSkills].map(skill => <Pressable key={skill || 'all'} accessibilityRole="button" accessibilityState={{ selected: skillFilter === skill }} onPress={() => setSkillFilter(skill)} style={[styles.filterChip, skillFilter === skill && styles.filterChipSelected]}><Text style={[styles.filterText, skillFilter === skill && styles.filterTextSelected]}>{skill || 'All skills'}</Text></Pressable>)}</ScrollView>
      <SectionTitle title="My templates" />
      {visible.filter(isCustomTemplate).map(row)}
      {!visible.some(isCustomTemplate) && <Text style={styles.moreCopy}>No matching personal templates. Create one or save a copy of a suggestion.</Text>}
      <View style={{ marginTop: 24 }}><SectionTitle title="Suggested templates" /></View>
      {visible.filter(recipe => !isCustomTemplate(recipe)).map(row)}
      {!visible.length && <Text style={styles.moreCopy}>No templates match your search. Try another skill or clear the search.</Text>}
    </ScrollView>;
  };
  const renderProgress = () => <ScrollView contentContainerStyle={styles.page}>
    {renderHeader('YOUR PERFORMANCE', 'Progress', 'Recorded practice, explained clearly.')}
    <View style={styles.optionGrid}>{[7, 30, 90, null].map(days => <Pressable key={days ?? 'all'} accessibilityRole="button" accessibilityState={{ selected: reportDays === days }} onPress={() => setReportDays(days)} style={[styles.option, reportDays === days && styles.optionActive]}><Text style={styles.optionText}>{days === null ? 'All time' : `${days} days`}</Text></Pressable>)}</View>
    <View style={styles.moreCard}><Text style={styles.moreTitle}>{periodLabel}</Text><Text style={styles.moreCopy}>{periodSessions.length} sessions · {Math.round(measuredMinutes(periodSessions))} measured active minutes</Text><Text style={styles.moreTitle}>{recentAccuracy === null ? 'No accuracy data yet' : `${recentAccuracy}% accuracy`}</Text><Text style={styles.moreCopy}>{periodSessions.some(session => Object.values(session.skillStats ?? {}).some(stats => stats.attempts > 0)) ? 'Calculated from recorded attempts. Sessions without per-skill counts are excluded from this accuracy.' : recentAccuracy === null ? 'Record attempts to begin tracking accuracy in this period.' : 'Session-average accuracy from legacy records.'}</Text>{periodSessions.some(session => session.elapsedMs === undefined) && <Text style={styles.moreCopy}>Legacy planned durations are preserved in history, not counted as measured time.</Text>}</View>
    <View style={styles.moreCard}><Text style={styles.moreTitle}>Skill trends</Text><Text style={styles.moreCopy}>Compare accuracy over time, or inspect points using each session’s saved rules.</Text><Button onPress={() => setTrendSkill(opportunity.skill || relevantSkills[0] || availableSkills[0])}>Explore skill charts</Button></View>
    <View style={styles.moreCard}><Text style={styles.moreTitle}>Next opportunity</Text><Text style={styles.moreCopy}>{opportunityCopy}</Text>{opportunity.template && <Button variant="soft" onPress={() => startSession(opportunity.template!)}>Train {opportunity.template.name}</Button>}</View>
    <View style={styles.reportCard}><ReportLine icon="◇" title="Personal best" copy={periodSessions.length ? `${Math.max(...periodSessions.map(session => session.accuracy))}% session accuracy · ${periodLabel}` : 'Record a session to discover your best.'} color={themePalette.accent} onPress={() => setReportView('best')} /><ReportLine icon="↗" title="Recent average" copy={recentAccuracy === null ? 'No recorded results in this period.' : `${recentAccuracy}% · ${periodLabel}`} color={themePalette.mint} onPress={() => setReportView('recent')} /></View>
    <SectionTitle title="Session history" />
    {periodSessions.map((session, index) => <Pressable key={session.completedAt || `legacy-${index}`} accessibilityRole="button" onPress={() => { setExpandedResultSkill(null); setSelectedSession(session); }} style={styles.moreRow}><View style={{ flex: 1 }}><Text style={styles.moreRowText}>{session.recipe.name}</Text><Text style={styles.moreCopy}>{session.date} · {session.drillResults ? `${session.totalPoints ?? 0} points` : 'Legacy accuracy record'} · {session.elapsedMs === undefined ? `${session.minutes} min planned (legacy)` : `${formatTrainingTime(session.elapsedMs)} active`}</Text></View><Text style={styles.chevron}>›</Text></Pressable>)}
    {!periodSessions.length && <Text style={styles.moreCopy}>No sessions in this period. Older undated sessions are available under All time.</Text>}
  </ScrollView>;
  const renderReportDetail = () => {
    if (!reportView) return null;
    const titles = { best: 'Personal best', recent: 'Recent average', next: 'Next opportunity' };
    const descriptions = {
      best: periodSessions.length ? `Your best session in ${periodLabel.toLowerCase()} is ${Math.max(...periodSessions.map(session => session.accuracy))}% accuracy.` : 'No recorded session in this period.',
      recent: recentAccuracy === null ? 'No accuracy data in this period.' : `${recentAccuracy}% accuracy in ${periodLabel.toLowerCase()}. Based on recorded attempts where available.`,
      next: opportunityCopy
    };
    return <View style={[styles.modal, { backgroundColor: themePalette.background }]}><SafeAreaView edges={['left', 'right', 'bottom']} style={styles.modalInner}><ScrollView contentContainerStyle={styles.page}><View style={styles.modalHeader}><Pressable onPress={() => setReportView(null)} accessibilityRole="button" accessibilityLabel="Go back" hitSlop={12} style={({ pressed }) => [styles.backButton, pressed && { backgroundColor: themePalette.mint }]}><Text style={[styles.back, { color: themePalette.primary }]}>‹</Text></Pressable><Text style={[styles.modalTitle, { color: themePalette.ink }]}>{titles[reportView]}</Text><Text style={[styles.sessionCount, { color: themePalette.muted }]}>Report</Text></View><View style={[styles.detailCard, { backgroundColor: themePalette.mint }]}><Text style={[styles.detailTitle, { color: themePalette.primary }]}>{titles[reportView].toUpperCase()}</Text><Text style={[styles.detailCopy, { color: themePalette.ink }]}>{descriptions[reportView]}</Text></View>{reportView !== 'next' && <><Text style={[styles.inputLabel, { color: themePalette.primary }]}>RECORDED SESSIONS</Text>{(reportView === 'best' ? [...periodSessions].sort((a, b) => b.accuracy - a.accuracy) : periodSessions).map((session, index) => <Pressable key={`${session.date}-${index}`} accessibilityRole="button" onPress={() => setSelectedSession(session)} style={styles.moreRow}><View style={{ flex: 1 }}><Text style={styles.moreRowText}>{session.date} · {session.recipe.name}</Text><Text style={styles.moreCopy}>{session.drillResults ? `${session.totalPoints ?? 0} points` : 'Recorded before drill scoring'} · {session.accuracy}% accuracy</Text></View><Text style={styles.chevron}>›</Text></Pressable>)}</>}{reportView === 'next' && <><Text style={[styles.inputLabel, { color: themePalette.primary }]}>SUGGESTED FOCUS</Text><View style={[styles.moreCard, { backgroundColor: themePalette.surface, borderColor: themePalette.line }]}><Text style={[styles.moreTitle, { color: themePalette.ink }]}>{opportunity.skill || opportunity.template?.name || 'Start training'}</Text><Text style={[styles.moreCopy, { color: themePalette.muted }]}>{opportunityCopy}</Text></View><Button onPress={() => { setReportView(null); setTab('Recipes'); }}>Open training templates  →</Button></>}</ScrollView></SafeAreaView></View>;
  };
  const renderMore = () => <ScrollView contentContainerStyle={styles.page}>{renderHeader('YOUR PREFERENCES', 'Settings', 'Your profile, skill library, and appearance.')}<View style={[styles.moreCard, { backgroundColor: themePalette.surface, borderColor: themePalette.line }]}><Text style={styles.moreTitle}>Goaliva</Text><Text style={styles.moreCopy}>Train bright. Play right.</Text><View style={styles.divider} /><Pressable accessibilityRole="button" accessibilityLabel="Profile & position" onPress={() => setSettingsPanel('profile')} style={styles.moreRow}><Text style={[styles.moreRowText, { color: themePalette.ink }] }>Profile & position</Text><Text style={styles.chevron}>›</Text></Pressable><Pressable accessibilityRole="button" accessibilityLabel="Choose theme" onPress={() => setSettingsPanel('theme')} style={styles.moreRow}><Text style={[styles.moreRowText, { color: themePalette.ink }] }>Theme: {theme}</Text><Text style={styles.chevron}>›</Text></Pressable><Pressable accessibilityRole="button" accessibilityLabel="Skill library" onPress={() => setSettingsPanel('skills')} style={styles.moreRow}><Text style={[styles.moreRowText, { color: themePalette.ink }] }>Customize skills</Text><Text style={styles.chevron}>›</Text></Pressable><Pressable accessibilityRole="button" accessibilityLabel="Export my progress" onPress={exportProgress} style={styles.moreRow}><Text style={[styles.moreRowText, { color: themePalette.ink }] }>Export my progress</Text><Text style={styles.chevron}>›</Text></Pressable></View><View style={[styles.moreCard, { backgroundColor: themePalette.surface, borderColor: themePalette.line }]}><Text style={styles.moreTitle}>Profile</Text><Text style={styles.moreCopy}>{[profileName || 'Player', position || 'All positions', profileAge ? `Age ${profileAge}` : '', profileClub].filter(Boolean).join(' · ')}</Text></View><View style={[styles.moreCard, { backgroundColor: themePalette.surface, borderColor: themePalette.line }]}><Text style={styles.moreTitle}>Player setup</Text><Text style={styles.moreCopy}>Review the optional questionnaire without losing your training history.</Text><Pressable accessibilityRole="button" onPress={() => { setOnboardingStep(0); setOnboardingCompleted(false); }} style={styles.moreRow}><Text style={styles.moreRowText}>Review quick setup</Text><Text style={styles.chevron}>›</Text></Pressable></View></ScrollView>;

  const renderPositionOptions = () => <View style={styles.optionGrid}>{[...POSITIONS, '' as const].map(item => <Pressable key={item || 'unspecified'} accessibilityRole="button" accessibilityState={{ selected: position === item }} onPress={() => setPosition(item)} style={[styles.option, position === item && styles.optionActive]}><Text style={[styles.optionText, position === item && styles.optionTextActive]}>{item || 'Not specified'}</Text></Pressable>)}</View>;
  const completeOnboarding = () => {
    setProfileName(profileName.trim());
    setProfileClub(profileClub.trim());
    if (!ageValid) setProfileAge('');
    setOnboardingCompleted(true);
    setTab('Today');
  };
  const advanceOnboarding = () => onboardingStep < 3 ? setOnboardingStep(onboardingStep + 1) : completeOnboarding();
  const skipOnboardingQuestion = () => { if (onboardingStep === 2 && !ageValid) setProfileAge(''); advanceOnboarding(); };
  const renderOnboarding = () => {
    const questions = [
      { title: 'Where do you play?', copy: 'We’ll recommend templates for your position. You can change this in Settings any time.' },
      { title: 'What should we call you?', copy: 'Add a name to your player profile. A nickname works too.' },
      { title: 'How old are you?', copy: 'This is optional profile information. Your training recommendations are based on position, not age.' },
      { title: 'Who do you play for?', copy: 'Add your club or team, or skip if you train independently.' },
    ];
    const question = questions[onboardingStep];
    return <SafeAreaView edges={['bottom']} style={styles.modalInner}><KeyboardAvoidingView style={styles.modalInner} behavior={Platform.OS === 'ios' ? 'padding' : undefined}><ScrollView key={`setup-${onboardingStep}`} keyboardShouldPersistTaps="handled" contentContainerStyle={[styles.page, { paddingBottom: 20 }]}>
      <Text style={styles.onboardingStep}>PLAYER SETUP · {onboardingStep + 1} OF 4</Text>
      {renderHeader('WELCOME TO GOALIVA', question.title, question.copy)}
      <Text style={styles.moreCopy}>Every question is optional. Your profile stays on this device.</Text>
      <View style={styles.sessionProgress}><View style={[styles.sessionFill, { width: `${((onboardingStep + 1) / 4) * 100}%` }]} /></View>
      {onboardingStep === 1 && <TextInput accessibilityLabel="Player name" value={profileName} onChangeText={setProfileName} style={styles.textInput} placeholder="Your name" placeholderTextColor={themePalette.muted} autoCapitalize="words" maxLength={80} />}
      {onboardingStep === 0 && <>{renderPositionOptions()}{position && <View style={styles.moreCard}><Text style={styles.moreTitle}>Recommended for {position.toLowerCase()}s</Text><Text style={styles.moreCopy}>These templates will appear first in your training library.</Text><Text style={styles.moreRowText}>{focusRecipe?.name ?? 'Create your first template'} · {focusRecipe?.skills.length ?? 0} skills</Text></View>}</>}
      {onboardingStep === 2 && <><TextInput accessibilityLabel="Player age" value={profileAge} onChangeText={value => setProfileAge(value.replace(/[^0-9]/g, '').slice(0, 3))} keyboardType="number-pad" style={styles.textInput} placeholder="Age (optional)" placeholderTextColor={themePalette.muted} maxLength={3} />{!ageValid && <Text style={styles.moreCopy}>Enter an age between 1 and 120, or skip this question.</Text>}</>}
      {onboardingStep === 3 && <TextInput accessibilityLabel="Player club" value={profileClub} onChangeText={setProfileClub} style={styles.textInput} placeholder="Club or team name" placeholderTextColor={themePalette.muted} autoCapitalize="words" maxLength={100} />}
      </ScrollView><View style={[styles.onboardingActions, { paddingHorizontal: 20, paddingBottom: 12, marginTop: 0 }]}>
        <Button disabled={onboardingStep === 2 && !ageValid} onPress={advanceOnboarding}>{onboardingStep === 3 ? 'Start training  →' : 'Continue  →'}</Button>
        <Button variant="ghost" onPress={skipOnboardingQuestion}>Skip this question</Button>
        {onboardingStep > 0 && <Button variant="soft" onPress={() => setOnboardingStep(onboardingStep - 1)}>← Previous question</Button>}
        <Pressable accessibilityRole="button" onPress={completeOnboarding} style={styles.resetButton}><Text style={styles.resetButtonText}>Skip setup — explore Goaliva</Text></Pressable>
      </View>
    </KeyboardAvoidingView></SafeAreaView>;
  };

  const renderSettingsPanel = () => {
    if (!settingsPanel) return null;
    if (settingsPanel === 'profile') return <PlayerProfileEditor profile={{ name: profileName, position, age: profileAge, club: profileClub }} palette={themePalette} onClose={() => setSettingsPanel(null)} onSave={value => { setProfileName(value.name); setPosition(value.position); setProfileAge(value.age); setProfileClub(value.club); setSettingsPanel(null); }} />;
    if (settingsPanel === 'theme') return <View style={[styles.modal, { backgroundColor: themePalette.background }]}><SafeAreaView style={styles.modalInner}><ScrollView contentContainerStyle={styles.page}><View style={styles.modalHeader}><Pressable onPress={() => setSettingsPanel(null)} accessibilityRole="button" accessibilityLabel="Go back" hitSlop={12} style={({ pressed }) => [styles.backButton, pressed && { backgroundColor: themePalette.mint }]}><Text style={[styles.back, { color: themePalette.primary }]}>‹</Text></Pressable><Text style={[styles.modalTitle, { color: themePalette.ink }] }>Choose a theme</Text><Text style={[styles.sessionCount, { color: themePalette.muted }]}>5 options</Text></View><Text style={[styles.caption, { color: themePalette.muted }] }>Tap a theme to apply it. Changes are saved automatically.</Text>{themeOptions.map((item) => <Pressable key={item} onPress={() => chooseTheme(item)} style={[styles.themeOption, { backgroundColor: themePalette.surface, borderColor: themePalette.line }, theme === item && { backgroundColor: themePalette.mint, borderColor: themePalette.primary }]}><View style={[styles.themeSwatch, { backgroundColor: themePalettes[item].primary }]} /><View style={{ flex: 1 }}><Text style={[styles.optionText, { color: themePalette.ink }]}>{item}</Text><View style={{ flexDirection: 'row', gap: 6, marginTop: 8 }}>{[themePalettes[item].primary, themePalettes[item].mint, themePalettes[item].accent, themePalettes[item].surface].map((color, index) => <View key={index} style={{ width: 16, height: 16, borderRadius: 8, backgroundColor: color, borderWidth: 1, borderColor: themePalettes[item].line }} />)}</View></View><Text style={[styles.chevron, { color: themePalette.primary }]}>{theme === item ? '✓' : '›'}</Text></Pressable>)}<Button onPress={() => setSettingsPanel(null)}>Done</Button></ScrollView></SafeAreaView></View>;
    return <SkillLibraryScreen customSkills={customSkills} skills={availableSkills} iconOptions={customIconOptions} palette={themePalette} icon={getSkillIcon} describe={describeSkill} onClose={() => setSettingsPanel(null)} onCreate={createLibrarySkill} onUpdate={updateLibrarySkill} onDelete={deleteCustomSkill} />;
  };
  const renderEditor = () => editing && <View style={styles.modal} accessibilityElementsHidden={Boolean(scoringSkill)} importantForAccessibility={scoringSkill ? 'no-hide-descendants' : 'auto'}><TemplateEditorScreen template={editing} minutes={sessionMinutesDraft} skills={availableSkills} iconOptions={customIconOptions} palette={themePalette} icon={getSkillIcon} onChange={setEditing} onMinutes={setSessionMinutesDraft} onClose={closeTemplateEditor} onSave={saveRecipe} onDelete={isCustomTemplate(editing) && recipes.some(saved => saved.id === editing.id) ? () => deleteTemplate(editing) : undefined} onAdd={addSkill} onRemove={removeSkill} onScoring={setScoringSkill} onCreate={createCustomSkillInTemplate} /></View>;
  const renderSession = () => active && <LiveSessionScreen palette={themePalette} template={active.name} skill={active.skills[currentSkillIndex]} index={currentSkillIndex} count={active.skills.length} attempts={attempts} successes={successes} config={currentDrillConfig} estimate={currentDrillPoints} total={liveTotalPoints} elapsedMs={elapsedMs} result={liveResults[active.skills[currentSkillIndex]]} showResult={Boolean(skillSummary)} saving={savingSession} paused={timerPaused} onPause={() => setTimerPaused(value => !value)} allComplete={Object.values(liveResults).every(result => result.completed)} nextSkill={active.skills.find(skill => !liveResults[skill]?.completed)} description={describeSkill(active.skills[currentSkillIndex])} canUndo={Object.prototype.hasOwnProperty.call(attemptHistory, active.skills[currentSkillIndex]) && Boolean(attemptHistory[active.skills[currentSkillIndex]]?.length)} note={note} notice={storageNotice || resetSkillNotice} onLog={logAttempt} onUndo={undoAttempt} onReset={requestReset} onLeave={leaveSession} onNavigate={goToSkill} onNote={setNote} onFinish={finishSession} onShowResult={() => setSkillSummary(active.skills[currentSkillIndex])} onReview={() => setSkillSummary(null)} onNext={() => { const nextIndex = active.skills.findIndex(skill => !liveResults[skill]?.completed); if (nextIndex >= 0) { setSkillSummary(null); goToSkill(nextIndex); } else finishSession(); }} />;
  const renderSkillSummary = () => null;
  const renderSessionReport = () => selectedSession && <View accessibilityElementsHidden={Boolean(trendSkill)} importantForAccessibility={trendSkill ? 'no-hide-descendants' : 'auto'} style={[styles.modal, { zIndex: 12 }]}><ScrollView contentContainerStyle={styles.page}>
    <View style={styles.modalHeader}><Pressable accessibilityRole="button" accessibilityLabel="Close session results" onPress={() => setSelectedSession(null)} hitSlop={12} style={({ pressed }) => [styles.backButton, pressed && { backgroundColor: themePalette.mint }]}><Text style={styles.back}>‹</Text></Pressable><Text style={styles.modalTitle}>Session results</Text><Text style={styles.sessionCount}>{selectedSession.date}</Text></View>
    <Text style={styles.sessionTitle}>{selectedSession.recipe.name}</Text>
    <Text style={styles.caption}>{selectedSession.drillResults ? `${selectedSession.accuracy}% accuracy · ${selectedSession.elapsedMs === undefined ? 'Planned duration: ' + selectedSession.minutes + ' min (legacy)' : formatTrainingTime(selectedSession.elapsedMs) + ' active training'} · Planned ${selectedSession.plannedMinutes ?? selectedSession.recipe.minutes} min` : 'This session was recorded before drill scoring. Its original accuracy is preserved.'}</Text>
    {selectedSession.drillResults && <View style={styles.reportHero}><ThemeGradient colors={themePalette.heroGradient} /><Text style={styles.reportLabel}>{Object.values(selectedSession.drillResults).every(result => result.completed) ? 'TEMPLATE COMPLETE · TOTAL POINTS' : 'PARTIAL TEMPLATE · COMPLETED SKILL POINTS'}</Text><Text style={styles.reportNumber}>{selectedSession.totalPoints ?? 0}</Text><Text style={styles.reportDelta}>{Object.values(selectedSession.drillResults).filter(result => result.completed).length}/{selectedSession.skills.length} skills completed</Text></View>}
    {selectedSession.skills.map(skill => {
      const result = selectedSession.drillResults?.[skill];
      const oldStats = selectedSession.skillStats?.[skill];
      return <View key={skill} style={[styles.moreCard, { marginTop: 16 }]}>
        <Text style={styles.moreTitle}>{skill}</Text>
        <Text style={styles.moreCopy}>{result ? `${result.attempts}/${result.targetAttempts} attempts · ${result.successes} successes` : oldStats ? `${oldStats.attempts} attempts · ${oldStats.successes} successes` : 'Per-drill attempt counts were not recorded.'}</Text>
        <Text style={styles.drillTargetLabel}>{result ? result.completed ? `${result.points ?? 0} points · Target completed` : 'Incomplete · No final points' : 'No recorded drill score'}</Text>
        {result && <><Button variant="ghost" onPress={() => setExpandedResultSkill(expandedResultSkill === skill ? null : skill)}>{expandedResultSkill === skill ? 'Hide scoring rules' : 'Show scoring rules'}</Button>{expandedResultSkill === skill && scoreBandLabels(getDrillConfig(selectedSession.recipe, skill)).map(label => <Text key={label} style={styles.scoreBandText}>{label}</Text>)}</>}
        <Button variant="soft" onPress={() => setTrendSkill(skill)}>View skill trend  →</Button>
      </View>;
    })}
    {selectedSession.note ? <View style={styles.detailCard}><Text style={styles.detailTitle}>SESSION NOTE</Text><Text style={styles.detailCopy}>{selectedSession.note}</Text></View> : null}
  </ScrollView></View>;

  const renderScoringEditor = () => editing && scoringSkill && <View style={[styles.modal, { zIndex: 10 }]}><DrillScoringEditor key={`${editing.id}:${scoringSkill}`} skill={scoringSkill} config={getDrillConfig(editing, scoringSkill)} palette={themePalette} onClose={() => setScoringSkill(null)} onApply={config => { setEditing({ ...editing, drills: { ...editing.drills, [scoringSkill]: config } }); setScoringSkill(null); }} /></View>;
  return <SafeAreaProvider><SafeAreaView edges={['top', 'left', 'right']} style={[styles.safe, { backgroundColor: themePalette.background }]}><StatusBar style={themePalette.dark ? 'light' : 'dark'} />{!hydrated ? <View style={styles.page}><Text style={styles.moreCopy}>Loading your training journal…</Text></View> : !onboardingCompleted ? renderOnboarding() : <><View style={{ flex: 1 }} accessibilityElementsHidden={Boolean(active || editing || settingsPanel || reportView || selectedSession || trendSkill)} importantForAccessibility={active || editing || settingsPanel || reportView || selectedSession || trendSkill ? 'no-hide-descendants' : 'auto'}>{tab === 'Today' && renderToday()}{tab === 'Recipes' && renderRecipes()}{tab === 'Progress' && renderProgress()}{tab === 'More' && renderMore()}{!active && !editing && !settingsPanel && !reportView && !selectedSession && !trendSkill && <BottomNavigation selected={tab} onSelect={setTab} />}</View>{renderEditor()}{renderSession()}{renderSettingsPanel()}{renderReportDetail()}{renderScoringEditor()}{renderSessionReport()}{renderSkillSummary()}{trendSkill && <SkillTrendReport key={trendSkill} sessions={sessions} initialSkill={trendSkill} skills={Array.from(new Set([...availableSkills, ...sessions.flatMap(session => session.skills)]))} palette={themePalette} onClose={() => setTrendSkill(null)} />}</>}</SafeAreaView></SafeAreaProvider>;
}
function BottomNavigation({ selected, onSelect }: { selected: 'Today' | 'Recipes' | 'Progress' | 'More'; onSelect: (tab: 'Today' | 'Recipes' | 'Progress' | 'More') => void }) {
  const insets = useSafeAreaInsets();
  const items = [{ tab: 'Today', label: 'Today', icon: '⌂' }, { tab: 'Recipes', label: 'Templates', icon: '▤' }, { tab: 'Progress', label: 'Progress', icon: '▥' }, { tab: 'More', label: 'Settings', icon: '☷' }] as const;
  return <View style={[styles.nav, { paddingBottom: Math.max(insets.bottom, 10) }]}>{items.map(item => <Pressable key={item.tab} accessibilityRole="tab" accessibilityState={{ selected: selected === item.tab }} accessibilityLabel={item.label} onPress={() => onSelect(item.tab)} style={styles.navItem}><View style={[{ width: 52, alignItems: 'center' }, selected === item.tab && styles.navSelected]}><Text style={[styles.navIcon, selected === item.tab && styles.navActive]}>{item.icon}</Text></View><Text style={[styles.navText, selected === item.tab && styles.navActive]}>{item.label}</Text></Pressable>)}</View>;
}
function SectionTitle({ title, action, onPress }: { title: string; action?: string; onPress?: () => void }) { return <View style={styles.sectionTitle}><Text style={[styles.sectionText, { color: activeTheme.ink }]}>{title}</Text>{action && (onPress ? <Pressable accessibilityRole="button" onPress={onPress}><Text style={styles.sectionAction}>{action}  ›</Text></Pressable> : <Text style={styles.sectionAction}>{action}</Text>)}</View>; }
function RecipeRow({ recipe, onStart, onEdit, onDelete, onCopy, large, skillIcon }: { recipe: Recipe; onStart: () => void; onEdit: () => void; onDelete?: () => void; onCopy?: () => void; large?: boolean; skillIcon?: string }) {
  return <View style={[styles.recipeRow, large && styles.largeRecipeRow]}>
    <Pressable accessibilityRole="button" accessibilityLabel={`Edit ${recipe.name}`} onPress={onEdit} style={styles.recipeContent}>
      <View style={styles.recipeIcon}><Text style={styles.recipeIconText}>{skillIcon || icons[recipe.skills[0]] || '◇'}</Text></View>
      <View style={styles.recipeBody}><Text style={styles.recipeName}>{recipe.name}</Text><Text style={styles.recipeMeta}>{recipe.skills.length} skills · {recipe.minutes} min planned</Text><Text style={styles.templateFocus}>{recipe.focus}</Text>{large && <Text style={styles.recipeMeta}>{recipe.skills.reduce((sum, skill) => sum + getDrillConfig(recipe, skill).targetAttempts, 0)} total attempts · Scored drills</Text>}{large && <Text numberOfLines={2} style={styles.recipeSkills}>{recipe.skills.join(' · ')}</Text>}</View>
    </Pressable>
    <Pressable accessibilityRole="button" accessibilityLabel={`${recipe.name} options`} onPress={() => Alert.alert(recipe.name, 'Template options', [{ text: 'Edit template', onPress: onEdit }, ...(onCopy ? [{ text: 'Save a copy', onPress: onCopy }] : []), ...(onDelete ? [{ text: 'Delete template', style: 'destructive' as const, onPress: onDelete }] : []), { text: 'Cancel', style: 'cancel' }])} style={styles.deleteTemplateIcon}><Text style={{ color: activeTheme.primary, fontSize: 24 }}>⋯</Text></Pressable>
    <Pressable accessibilityRole="button" accessibilityLabel={`Start ${recipe.name}`} onPress={onStart} style={({ pressed }) => [styles.playButton, pressed && styles.pressed]}><Text style={styles.playText}>▶</Text></Pressable>
  </View>;
}
function ReportLine({ icon, title, copy, color, onPress }: { icon: string; title: string; copy: string; color: string; onPress?: () => void }) { return <Pressable accessibilityRole="button" accessibilityLabel={title} accessibilityHint={copy} onPress={onPress} style={styles.reportLine}><View style={[styles.reportIcon, { backgroundColor: activeTheme.mint }]}><Text style={styles.reportIconText}>{icon}</Text></View><View style={styles.reportText}><Text style={[styles.reportTitle, { color: activeTheme.ink }]}>{title}</Text><Text style={[styles.reportCopy, { color: activeTheme.muted }]}>{copy}</Text></View><Text style={[styles.chevron, { color: activeTheme.primary }]}>›</Text></Pressable>; }
const headerStyles = StyleSheet.create({
  container: { marginBottom: 24, alignSelf: 'stretch' },
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 16 },
  logo: { width: 40, height: 40, borderRadius: 10 },
  eyebrow: { flexShrink: 1, fontSize: 11, fontWeight: '700', letterSpacing: 1.6 },
  title: { fontSize: 28, lineHeight: 34, fontWeight: '700', letterSpacing: -0.5 },
  caption: { fontSize: 14, lineHeight: 21, marginTop: 8 },
});

function createStyles(palette: ThemePalette) {
  const C = {
    ink: palette.ink, muted: palette.muted, green: palette.primary,
    mint: palette.mint, cream: palette.background, yellow: palette.accent,
    coral: palette.accent, blue: palette.primary, line: palette.line, white: palette.surface,
  };
  return StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.cream },
    page: { padding: 24, paddingBottom: 130 },
    header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 },
    themeAccent: { position: 'absolute', top: 0, left: 0, right: 0, height: 5 },
    eyebrow: { color: C.green, fontSize: 12, fontWeight: '700', letterSpacing: 2 },
    title: { color: C.ink, fontSize: 30, lineHeight: 35, fontWeight: '700', marginTop: 8, maxWidth: 310 },
    caption: { color: C.muted, fontSize: 14, lineHeight: 20, marginTop: 7, maxWidth: 300 },
    logoMark: { width: 42, height: 42, backgroundColor: C.yellow, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
    logoMarkText: { color: C.green, fontWeight: '700', fontSize: 24 },
    focusCard: { overflow: 'hidden', backgroundColor: palette.hero, borderRadius: 18, padding: 22, marginBottom: 14 },
    focusTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    focusEyebrow: { color: C.yellow, fontSize: 11, letterSpacing: 1.4, fontWeight: '700' },
    focusTarget: { color: C.yellow, fontSize: 27 },
    focusTitle: { color: '#FFFFFF', fontSize: 25, fontWeight: '700', marginTop: 12 },
    focusCopy: { color: palette.heroMuted, fontSize: 14, lineHeight: 20, marginTop: 7, marginBottom: 18 },
    button: { minHeight: 52, overflow: 'hidden', backgroundColor: palette.buttonGradient[0], borderRadius: 15, paddingVertical: 15, paddingHorizontal: 18, alignItems: 'center', justifyContent: 'center' },
    buttonText: { color: palette.onAccent, fontSize: 15, fontWeight: '700' },
    ghostButton: { backgroundColor: 'transparent', borderWidth: 1, borderColor: C.line },
    softButton: { backgroundColor: C.mint },
    darkButtonText: { color: C.green },
    pressed: { opacity: 0.72 },
    statRow: { flexDirection: 'row', gap: 10, marginBottom: 27 },
    statCard: { flex: 1, backgroundColor: C.white, borderRadius: 17, padding: 15, borderWidth: 1, borderColor: C.line },
    statNumber: { color: C.ink, fontSize: 22, fontWeight: '700' },
    statLabel: { color: C.muted, fontSize: 11, marginTop: 5 },
    sectionTitle: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
    sectionText: { color: C.ink, fontSize: 18, fontWeight: '700' },
    sectionAction: { color: C.green, fontSize: 13, fontWeight: '700' },
    recipeRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: C.white, borderRadius: 18, padding: 12, marginBottom: 10, borderWidth: 1, borderColor: C.line },
    largeRecipeRow: { paddingVertical: 16 },
    recipeIcon: { backgroundColor: C.mint, width: 48, height: 48, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
    recipeIconText: { fontSize: 23, color: C.green },
    recipeBody: { flex: 1, marginLeft: 12 },
    recipeName: { color: C.ink, fontSize: 15, fontWeight: '700' },
    recipeMeta: { color: C.muted, fontSize: 12, marginTop: 5 },
    moreButton: { padding: 7 },
    moreDots: { color: C.muted, letterSpacing: 2 },
    deleteTemplateIcon: { width: 44, height: 48, alignItems: 'center', justifyContent: 'center', marginRight: 8, borderRadius: 12 },
    deleteTemplateIconText: { color: palette.dark ? '#FF9790' : '#B42318', fontSize: 28 },
    deleteTemplateButton: { minHeight: 52, paddingVertical: 12, marginBottom: 12, borderBottomWidth: 1, borderBottomColor: palette.line },
    deleteTemplateText: { color: palette.dark ? '#FF9790' : '#B42318', fontSize: 15, fontWeight: '700' },
    playButton: { overflow: 'hidden', width: 48, height: 48, backgroundColor: C.green, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
    playText: { color: palette.onPrimary, fontSize: 13 },
    quoteCard: { backgroundColor: C.mint, borderRadius: 18, padding: 18, marginTop: 10 },
    quote: { color: C.green, fontSize: 16, fontStyle: 'italic', textAlign: 'center', lineHeight: 23 },
    filterRow: { flexDirection: 'row', gap: 8, marginVertical: 20 },
    filterChip: { minHeight: 48, justifyContent: 'center', backgroundColor: C.mint, borderRadius: 20, paddingVertical: 9, paddingHorizontal: 12 },
    filterText: { color: C.ink, fontSize: 12, fontWeight: '700' },
    reportHero: { overflow: 'hidden', backgroundColor: palette.hero, borderRadius: 18, padding: 22, marginBottom: 14 },
    reportLabel: { color: C.yellow, fontSize: 11, fontWeight: '700', letterSpacing: 1.3 },
    reportNumber: { color: '#FFFFFF', fontSize: 54, fontWeight: '700', marginTop: 8 },
    reportDelta: { color: palette.heroMuted, fontSize: 13 },
    chart: { height: 95, flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', marginTop: 18, paddingHorizontal: 6 },
    chartCol: { flex: 1, height: 95, alignItems: 'center', justifyContent: 'flex-end' },
    chartBar: { width: 19, backgroundColor: C.yellow, borderRadius: 9 },
    chartDot: { color: palette.heroMuted, marginTop: 5, fontSize: 10 },
    reportCard: { backgroundColor: C.white, padding: 5, borderRadius: 18, borderWidth: 1, borderColor: C.line, marginBottom: 25 },
    reportLine: { flexDirection: 'row', alignItems: 'center', padding: 14 },
    reportIcon: { width: 38, height: 38, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
    reportText: { flex: 1, marginLeft: 12 },
    reportTitle: { color: C.ink, fontSize: 14, fontWeight: '700' },
    reportCopy: { color: C.muted, fontSize: 12, lineHeight: 17, marginTop: 3 },
    chevron: { color: C.muted, fontSize: 24, marginLeft: 'auto', paddingLeft: 10 },
    progressLine: { marginBottom: 17 },
    progressLabel: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 7 },
    progressSkill: { color: C.ink, fontSize: 13, fontWeight: '700' },
    progressValue: { color: C.green, fontSize: 13, fontWeight: '700' },
    track: { height: 8, borderRadius: 5, backgroundColor: C.line, overflow: 'hidden' },
    fill: { height: '100%', borderRadius: 5 },
    nextCard: { backgroundColor: C.mint, padding: 18, borderRadius: 18, marginTop: 7 },
    nextEyebrow: { color: C.green, fontSize: 10, letterSpacing: 1.5, fontWeight: '700' },
    nextTitle: { color: C.ink, fontSize: 17, fontWeight: '700', marginTop: 8 },
    nextCopy: { color: C.muted, fontSize: 13, lineHeight: 18, marginTop: 5 },
    moreCard: { backgroundColor: C.white, borderRadius: 20, borderWidth: 1, borderColor: C.line, padding: 20, marginBottom: 13 },
    moreTitle: { color: C.ink, fontSize: 18, fontWeight: '700' },
    moreCopy: { color: C.muted, fontSize: 13, lineHeight: 19, marginTop: 5 },
    divider: { height: 1, backgroundColor: C.line, marginVertical: 15 },
    moreItem: { color: C.ink, fontSize: 15, paddingVertical: 12, fontWeight: '600' },
    detailCard: { backgroundColor: C.mint, borderRadius: 16, padding: 16, marginTop: 14 },
    detailTitle: { color: C.green, fontSize: 12, fontWeight: '700', letterSpacing: 1.2 },
    detailCopy: { color: C.ink, fontSize: 14, lineHeight: 20, marginTop: 7 },
    detailClose: { color: C.green, fontSize: 13, fontWeight: '700', marginTop: 12 },
    editAction: { color: C.green, fontSize: 20, paddingHorizontal: 8 },
    customEditor: { marginTop: 16, backgroundColor: C.mint, borderRadius: 16, padding: 16 },
    iconGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 14 },
    iconChoice: { width: 48, height: 48, borderRadius: 12, backgroundColor: C.white, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: C.line },
    iconChoiceActive: { backgroundColor: C.yellow, borderColor: C.green },
    moreRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 13, borderBottomWidth: 1, borderBottomColor: C.line },
    moreRowText: { color: C.ink, fontSize: 15, fontWeight: '600' },
    textInput: { backgroundColor: C.white, borderWidth: 1, borderColor: C.line, borderRadius: 14, padding: 14, color: C.ink, fontSize: 16, marginBottom: 16 },
    optionGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 24 },
    option: { minHeight: 48, justifyContent: 'center', backgroundColor: C.white, borderWidth: 1, borderColor: C.line, borderRadius: 14, paddingVertical: 13, paddingHorizontal: 15, marginBottom: 8 },
    optionActive: { backgroundColor: C.mint, borderColor: C.green },
    optionText: { color: C.ink, fontSize: 14, fontWeight: '700' },
    optionTextActive: { color: C.ink },
    themeOption: { flexDirection: 'row', alignItems: 'center', backgroundColor: C.white, borderWidth: 1, borderColor: C.line, borderRadius: 16, padding: 15, marginBottom: 10 },
    themeOptionActive: { borderColor: C.green, backgroundColor: C.mint },
    themeSwatch: { width: 26, height: 26, borderRadius: 9, marginRight: 12 },
    skillAddRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    addSkillButton: { width: 50, height: 50, borderRadius: 14, backgroundColor: C.green, alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
    addSkillText: { color: palette.onPrimary, fontSize: 24, fontWeight: '700' },
    customSkillList: { backgroundColor: C.white, borderRadius: 18, overflow: 'hidden' },
    customSkillRow: { flexDirection: 'row', alignItems: 'center', padding: 14, borderBottomWidth: 1, borderBottomColor: C.line },
    skillStatus: { color: C.muted, fontSize: 11, fontWeight: '700' },
    nav: { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: C.white, borderTopWidth: 1, borderTopColor: C.line, flexDirection: 'row', justifyContent: 'space-around', paddingTop: 10 },
    navItem: { alignItems: 'center', width: '25%', minHeight: 58, paddingVertical: 6, gap: 2 },
    navIcon: { color: C.muted, fontSize: 23, height: 30 },
    navText: { color: C.muted, fontSize: 11, fontWeight: '700' },
    navActive: { color: C.ink },
    modal: { ...StyleSheet.absoluteFill, backgroundColor: C.cream, zIndex: 5 },
    modalInner: { flex: 1 },
    modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 },
    backButton: { width: 52, height: 52, flexShrink: 0, alignItems: 'center', justifyContent: 'center', borderRadius: 26, marginLeft: -12 },
    back: { fontSize: 36, color: C.green, lineHeight: 38 },
    modalTitle: { color: C.ink, fontSize: 18, fontWeight: '700' },
    saveText: { color: C.green, fontSize: 15, fontWeight: '700' },
    sessionCount: { color: C.muted, fontSize: 12 },
    inputLabel: { color: C.green, fontSize: 11, fontWeight: '700', letterSpacing: 1.3, marginTop: 20, marginBottom: 9 },
    fakeInput: { backgroundColor: C.white, borderRadius: 14, borderWidth: 1, borderColor: C.line, padding: 15 },
    fakeInputText: { color: C.ink, fontSize: 16, fontWeight: '700' },
    editSkill: { flexDirection: 'row', alignItems: 'center', backgroundColor: C.white, borderRadius: 15, padding: 14, marginBottom: 8, borderWidth: 1, borderColor: C.line },
    reorder: { color: C.green, width: 26, fontWeight: '700' },
    editSkillText: { color: C.ink, fontWeight: '700', flex: 1, marginLeft: 10 },
    remove: { color: C.coral, fontSize: 25, paddingHorizontal: 5 },
    skillGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    skillPill: { backgroundColor: C.white, borderWidth: 1, borderColor: C.line, borderRadius: 18, flexDirection: 'row', alignItems: 'center', paddingVertical: 10, paddingHorizontal: 12, marginBottom: 8 },
    activeSkillPill: { backgroundColor: C.green },
    skillIcon: { fontSize: 17, color: C.green },
    skillPillText: { color: C.ink, fontSize: 12, fontWeight: '700', marginLeft: 6 },
    activeSkillText: { color: palette.onPrimary },
    saveHint: { backgroundColor: C.mint, borderRadius: 16, padding: 15, marginVertical: 20 },
    saveHintText: { color: C.green, fontSize: 13, lineHeight: 19 },
    sessionTitle: { color: C.ink, fontSize: 28, fontWeight: '700' },
    sessionProgress: { height: 8, backgroundColor: C.line, borderRadius: 4, marginVertical: 20, overflow: 'hidden' },
    sessionFill: { height: '100%', backgroundColor: C.yellow, borderRadius: 4 },
    currentDrill: { backgroundColor: C.white, borderRadius: 18, padding: 20, borderWidth: 1, borderColor: C.line },
    currentTitle: { color: C.ink, fontSize: 23, fontWeight: '700', marginTop: 10 },
    currentCopy: { color: C.muted, fontSize: 14, lineHeight: 20, marginTop: 7 },
    bigStats: { flexDirection: 'row', justifyContent: 'space-around', backgroundColor: C.mint, borderRadius: 18, padding: 18, marginVertical: 16 },
    bigNumber: { color: C.green, fontSize: 24, fontWeight: '700', textAlign: 'center' },
    bigLabel: { color: C.muted, fontSize: 11, textAlign: 'center', marginTop: 3 },
    tapRow: { flexDirection: 'row', gap: 12, marginBottom: 18 },
    tapButton: { flex: 1, backgroundColor: C.white, borderRadius: 19, padding: 20, alignItems: 'center' },
    successTap: { backgroundColor: C.mint },
    tapIcon: { color: C.ink, fontSize: 32, fontWeight: '300' },
    tapLabel: { color: C.ink, fontSize: 13, fontWeight: '700', marginTop: 5 },
    focusMeta: { flexDirection: 'row', alignItems: 'center', gap: 9, marginBottom: 22 },
    focusMetaText: { color: palette.heroMuted, fontSize: 11, fontWeight: '600', letterSpacing: 0.8 },
    focusMetaDot: { width: 3, height: 3, borderRadius: 2, backgroundColor: palette.heroMuted },
    focusMetaTag: { marginLeft: 'auto', color: C.yellow, fontSize: 10, letterSpacing: 1 },
    filterChipSelected: { backgroundColor: C.green },
    filterTextSelected: { color: palette.onPrimary },
    recipeContent: { flex: 1, flexDirection: 'row', alignItems: 'center', paddingVertical: 4, marginRight: 12 },
    recipeSkills: { color: C.muted, fontSize: 12, lineHeight: 18, marginTop: 8 },
    reportIconText: { color: C.green, fontSize: 20 },
    sessionNavigation: { flexDirection: 'row', gap: 12 },
    sessionNavButton: { flex: 1 },
    resetButton: { alignItems: 'center', paddingVertical: 18, marginBottom: 6 },
    resetButtonText: { color: C.muted, fontSize: 13, textDecorationLine: 'underline' },
    drillEditorCard: { backgroundColor: C.white, borderRadius: 16, padding: 14, marginBottom: 12, borderWidth: 1, borderColor: C.line },
    editSkillHeader: { flexDirection: 'row', alignItems: 'center' },
    drillConfigAction: { flexDirection: 'row', alignItems: 'center', borderTopWidth: 1, borderTopColor: C.line, marginTop: 12, paddingTop: 12 },
    drillTargetLabel: { color: C.green, fontSize: 14, fontWeight: '700', marginTop: 8 },
    scoreBandText: { color: C.ink, fontSize: 13, lineHeight: 23, marginTop: 4 },
    disabledControl: { opacity: 0.4 },
    templateFocus: { color: C.green, fontSize: 11, fontWeight: '600', marginTop: 7 },
    onboardingActions: { gap: 12, marginTop: 24 },
    onboardingStep: { color: C.muted, fontSize: 12, marginBottom: 20 },
    navSelected: { backgroundColor: C.mint, borderRadius: 14 },

  });
}
let styles = createStyles(activeTheme);
