import React, { useEffect, useState } from 'react';
import { Alert, BackHandler, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { POSITIONS, type PlayerPosition } from './templateRelevance';
import { ThemeGradient } from './ThemeGradient';
import type { ThemePalette } from './appThemes';
export type PlayerProfile = { name: string; position: PlayerPosition | ''; age: string; club: string };
export function PlayerProfileEditor({ profile, palette: p, onSave, onClose }: { profile: PlayerProfile; palette: ThemePalette; onSave: (value: PlayerProfile) => void; onClose: () => void }) {
  const [draft, setDraft] = useState(profile);
  const dirty = JSON.stringify(draft) !== JSON.stringify(profile);
  const close = () => dirty ? Alert.alert('Discard profile changes?', 'Your saved profile will stay unchanged.', [{ text: 'Keep editing', style: 'cancel' }, { text: 'Discard', style: 'destructive', onPress: onClose }]) : onClose();
  useEffect(() => { const listener = BackHandler.addEventListener('hardwareBackPress', () => { close(); return true; }); return () => listener.remove(); }, [dirty, draft]);
  const validAge = !draft.age || (Number.isInteger(Number(draft.age)) && Number(draft.age) >= 1 && Number(draft.age) <= 120);
  return <SafeAreaView edges={['left', 'right', 'bottom']} style={[StyleSheet.absoluteFill, { zIndex: 8, backgroundColor: p.background }]}><KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
    <View style={s.header}><Pressable accessibilityRole="button" onPress={close} style={s.action}><Text style={{ color: p.primary, fontSize: 18 }}>‹ Back</Text></Pressable><Text style={[s.title, { color: p.ink }]}>Player profile</Text></View>
    <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 20 }}><Text style={{ color: p.muted }}>All details are optional. Position changes update recommendations after saving.</Text>
      <Text style={[s.label, { color: p.ink }]}>Position</Text><View style={s.options}>{[...POSITIONS, '' as const].map(position => <Pressable key={position || 'none'} accessibilityRole="button" accessibilityState={{ selected: draft.position === position }} onPress={() => setDraft({ ...draft, position })} style={[s.action, { backgroundColor: draft.position === position ? p.primary : p.surface }]}><Text style={{ color: draft.position === position ? p.onPrimary : p.ink }}>{position || 'Not specified'}</Text></Pressable>)}</View>
      {(['name', 'age', 'club'] as const).map(field => <View key={field}><Text style={[s.label, { color: p.ink }]}>{field === 'name' ? 'Name' : field === 'age' ? 'Age' : 'Club or team'}</Text><TextInput accessibilityLabel={`Player ${field}`} value={draft[field]} onChangeText={value => setDraft({ ...draft, [field]: field === 'age' ? value.replace(/\D/g, '').slice(0, 3) : value })} keyboardType={field === 'age' ? 'number-pad' : 'default'} placeholder="Optional" placeholderTextColor={p.muted} maxLength={field === 'age' ? 3 : 100} style={[s.input, { backgroundColor: p.surface, color: p.ink, borderColor: p.line }]} /></View>)}
      {!validAge && <Text style={{ color: p.ink }}>Enter an age from 1 to 120, or leave it empty.</Text>}
    </ScrollView><View style={{ padding: 16 }}><Pressable accessibilityRole="button" disabled={!validAge} accessibilityState={{ disabled: !validAge }} onPress={() => onSave({ ...draft, name: draft.name.trim(), club: draft.club.trim() })} style={[s.save, { backgroundColor: p.buttonGradient[0], opacity: validAge ? 1 : 0.4 }]}><ThemeGradient colors={p.buttonGradient} /><Text style={{ color: p.onAccent, fontWeight: '700', fontSize: 16 }}>Save profile</Text></Pressable></View>
  </KeyboardAvoidingView></SafeAreaView>;
}
const s = StyleSheet.create({ header: { padding: 16, flexDirection: 'row', alignItems: 'center', gap: 16 }, title: { fontSize: 22, fontWeight: '700' }, action: { minWidth: 48, minHeight: 48, padding: 12, borderRadius: 12, alignItems: 'center', justifyContent: 'center' }, options: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 }, label: { fontSize: 14, fontWeight: '600', marginTop: 18, marginBottom: 8 }, input: { borderWidth: 1, borderRadius: 12, padding: 14, fontSize: 16 }, save: { overflow: 'hidden', minHeight: 56, borderRadius: 14, alignItems: 'center', justifyContent: 'center' } });
