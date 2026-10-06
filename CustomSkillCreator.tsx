import React, { useEffect, useRef, useState } from 'react';
import { Alert, BackHandler, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import type { ThemePalette } from './appThemes';
import { ThemeGradient } from './ThemeGradient';

export function CustomSkillCreator({ existingSkills, iconOptions, palette: p, onCreate, initialSkill, onCancel, libraryOnly = false }: {
  existingSkills: string[]; iconOptions: string[]; palette: ThemePalette;
  onCreate: (name: string, icon: string, description: string) => boolean;
  initialSkill?: { name: string; icon: string; description?: string }; onCancel?: () => void; libraryOnly?: boolean;
}) {
  const [open, setOpen] = useState(Boolean(initialSkill));
  const [name, setName] = useState(initialSkill?.name ?? '');
  const [description, setDescription] = useState(initialSkill?.description ?? '');
  const [icon, setIcon] = useState(initialSkill?.icon === '⚽' ? '◉' : initialSkill?.icon ?? '★');
  const [error, setError] = useState('');
  const [addedName, setAddedName] = useState('');
  const creating = useRef(false);
  const close = () => { setOpen(false); setName(''); setIcon('★'); setError(''); setDescription(''); onCancel?.(); };
  const cancelForm = () => {
    const changed = initialSkill ? name !== initialSkill.name || description !== (initialSkill.description ?? '') || icon !== (initialSkill.icon === '⚽' ? '◉' : initialSkill.icon) : Boolean(name || description || icon !== '★');
    if (changed) Alert.alert('Discard skill changes?', 'No changes will be saved.', [{ text: 'Keep editing', style: 'cancel' }, { text: 'Discard', style: 'destructive', onPress: close }]); else close();
  };
  useEffect(() => { if (!open) return; const listener = BackHandler.addEventListener('hardwareBackPress', () => { cancelForm(); return true; }); return () => listener.remove(); }, [open, name, description, icon]);
  const create = () => {
    if (creating.current) return;
    const trimmed = name.trim();
    if (!trimmed) { setError('Enter a skill name.'); return; }
    if (existingSkills.some(skill => skill.trim().toLowerCase() === trimmed.toLowerCase())) { setError('This skill already exists. Select it from the skill list above.'); return; }
    creating.current = true;
    if (onCreate(trimmed, icon, description.trim())) { close(); setAddedName(trimmed); } else creating.current = false;
  };
  return <View style={{ marginTop: 12 }}>
    {!open ? <><Pressable accessibilityRole="button" onPress={() => { creating.current = false; setOpen(true); setAddedName(''); }} style={[s.button, { borderColor: p.primary, backgroundColor: p.mint }]}><Text style={[s.buttonText, { color: p.ink }]}>＋ Create a custom skill</Text></Pressable>{addedName && <Text accessibilityLiveRegion="polite" style={[s.copy, { color: p.ink }]}>{addedName}{libraryOnly ? ' saved in your skill library.' : ' added to this template with 15 attempts. Save the template to keep the combination.'}</Text>}</> : <View style={[s.card, { backgroundColor: p.mint, borderColor: p.line }]}>
      <Text style={[s.title, { color: p.ink }]}>{initialSkill ? 'Edit custom skill' : 'New custom skill'}</Text>
      <Text style={[s.copy, { color: p.muted }]}>{libraryOnly ? 'This skill is shared across your templates. Saved changes update your library.' : 'Create it here and add it straight to this template. It will also be available in your skill library.'}</Text>
      <TextInput accessibilityLabel="New custom skill name" value={name} onChangeText={value => { setName(value); setError(''); }} placeholder="e.g. Crossing accuracy" placeholderTextColor={p.muted} maxLength={80} autoCapitalize="words" returnKeyType="done" onSubmitEditing={create} style={[s.input, { backgroundColor: p.surface, borderColor: p.line, color: p.ink }]} />
      <TextInput accessibilityLabel="Custom skill description" value={description} onChangeText={setDescription} placeholder="How to practice it (optional)" placeholderTextColor={p.muted} maxLength={400} multiline style={[s.input, { backgroundColor: p.surface, borderColor: p.line, color: p.ink }]} />
      <Text style={[s.copy, { color: p.ink }]}>Choose an icon</Text>
      <View style={s.icons}>{iconOptions.map(option => <Pressable key={option} accessibilityRole="button" accessibilityLabel={`Choose ${option} icon`} accessibilityState={{ selected: icon === option }} onPress={() => setIcon(option)} style={[s.icon, { backgroundColor: icon === option ? p.primary : p.surface, borderColor: p.line }]}><Text style={{ fontSize: 22, color: icon === option ? p.onPrimary : p.primary }}>{option}</Text></Pressable>)}</View>
      {error ? <Text accessibilityLiveRegion="polite" style={[s.copy, { color: p.ink }]}>{error}</Text> : null}
      <Text style={[s.copy, { color: p.muted }]}>Starts with 15 attempts and default scoring. You can configure it after adding.</Text>
      <Pressable accessibilityRole="button" onPress={create} style={[s.button, { overflow: 'hidden', backgroundColor: p.buttonGradient[0] }]}><ThemeGradient colors={p.buttonGradient} /><Text style={[s.buttonText, { color: p.onAccent }]}>{initialSkill ? 'Save skill changes' : libraryOnly ? 'Create skill' : 'Create & add to template'}</Text></Pressable>
      <Pressable accessibilityRole="button" onPress={cancelForm} style={s.button}><Text style={[s.buttonText, { color: p.primary }]}>Cancel</Text></Pressable>
      <Text style={[s.copy, { color: p.muted }]}>{libraryOnly ? 'Saved skills are available when building any template.' : 'Save the template to keep this combination. The new skill is saved in your library immediately.'}</Text>
    </View>}
  </View>;
}
const s = StyleSheet.create({ card: { padding: 16, borderWidth: 1, borderRadius: 16 }, title: { fontSize: 18, fontWeight: '700' }, copy: { fontSize: 13, lineHeight: 20, marginVertical: 8 }, input: { borderWidth: 1, borderRadius: 12, padding: 14, fontSize: 16, marginVertical: 8 }, icons: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginVertical: 8 }, icon: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center', borderRadius: 12, borderWidth: 1 }, button: { minHeight: 52, padding: 14, borderRadius: 14, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'transparent' }, buttonText: { fontSize: 15, fontWeight: '700', textAlign: 'center' } });
