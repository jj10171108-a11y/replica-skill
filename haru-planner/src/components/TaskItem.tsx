import React, { memo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { formatDue, formatTime, todayKey } from '../date';
import { priorityColor, useTheme } from '../theme';
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

function TaskItemImpl({ task, project, goal, onToggle, onPress, onLongPress, hideDate, position = 'single' }: {
  task: Task; project?: Project; goal?: Goal; onToggle: (id: string) => void; onPress: (t: Task) => void;
  onLongPress?: (t: Task) => void; hideDate?: boolean; position?: RowPosition;
}) {
  const t = useTheme();
  const pc = priorityColor(t, task.priority);
  const overdue = !task.done && task.due !== null && task.due < todayKey();
  const subDone = task.subtasks.filter((s) => s.done).length;
  const top = position === 'single' || position === 'first';
  const bottom = position === 'single' || position === 'last';

  return (
    <View style={[st.wrap, { marginBottom: bottom ? 10 : 0 }]}>
      <Pressable
        onPress={() => onPress(task)}
        onLongPress={onLongPress ? () => { tap(); onLongPress(task); } : undefined}
        style={({ pressed }) => [
          st.row,
          { backgroundColor: pressed ? t.fill : t.card },
          top && st.top,
          bottom && st.bottom,
        ]}
      >
        <Pressable
          onPress={() => { tap(); onToggle(task.id); }}
          hitSlop={12}
          accessibilityRole="checkbox"
          accessibilityState={{ checked: task.done }}
          accessibilityLabel={task.title}
          style={[st.check, { borderColor: task.done ? t.primary : task.priority ? pc : t.faint, backgroundColor: task.done ? t.primary : 'transparent' }]}
        >
          {task.done ? <Ionicons name="checkmark" size={14} color={t.onPrimary} /> : null}
        </Pressable>
        <View style={[st.body, !bottom && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: t.separator }]}>
          <View style={{ flex: 1 }}>
            <Text
              numberOfLines={2}
              style={{ color: task.done ? t.faint : t.text, fontSize: 15.5, fontWeight: '500', lineHeight: 21, textDecorationLine: task.done ? 'line-through' : 'none' }}
            >
              {task.title}
            </Text>
            <View style={[st.meta, !(task.due && !hideDate) && !(task.time && hideDate) && task.repeat === 'none' && !task.subtasks.length && !task.remind && !task.note && !project && !goal && { marginTop: 0 }]}>
              {task.due && !hideDate ? <Meta icon="calendar-clear-outline" text={formatDue(task.due, task.time)} color={overdue ? t.danger : t.sub} /> : null}
              {task.time && hideDate ? <Meta icon="time-outline" text={formatTime(task.time)} color={t.sub} /> : null}
              {task.repeat !== 'none' ? <Meta icon="repeat" text={REPEAT_LABEL[task.repeat]} color={t.sub} /> : null}
              {task.subtasks.length ? <Meta icon="list" text={`${subDone}/${task.subtasks.length}`} color={t.sub} /> : null}
              {task.remind ? <Meta icon="notifications-outline" text="" color={t.sub} /> : null}
              {task.note ? <Meta icon="document-text-outline" text="" color={t.sub} /> : null}
              {project ? (
                <View style={st.metaItem}>
                  <View style={[st.projDot, { backgroundColor: project.color }]} />
                  <Text style={{ color: t.sub, fontSize: 12 }} numberOfLines={1}>{project.name}</Text>
                </View>
              ) : null}
              {goal ? <Meta icon="flag-outline" text={goal.title} color={t.sub} /> : null}
            </View>
          </View>
          {task.priority === 3 && !task.done ? <Ionicons name="flag" size={14} color={t.danger} style={{ marginTop: 3 }} /> : null}
        </View>
      </Pressable>
    </View>
  );
}

export const TaskItem = memo(TaskItemImpl);

const st = StyleSheet.create({
  wrap: { marginHorizontal: 16 },
  row: { flexDirection: 'row', alignItems: 'flex-start', paddingLeft: 14 },
  top: { borderTopLeftRadius: 16, borderTopRightRadius: 16 },
  bottom: { borderBottomLeftRadius: 16, borderBottomRightRadius: 16 },
  check: { width: 22, height: 22, borderRadius: 11, borderWidth: 1.8, alignItems: 'center', justifyContent: 'center', marginTop: 14, marginRight: 12 },
  body: { flex: 1, flexDirection: 'row', paddingVertical: 13, paddingRight: 14, gap: 8 },
  meta: { flexDirection: 'row', flexWrap: 'wrap', columnGap: 10, rowGap: 2, marginTop: 3 },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  projDot: { width: 7, height: 7, borderRadius: 4 },
});
