import React, { memo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { formatDue, todayKey } from '../date';
import { priorityColor, useTheme } from '../theme';
import { Goal, Project, Task } from '../types';
import { tap } from './ui';

const REPEAT_LABEL: Record<string, string> = { daily: '매일', weekdays: '평일', weekly: '매주', monthly: '매월' };

function TaskItemImpl({ task, project, goal, onToggle, onPress, onLongPress, hideDate }: {
  task: Task; project?: Project; goal?: Goal; onToggle: (id: string) => void; onPress: (t: Task) => void;
  onLongPress?: (t: Task) => void; hideDate?: boolean;
}) {
  const t = useTheme();
  const pc = priorityColor(t, task.priority);
  const overdue = !task.done && task.due !== null && task.due < todayKey();
  const subDone = task.subtasks.filter((s) => s.done).length;
  const meta: { text: string; color?: string }[] = [];
  if (task.due && !hideDate) meta.push({ text: formatDue(task.due, task.time), color: overdue ? t.danger : undefined });
  else if (task.time && hideDate) meta.push({ text: formatDue(todayKey(), task.time).replace('오늘 ', '') });
  if (task.repeat !== 'none') meta.push({ text: '↻ ' + REPEAT_LABEL[task.repeat] });
  if (task.remind) meta.push({ text: '🔔' });
  if (task.subtasks.length) meta.push({ text: `☑ ${subDone}/${task.subtasks.length}` });
  if (task.note) meta.push({ text: '📝' });

  return (
    <Pressable
      onPress={() => onPress(task)}
      onLongPress={onLongPress ? () => { tap(); onLongPress(task); } : undefined}
      style={({ pressed }) => [st.row, { backgroundColor: pressed ? t.primarySoft : t.card, borderColor: t.border }]}
    >
      <Pressable
        onPress={() => { tap(); onToggle(task.id); }}
        hitSlop={10}
        accessibilityRole="checkbox"
        accessibilityState={{ checked: task.done }}
        style={[st.check, { borderColor: task.done ? t.success : pc, backgroundColor: task.done ? t.success : 'transparent' }]}
      >
        {task.done ? <Text style={{ color: '#fff', fontSize: 14, fontWeight: '900' }}>✓</Text> : null}
      </Pressable>
      <View style={{ flex: 1 }}>
        <Text
          numberOfLines={2}
          style={{ color: task.done ? t.faint : t.text, fontSize: 16, fontWeight: '600', textDecorationLine: task.done ? 'line-through' : 'none' }}
        >
          {task.title}
        </Text>
        {(meta.length > 0 || project || goal) && (
          <View style={st.meta}>
            {meta.map((m, i) => (
              <Text key={i} style={{ color: m.color ?? t.sub, fontSize: 12, fontWeight: m.color ? '700' : '500' }}>{m.text}</Text>
            ))}
            {goal ? <Text style={{ color: t.sub, fontSize: 12 }}>{goal.emoji} {goal.title}</Text> : null}
          </View>
        )}
      </View>
      {project ? (
        <View style={[st.tag, { backgroundColor: project.color + (t.dark ? '33' : '1F') }]}>
          <Text style={{ color: project.color, fontSize: 11, fontWeight: '700' }} numberOfLines={1}>{project.emoji} {project.name}</Text>
        </View>
      ) : null}
    </Pressable>
  );
}

export const TaskItem = memo(TaskItemImpl);

const st = StyleSheet.create({
  row: {
    flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14, paddingVertical: 13,
    borderRadius: 14, borderWidth: StyleSheet.hairlineWidth, marginHorizontal: 16, marginBottom: 8,
  },
  check: { width: 24, height: 24, borderRadius: 12, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  meta: { flexDirection: 'row', flexWrap: 'wrap', columnGap: 10, rowGap: 2, marginTop: 4 },
  tag: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, maxWidth: 96 },
});
