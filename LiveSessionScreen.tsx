import React, { useEffect, useState } from 'react';
import { Alert, BackHandler, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ThemeGradient } from './ThemeGradient';
import type { ThemePalette } from './appThemes';
import type { DrillConfig, DrillResult } from './drillScoring';
import { scoreBandLabels } from './drillScoring';
import { formatTrainingTime } from './trainingUX';

type Props = {
  palette: ThemePalette; template: string; skill: string; index: number; count: number;
  attempts: number; successes: number; config: DrillConfig; estimate: number; total: number;
  result?: DrillResult; showResult: boolean; allComplete: boolean; nextSkill?: string; saving: boolean; paused: boolean; onPause: () => void; description: string; elapsedMs: number;
  canUndo: boolean; note: string; notice?: string | null;
  onLog: (attempts: number, successes: number) => void; onUndo: () => void; onReset: () => void;
  onLeave: () => void; onNavigate: (index: number) => void; onFinish: () => void;
  onNext: () => void; onReview: () => void; onShowResult: () => void; onNote: (note: string) => void;
};
export function LiveSessionScreen(props: Props) {
  const { palette: p, attempts, successes, config } = props;
  const [details, setDetails] = useState(false);
  const [setMode, setSetMode] = useState(false);
  const [batchAttempts, setBatchAttempts] = useState('');
  const [batchSuccesses, setBatchSuccesses] = useState('');
  const [error, setError] = useState('');
  const [noteEditing, setNoteEditing] = useState(false);
  const complete = attempts >= config.targetAttempts;
  const overlayOpen = setMode || props.showResult || noteEditing;
  useEffect(() => {
    const listener = BackHandler.addEventListener('hardwareBackPress', () => {
      if (setMode) { setSetMode(false); return true; }
      if (noteEditing) { setNoteEditing(false); return true; }
      if (props.showResult) { props.onReview(); return true; }
      props.onLeave(); return true;
    });
    return () => listener.remove();
  }, [setMode, noteEditing, props.showResult, props.onLeave, props.onReview]);
  const button = (label: string, action: () => void, primary = false, disabled = false) => <Pressable accessibilityRole="button" accessibilityState={{ disabled: disabled || props.saving }} disabled={disabled || props.saving} onPress={action} style={({ pressed }) => [s.button, { backgroundColor: primary ? p.buttonGradient[0] : p.surface, borderColor: p.line, opacity: disabled || props.saving ? 0.4 : pressed ? 0.7 : 1 }]}>{primary && <ThemeGradient colors={p.buttonGradient} />}<Text style={[s.buttonText, { color: primary ? p.onAccent : p.ink }]}>{label}</Text></Pressable>;
  const submitSet = () => {
    const a = Number(batchAttempts), b = Number(batchSuccesses);
    if (!batchAttempts || !batchSuccesses || !Number.isInteger(a) || !Number.isInteger(b) || a < 1 || b < 0 || b > a || a > config.targetAttempts - attempts) { setError(`Enter 1–${config.targetAttempts - attempts} attempts and 0–that many successes.`); return; }
    props.onLog(a, b); setSetMode(false); setError('');
  };
  return <SafeAreaView edges={['left', 'right', 'bottom']} style={[StyleSheet.absoluteFill, { zIndex: 5, backgroundColor: p.background }]}><KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
    <View style={{ flex: 1 }} accessibilityElementsHidden={overlayOpen} importantForAccessibility={overlayOpen ? 'no-hide-descendants' : 'auto'}><View style={s.header}>{button('‹ Exit', props.onLeave)}<View style={{ flex: 1 }}><Text numberOfLines={1} style={{ color: p.muted, fontSize: 12 }}>{props.template}</Text><Text style={{ color: p.ink, fontWeight: '700' }}>Skill {props.index + 1} of {props.count}</Text></View><Text accessibilityLabel="Elapsed active training time" style={{ color: p.muted }}>{formatTrainingTime(props.elapsedMs)}{props.paused ? ' · Paused' : ''}</Text></View>
    <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={s.content}>
      <Text style={[s.title, { color: p.ink }]}>{props.skill}</Text>
      <Text style={[s.number, { color: p.primary }]} accessibilityLiveRegion="polite">{successes}</Text><Text style={{ color: p.muted, textAlign: 'center', fontSize: 18 }}>successful attempts</Text>
      <Text style={{ color: p.ink, textAlign: 'center', marginTop: 16, fontSize: 20 }}>{attempts} / {config.targetAttempts} attempts</Text>
      <View style={[s.track, { backgroundColor: p.line }]}><View style={{ height: 8, width: `${Math.min(100, attempts / config.targetAttempts * 100)}%`, backgroundColor: p.primary }} /></View>
      <Text style={{ color: p.muted, textAlign: 'center' }}>{attempts ? `${Math.round(successes / attempts * 100)}% accuracy · ` : ''}{complete ? `${props.estimate} skill points earned` : `Current score estimate: ${props.estimate > 0 ? '+' : ''}${props.estimate}`}</Text>
      <Text style={{ color: p.muted, textAlign: 'center', marginTop: 6 }}>Template total so far: {props.total} points</Text>
      {props.notice && <Text accessibilityLiveRegion="polite" style={{ color: p.ink, marginVertical: 12 }}>{props.notice}</Text>}
      <View style={s.row}>{button(details ? 'Hide drill details' : 'Instructions & scoring', () => setDetails(!details))}{button('More', () => Alert.alert('Session options', 'Choose an action for this practice.', [{ text: props.paused ? 'Resume timer' : 'Pause timer', onPress: props.onPause }, { text: 'Add a note', onPress: () => setNoteEditing(true) }, { text: 'Reset current skill', style: 'destructive', onPress: props.onReset }, { text: 'Cancel', style: 'cancel' }]))}</View>
      {details && <View style={[s.details, { backgroundColor: p.surface }]}><Text style={{ color: p.ink, lineHeight: 22 }}>{props.description}</Text>{scoreBandLabels(config).map(label => <Text key={label} style={{ color: p.muted, lineHeight: 25 }}>{label}</Text>)}<Text style={{ color: p.muted }}>Only one scoring band applies. Points are final at the attempt target.</Text></View>}
      <View style={s.row}>{button('‹ Previous', () => props.onNavigate(props.index - 1), false, props.index === 0)}{button('Next skill ›', () => props.onNavigate(props.index + 1), false, props.index === props.count - 1)}</View>
      {complete && button('Review skill result', props.onShowResult)}
      {button('Finish template', props.onFinish)}
    </ScrollView>
    <View style={[s.footer, { backgroundColor: p.background, borderTopColor: p.line }]}>
      <View style={s.row}>{button('Undo last entry', props.onUndo, false, !props.canUndo)}{button('Enter set results', () => { setBatchAttempts(String(config.targetAttempts - attempts)); setBatchSuccesses(''); setError(''); setSetMode(true); }, false, complete)}</View>
      <View style={s.row}>
        <Pressable accessibilityRole="button" accessibilityLabel="Log a missed attempt" disabled={complete || props.saving} accessibilityState={{ disabled: complete || props.saving }} onPress={() => props.onLog(1, 0)} style={({ pressed }) => [s.log, { backgroundColor: p.surface, borderColor: p.line, opacity: complete || props.saving ? 0.4 : pressed ? 0.7 : 1 }]}><Text style={[s.logLabel, { color: p.ink }]}>Miss</Text><Text style={{ color: p.muted }}>+1 attempt</Text></Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel="Log a successful attempt" disabled={complete} accessibilityState={{ disabled: complete }} onPress={() => props.onLog(1, 1)} style={({ pressed }) => [s.log, { backgroundColor: p.buttonGradient[0], borderColor: p.primary, opacity: complete || props.saving ? 0.4 : pressed ? 0.7 : 1 }]}><ThemeGradient colors={p.buttonGradient} /><Text style={[s.logLabel, { color: p.onAccent }]}>Success</Text><Text style={{ color: p.onAccent }}>+1 attempt & success</Text></Pressable>
      </View>
    </View>
    </View>{overlayOpen && <View accessibilityViewIsModal style={s.overlay}><View style={[s.sheet, { backgroundColor: p.surface }]}><ScrollView keyboardShouldPersistTaps="handled">
      {noteEditing ? <><Text style={[s.title, { color: p.ink }]}>Session note</Text><TextInput accessibilityLabel="Session note" value={props.note} onChangeText={props.onNote} placeholder="What worked today?" placeholderTextColor={p.muted} multiline style={[s.input, { color: p.ink, borderColor: p.line }]} />{button('Done', () => setNoteEditing(false), true)}</> : setMode ? <><Text style={[s.title, { color: p.ink }]}>Record a set</Text><Text style={{ color: p.muted }}>{config.targetAttempts - attempts} attempts remaining. Undo reverses the entire set.</Text><Text style={[s.label, { color: p.ink }]}>Attempts in this set</Text><TextInput accessibilityLabel="Attempts in set" value={batchAttempts} onChangeText={v => setBatchAttempts(v.replace(/\D/g, ''))} keyboardType="number-pad" style={[s.input, { color: p.ink, borderColor: p.line }]} /><Text style={[s.label, { color: p.ink }]}>Successful attempts</Text><TextInput accessibilityLabel="Successes in set" value={batchSuccesses} onChangeText={v => setBatchSuccesses(v.replace(/\D/g, ''))} keyboardType="number-pad" style={[s.input, { color: p.ink, borderColor: p.line }]} />{error && <Text accessibilityLiveRegion="polite" style={{ color: p.ink }}>{error}</Text>}{button('Record set', submitSet, true)}{button('Cancel', () => setSetMode(false))}</> : <>
        <Text style={[s.title, { color: p.ink }]}>{props.skill} complete</Text><Text style={[s.earned, { color: p.primary }]}>You earned {props.result?.points ?? 0} points</Text><Text style={{ color: p.muted }}>{successes}/{attempts} successful attempts · Template total: {props.total} points</Text>
        {props.allComplete && <><Text style={[s.label, { color: p.ink }]}>Session note (optional)</Text><TextInput editable={!props.saving} accessibilityLabel="Session note" value={props.note} onChangeText={props.onNote} placeholder="What worked today?" placeholderTextColor={p.muted} multiline style={[s.input, { color: p.ink, borderColor: p.line }]} /></>}
        {button(props.saving ? 'Saving…' : props.allComplete ? 'Save session & see total' : `Next: ${props.nextSkill || 'skill'}`, props.onNext, true)}{button('Review or correct result', props.onReview)}
      </>}
    </ScrollView></View></View>}
  </KeyboardAvoidingView></SafeAreaView>;
}
const s = StyleSheet.create({ header: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16 }, content: { paddingHorizontal: 20, paddingBottom: 20 }, title: { fontSize: 24, fontWeight: '700', marginBottom: 12 }, number: { fontSize: 76, fontWeight: '700', textAlign: 'center', marginTop: 6 }, track: { height: 8, borderRadius: 4, overflow: 'hidden', marginVertical: 16 }, row: { flexDirection: 'row', gap: 10, marginVertical: 6 }, button: { overflow: 'hidden', minHeight: 48, flexShrink: 1, borderWidth: 1, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 13, alignItems: 'center', justifyContent: 'center', marginVertical: 3 }, buttonText: { fontSize: 13, fontWeight: '600', textAlign: 'center' }, footer: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 8, borderTopWidth: 1 }, log: { overflow: 'hidden', flex: 1, minHeight: 100, padding: 14, borderWidth: 1, borderRadius: 18, alignItems: 'center', justifyContent: 'center' }, logLabel: { fontSize: 28, fontWeight: '700', marginBottom: 6 }, details: { padding: 16, borderRadius: 16, marginVertical: 8 }, overlay: { ...StyleSheet.absoluteFill, backgroundColor: '#00000066', justifyContent: 'flex-end' }, sheet: { maxHeight: '85%', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 22 }, earned: { fontSize: 26, fontWeight: '700', marginBottom: 10 }, label: { fontSize: 13, fontWeight: '600', marginTop: 14, marginBottom: 6 }, input: { borderWidth: 1, borderRadius: 12, padding: 12, fontSize: 16, marginBottom: 12 } });
