import React, { memo, useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { fromKey, monthGrid, todayKey, WEEKDAYS } from '../date';
import { getHoliday, shortHoliday } from '../holidays';
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
  const rows = fromKey(cells[35]).getMonth() !== month ? 5 : 6;
  const isThisMonth = new Date().getFullYear() === year && new Date().getMonth() === month;

  return (
    <View>
      <View style={st.nav}>
        <Text style={{ color: t.text, fontSize: 19, fontWeight: '800', letterSpacing: -0.4, flex: 1 }}>
          {year}년 {month + 1}월
        </Text>
        {!isThisMonth && (
          <Pressable
            onPress={() => { tap(); const d = new Date(); onMonthChange(d.getFullYear(), d.getMonth()); onSelect(todayKey()); }}
            style={[st.todayBtn, { backgroundColor: t.primarySoft }]}
          >
            <Text style={{ color: t.primary, fontWeight: '700', fontSize: 13 }}>오늘</Text>
          </Pressable>
        )}
        <Pressable onPress={() => go(-1)} hitSlop={8} style={[st.navBtn, { backgroundColor: t.fill }]} accessibilityLabel="이전 달">
          <Ionicons name="chevron-back" size={18} color={t.text} />
        </Pressable>
        <Pressable onPress={() => go(1)} hitSlop={8} style={[st.navBtn, { backgroundColor: t.fill }]} accessibilityLabel="다음 달">
          <Ionicons name="chevron-forward" size={18} color={t.text} />
        </Pressable>
      </View>
      <View style={st.row}>
        {days.map((d) => (
          <Text key={d} style={[st.dow, { color: d === '일' ? t.holiday : d === '토' ? t.saturday : t.faint }]}>{d}</Text>
        ))}
      </View>
      {Array.from({ length: rows }).map((_, r) => (
        <View key={r} style={st.row}>
          {cells.slice(r * 7, r * 7 + 7).map((k) => {
            const d = fromKey(k);
            const inMonth = d.getMonth() === month;
            const isSel = k === selected;
            const isToday = k === today;
            const holiday = getHoliday(k);
            const dots = markers?.[k] ?? [];
            const dow = d.getDay();
            const red = holiday || dow === 0;
            const color = isSel ? t.onPrimary : red ? t.holiday : dow === 6 ? t.saturday : t.text;
            return (
              <Pressable
                key={k}
                style={[st.cell, { height: compact ? 44 : 58, opacity: inMonth ? 1 : 0.32 }]}
                onPress={() => { tap(); onSelect(k); }}
                accessibilityLabel={`${d.getMonth() + 1}월 ${d.getDate()}일${holiday ? ' ' + holiday : ''}`}
              >
                <View style={[st.dayCircle, isSel && { backgroundColor: t.primary }, !isSel && isToday && { backgroundColor: t.primarySoft }]}>
                  <Text style={{ color: !isSel && isToday ? t.primary : color, fontWeight: isToday || isSel ? '800' : '500', fontSize: 15 }}>
                    {d.getDate()}
                  </Text>
                </View>
                {!compact && holiday ? (
                  <Text numberOfLines={1} style={[st.holiday, { color: t.holiday }]}>{shortHoliday(holiday)}</Text>
                ) : (
                  <View style={st.dots}>
                    {dots.slice(0, 3).map((c, i) => <View key={i} style={[st.dot, { backgroundColor: c }]} />)}
                  </View>
                )}
                {!compact && holiday && dots.length > 0 ? (
                  <View style={[st.dots, { marginTop: 1 }]}>
                    {dots.slice(0, 3).map((c, i) => <View key={i} style={[st.dot, { backgroundColor: c }]} />)}
                  </View>
                ) : null}
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
  nav: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 6, paddingBottom: 12 },
  navBtn: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  todayBtn: { height: 32, paddingHorizontal: 12, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  row: { flexDirection: 'row' },
  dow: { flex: 1, textAlign: 'center', fontSize: 12, fontWeight: '600', paddingBottom: 6 },
  cell: { flex: 1, alignItems: 'center', paddingTop: 2 },
  dayCircle: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  holiday: { fontSize: 9, fontWeight: '600', marginTop: 1, maxWidth: '96%' },
  dots: { flexDirection: 'row', gap: 3, marginTop: 3, height: 5 },
  dot: { width: 5, height: 5, borderRadius: 3 },
});
