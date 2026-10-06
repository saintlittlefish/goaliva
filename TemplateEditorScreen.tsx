import React, { useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { TEMPLATE_FOCUSES, type TemplateFocus } from './templateRelevance';
import { getDrillConfig, type DrillConfig } from './drillScoring';
import { moveTemplateSkill } from './trainingUX';
import { CustomSkillCreator } from './CustomSkillCreator';
import { ThemeGradient } from './ThemeGradient';
import type { ThemePalette } from './appThemes';
type Template = { id: string; name: string; skills: string[]; minutes: number; color: string; focus: TemplateFocus; drills?: Record<string, DrillConfig> };
export function TemplateEditorScreen({ template, minutes, skills, iconOptions, palette: p, icon, onChange, onMinutes, onClose, onSave, onDelete, onAdd, onRemove, onScoring, onCreate }: {
  template: Template; minutes: string; skills: string[]; iconOptions: string[]; palette: ThemePalette; icon: (skill: string) => string;
  onChange: (value: Template) => void; onMinutes: (value: string) => void; onClose: () => void; onSave: () => void; onDelete?: () => void;
  onAdd: (skill: string) => void; onRemove: (skill: string) => void; onScoring: (skill: string) => void; onCreate: (name: string, icon: string, description: string) => boolean;
}) {
  const [focusOpen, setFocusOpen] = useState(false);
  const action = (label: string, callback: () => void, disabled = false, accessibilityLabel = label) => <Pressable key={label} accessibilityRole="button" accessibilityLabel={accessibilityLabel} disabled={disabled} accessibilityState={{ disabled }} onPress={callback} style={[s.action, { backgroundColor: p.mint, opacity: disabled ? 0.35 : 1 }]}><Text style={{ color: p.ink, fontWeight: '600' }}>{label}</Text></Pressable>;
  return <SafeAreaView edges={['left', 'right', 'bottom']} style={[StyleSheet.absoluteFill, { zIndex: 5, backgroundColor: p.background }]}><KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
    <View style={s.header}>{action('‹ Back', onClose)}<Text style={[s.title, { color: p.ink, flex: 1 }]}>Edit template</Text>{onDelete && action('More', () => Alert.alert('Template options', 'Completed sessions will always be kept.', [{ text: 'Delete template', style: 'destructive', onPress: onDelete }, { text: 'Cancel', style: 'cancel' }]))}</View>
    <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={s.content}>
      <Text style={[s.label, { color: p.ink }]}>Template name</Text><TextInput accessibilityLabel="Template name" value={template.name} onChangeText={name => onChange({ ...template, name })} style={[s.input, { color: p.ink, backgroundColor: p.surface, borderColor: p.line }]} />
      <Text style={[s.label, { color: p.ink }]}>Planned duration (minutes)</Text><TextInput accessibilityLabel="Session length in minutes" value={minutes} onChangeText={value => onMinutes(value.replace(/\D/g, ''))} placeholder="Minutes" placeholderTextColor={p.muted} selectTextOnFocus keyboardType="number-pad" style={[s.input, { color: p.ink, backgroundColor: p.surface, borderColor: p.line }]} /><Text style={{ color: p.muted }}>An estimate for planning. Actual active time is measured during training.</Text>
      <View style={s.row}>{action(`Focus: ${template.focus}`, () => setFocusOpen(!focusOpen))}</View>
      {focusOpen && <View style={s.rowWrap}>{TEMPLATE_FOCUSES.map(focus => <Pressable key={focus} accessibilityRole="button" accessibilityState={{ selected: template.focus === focus }} onPress={() => onChange({ ...template, focus })} style={[s.action, { backgroundColor: template.focus === focus ? p.primary : p.surface }]}><Text style={{ color: template.focus === focus ? p.onPrimary : p.ink }}>{focus}</Text></Pressable>)}</View>}
      <Text style={[s.label, { color: p.ink }]}>Drill order</Text><Text style={{ color: p.muted, marginBottom: 12 }}>Use the arrows to change your flow. Scoring belongs to each skill, not its position.</Text>
      {template.skills.map((skill, index) => <View key={skill} style={[s.card, { backgroundColor: p.surface, borderColor: p.line }]}>
        <View style={s.row}><Text style={{ color: p.primary, fontSize: 20 }}>{icon(skill)}</Text><Text style={{ color: p.ink, flex: 1, fontWeight: '700' }}>{index + 1}. {skill}</Text>{action('↑', () => onChange(moveTemplateSkill(template, index, -1)), index === 0, `Move ${skill} earlier`)}{action('↓', () => onChange(moveTemplateSkill(template, index, 1)), index === template.skills.length - 1, `Move ${skill} later`)}</View>
        <Text style={{ color: p.primary, fontWeight: '700', marginVertical: 8 }}>{getDrillConfig(template, skill).targetAttempts} attempts</Text>
        <View style={s.row}>{action('Targets & scoring', () => onScoring(skill))}{action('Remove', () => onRemove(skill))}</View>
      </View>)}
      <Text style={[s.label, { color: p.ink }]}>Add a skill</Text><View style={s.rowWrap}>{skills.filter(skill => !template.skills.includes(skill)).map(skill => action(skill, () => onAdd(skill)))}</View>
      <CustomSkillCreator key={template.id} existingSkills={[...skills, ...template.skills]} iconOptions={iconOptions} palette={p} onCreate={onCreate} />
    </ScrollView>
    <View style={[s.footer, { backgroundColor: p.background, borderTopColor: p.line }]}><Pressable accessibilityRole="button" onPress={onSave} style={[s.save, { backgroundColor: p.buttonGradient[0] }]}><ThemeGradient colors={p.buttonGradient} /><Text style={{ color: p.onAccent, fontSize: 16, fontWeight: '700' }}>Save template</Text></Pressable></View>
  </KeyboardAvoidingView></SafeAreaView>;
}
const s = StyleSheet.create({ header: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 16 }, title: { fontSize: 20, fontWeight: '700' }, content: { padding: 20 }, label: { fontSize: 14, fontWeight: '700', marginTop: 16, marginBottom: 8 }, input: { padding: 14, borderRadius: 12, borderWidth: 1, fontSize: 16, marginBottom: 8 }, row: { flexDirection: 'row', alignItems: 'center', gap: 8, marginVertical: 5 }, rowWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 }, action: { minWidth: 48, minHeight: 48, padding: 12, borderRadius: 12, alignItems: 'center', justifyContent: 'center', flexShrink: 1 }, card: { padding: 14, borderRadius: 16, borderWidth: 1, marginBottom: 12 }, footer: { padding: 16, borderTopWidth: 1 }, save: { overflow: 'hidden', minHeight: 56, borderRadius: 14, alignItems: 'center', justifyContent: 'center' } });
