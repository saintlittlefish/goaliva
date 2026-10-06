import React, { useEffect, useState } from 'react';
import { Alert, BackHandler, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { ThemePalette } from './appThemes';
import { CustomSkillCreator } from './CustomSkillCreator';
type CustomSkill = { id: string; name: string; icon: string; description?: string };
export function SkillLibraryScreen({ customSkills, skills, iconOptions, palette: p, describe, icon, onClose, onCreate, onUpdate, onDelete }: {
  customSkills: CustomSkill[]; skills: string[]; iconOptions: string[]; palette: ThemePalette; describe: (skill: string) => string; icon: (skill: string) => string;
  onClose: () => void; onCreate: (name: string, icon: string, description: string) => boolean;
  onUpdate: (id: string, name: string, icon: string, description: string) => boolean; onDelete: (skill: CustomSkill) => void;
}) {
  const [editing, setEditing] = useState<CustomSkill | undefined>();
  const [info, setInfo] = useState<string | null>(null);
  const close = () => editing ? Alert.alert('Leave skill editor?', 'Unsaved skill changes will be discarded.', [{ text: 'Keep editing', style: 'cancel' }, { text: 'Leave', style: 'destructive', onPress: onClose }]) : onClose();
  useEffect(() => { const listener = BackHandler.addEventListener('hardwareBackPress', () => { close(); return true; }); return () => listener.remove(); }, [editing]);
  useEffect(() => { if (editing && !customSkills.some(skill => skill.id === editing.id)) setEditing(undefined); }, [customSkills, editing]);
  return <SafeAreaView edges={['left', 'right', 'bottom']} style={[StyleSheet.absoluteFill, { zIndex: 8, backgroundColor: p.background }]}><KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
    <View style={s.header}><Pressable accessibilityRole="button" onPress={close} style={s.button}><Text style={{ color: p.primary, fontSize: 18 }}>‹ Back</Text></Pressable><Text style={{ color: p.ink, fontSize: 22, fontWeight: '700' }}>Skill library</Text></View>
    <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 20 }}><Text style={{ color: p.muted }}>Shared across all templates. Tap a skill to read its instructions; edit custom skills here or create one while building a template.</Text>
      <CustomSkillCreator key={editing?.id ?? 'library-create'} existingSkills={skills.filter(skill => skill !== editing?.name)} iconOptions={iconOptions} palette={p} initialSkill={editing} libraryOnly onCancel={() => setEditing(undefined)} onCreate={(name, symbol, description) => editing ? onUpdate(editing.id, name, symbol, description) : onCreate(name, symbol, description)} />
      {info && <View style={[s.card, { backgroundColor: p.mint }]}><Text style={{ color: p.ink, fontWeight: '700' }}>{info}</Text><Text style={{ color: p.muted, marginVertical: 8 }}>{describe(info)}</Text><Pressable accessibilityRole="button" onPress={() => setInfo(null)} style={s.button}><Text style={{ color: p.primary }}>Close details</Text></Pressable></View>}
      {skills.map(skill => { const custom = customSkills.find(item => item.name === skill); return <View key={skill} style={[s.row, { backgroundColor: p.surface, borderColor: p.line }]}><Pressable accessibilityRole="button" accessibilityLabel={`Read about ${skill}`} onPress={() => setInfo(skill)} style={{ flex: 1, minHeight: 52, justifyContent: 'center' }}><Text style={{ color: p.ink, fontSize: 15, fontWeight: '600' }}>{icon(skill)}  {skill}</Text><Text style={{ color: p.muted, fontSize: 12, marginTop: 4 }}>{custom ? 'Custom · Shared library' : 'Built-in'}</Text></Pressable>{custom && <Pressable accessibilityRole="button" accessibilityLabel={`${skill} options`} onPress={() => Alert.alert(skill, 'Manage this shared skill.', [{ text: 'Edit skill', onPress: () => setEditing(custom) }, { text: 'Delete skill', style: 'destructive', onPress: () => onDelete(custom) }, { text: 'Cancel', style: 'cancel' }])} style={s.button}><Text style={{ color: p.primary, fontSize: 22 }}>⋯</Text></Pressable>}</View>; })}
    </ScrollView>
  </KeyboardAvoidingView></SafeAreaView>;
}
const s = StyleSheet.create({ header: { flexDirection: 'row', alignItems: 'center', padding: 16, gap: 12 }, button: { minWidth: 48, minHeight: 48, padding: 12, alignItems: 'center', justifyContent: 'center' }, card: { padding: 16, borderRadius: 16, marginVertical: 12 }, row: { flexDirection: 'row', alignItems: 'center', padding: 12, borderWidth: 1, borderRadius: 14, marginTop: 10 } });
