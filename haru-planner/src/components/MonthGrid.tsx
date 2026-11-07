import React, { memo, useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { fromKey, monthGrid, todayKey, WEEKDAYS } from '../date';
import { useTheme } from '../theme';
import { tap } from './ui';

interface Props {
  year: number;
  month: number;
  selected: string | null;
  weekStart: 0 | 1;
  onSelect: (key: string) => void;
  onMonthChange: (year: number, month: number) => void;
  /** key -> list of dot colors */
  markers?: Record<string, string[]>;
  compact?: boolean;
}

function MonthGridImpl({ year, month, selected, weekStart, onSelect, onMonthChange, markers, compact }: Props) {
  const t = useTheme();
  const cells = useMemo(() => monthGrid(year, month, weekStart), [year, month, weekStart]);
  const today = todayKey();
  const days = weekStart === 1 ? [...WEEKDAYS.slice(1), WEEKDAYS[0]] : WEEKDAYS;
  const go = (n: number) => {
    const d = new Date(year, month + n, 1);
    tap();
    onMonthChange(d.getFullYear(), d.getMonth());
  };
  const rows = cells[35] && fromKey(cells[35]).getMonth() !== month ? 5 : 6;

  return (
    <View>
      <View style={st.nav}>
        <Pressable onPress={() => go(-1)} hitSlop={12} style={st.navBtn} accessibilityLabel="이전 달">
          <Text style={{ color: t.text, fontSize: 22 }}>‹</Text>
        </Pressable>
        <Pressable onPress={() => { const d = new Date(); onMonthChange(d.getFullYear(), d.getMonth()); onSelect(todayKey()); }}>
          <Text style={{ color: t.text, fontSize: 18, fontWeight: '800' }}>{year}년 {month + 1}월</Text>
        </Pressable>
        <Pressable onPress={() => go(1)} hitSlop={12} style={st.navBtn} accessibilityLabel="다음 달">
          <Text style={{ color: t.text, fontSize: 22 }}>›</Text>
        </Pressable>
      </View>
      <View style={st.row}>
        {days.map((d) => (
          <Text key={d} style={[st.dow, { color: d === '일' ? t.danger : d === '토' ? t.primary : t.sub }]}>{d}</Text>
        ))}
      </View>
      {Array.from({ length: rows }).map((_, r) => (
        <View key={r} style={st.row}>
          {cells.slice(r * 7, r * 7 + 7).map((k) => {
            const d = fromKey(k);
            const inMonth = d.getMonth() === month;
            const isSel = k === selected;
            const isToday = k === today;
            const dots = markers?.[k] ?? [];
            const dow = d.getDay();
            const color = isSel ? t.onPrimary : !inMonth ? t.faint : dow === 0 ? t.danger : dow === 6 ? t.primary : t.text;
            return (
              <Pressable key={k} style={[st.cell, { height: compact ? 42 : 52 }]} onPress={() => { tap(); onSelect(k); }}>
                <View style={[st.dayCircle, isSel && { backgroundColor: t.primary }, !isSel && isToday && { borderWidth: 1.5, borderColor: t.primary }]}>
                  <Text style={{ color, fontWeight: isToday || isSel ? '800' : '500', fontSize: 15, opacity: inMonth ? 1 : 0.6 }}>{d.getDate()}</Text>
                </View>
                <View style={st.dots}>
                  {dots.slice(0, 3).map((c, i) => <View key={i} style={[st.dot, { backgroundColor: c }]} />)}
                </View>
              </Pressable>
            );
          })}
        </View>
      ))}
    </View>
  );
}

export const MonthGrid = memo(MonthGridImpl);

const st = StyleSheet.create({
  nav: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 4, paddingBottom: 10 },
  navBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  row: { flexDirection: 'row' },
  dow: { flex: 1, textAlign: 'center', fontSize: 12, fontWeight: '700', paddingBottom: 6 },
  cell: { flex: 1, alignItems: 'center', paddingTop: 2 },
  dayCircle: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  dots: { flexDirection: 'row', gap: 3, marginTop: 2, height: 5 },
  dot: { width: 5, height: 5, borderRadius: 3 },
});
