import React, { useEffect, useMemo, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { formatLong, fromKey, todayKey } from '../date';
import { useStore } from '../store';
import { NOTE_COLORS_DARK, priorityColor, useTheme } from '../theme';
import { MonthGrid } from '../components/MonthGrid';
import { TaskItem } from '../components/TaskItem';
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

  return (
    <View style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={{ paddingBottom: 110 }}>
        <ScreenHeader title="캘린더" />
        <Card style={{ marginHorizontal: 16, paddingHorizontal: 8 }}>
          <MonthGrid
            year={ym.y} month={ym.m} selected={selected} weekStart={data.settings.weekStart} markers={markers}
            onMonthChange={(y, m) => setYm({ y, m })}
            onSelect={(k) => {
              setSelected(k);
              const d = fromKey(k);
              if (d.getMonth() !== ym.m) setYm({ y: d.getFullYear(), m: d.getMonth() });
            }}
          />
        </Card>
        <Text style={{ color: t.text, fontSize: 18, fontWeight: '800', marginHorizontal: 20, marginTop: 20, marginBottom: 10 }}>
          {formatLong(selected)}
        </Text>
        {dayTasks.map((x) => (
          <TaskItem key={x.id} task={x} project={x.projectId ? projectMap[x.projectId] : undefined} onToggle={toggleTask} onPress={openTask} onLongPress={quickMenu} hideDate />
        ))}
        {dayNotes.map((n) => (
          <Card key={n.id} onPress={() => openNote(n)} style={{ marginHorizontal: 16, marginBottom: 8, backgroundColor: t.dark ? NOTE_COLORS_DARK[n.color] ?? t.card : n.color, borderWidth: 0 }}>
            <Text style={{ color: t.text, fontWeight: '700' }} numberOfLines={1}>📝 {n.title || '제목 없음'}</Text>
            {n.body ? <Text style={{ color: t.sub, marginTop: 4 }} numberOfLines={2}>{n.body}</Text> : null}
          </Card>
        ))}
        {dayTasks.length === 0 && dayNotes.length === 0 && <Empty emoji="🗓" title="일정이 없어요" desc="+ 버튼으로 이 날짜에 할 일을 추가하세요" />}
      </ScrollView>
      <Fab onPress={() => openTask({ due: selected })} />
    </View>
  );
}
