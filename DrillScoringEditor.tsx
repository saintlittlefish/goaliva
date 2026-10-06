import React, { useEffect, useState } from 'react';
import { Alert, BackHandler, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { calculateDrillPoints, defaultDrillConfig, scoreBandLabels, validateDrillConfig, type DrillConfig } from './drillScoring';
import { ThemeGradient } from './ThemeGradient';
import type { ThemePalette } from './appThemes';

type Palette = ThemePalette;
type RuleDraft = { id: number; threshold: string; points: string };

export function DrillScoringEditor({ skill, config, palette, onApply, onClose }: {
  skill: string; config: DrillConfig; palette: Palette; onApply: (config: DrillConfig) => void; onClose: () => void;
}) {
  const [sample, setSample] = useState('9');
  const [target, setTarget] = useState(String(config.targetAttempts));
  const [rules, setRules] = useState<RuleDraft[]>(config.scoreRules.map((rule, id) => ({ id, threshold: String(rule.minSuccesses), points: String(rule.points) })));
  const candidate: DrillConfig = {
    targetAttempts: target.trim() ? Number(target) : NaN,
    scoreRules: rules.map(rule => ({ minSuccesses: rule.threshold.trim() ? Number(rule.threshold) : NaN, points: /^-?\d+$/.test(rule.points) ? Number(rule.points) : NaN })),
  };
  const error = validateDrillConfig(candidate);
  const close = () => {
    const dirty = target !== String(config.targetAttempts) || JSON.stringify(candidate.scoreRules) !== JSON.stringify(config.scoreRules);
    if (dirty) Alert.alert('Discard scoring changes?', 'Use Apply to template to keep your draft rules.', [{ text: 'Keep editing', style: 'cancel' }, { text: 'Discard', style: 'destructive', onPress: onClose }]); else onClose();
  };
  useEffect(() => { const listener = BackHandler.addEventListener('hardwareBackPress', () => { close(); return true; }); return () => listener.remove(); }, [target, rules]);
  const colors = StyleSheet.create({
    text: { color: palette.ink }, muted: { color: palette.muted },
    input: { color: palette.ink, backgroundColor: palette.surface, borderColor: palette.line },
    card: { backgroundColor: palette.mint }, primary: { backgroundColor: palette.buttonGradient[0] },
  });
  const updateRule = (id: number, field: 'threshold' | 'points', value: string) => setRules(rules.map(rule => rule.id === id ? { ...rule, [field]: value } : rule));
  const addRule = () => {
    if (!Number.isInteger(candidate.targetAttempts) || candidate.targetAttempts < 1 || candidate.targetAttempts > 999) { Alert.alert('Set a target first', 'Enter an attempt target from 1 to 999.'); return; }
    const occupied = new Set(rules.map(rule => Number(rule.threshold)));
    let threshold = candidate.targetAttempts;
    while (threshold >= 0 && occupied.has(threshold)) threshold--;
    if (threshold < 0) { Alert.alert('All thresholds used', 'There is already a rule for every possible success count.'); return; }
    setRules([...rules, { id: Math.max(-1, ...rules.map(rule => rule.id)) + 1, threshold: String(threshold), points: '0' }]);
  };
  const resetRules = () => setRules(defaultDrillConfig(Number(target)).scoreRules.map((rule, id) => ({ id, threshold: String(rule.minSuccesses), points: String(rule.points) })));
  return <KeyboardAvoidingView style={[ui.root, { backgroundColor: palette.background }]} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
    <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={ui.page}>
      <View style={ui.header}><Pressable accessibilityRole="button" accessibilityLabel="Close drill scoring" onPress={close} hitSlop={12} style={({ pressed }) => [ui.close, pressed && { backgroundColor: palette.mint }]}><Text style={[ui.back, { color: palette.primary }]}>‹</Text></Pressable><Text style={[ui.title, colors.text]}>Drill targets & scoring</Text></View>
      <Text style={[ui.skill, colors.text]}>{skill}</Text>
      <Text style={[ui.copy, colors.muted]}>These rules belong to this skill in this template. Other templates can use different targets and scores.</Text>
      <Text style={[ui.label, colors.text]}>TARGET ATTEMPTS</Text>
      <TextInput accessibilityLabel="Target attempts" value={target} onChangeText={value => setTarget(value.replace(/[^0-9]/g, '').slice(0, 3))} keyboardType="number-pad" maxLength={3} style={[ui.input, colors.input]} selectTextOnFocus />
      <Text style={[ui.copy, colors.muted]}>Every success also counts as one attempt. Stop when you reach this target.</Text>
      <Text style={[ui.label, colors.text]}>SCORING BANDS</Text>
      <Text style={[ui.copy, colors.muted]}>Enter the starting success count and its final points. The preview below shows the complete ranges. Only one band applies; scores are not cumulative.</Text>
      <View style={ui.row}><Text style={[ui.columnLabel, colors.muted]}>From successes</Text><Text style={[ui.columnLabel, colors.muted]}>Points</Text><View style={ui.remove} /></View>
      {rules.map(rule => <View key={rule.id} style={ui.row}>
        <TextInput accessibilityLabel={`Success threshold for scoring band ${rule.id + 1}`} value={rule.threshold} onChangeText={value => updateRule(rule.id, 'threshold', value.replace(/[^0-9]/g, '').slice(0, 3))} keyboardType="number-pad" style={[ui.input, ui.cell, colors.input]} selectTextOnFocus />
        <TextInput accessibilityLabel={`Points for scoring band ${rule.id + 1}`} value={rule.points} onChangeText={value => updateRule(rule.id, 'points', value.replace(/[^0-9-]/g, '').slice(0, 5))} keyboardType={Platform.OS === 'ios' ? 'numbers-and-punctuation' : 'default'} style={[ui.input, ui.cell, colors.input]} selectTextOnFocus />
        <Pressable accessibilityRole="button" accessibilityLabel={`Remove scoring band ${rule.id + 1}`} onPress={() => setRules(rules.filter(item => item.id !== rule.id))} style={ui.remove}><Text style={[ui.removeText, colors.muted]}>×</Text></Pressable>
      </View>)}
      <View style={ui.actions}><Pressable accessibilityRole="button" onPress={addRule} style={[ui.secondary, { borderColor: palette.line }]}><Text style={[ui.actionText, colors.text]}>＋ Add band</Text></Pressable><Pressable accessibilityRole="button" onPress={resetRules} style={[ui.secondary, { borderColor: palette.line }]}><Text style={[ui.actionText, colors.text]}>Default scoring</Text></Pressable></View>
      <Text style={[ui.copy, colors.muted]}>Changing the target does not change your custom rules. “Default scoring” rebuilds bands for the new target.</Text>
      {error ? <View style={[ui.card, colors.card]}><Text accessibilityLiveRegion="polite" style={[ui.copy, colors.text]}>{error}</Text></View> : <View style={[ui.card, colors.card]}><Text style={[ui.label, colors.text]}>SCORE PREVIEW</Text>{scoreBandLabels(candidate).map(label => <Text key={label} style={[ui.preview, colors.text]}>{label}</Text>)}</View>}
      {!error && <View style={[ui.card, colors.card]}><Text style={[ui.label, colors.text]}>TRY A SAMPLE RESULT</Text><TextInput accessibilityLabel="Sample successful attempts" value={sample} onChangeText={v => setSample(v.replace(/\D/g, '').slice(0, 3))} keyboardType="number-pad" style={[ui.input, colors.input]} /><Text accessibilityLiveRegion="polite" style={[ui.copy, colors.text]}>{sample && Number(sample) <= candidate.targetAttempts ? `${sample} successes out of ${candidate.targetAttempts} attempts earns ${calculateDrillPoints(Number(sample), candidate)} points.` : 'Enter a success count between 0 and your attempt target.'}</Text></View>}
      <Pressable accessibilityRole="button" accessibilityState={{ disabled: Boolean(error) }} disabled={Boolean(error)} onPress={() => onApply({ ...candidate, scoreRules: [...candidate.scoreRules].sort((a, b) => a.minSuccesses - b.minSuccesses) })} style={[ui.primary, colors.primary, error && { opacity: 0.4 }]}><ThemeGradient colors={palette.buttonGradient} /><Text style={[ui.primaryText, { color: palette.onAccent }]}>Apply to template</Text></Pressable>
      <Text style={[ui.copy, colors.muted]}>Save the template afterward to keep your changes.</Text>
    </ScrollView>
  </KeyboardAvoidingView>;
}

const ui = StyleSheet.create({
  root: { flex: 1 }, page: { padding: 24, paddingBottom: 80 }, header: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 24 },
  close: { width: 52, height: 52, flexShrink: 0, alignItems: 'center', justifyContent: 'center', borderRadius: 26, marginLeft: -12 }, back: { fontSize: 36 }, title: { fontSize: 18, fontWeight: '700', flex: 1 },
  skill: { fontSize: 26, fontWeight: '700', marginBottom: 8 }, copy: { fontSize: 13, lineHeight: 20, marginBottom: 12 },
  label: { fontSize: 11, fontWeight: '700', letterSpacing: 1, marginTop: 16, marginBottom: 10 },
  input: { borderWidth: 1, borderRadius: 12, padding: 14, fontSize: 16, marginBottom: 8 }, row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  cell: { flex: 1 }, columnLabel: { flex: 1, fontSize: 11, marginVertical: 10 }, remove: { width: 44, minHeight: 48, alignItems: 'center', justifyContent: 'center' }, removeText: { fontSize: 28 },
  actions: { flexDirection: 'row', gap: 10, marginVertical: 12 }, secondary: { flex: 1, paddingVertical: 14, borderWidth: 1, borderRadius: 12, alignItems: 'center' }, actionText: { fontSize: 12, fontWeight: '600' },
  card: { borderRadius: 16, padding: 16, marginVertical: 12 }, preview: { fontSize: 14, lineHeight: 25 },
  primary: { overflow: 'hidden', paddingVertical: 16, paddingHorizontal: 14, alignItems: 'center', borderRadius: 14, marginVertical: 12 }, primaryText: { fontSize: 15, fontWeight: '700' },
});
