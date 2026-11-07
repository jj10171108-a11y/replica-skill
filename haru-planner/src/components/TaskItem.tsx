import React, { memo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { formatDue, formatTime, todayKey } from '../date';
import { cardShadow, tint, useTheme } from '../theme';
import { Goal, Project, Task } from '../types';
import { IconName, tap } from './ui';

const REPEAT_LABEL: Record<string, string> = { daily: '매일', weekdays: '평일', weekly: '매주', monthly: '매월' };

export type RowPosition = 'single' | 'first' | 'middle' | 'last';
export const positionOf = (index: number, length: number): RowPosition =>
  length === 1 ? 'single' : index === 0 ? 'first' : index === length - 1 ? 'last' : 'middle';

function Meta({ icon, text, color }: { icon?: IconName; text: string; color: string }) {
  return (
    <View style={st.metaItem}>
      {icon ? <Ionicons name={icon} size={12} color={color} /> : null}
      {text ? <Text style={{ color, fontSize: 12, fontWeight: '500' }}>{text}</Text> : null}
    </View>
  );
}

function TaskItemImpl({ task, project, goal, onToggle, onPress, onLongPress, hideDate }: {
  task: Task; project?: Project; goal?: Goal; onToggle: (id: string) => void; onPress: (t: Task) => void;
  onLongPress?: (t: Task) => void; hideDate?: boolean; position?: RowPosition;
}) {
  const t = useTheme();
  const overdue = !task.done && task.due !== null && task.due < todayKey();
  const subDone = task.subtasks.filter((s) => s.done).length;
  // 프로젝트가 있으면 그 파스텔 색 카드, 없으면 흰 카드
  const p = project ? tint(t, project.color) : null;
  const bg = task.done ? t.card : p ? p.bg : t.card;
  const ink = p ? p.ink : t.primaryInk;
  const metaColor = t.sub;
  const hasMeta = (task.due && !hideDate) || (task.time && hideDate) || task.repeat !== 'none' || task.subtasks.length || task.remind || task.note || project || goal;

  return (
    <Pressable
      onPress={() => onPress(task)}
      onLongPress={onLongPress ? () => { tap(); onLongPress(task); } : undefined}
      style={({ pressed }) => [
        st.card,
        { backgroundColor: bg, opacity: task.done ? 0.7 : 1, transform: [{ scale: pressed ? 0.985 : 1 }] },
        !p || task.done ? cardShadow(t) : null,
      ]}
    >
      <Pressable
        onPress={() => { tap(); onToggle(task.id); }}
        hitSlop={12}
        accessibilityRole="checkbox"
        accessibilityState={{ checked: task.done }}
        accessibilityLabel={task.title}
        style={[st.check, { borderColor: task.done ? t.success : task.priority === 3 ? t.danger : ink, backgroundColor: task.done ? t.success : t.dark ? 'transparent' : 'rgba(255,255,255,0.7)' }]}
      >
        {task.done ? <Ionicons name="checkmark" size={15} color={t.dark ? t.bg : '#fff'} /> : null}
      </Pressable>
      <View style={{ flex: 1 }}>
        <Text
          numberOfLines={2}
          style={{ color: task.done ? t.faint : t.text, fontSize: 16, fontWeight: '600', lineHeight: 22, textDecorationLine: task.done ? 'line-through' : 'none' }}
        >
          {task.title}
        </Text>
        {hasMeta ? (
          <View style={st.meta}>
            {task.due && !hideDate ? <Meta icon="calendar-clear-outline" text={formatDue(task.due, task.time)} color={overdue ? t.danger : metaColor} /> : null}
            {task.time && hideDate ? <Meta icon="time-outline" text={formatTime(task.time)} color={metaColor} /> : null}
            {task.repeat !== 'none' ? <Meta icon="repeat" text={REPEAT_LABEL[task.repeat]} color={metaColor} /> : null}
            {task.subtasks.length ? <Meta icon="list" text={`${subDone}/${task.subtasks.length}`} color={metaColor} /> : null}
            {task.remind ? <Meta icon="notifications-outline" text="" color={metaColor} /> : null}
            {task.note ? <Meta icon="document-text-outline" text="" color={metaColor} /> : null}
            {goal ? <Meta icon="flag-outline" text={goal.title} color={metaColor} /> : null}
          </View>
        ) : null}
      </View>
      {project ? (
        <View style={[st.tag, { backgroundColor: t.dark ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.75)' }]}>
          <Text style={{ color: ink, fontSize: 12, fontWeight: '700' }} numberOfLines={1}>{project.emoji} {project.name}</Text>
        </View>
      ) : task.priority === 3 && !task.done ? <Ionicons name="flag" size={15} color={t.danger} /> : null}
    </Pressable>
  );
}

export const TaskItem = memo(TaskItemImpl);

const st = StyleSheet.create({
  card: { flexDirection: 'row', alignItems: 'center', gap: 12, marginHorizontal: 16, marginBottom: 10, paddingHorizontal: 16, paddingVertical: 15, borderRadius: 22 },
  check: { width: 26, height: 26, borderRadius: 13, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  meta: { flexDirection: 'row', flexWrap: 'wrap', columnGap: 10, rowGap: 2, marginTop: 4 },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  tag: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999, maxWidth: 110 },
});
