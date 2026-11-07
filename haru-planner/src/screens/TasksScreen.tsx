import React, { useCallback, useMemo, useState } from 'react';
import { Pressable, SectionList, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { addDays, formatLong, todayKey } from '../date';
import { getHoliday } from '../holidays';
import { useStore } from '../store';
import { useTheme } from '../theme';
import { Task } from '../types';
import { positionOf, TaskItem } from '../components/TaskItem';
import { useEditor } from '../components/TaskEditor';
import { Card, Chip, ChipRow, Empty, Fab, Progress, ScreenHeader, SearchField, SectionTitle, Segmented, tap } from '../components/ui';

type Filter = 'today' | 'upcoming' | 'all' | 'done';
type Sort = 'smart' | 'priority' | 'created';
const SORT_LABEL: Record<Sort, string> = { smart: '날짜순', priority: '중요도순', created: '최근 추가순' };
const SORT_NEXT: Record<Sort, Sort> = { smart: 'priority', priority: 'created', created: 'smart' };

const sorters: Record<Sort, (a: Task, b: Task) => number> = {
  smart: (a, b) =>
    (a.due ?? '9999').localeCompare(b.due ?? '9999') || (a.time ?? '99').localeCompare(b.time ?? '99') || b.priority - a.priority,
  priority: (a, b) => b.priority - a.priority || (a.due ?? '9999').localeCompare(b.due ?? '9999'),
  created: (a, b) => b.createdAt - a.createdAt,
};

interface Section { title: string; data: Task[]; tone?: 'danger' }

export function TasksScreen() {
  const t = useTheme();
  const { data, toggleTask } = useStore();
  const { openTask, quickMenu } = useEditor();
  const [filter, setFilter] = useState<Filter>('today');
  const [projectId, setProjectId] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<Sort>('smart');
  const today = todayKey();
  const tomorrow = addDays(today, 1);
  const holiday = getHoliday(today);

  const projectMap = useMemo(() => Object.fromEntries(data.projects.map((p) => [p.id, p])), [data.projects]);
  const goalMap = useMemo(() => Object.fromEntries(data.goals.map((g) => [g.id, g])), [data.goals]);

  const todayStats = useMemo(() => {
    const list = data.tasks.filter((x) => x.due === today);
    return { total: list.length, done: list.filter((x) => x.done).length };
  }, [data.tasks, today]);

  const sections = useMemo<Section[]>(() => {
    const q = query.trim().toLowerCase();
    let list = data.tasks.filter((x) => (!projectId || x.projectId === projectId) &&
      (!q || x.title.toLowerCase().includes(q) || x.note.toLowerCase().includes(q) || x.subtasks.some((s) => s.title.toLowerCase().includes(q))));
    const sorted = (l: Task[]) => [...l].sort(sorters[sort]);

    if (filter === 'done') {
      list = list.filter((x) => x.done).sort((a, b) => (b.doneAt ?? 0) - (a.doneAt ?? 0));
      return list.length ? [{ title: `완료 ${list.length}`, data: list.slice(0, 200) }] : [];
    }
    const open = list.filter((x) => !x.done);
    const overdue = sorted(open.filter((x) => x.due && x.due < today));
    const todays = sorted(open.filter((x) => x.due === today));
    const doneToday = list.filter((x) => x.done && x.due === today);
    const out: Section[] = [];
    if (overdue.length) out.push({ title: `기한 지남 ${overdue.length}`, data: overdue, tone: 'danger' });

    if (filter === 'today') {
      if (todays.length) out.push({ title: `오늘 ${todays.length}`, data: todays });
      if (doneToday.length) out.push({ title: `완료 ${doneToday.length}`, data: doneToday });
    } else if (filter === 'upcoming') {
      if (todays.length) out.push({ title: `오늘 ${todays.length}`, data: todays });
      const tm = sorted(open.filter((x) => x.due === tomorrow));
      if (tm.length) out.push({ title: `내일 ${tm.length}`, data: tm });
      const week = sorted(open.filter((x) => x.due && x.due > tomorrow && x.due <= addDays(today, 7)));
      if (week.length) out.push({ title: `7일 이내 ${week.length}`, data: week });
      const later = sorted(open.filter((x) => x.due && x.due > addDays(today, 7)));
      if (later.length) out.push({ title: `이후 ${later.length}`, data: later });
    } else {
      const dated = sorted(open.filter((x) => x.due && x.due >= today));
      if (dated.length) out.push({ title: `예정 ${dated.length}`, data: dated });
      const none = sorted(open.filter((x) => !x.due));
      if (none.length) out.push({ title: `날짜 없음 ${none.length}`, data: none });
    }
    return out;
  }, [data.tasks, filter, projectId, query, sort, today, tomorrow]);

  const onPress = useCallback((task: Task) => openTask(task), [openTask]);
  const hour = new Date().getHours();
  const greet = hour < 6 ? '편안한 밤 보내세요' : hour < 12 ? '좋은 아침이에요' : hour < 18 ? '오늘도 화이팅' : '오늘 하루 수고했어요';
  const ratio = todayStats.total ? todayStats.done / todayStats.total : 0;

  const header = (
    <View>
      <ScreenHeader title="할 일" subtitle={formatLong(today)} />
      <Card style={{ marginHorizontal: 16, marginBottom: 14 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
          <View style={{ flex: 1 }}>
            <Text style={{ color: t.sub, fontSize: 13, fontWeight: '600' }}>{holiday ? `오늘은 ${holiday}` : greet}</Text>
            <Text style={{ color: t.text, fontSize: 17, fontWeight: '700', marginTop: 3 }}>
              {todayStats.total === 0 ? '오늘 예정된 일이 없어요' : todayStats.done === todayStats.total ? '오늘 할 일을 모두 끝냈어요' : `${todayStats.total - todayStats.done}개 남았어요`}
            </Text>
          </View>
          <Text style={{ color: t.primary, fontSize: 24, fontWeight: '800', letterSpacing: -0.5 }}>{Math.round(ratio * 100)}%</Text>
        </View>
        <Progress value={ratio} />
      </Card>
      <View style={{ paddingHorizontal: 16, gap: 10 }}>
        <Segmented<Filter> value={filter} onChange={setFilter} options={[
          { value: 'today', label: '오늘' }, { value: 'upcoming', label: '예정' }, { value: 'all', label: '전체' }, { value: 'done', label: '완료' },
        ]} />
        <SearchField value={query} onChangeText={setQuery} placeholder="할 일 검색" />
        {data.projects.length > 0 && (
          <ChipRow>
            <Chip label="전체" active={!projectId} onPress={() => setProjectId(null)} />
            {data.projects.map((p) => (
              <Chip key={p.id} label={`${p.emoji} ${p.name}`} color={p.color} active={projectId === p.id} onPress={() => setProjectId(projectId === p.id ? null : p.id)} />
            ))}
          </ChipRow>
        )}
      </View>
    </View>
  );

  return (
    <View style={{ flex: 1 }}>
      <SectionList
        sections={sections}
        keyExtractor={(x) => x.id}
        ListHeaderComponent={header}
        stickySectionHeadersEnabled={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingBottom: 110 }}
        renderSectionHeader={({ section }) => (
          <SectionTitle
            color={(section as Section).tone === 'danger' ? t.danger : undefined}
            right={section === sections[0] && filter !== 'done' ? (
              <Pressable onPress={() => { tap(); setSort(SORT_NEXT[sort]); }} hitSlop={8} style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
                <Ionicons name="swap-vertical" size={13} color={t.sub} />
                <Text style={{ color: t.sub, fontSize: 12, fontWeight: '600' }}>{SORT_LABEL[sort]}</Text>
              </Pressable>
            ) : undefined}
          >
            {section.title}
          </SectionTitle>
        )}
        renderItem={({ item, index, section }) => (
          <TaskItem
            task={item}
            position={positionOf(index, section.data.length)}
            project={item.projectId ? projectMap[item.projectId] : undefined}
            goal={item.goalId ? goalMap[item.goalId] : undefined}
            onToggle={toggleTask}
            onPress={onPress}
            onLongPress={quickMenu}
            hideDate={item.due === today}
          />
        )}
        ListEmptyComponent={
          query ? <Empty icon="search" title="검색 결과가 없어요" />
            : filter === 'done' ? <Empty icon="leaf-outline" title="아직 완료한 일이 없어요" />
            : <Empty icon="checkmark-done" title={filter === 'today' ? '오늘 할 일을 모두 끝냈어요' : '할 일이 없어요'} desc="+ 버튼을 눌러 새 할 일을 추가하세요" />
        }
      />
      <Fab onPress={() => openTask({ due: filter === 'all' ? null : today, projectId })} />
    </View>
  );
}
