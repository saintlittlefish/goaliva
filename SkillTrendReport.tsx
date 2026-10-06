import React, { useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { skillTrend, type TrendMetric, type TrendRange, type TrendSession } from './skillTrends';

type Palette = { background: string; surface: string; primary: string; accent: string; ink: string; muted: string; line: string; mint: string };
export function SkillTrendReport({ sessions, skills, initialSkill, palette: p, onClose }: { sessions: TrendSession[]; skills: string[]; initialSkill: string; palette: Palette; onClose: () => void }) {
  const [skill, setSkill] = useState(initialSkill);
  const [range, setRange] = useState<TrendRange>('30D');
  const [metric, setMetric] = useState<TrendMetric>('Accuracy');
  const [templateId, setTemplateId] = useState('');
  const [filtersOpen, setFiltersOpen] = useState(false);
  const touchStart = useRef({ x: 0, y: 0 });
  const [width, setWidth] = useState(280);
  const [selected, setSelected] = useState<number | null>(null);
  const points = useMemo(() => skillTrend(sessions, skill, metric, range, Date.now(), templateId), [sessions, skill, metric, range, templateId]);
  const templates = Array.from(new Map(sessions.filter(s => s.drillResults?.[skill] || s.skillStats?.[skill]).map(s => [s.recipe.id, s.recipe])).values());
  const values = points.map(point => point.value);
  const low = values.length ? Math.min(...values) : 0;
  const high = values.length ? Math.max(...values) : 0;
  const padding = Math.max(1, (high - low) * 0.15);
  const min = metric === 'Accuracy' ? 0 : low - padding, max = metric === 'Accuracy' ? 100 : high + padding;
  const first = points[0]?.timestamp ?? 0, last = points[points.length - 1]?.timestamp ?? first;
  const plotWidth = Math.max(1, width - 58), height = 190;
  const coords = points.map(point => ({ x: last === first ? plotWidth / 2 : (point.timestamp - first) / (last - first) * plotWidth, y: height - (point.value - min) / (max - min) * height }));
  const index = selected === null ? points.length - 1 : Math.min(selected, points.length - 1);
  const current = points[index];
  const unit = metric === 'Accuracy' ? '%' : ' pts';
  const choose = (x: number) => {
    if (!coords.length) return;
    setSelected(coords.reduce((best, point, i) => Math.abs(point.x - x) < Math.abs(coords[best].x - x) ? i : best, 0));
  };
  const chips = (items: string[], value: string, change: (v: string) => void) => <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.chips}>{items.map(item => <Pressable key={item} accessibilityRole="button" accessibilityState={{ selected: value === item }} onPress={() => { change(item); setSelected(null); }} style={[s.chip, { backgroundColor: value === item ? p.mint : p.surface, borderColor: value === item ? p.primary : p.line }]}><Text style={{ color: p.ink }}>{item}</Text></Pressable>)}</ScrollView>;
  return <View style={[StyleSheet.absoluteFill, { zIndex: 20, backgroundColor: p.background }]}><SafeAreaView edges={['left', 'right', 'bottom']} style={{ flex: 1 }}><ScrollView contentContainerStyle={s.page}>
    <View style={s.header}><Pressable accessibilityRole="button" accessibilityLabel="Close skill report" onPress={onClose} hitSlop={12} style={({ pressed }) => [s.close, pressed && { backgroundColor: p.mint }]}><Text style={{ color: p.primary, fontSize: 32 }}>‹</Text></Pressable><Text style={[s.title, { color: p.ink }]}>Skill trends</Text></View>
    <Text style={{ color: p.muted }}>Follow each practice result over time. Touch the chart to inspect a session.</Text>
    {chips(skills, skill, value => { setSkill(value); setTemplateId(''); })}
    {chips(['7D', '30D', '90D', '1Y', 'All'], range, value => setRange(value as TrendRange))}
    <View style={[s.card, { backgroundColor: p.surface, borderColor: p.line }]}>
      <Text style={[s.title, { color: p.ink }]}>{skill}</Text>
      {current ? <><Text style={[s.number, { color: p.primary }]}>{current.value}{unit}</Text><Text style={{ color: p.muted }}>{new Date(current.timestamp).toLocaleString()} · {current.template}</Text><Text style={{ color: p.muted }}>{current.successes}/{current.attempts} successful attempts</Text>
        <View onLayout={event => setWidth(event.nativeEvent.layout.width)} style={{ height: height + 35, marginTop: 24 }}>
          {[0, 0.5, 1].map(fraction => <View key={fraction} style={{ position: 'absolute', top: fraction * height, left: 0, right: 0 }}><View style={{ height: 1, width: plotWidth, backgroundColor: p.line }} /><Text style={{ position: 'absolute', left: plotWidth + 6, top: -8, color: p.muted, fontSize: 11 }}>{Math.round(max - fraction * (max - min))}</Text></View>)}
          <View accessibilityLabel={`${skill} ${metric} chart, ${points.length} sessions`} onTouchStart={event => { touchStart.current = { x: event.nativeEvent.pageX, y: event.nativeEvent.pageY }; }} onTouchEnd={event => { if (Math.abs(event.nativeEvent.pageY - touchStart.current.y) < 8) choose(event.nativeEvent.locationX); }} onStartShouldSetResponder={() => false} onMoveShouldSetResponder={event => Math.abs(event.nativeEvent.pageX - touchStart.current.x) > 8 && Math.abs(event.nativeEvent.pageX - touchStart.current.x) > Math.abs(event.nativeEvent.pageY - touchStart.current.y)} onResponderGrant={event => choose(event.nativeEvent.locationX)} onResponderMove={event => choose(event.nativeEvent.locationX)} style={{ width: plotWidth, height }}>
            {coords.slice(1).map((point, i) => { const previous = coords[i], dx = point.x - previous.x, dy = point.y - previous.y, length = Math.sqrt(dx * dx + dy * dy); return <View pointerEvents="none" key={i} style={{ position: 'absolute', left: (previous.x + point.x - length) / 2, top: (previous.y + point.y) / 2 - 1, width: length, height: 2, backgroundColor: p.primary, transform: [{ rotate: `${Math.atan2(dy, dx)}rad` }] }} />; })}
            {coords[index] && <View pointerEvents="none" style={{ position: 'absolute', left: coords[index].x, top: 0, height, borderLeftWidth: 1, borderColor: p.accent }} />}
            {coords.map((point, i) => <View pointerEvents="none" key={i} style={{ position: 'absolute', left: point.x - 4, top: point.y - 4, width: 8, height: 8, borderRadius: 4, backgroundColor: i === index ? p.accent : p.primary }} />)}
          </View>
          <View style={{ width: plotWidth, flexDirection: 'row', justifyContent: 'space-between', marginTop: 10 }}><Text style={{ color: p.muted, fontSize: 11 }}>{new Date(first).toLocaleDateString()}</Text>{last !== first && <Text style={{ color: p.muted, fontSize: 11 }}>{new Date(last).toLocaleDateString()}</Text>}</View>
        </View>
        <Text style={{ color: p.ink }}>{points.length} results · Best {high}{unit} · Change {(points.at(-1)!.value - points[0].value) > 0 ? '+' : ''}{points.at(-1)!.value - points[0].value}{metric === 'Accuracy' ? ' percentage points' : ' pts'}</Text>
        <View style={{ flexDirection: 'row', gap: 8, marginTop: 12 }}>{[['Previous result', Math.max(0, index - 1)], ['Next result', Math.min(points.length - 1, index + 1)]].map(([label, destination]) => <Pressable key={String(label)} accessibilityRole="button" onPress={() => setSelected(Number(destination))} style={[s.chip, { minHeight: 48, backgroundColor: p.mint, borderColor: p.line }]}><Text style={{ color: p.ink }}>{label}</Text></Pressable>)}</View>
        {points.length === 1 && <Text style={{ color: p.muted, marginTop: 8 }}>One result so far. Complete another session to see a trend.</Text>}
      </> : <Text style={{ color: p.muted, marginTop: 20 }}>No {metric.toLowerCase()} results in this period. {metric === 'Points' ? 'Reach the attempt target and save your template to record points.' : 'Save a session with attempts for this skill.'}</Text>}
    </View>
    <Pressable accessibilityRole="button" accessibilityState={{ expanded: filtersOpen }} onPress={() => setFiltersOpen(!filtersOpen)} style={[s.chip, { minHeight: 48, borderColor: p.line, backgroundColor: p.surface, justifyContent: 'center' }]}><Text style={{ color: p.ink }}>Filters · {metric} · {templates.find(template => template.id === templateId)?.name ?? 'All templates'} {filtersOpen ? '−' : '+'}</Text></Pressable>
    {filtersOpen && <View>
    {chips(['Points', 'Accuracy'], metric, value => setMetric(value as TrendMetric))}
    <Text style={[s.label, { color: p.muted }]}>TEMPLATE FILTER</Text>
    <ScrollView horizontal contentContainerStyle={s.chips}>{[{ id: '', name: 'All templates' }, ...templates].map(template => <Pressable key={template.id} accessibilityRole="button" accessibilityState={{ selected: template.id === templateId }} onPress={() => { setTemplateId(template.id); setSelected(null); }} style={[s.chip, { backgroundColor: template.id === templateId ? p.mint : p.surface, borderColor: p.line }]}><Text style={{ color: p.ink }}>{template.name}</Text></Pressable>)}</ScrollView>

    </View>}
    <Text style={{ color: p.muted }}>{metric === 'Points' ? 'Points use the scoring rules saved with each session. If rules or attempt targets change, use Accuracy or filter by template for context.' : 'Accuracy is successes divided by attempts. Partial saved drills are included.'}</Text>
    {sessions.some(session => !session.completedAt && (session.drillResults?.[skill] || session.skillStats?.[skill])) && <Text style={{ color: p.muted, marginTop: 12 }}>Older sessions without a precise recording date remain in your history, but are not plotted.</Text>}
  </ScrollView></SafeAreaView></View>;
}
const s = StyleSheet.create({ page: { padding: 24, paddingBottom: 60 }, header: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 12 }, close: { width: 52, height: 52, flexShrink: 0, alignItems: 'center', justifyContent: 'center', borderRadius: 26, marginLeft: -12 }, title: { fontSize: 23, fontWeight: '700' }, chips: { gap: 8, paddingVertical: 10 }, chip: { minHeight: 48, justifyContent: 'center', paddingHorizontal: 14, paddingVertical: 12, borderWidth: 1, borderRadius: 20 }, label: { fontSize: 11, letterSpacing: 1, marginTop: 8 }, card: { borderWidth: 1, borderRadius: 20, padding: 18, marginVertical: 18 }, number: { fontSize: 44, fontWeight: '700', marginVertical: 8 } });
