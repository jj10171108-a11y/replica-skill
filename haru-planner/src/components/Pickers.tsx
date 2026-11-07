import React, { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { fromKey, todayKey } from '../date';
import { useTheme } from '../theme';
import { MonthGrid } from './MonthGrid';
import { Button, Sheet, tap } from './ui';

export function DatePickerSheet({ visible, value, weekStart, onClose, onPick }: {
  visible: boolean; value: string | null; weekStart: 0 | 1; onClose: () => void; onPick: (k: string | null) => void;
}) {
  const t = useTheme();
  const init = fromKey(value ?? todayKey());
  const [ym, setYm] = useState({ y: init.getFullYear(), m: init.getMonth() });
  useEffect(() => {
    if (visible) {
      const d = fromKey(value ?? todayKey());
      setYm({ y: d.getFullYear(), m: d.getMonth() });
    }
  }, [visible, value]);
  return (
    <Sheet visible={visible} onClose={onClose} title="날짜 선택" right={
      <Pressable onPress={() => { onPick(null); onClose(); }} hitSlop={10}>
        <Text style={{ color: t.danger, fontSize: 16 }}>지우기</Text>
      </Pressable>
    }>
      <View style={{ paddingHorizontal: 16, paddingBottom: 8 }}>
        <MonthGrid
          year={ym.y} month={ym.m} selected={value} weekStart={weekStart} compact
          onMonthChange={(y, m) => setYm({ y, m })}
          onSelect={(k) => { onPick(k); onClose(); }}
        />
      </View>
    </Sheet>
  );
}

const HOURS = Array.from({ length: 24 }, (_, i) => i);
const MINUTES = Array.from({ length: 12 }, (_, i) => i * 5);
const pad = (n: number) => String(n).padStart(2, '0');

export function TimePickerSheet({ visible, value, onClose, onPick }: {
  visible: boolean; value: string | null; onClose: () => void; onPick: (v: string | null) => void;
}) {
  const t = useTheme();
  const [h, setH] = useState(9);
  const [m, setM] = useState(0);
  useEffect(() => {
    if (visible) {
      if (value) {
        const [hh, mm] = value.split(':').map(Number);
        setH(hh); setM(Math.round(mm / 5) * 5 % 60);
      } else {
        const now = new Date();
        setH(Math.min(23, now.getHours() + 1)); setM(0);
      }
    }
  }, [visible, value]);

  const Cell = ({ label, on, onPress }: { label: string; on: boolean; onPress: () => void }) => (
    <Pressable onPress={() => { tap(); onPress(); }} style={[st.cell, { backgroundColor: on ? t.primary : t.bg }]}>
      <Text style={{ color: on ? t.onPrimary : t.text, fontWeight: on ? '800' : '500', fontSize: 16 }}>{label}</Text>
    </Pressable>
  );

  return (
    <Sheet visible={visible} onClose={onClose} title="시간 선택" right={
      <Pressable onPress={() => { onPick(null); onClose(); }} hitSlop={10}>
        <Text style={{ color: t.danger, fontSize: 16 }}>지우기</Text>
      </Pressable>
    }>
      <View style={{ paddingHorizontal: 20 }}>
        <Text style={{ color: t.text, fontSize: 36, fontWeight: '800', textAlign: 'center', marginVertical: 8 }}>
          {h < 12 ? '오전' : '오후'} {h % 12 === 0 ? 12 : h % 12}:{pad(m)}
        </Text>
        <Text style={[st.cap, { color: t.sub }]}>시</Text>
        <ScrollView style={{ maxHeight: 150 }} contentContainerStyle={st.grid}>
          {HOURS.map((x) => <Cell key={x} label={pad(x)} on={x === h} onPress={() => setH(x)} />)}
        </ScrollView>
        <Text style={[st.cap, { color: t.sub }]}>분</Text>
        <View style={st.grid}>
          {MINUTES.map((x) => <Cell key={x} label={pad(x)} on={x === m} onPress={() => setM(x)} />)}
        </View>
        <Button label="확인" onPress={() => { onPick(`${pad(h)}:${pad(m)}`); onClose(); }} style={{ marginTop: 18 }} />
      </View>
    </Sheet>
  );
}

const st = StyleSheet.create({
  cap: { fontSize: 13, fontWeight: '700', marginTop: 12, marginBottom: 8 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  cell: { width: '14.6%', aspectRatio: 1.3, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
});
