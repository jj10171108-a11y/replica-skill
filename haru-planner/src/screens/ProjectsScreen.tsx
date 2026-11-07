import React, { useMemo, useState } from 'react';
import { Alert, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { diffDays, formatDue, todayKey } from '../date';
import { uid, useStore } from '../store';
import { PALETTE, useTheme } from '../theme';
import { Goal, Project, Task } from '../types';
import { TaskItem } from '../components/TaskItem';
import { useEditor } from '../components/TaskEditor';
import { DatePickerSheet } from '../components/Pickers';
import { Button, Card, Chip, Empty, Fab, Field, Label, Progress, ScreenHeader, Segmented, Sheet, tap } from '../components/ui';

const PROJECT_EMOJI = ['📁', '🏠', '💼', '📚', '🛒', '💪', '✈️', '💰', '🎨', '🧑‍💻', '❤️', '🎵'];
const GOAL_EMOJI = ['⭐', '🎯', '🏃', '📖', '💰', '🧘', '🥗', '🏆', '🌱', '✍️', '🗣', '🚀'];

const confirm = (title: string, msg: string, go: () => void) => {
  if (Platform.OS === 'web') return go();
  Alert.alert(title, msg, [{ text: '취소', style: 'cancel' }, { text: '삭제', style: 'destructive', onPress: go }]);
};

function EmojiRow({ list, value, onPick }: { list: string[]; value: string; onPick: (e: string) => void }) {
  const t = useTheme();
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
      {list.map((e) => (
        <Pressable key={e} onPress={() => { tap(); onPick(e); }}
          style={[st.emoji, { backgroundColor: value === e ? t.primarySoft : t.bg, borderColor: value === e ? t.primary : t.border }]}>
          <Text style={{ fontSize: 20 }}>{e}</Text>
        </Pressable>
      ))}
    </View>
  );
}

function ProjectForm({ initial, onClose }: { initial: Project; onClose: () => void }) {
  const t = useTheme();
  const { data, saveProject, deleteProject } = useStore();
  const [p, setP] = useState(initial);
  const isNew = !data.projects.some((x) => x.id === p.id);
  return (
    <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 20 }} keyboardShouldPersistTaps="handled">
      <Label>이름</Label>
      <Field value={p.name} onChangeText={(v) => setP({ ...p, name: v })} placeholder="예: 운동, 공부, 이사 준비" autoFocus={isNew} maxLength={40} />
      <Label>아이콘</Label>
      <EmojiRow list={PROJECT_EMOJI} value={p.emoji} onPick={(e) => setP({ ...p, emoji: e })} />
      <Label>색상</Label>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
        {PALETTE.map((c) => (
          <Pressable key={c} onPress={() => { tap(); setP({ ...p, color: c }); }}
            style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: c, borderWidth: p.color === c ? 3 : 0, borderColor: t.text }} />
        ))}
      </View>
      <Button label={isNew ? '프로젝트 만들기' : '저장'} disabled={!p.name.trim()} onPress={() => { saveProject({ ...p, name: p.name.trim() }); onClose(); }} style={{ marginTop: 24 }} />
      {!isNew && <Button label="프로젝트 삭제" kind="danger" style={{ marginTop: 10 }} onPress={() =>
        confirm('프로젝트 삭제', '프로젝트만 삭제되고 할 일은 남아요.', () => { deleteProject(p.id); onClose(); })} />}
    </ScrollView>
  );
}

function GoalForm({ initial, onClose }: { initial: Goal; onClose: () => void }) {
  const { data, saveGoal, deleteGoal } = useStore();
  const [g, setG] = useState(initial);
  const [dateOpen, setDateOpen] = useState(false);
  const isNew = !data.goals.some((x) => x.id === g.id);
  return (
    <>
      <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 20 }} keyboardShouldPersistTaps="handled">
        <Label>목표</Label>
        <Field value={g.title} onChangeText={(v) => setG({ ...g, title: v })} placeholder="예: 매일 책 20쪽 읽기" autoFocus={isNew} maxLength={60} />
        <Label>아이콘</Label>
        <EmojiRow list={GOAL_EMOJI} value={g.emoji} onPick={(e) => setG({ ...g, emoji: e })} />
        <Label>목표일</Label>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <Chip label={g.deadline ? `📅 ${formatDue(g.deadline)}` : '📅 날짜 선택'} active={!!g.deadline} onPress={() => setDateOpen(true)} />
          {g.deadline ? <Chip label="없음" onPress={() => setG({ ...g, deadline: null })} /> : null}
        </View>
        <Button label={isNew ? '목표 만들기' : '저장'} disabled={!g.title.trim()} onPress={() => { saveGoal({ ...g, title: g.title.trim() }); onClose(); }} style={{ marginTop: 24 }} />
        {!isNew && <Button label="목표 삭제" kind="danger" style={{ marginTop: 10 }} onPress={() =>
          confirm('목표 삭제', '목표만 삭제되고 연결된 할 일은 남아요.', () => { deleteGoal(g.id); onClose(); })} />}
      </ScrollView>
      <DatePickerSheet visible={dateOpen} value={g.deadline} weekStart={data.settings.weekStart} onClose={() => setDateOpen(false)} onPick={(k) => setG({ ...g, deadline: k })} />
    </>
  );
}

type Detail = { kind: 'project'; id: string | null } | { kind: 'goal'; id: string };

export function ProjectsScreen() {
  const t = useTheme();
  const { data, toggleTask } = useStore();
  const { openTask, quickMenu } = useEditor();
  const [tab, setTab] = useState<'projects' | 'goals'>('projects');
  const [pForm, setPForm] = useState<Project | null>(null);
  const [gForm, setGForm] = useState<Goal | null>(null);
  const [detail, setDetail] = useState<Detail | null>(null);
  const [showDone, setShowDone] = useState(false);
  const today = todayKey();

  const stats = useMemo(() => {
    const by = (pred: (x: Task) => boolean) => {
      const l = data.tasks.filter(pred);
      return { total: l.length, done: l.filter((x) => x.done).length, open: l.filter((x) => !x.done).length };
    };
    return {
      projects: Object.fromEntries(data.projects.map((p) => [p.id, by((x) => x.projectId === p.id)])),
      inbox: by((x) => !x.projectId),
      goals: Object.fromEntries(data.goals.map((g) => [g.id, by((x) => x.goalId === g.id)])),
    };
  }, [data]);

  const detailInfo = useMemo(() => {
    if (!detail) return null;
    const projectMap = Object.fromEntries(data.projects.map((p) => [p.id, p]));
    if (detail.kind === 'project') {
      const p = detail.id ? data.projects.find((x) => x.id === detail.id) : null;
      const tasks = data.tasks.filter((x) => x.projectId === detail.id);
      return { title: p ? `${p.emoji} ${p.name}` : '📥 미분류', tasks, projectMap, edit: p ? () => { setDetail(null); setPForm(p); } : undefined, preset: { projectId: detail.id } };
    }
    const g = data.goals.find((x) => x.id === detail.id);
    if (!g) return null;
    const tasks = data.tasks.filter((x) => x.goalId === detail.id);
    return { title: `${g.emoji} ${g.title}`, tasks, projectMap, edit: () => { setDetail(null); setGForm(g); }, preset: { goalId: g.id, due: today } };
  }, [detail, data, today]);

  const newProject = () => setPForm({ id: uid(), name: '', emoji: '📁', color: PALETTE[data.projects.length % PALETTE.length], createdAt: Date.now() });
  const newGoal = () => setGForm({ id: uid(), title: '', emoji: '⭐', deadline: null, createdAt: Date.now() });

  return (
    <View style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={{ paddingBottom: 110 }}>
        <ScreenHeader title={tab === 'projects' ? '프로젝트' : '목표'} />
        <View style={{ paddingHorizontal: 16, marginBottom: 14 }}>
          <Segmented value={tab} onChange={setTab} options={[{ value: 'projects', label: '📁 프로젝트' }, { value: 'goals', label: '⭐ 목표' }]} />
        </View>

        {tab === 'projects' ? (
          <View style={{ paddingHorizontal: 16, gap: 10 }}>
            <Card onPress={() => setDetail({ kind: 'project', id: null })} style={st.rowCard}>
              <Text style={{ fontSize: 24 }}>📥</Text>
              <View style={{ flex: 1 }}>
                <Text style={[st.cardTitle, { color: t.text }]}>미분류</Text>
                <Text style={{ color: t.sub, fontSize: 13 }}>프로젝트 없는 할 일</Text>
              </View>
              <Text style={{ color: t.sub, fontWeight: '700' }}>{stats.inbox.open}</Text>
            </Card>
            {data.projects.map((p) => {
              const s = stats.projects[p.id];
              return (
                <Card key={p.id} onPress={() => setDetail({ kind: 'project', id: p.id })} onLongPress={() => setPForm(p)}>
                  <View style={st.rowCard}>
                    <View style={[st.icon, { backgroundColor: p.color + '22' }]}><Text style={{ fontSize: 22 }}>{p.emoji}</Text></View>
                    <View style={{ flex: 1 }}>
                      <Text style={[st.cardTitle, { color: t.text }]}>{p.name}</Text>
                      <Text style={{ color: t.sub, fontSize: 13 }}>남은 일 {s.open}개 · 완료 {s.done}개</Text>
                    </View>
                    <Text style={{ color: p.color, fontWeight: '800' }}>{s.total ? Math.round((s.done / s.total) * 100) : 0}%</Text>
                  </View>
                  <View style={{ marginTop: 12 }}><Progress value={s.total ? s.done / s.total : 0} color={p.color} height={6} /></View>
                </Card>
              );
            })}
            {data.projects.length === 0 && <Empty emoji="📁" title="프로젝트가 없어요" desc="할 일을 주제별로 묶어 관리해 보세요" />}
            <Text style={{ color: t.faint, fontSize: 12, textAlign: 'center', marginTop: 4 }}>길게 누르면 편집할 수 있어요</Text>
          </View>
        ) : (
          <View style={{ paddingHorizontal: 16, gap: 10 }}>
            {data.goals.map((g) => {
              const s = stats.goals[g.id];
              const left = g.deadline ? diffDays(g.deadline, today) : null;
              return (
                <Card key={g.id} onPress={() => setDetail({ kind: 'goal', id: g.id })} onLongPress={() => setGForm(g)}>
                  <View style={st.rowCard}>
                    <View style={[st.icon, { backgroundColor: t.primarySoft }]}><Text style={{ fontSize: 22 }}>{g.emoji}</Text></View>
                    <View style={{ flex: 1 }}>
                      <Text style={[st.cardTitle, { color: t.text }]}>{g.title}</Text>
                      <Text style={{ color: left !== null && left < 0 ? t.danger : t.sub, fontSize: 13 }}>
                        {left === null ? '기한 없음' : left > 0 ? `D-${left}` : left === 0 ? 'D-Day' : `${-left}일 지남`} · 완료 {s.done}/{s.total}
                      </Text>
                    </View>
                    <Text style={{ color: t.primary, fontWeight: '800', fontSize: 16 }}>{s.total ? Math.round((s.done / s.total) * 100) : 0}%</Text>
                  </View>
                  <View style={{ marginTop: 12 }}><Progress value={s.total ? s.done / s.total : 0} /></View>
                </Card>
              );
            })}
            {data.goals.length === 0 && <Empty emoji="🎯" title="목표를 세워 보세요" desc="할 일을 목표에 연결하면 진행률이 자동으로 계산돼요" />}
          </View>
        )}
      </ScrollView>
      <Fab onPress={tab === 'projects' ? newProject : newGoal} />

      <Sheet visible={!!pForm} onClose={() => setPForm(null)} title="프로젝트">
        {pForm && <ProjectForm key={pForm.id} initial={pForm} onClose={() => setPForm(null)} />}
      </Sheet>
      <Sheet visible={!!gForm} onClose={() => setGForm(null)} title="목표">
        {gForm && <GoalForm key={gForm.id} initial={gForm} onClose={() => setGForm(null)} />}
      </Sheet>
      <Sheet visible={!!detailInfo} onClose={() => { setDetail(null); setShowDone(false); }} title={detailInfo?.title} full
        right={detailInfo?.edit ? <Pressable onPress={detailInfo.edit} hitSlop={10}><Text style={{ color: t.primary, fontSize: 16 }}>편집</Text></Pressable> : undefined}>
        {detailInfo && (
          <ScrollView contentContainerStyle={{ paddingBottom: 20 }}>
            {detailInfo.tasks.filter((x) => !x.done).map((x) => (
              <TaskItem key={x.id} task={x} project={x.projectId ? detailInfo.projectMap[x.projectId] : undefined} onToggle={toggleTask}
                onPress={openTask} onLongPress={quickMenu} />
            ))}
            {detailInfo.tasks.every((x) => x.done) && <Empty emoji="✨" title="남은 할 일이 없어요" />}
            <View style={{ paddingHorizontal: 16, gap: 10, marginTop: 8 }}>
              <Button label="+ 할 일 추가" kind="ghost" onPress={() => openTask(detailInfo.preset)} />
              {detailInfo.tasks.some((x) => x.done) && (
                <Pressable onPress={() => setShowDone(!showDone)} style={{ paddingVertical: 8 }}>
                  <Text style={{ color: t.sub, fontWeight: '700' }}>{showDone ? '▾' : '▸'} 완료된 항목 {detailInfo.tasks.filter((x) => x.done).length}개</Text>
                </Pressable>
              )}
            </View>
            {showDone && detailInfo.tasks.filter((x) => x.done).map((x) => (
              <TaskItem key={x.id} task={x} onToggle={toggleTask} onPress={openTask} />
            ))}
          </ScrollView>
        )}
      </Sheet>
    </View>
  );
}

const st = StyleSheet.create({
  rowCard: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  icon: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  cardTitle: { fontSize: 16, fontWeight: '700', marginBottom: 2 },
  emoji: { width: 44, height: 44, borderRadius: 12, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
});
