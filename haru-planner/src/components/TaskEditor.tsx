import React, { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';
import { Alert, Platform, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { addDays, formatDue, formatTime, todayKey, startOfWeek } from '../date';
import { newTask, uid, useStore } from '../store';
import { PRIORITY_LABEL, priorityColor, useTheme } from '../theme';
import { Priority, Repeat, Task } from '../types';
import { DatePickerSheet, TimePickerSheet } from './Pickers';
import { Button, Chip, ChipRow, Field, Label, Sheet } from './ui';
import { Ionicons } from '@expo/vector-icons';
import { requestPermission } from '../notify';

const REPEATS: { v: Repeat; l: string }[] = [
  { v: 'none', l: '안 함' }, { v: 'daily', l: '매일' }, { v: 'weekdays', l: '평일' }, { v: 'weekly', l: '매주' }, { v: 'monthly', l: '매월' },
];

function Editor({ initial, onClose }: { initial: Task; onClose: () => void }) {
  const t = useTheme();
  const { data, saveTask, deleteTask } = useStore();
  const isNew = !data.tasks.some((x) => x.id === initial.id);
  const [task, setTask] = useState<Task>(initial);
  const [dateOpen, setDateOpen] = useState(false);
  const [timeOpen, setTimeOpen] = useState(false);
  const [subDraft, setSubDraft] = useState('');
  const scrollRef = useRef<React.ComponentRef<typeof ScrollView>>(null);
  // 키보드가 올라온 뒤 입력 중인 세부 항목이 보이도록 아래로 스크롤
  const revealBottom = () => {
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 120);
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 400);
  };
  const set = <K extends keyof Task>(k: K, v: Task[K]) => setTask((p) => ({ ...p, [k]: v }));
  const today = todayKey();
  const nextMon = addDays(startOfWeek(today, 1), 7);

  const save = async () => {
    const title = task.title.trim();
    if (!title) {
      Alert.alert('제목을 입력해 주세요');
      return;
    }
    if (task.remind && !task.due) {
      Alert.alert('알림을 받으려면 날짜를 정해 주세요');
      return;
    }
    let subtasks = task.subtasks;
    if (subDraft.trim()) subtasks = [...subtasks, { id: uid(), title: subDraft.trim(), done: false }];
    await saveTask({ ...task, title, subtasks });
    onClose();
  };

  const remove = () => {
    const go = async () => { await deleteTask(task.id); onClose(); };
    if (Platform.OS === 'web') { go(); return; }
    Alert.alert('할 일 삭제', '이 할 일을 삭제할까요?', [
      { text: '취소', style: 'cancel' },
      { text: '삭제', style: 'destructive', onPress: go },
    ]);
  };

  const toggleRemind = async (v: boolean) => {
    if (v) {
      const ok = await requestPermission();
      if (!ok && Platform.OS !== 'web') {
        Alert.alert('알림 권한이 필요해요', '휴대폰 설정에서 알림을 허용해 주세요.');
      }
      if (!task.due) set('due', today);
    }
    set('remind', v);
  };

  const addSub = () => {
    const v = subDraft.trim();
    if (!v) return;
    set('subtasks', [...task.subtasks, { id: uid(), title: v, done: false }]);
    setSubDraft('');
    revealBottom();
  };

  return (
    <>
      <ScrollView ref={scrollRef} contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 24 }} keyboardShouldPersistTaps="handled">
        <TextInput
          value={task.title}
          onChangeText={(v) => set('title', v)}
          placeholder="무엇을 해야 하나요?"
          placeholderTextColor={t.faint}
          autoFocus={isNew}
          maxLength={300}
          style={[st.title, { color: t.text }]}
          returnKeyType="done"
          onSubmitEditing={save}
        />
        <Field value={task.note} onChangeText={(v) => set('note', v)} placeholder="메모 추가" multiline style={{ minHeight: 60, textAlignVertical: 'top' }} />

        <Label icon="calendar-clear-outline">날짜</Label>
        <ChipRow>
          <Chip label="오늘" active={task.due === today} onPress={() => set('due', today)} />
          <Chip label="내일" active={task.due === addDays(today, 1)} onPress={() => set('due', addDays(today, 1))} />
          <Chip label="다음 주" active={task.due === nextMon} onPress={() => set('due', nextMon)} />
          <Chip
            icon="calendar-outline"
            label={task.due && ![today, addDays(today, 1), nextMon].includes(task.due) ? formatDue(task.due) : '직접 선택'}
            active={!!task.due && ![today, addDays(today, 1), nextMon].includes(task.due)}
            onPress={() => setDateOpen(true)}
          />
          <Chip label="없음" active={!task.due} onPress={() => { set('due', null); set('remind', false); }} />
        </ChipRow>

        <View style={st.rowBetween}>
          <Pressable style={[st.pill, { backgroundColor: t.fill }]} onPress={() => setTimeOpen(true)}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Ionicons name="time-outline" size={18} color={task.time ? t.primary : t.sub} />
              <Text style={{ color: task.time ? t.text : t.sub, fontSize: 15, fontWeight: task.time ? '600' : '400' }}>{task.time ? formatTime(task.time) : '시간 추가'}</Text>
            </View>
          </Pressable>
          <View style={[st.pill, { backgroundColor: t.fill, flexDirection: 'row', alignItems: 'center', gap: 8 }]}>
            <Ionicons name="notifications-outline" size={18} color={task.remind ? t.primary : t.sub} />
            <Text style={{ color: t.text, fontSize: 15, flex: 1 }}>알림</Text>
            <Switch value={task.remind} onValueChange={toggleRemind} trackColor={{ true: t.primary, false: t.border }} thumbColor="#fff" />
          </View>
        </View>

        <Label icon="repeat">반복</Label>
        <ChipRow>
          {REPEATS.map((r) => <Chip key={r.v} label={r.l} active={task.repeat === r.v} onPress={() => {
            set('repeat', r.v);
            if (r.v !== 'none' && !task.due) set('due', today);
          }} />)}
        </ChipRow>

        <Label icon="flag-outline">우선순위</Label>
        <ChipRow>
          {([3, 2, 1, 0] as Priority[]).map((p) => (
            <Chip key={p} icon={p ? 'flag' : undefined} label={PRIORITY_LABEL[p]} color={priorityColor(t, p)} active={task.priority === p} onPress={() => set('priority', p)} />
          ))}
        </ChipRow>

        <Label icon="folder-open-outline">프로젝트</Label>
        <ChipRow>
          <Chip label="없음" active={!task.projectId} onPress={() => set('projectId', null)} />
          {data.projects.map((p) => (
            <Chip key={p.id} label={`${p.emoji} ${p.name}`} color={p.color} active={task.projectId === p.id} onPress={() => set('projectId', p.id)} />
          ))}
        </ChipRow>

        {data.goals.length > 0 && (
          <>
            <Label icon="trophy-outline">목표 연결</Label>
            <ChipRow>
              <Chip label="없음" active={!task.goalId} onPress={() => set('goalId', null)} />
              {data.goals.map((g) => (
                <Chip key={g.id} label={`${g.emoji} ${g.title}`} active={task.goalId === g.id} onPress={() => set('goalId', g.id)} />
              ))}
            </ChipRow>
          </>
        )}

        <Label icon="list">세부 항목 {task.subtasks.length ? `(${task.subtasks.filter((s) => s.done).length}/${task.subtasks.length})` : ''}</Label>
        {task.subtasks.map((s) => (
          <View key={s.id} style={[st.sub, { borderColor: t.border }]}>
            <Pressable
              hitSlop={8}
              onPress={() => set('subtasks', task.subtasks.map((x) => (x.id === s.id ? { ...x, done: !x.done } : x)))}
              style={[st.subCheck, { borderColor: s.done ? t.primary : t.faint, backgroundColor: s.done ? t.primary : 'transparent' }]}
            >
              {s.done ? <Ionicons name="checkmark" size={13} color={t.onPrimary} /> : null}
            </Pressable>
            <TextInput
              value={s.title}
              onChangeText={(v) => set('subtasks', task.subtasks.map((x) => (x.id === s.id ? { ...x, title: v } : x)))}
              onFocus={revealBottom}
              style={{ flex: 1, color: s.done ? t.faint : t.text, fontSize: 15, textDecorationLine: s.done ? 'line-through' : 'none', paddingVertical: 4 }}
            />
            <Pressable hitSlop={10} onPress={() => set('subtasks', task.subtasks.filter((x) => x.id !== s.id))}>
              <Ionicons name="close" size={18} color={t.faint} />
            </Pressable>
          </View>
        ))}
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <Field value={subDraft} onChangeText={setSubDraft} placeholder="세부 항목 추가" onFocus={revealBottom} onSubmitEditing={addSub} returnKeyType="done" blurOnSubmit={false} style={{ flex: 1 }} />
          <Button label="추가" kind="ghost" onPress={addSub} style={{ height: 48, paddingHorizontal: 16 }} />
        </View>

        <Button label={isNew ? '할 일 추가' : '저장'} onPress={save} style={{ marginTop: 24 }} />
        {!isNew && <Button label="삭제" kind="danger" onPress={remove} style={{ marginTop: 10 }} />}
      </ScrollView>
      <DatePickerSheet visible={dateOpen} value={task.due} weekStart={data.settings.weekStart} onClose={() => setDateOpen(false)}
        onPick={(k) => { set('due', k); if (!k) set('remind', false); }} />
      <TimePickerSheet visible={timeOpen} value={task.time} onClose={() => setTimeOpen(false)} onPick={(v) => { set('time', v); if (v && !task.due) set('due', today); }} />
    </>
  );
}

interface EditorApi {
  openTask: (t?: Partial<Task> | Task) => void;
  quickMenu: (t: Task) => void;
}
const EditorCtx = createContext<EditorApi | null>(null);

export function EditorProvider({ children }: { children: React.ReactNode }) {
  const { data, saveTask, deleteTask, toggleTask } = useStore();
  const [current, setCurrent] = useState<Task | null>(null);
  const [key, setKey] = useState(0);

  const openTask = useCallback((p?: Partial<Task> | Task) => {
    const existing = p && 'id' in p && p.id ? data.tasks.find((x) => x.id === p.id) : undefined;
    setCurrent(existing ?? newTask(p));
    setKey((k) => k + 1);
  }, [data.tasks]);

  const quickMenu = useCallback((task: Task) => {
    if (Platform.OS === 'web') { openTask(task); return; }
    const today = todayKey();
    Alert.alert(task.title, undefined, [
      { text: task.done ? '미완료로 표시' : '완료', onPress: () => toggleTask(task.id) },
      { text: '내일로 미루기', onPress: () => saveTask({ ...task, due: addDays(task.due && task.due > today ? task.due : today, 1) }) },
      { text: '삭제', style: 'destructive', onPress: () => deleteTask(task.id) },
      { text: '취소', style: 'cancel' },
    ]);
  }, [toggleTask, saveTask, deleteTask, openTask]);

  const api = useMemo(() => ({ openTask, quickMenu }), [openTask, quickMenu]);
  const isNew = current ? !data.tasks.some((x) => x.id === current.id) : true;

  return (
    <EditorCtx.Provider value={api}>
      {children}
      <Sheet visible={!!current} onClose={() => setCurrent(null)} title={isNew ? '새 할 일' : '할 일 수정'} full>
        {current && <Editor key={key} initial={current} onClose={() => setCurrent(null)} />}
      </Sheet>
    </EditorCtx.Provider>
  );
}

export const useEditor = () => {
  const c = useContext(EditorCtx);
  if (!c) throw new Error('EditorProvider missing');
  return c;
};

const st = StyleSheet.create({
  title: { fontSize: 22, fontWeight: '700', letterSpacing: -0.4, paddingVertical: 10, marginBottom: 6 },
  rowBetween: { flexDirection: 'row', gap: 10, marginTop: 12 },
  pill: { flex: 1, borderRadius: 12, paddingHorizontal: 14, minHeight: 48, justifyContent: 'center' },
  sub: { flexDirection: 'row', alignItems: 'center', gap: 10, borderBottomWidth: StyleSheet.hairlineWidth, paddingVertical: 6, marginBottom: 4 },
  subCheck: { width: 20, height: 20, borderRadius: 6, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
});
