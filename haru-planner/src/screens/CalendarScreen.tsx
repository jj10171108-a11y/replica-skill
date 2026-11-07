import React, { useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { formatLong, fromKey, todayKey } from '../date';
import { getHoliday } from '../holidays';
import { useStore } from '../store';
import { noteBg, priorityColor, useTheme } from '../theme';
import { MonthGrid } from '../components/MonthGrid';
import { positionOf, TaskItem } from '../components/TaskItem';
import { useEditor } from '../components/TaskEditor';
import { Card, Empty, Fab, ScreenHeader } from '../components/ui';
import { useNoteEditor } from './NotesScreen';

export function CalendarScreen({ focus }: { focus?: { date: string; n: number } | null }) {
  const t = useTheme();
  const { data, toggleTask } = useStore();
  const { openTask, quickMenu } = useEditor();
  const openNote = useNoteEditor();
  const [selected, setSelected] = useState(todayKey());
  const init = fromKey(selected);
  const [ym, setYm] = useState({ y: init.getFullYear(), m: init.getMonth() });

  const projectMap = useMemo(() => Object.fromEntries(data.projects.map((p) => [p.id, p])), [data.projects]);

  // 위젯에서 특정 날짜를 눌러 들어온 경우
  useEffect(() => {
    if (!focus) return;
    setSelected(focus.date);
    const d = fromKey(focus.date);
    setYm({ y: d.getFullYear(), m: d.getMonth() });
  }, [focus]);

  const markers = useMemo(() => {
    const m: Record<string, string[]> = {};
    for (const task of data.tasks) {
      if (!task.due) continue;
      const c = task.done ? t.faint : task.projectId && projectMap[task.projectId] ? projectMap[task.projectId].color : priorityColor(t, task.priority || 1);
      (m[task.due] ??= []).push(c);
    }
    for (const n of data.notes) if (n.date) (m[n.date] ??= []).push(t.warn);
    return m;
  }, [data.tasks, data.notes, projectMap, t]);

  const dayTasks = useMemo(
    () => data.tasks.filter((x) => x.due === selected).sort((a, b) => Number(a.done) - Number(b.done) || (a.time ?? '99').localeCompare(b.time ?? '99')),
    [data.tasks, selected],
  );
  const dayNotes = useMemo(() => data.notes.filter((n) => n.date === selected), [data.notes, selected]);
  const holiday = getHoliday(selected);

  // 이번 달 공휴일 목록
  const monthHolidays = useMemo(() => {
    const out: { key: string; name: string }[] = [];
    const last = new Date(ym.y, ym.m + 1, 0).getDate();
    for (let d = 1; d <= last; d++) {
      const key = `${ym.y}-${String(ym.m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      const name = getHoliday(key);
      if (name) out.push({ key, name });
    }
    return out;
  }, [ym]);

  return (
    <View style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={{ paddingBottom: 110 }}>
        <ScreenHeader title="캘린더" />
        <Card style={{ marginHorizontal: 16, paddingHorizontal: 6, paddingTop: 14, paddingBottom: 8 }}>
          <MonthGrid
            year={ym.y} month={ym.m} selected={selected} weekStart={data.settings.weekStart} markers={markers}
            onMonthChange={(y, m) => setYm({ y, m })}
            onSelect={(k) => {
              setSelected(k);
              const d = fromKey(k);
              if (d.getMonth() !== ym.m) setYm({ y: d.getFullYear(), m: d.getMonth() });
            }}
          />
          {monthHolidays.length > 0 && (
            <View style={[st.holidayList, { borderTopColor: t.separator }]}>
              {monthHolidays.map((h) => (
                <Text key={h.key} style={{ color: t.sub, fontSize: 12 }}>
                  <Text style={{ color: t.holiday, fontWeight: '700' }}>{Number(h.key.slice(8))}일</Text> {h.name}
                </Text>
              ))}
            </View>
          )}
        </Card>

        <View style={st.dayHeader}>
          <Text style={{ color: t.text, fontSize: 18, fontWeight: '800', letterSpacing: -0.3 }}>{formatLong(selected)}</Text>
          {holiday ? (
            <View style={[st.badge, { backgroundColor: t.dangerSoft }]}>
              <Text style={{ color: t.holiday, fontSize: 12, fontWeight: '700' }}>{holiday}</Text>
            </View>
          ) : null}
        </View>

        {dayTasks.map((x, i) => (
          <TaskItem key={x.id} task={x} position={positionOf(i, dayTasks.length)} project={x.projectId ? projectMap[x.projectId] : undefined}
            onToggle={toggleTask} onPress={openTask} onLongPress={quickMenu} hideDate />
        ))}
        {dayNotes.map((n) => (
          <Card key={n.id} onPress={() => openNote(n)} style={{ marginHorizontal: 16, marginBottom: 10, backgroundColor: noteBg(t, n.color), shadowOpacity: 0, elevation: 0, borderWidth: 0 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Ionicons name="document-text-outline" size={15} color={t.sub} />
              <Text style={{ color: t.text, fontWeight: '700', flex: 1 }} numberOfLines={1}>{n.title || '제목 없음'}</Text>
            </View>
            {n.body ? <Text style={{ color: t.sub, marginTop: 6, lineHeight: 19 }} numberOfLines={2}>{n.body}</Text> : null}
          </Card>
        ))}
        {dayTasks.length === 0 && dayNotes.length === 0 && <Empty icon="calendar-clear-outline" title="일정이 없어요" desc="+ 버튼으로 이 날짜에 할 일을 추가하세요" />}
      </ScrollView>
      <Fab onPress={() => openTask({ due: selected })} />
    </View>
  );
}

const st = StyleSheet.create({
  holidayList: { flexDirection: 'row', flexWrap: 'wrap', columnGap: 12, rowGap: 4, borderTopWidth: StyleSheet.hairlineWidth, marginTop: 6, paddingTop: 10, paddingHorizontal: 8, paddingBottom: 4 },
  dayHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginHorizontal: 20, marginTop: 22, marginBottom: 10 },
  badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
});
