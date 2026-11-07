import React, { useCallback, useMemo, useState } from 'react';
import { Pressable, SectionList, Text, View } from 'react-native';
import { addDays, formatLong, todayKey } from '../date';
import { useStore } from '../store';
import { useTheme } from '../theme';
import { Task } from '../types';
import { TaskItem } from '../components/TaskItem';
import { useEditor } from '../components/TaskEditor';
import { Chip, ChipRow, Empty, Fab, Field, Progress, ScreenHeader, Segmented } from '../components/ui';

type Filter = 'today' | 'upcoming' | 'all' | 'done';
type Sort = 'smart' | 'priority' | 'created';

const sorters: Record<Sort, (a: Task, b: Task) => number> = {
  smart: (a, b) =>
    (a.due ?? '9999').localeCompare(b.due ?? '9999') || (a.time ?? '99').localeCompare(b.time ?? '99') || b.priority - a.priority,
  priority: (a, b) => b.priority - a.priority || (a.due ?? '9999').localeCompare(b.due ?? '9999'),
  created: (a, b) => b.createdAt - a.createdAt,
};

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

  const projectMap = useMemo(() => Object.fromEntries(data.projects.map((p) => [p.id, p])), [data.projects]);
  const goalMap = useMemo(() => Object.fromEntries(data.goals.map((g) => [g.id, g])), [data.goals]);

  const todayStats = useMemo(() => {
    const list = data.tasks.filter((x) => x.due === today);
    return { total: list.length, done: list.filter((x) => x.done).length };
  }, [data.tasks, today]);

  const sections = useMemo(() => {
    const q = query.trim().toLowerCase();
    let list = data.tasks.filter((x) => (!projectId || x.projectId === projectId) &&
      (!q || x.title.toLowerCase().includes(q) || x.note.toLowerCase().includes(q) || x.subtasks.some((s) => s.title.toLowerCase().includes(q))));
    const sorted = (l: Task[]) => [...l].sort(sorters[sort]);

    if (filter === 'done') {
      list = list.filter((x) => x.done).sort((a, b) => (b.doneAt ?? 0) - (a.doneAt ?? 0));
      return list.length ? [{ title: `완료 ${list.length}개`, data: list.slice(0, 200) }] : [];
    }
    const open = list.filter((x) => !x.done);
    const overdue = sorted(open.filter((x) => x.due && x.due < today));
    const todays = sorted(open.filter((x) => x.due === today));
    const doneToday = list.filter((x) => x.done && x.due === today);
    const out: { title: string; data: Task[]; tone?: 'danger' }[] = [];
    if (overdue.length) out.push({ title: `기한 지남 · ${overdue.length}`, data: overdue, tone: 'danger' });

    if (filter === 'today') {
      if (todays.length) out.push({ title: `오늘 · ${todays.length}`, data: todays });
      if (doneToday.length) out.push({ title: `오늘 완료 · ${doneToday.length}`, data: doneToday });
    } else if (filter === 'upcoming') {
      if (todays.length) out.push({ title: `오늘 · ${todays.length}`, data: todays });
      const tm = sorted(open.filter((x) => x.due === tomorrow));
      if (tm.length) out.push({ title: `내일 · ${tm.length}`, data: tm });
      const week = sorted(open.filter((x) => x.due && x.due > tomorrow && x.due <= addDays(today, 7)));
      if (week.length) out.push({ title: `7일 이내 · ${week.length}`, data: week });
      const later = sorted(open.filter((x) => x.due && x.due > addDays(today, 7)));
      if (later.length) out.push({ title: `이후 · ${later.length}`, data: later });
    } else {
      const dated = sorted(open.filter((x) => x.due && x.due >= today));
      if (dated.length) out.push({ title: `예정 · ${dated.length}`, data: dated });
      const none = sorted(open.filter((x) => !x.due));
      if (none.length) out.push({ title: `날짜 없음 · ${none.length}`, data: none });
    }
    return out;
  }, [data.tasks, filter, projectId, query, sort, today, tomorrow]);

  const onPress = useCallback((task: Task) => openTask(task), [openTask]);
  const hour = new Date().getHours();
  const greet = hour < 6 ? '늦은 밤이에요 🌙' : hour < 12 ? '좋은 아침이에요 ☀️' : hour < 18 ? '좋은 오후예요 🌤' : '오늘도 수고했어요 🌆';
  const ratio = todayStats.total ? todayStats.done / todayStats.total : 0;

  const header = (
    <View>
      <ScreenHeader title="할 일" subtitle={`${formatLong(today)} · ${greet}`} />
      <View style={{ marginHorizontal: 16, marginBottom: 12, padding: 16, borderRadius: 16, backgroundColor: t.primary }}>
        <Text style={{ color: t.onPrimary, opacity: 0.85, fontSize: 13, fontWeight: '600' }}>오늘의 진행률</Text>
        <View style={{ flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', marginVertical: 8 }}>
          <Text style={{ color: t.onPrimary, fontSize: 28, fontWeight: '800' }}>{Math.round(ratio * 100)}%</Text>
          <Text style={{ color: t.onPrimary, opacity: 0.85, fontSize: 14 }}>{todayStats.done} / {todayStats.total} 완료</Text>
        </View>
        <Progress value={ratio} color={t.onPrimary} height={6} />
      </View>
      <View style={{ paddingHorizontal: 16, gap: 10, marginBottom: 8 }}>
        <Segmented<Filter> value={filter} onChange={setFilter} options={[
          { value: 'today', label: '오늘' }, { value: 'upcoming', label: '예정' }, { value: 'all', label: '전체' }, { value: 'done', label: '완료' },
        ]} />
        <Field value={query} onChangeText={setQuery} placeholder="🔍 할 일 검색" returnKeyType="search" style={{ paddingVertical: 10 }} />
        <ChipRow>
          <Chip label="모든 프로젝트" active={!projectId} onPress={() => setProjectId(null)} />
          {data.projects.map((p) => (
            <Chip key={p.id} label={`${p.emoji} ${p.name}`} color={p.color} active={projectId === p.id} onPress={() => setProjectId(projectId === p.id ? null : p.id)} />
          ))}
        </ChipRow>
        {filter !== 'done' && (
          <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 14 }}>
            {(['smart', 'priority', 'created'] as Sort[]).map((s) => (
              <Pressable key={s} onPress={() => setSort(s)} hitSlop={6}>
                <Text style={{ color: sort === s ? t.primary : t.faint, fontSize: 12, fontWeight: '700' }}>
                  {s === 'smart' ? '날짜순' : s === 'priority' ? '중요도순' : '최근 추가순'}
                </Text>
              </Pressable>
            ))}
          </View>
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
          <Text style={{ color: (section as any).tone === 'danger' ? t.danger : t.sub, fontSize: 13, fontWeight: '800', marginHorizontal: 20, marginTop: 14, marginBottom: 8 }}>
            {section.title}
          </Text>
        )}
        renderItem={({ item }) => (
          <TaskItem
            task={item}
            project={item.projectId ? projectMap[item.projectId] : undefined}
            goal={item.goalId ? goalMap[item.goalId] : undefined}
            onToggle={toggleTask}
            onPress={onPress}
            onLongPress={quickMenu}
            hideDate={filter === 'today' && item.due === today}
          />
        )}
        ListEmptyComponent={
          query ? <Empty emoji="🔍" title="검색 결과가 없어요" />
            : filter === 'done' ? <Empty emoji="🌱" title="아직 완료한 일이 없어요" />
            : <Empty emoji="🎉" title={filter === 'today' ? '오늘 할 일을 모두 끝냈어요!' : '할 일이 없어요'} desc="+ 버튼을 눌러 새 할 일을 추가하세요" />
        }
      />
      <Fab onPress={() => openTask({ due: filter === 'all' ? null : today, projectId })} />
    </View>
  );
}
