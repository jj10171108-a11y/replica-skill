import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { Alert, FlatList, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { formatDue } from '../date';
import { uid, useStore } from '../store';
import { NOTE_COLORS, NOTE_COLORS_DARK, useTheme } from '../theme';
import { Note } from '../types';
import { DatePickerSheet } from '../components/Pickers';
import { Button, Chip, Empty, Fab, Field, ScreenHeader, Sheet, tap } from '../components/ui';

const NoteCtx = createContext<(n?: Partial<Note>) => void>(() => {});
export const useNoteEditor = () => useContext(NoteCtx);

function NoteEditor({ initial, onClose }: { initial: Note; onClose: () => void }) {
  const t = useTheme();
  const { data, saveNote, deleteNote } = useStore();
  const [n, setN] = useState(initial);
  const [dateOpen, setDateOpen] = useState(false);
  const isNew = !data.notes.some((x) => x.id === n.id);
  const bg = t.dark ? NOTE_COLORS_DARK[n.color] ?? t.card : n.color;

  const save = () => {
    if (!n.title.trim() && !n.body.trim()) { onClose(); return; }
    saveNote({ ...n, title: n.title.trim(), updatedAt: Date.now() });
    onClose();
  };
  const remove = () => {
    const go = () => { deleteNote(n.id); onClose(); };
    if (Platform.OS === 'web') return go();
    Alert.alert('메모 삭제', '이 메모를 삭제할까요?', [{ text: '취소', style: 'cancel' }, { text: '삭제', style: 'destructive', onPress: go }]);
  };

  return (
    <>
      <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 24 }} keyboardShouldPersistTaps="handled">
        <View style={{ backgroundColor: bg, borderRadius: 16, padding: 16 }}>
          <TextInput value={n.title} onChangeText={(v) => setN({ ...n, title: v })} placeholder="제목" placeholderTextColor={t.faint}
            style={{ color: t.text, fontSize: 20, fontWeight: '800', paddingVertical: 4 }} />
          <TextInput value={n.body} onChangeText={(v) => setN({ ...n, body: v })} placeholder="내용을 입력하세요" placeholderTextColor={t.faint}
            multiline autoFocus={isNew} style={{ color: t.text, fontSize: 16, lineHeight: 24, minHeight: 220, textAlignVertical: 'top', marginTop: 8 }} />
        </View>
        <View style={{ flexDirection: 'row', gap: 10, marginTop: 16, flexWrap: 'wrap' }}>
          {NOTE_COLORS.map((c) => (
            <Pressable key={c} onPress={() => { tap(); setN({ ...n, color: c }); }}
              style={[st.swatch, { backgroundColor: t.dark ? NOTE_COLORS_DARK[c] : c, borderColor: n.color === c ? t.primary : t.border, borderWidth: n.color === c ? 3 : 1 }]} />
          ))}
        </View>
        <View style={{ flexDirection: 'row', gap: 8, marginTop: 16, flexWrap: 'wrap' }}>
          <Chip label={n.date ? `📅 ${formatDue(n.date)}` : '📅 날짜 연결'} active={!!n.date} onPress={() => setDateOpen(true)} />
          <Chip label={n.pinned ? '📌 고정됨' : '📌 고정'} active={n.pinned} onPress={() => setN({ ...n, pinned: !n.pinned })} />
        </View>
        <Button label="저장" onPress={save} style={{ marginTop: 24 }} />
        {!isNew && <Button label="삭제" kind="danger" onPress={remove} style={{ marginTop: 10 }} />}
      </ScrollView>
      <DatePickerSheet visible={dateOpen} value={n.date} weekStart={data.settings.weekStart} onClose={() => setDateOpen(false)} onPick={(k) => setN({ ...n, date: k })} />
    </>
  );
}

export function NoteEditorProvider({ children }: { children: React.ReactNode }) {
  const { data } = useStore();
  const [cur, setCur] = useState<Note | null>(null);
  const open = useCallback((p?: Partial<Note>) => {
    const existing = p?.id ? data.notes.find((x) => x.id === p.id) : undefined;
    setCur(existing ?? { id: uid(), title: '', body: '', date: null, color: NOTE_COLORS[0], pinned: false, updatedAt: Date.now(), ...p });
  }, [data.notes]);
  return (
    <NoteCtx.Provider value={open}>
      {children}
      <Sheet visible={!!cur} onClose={() => setCur(null)} title="메모" full>
        {cur && <NoteEditor key={cur.id} initial={cur} onClose={() => setCur(null)} />}
      </Sheet>
    </NoteCtx.Provider>
  );
}

export function NotesScreen() {
  const t = useTheme();
  const { data } = useStore();
  const open = useNoteEditor();
  const [q, setQ] = useState('');
  const notes = useMemo(() => {
    const qq = q.trim().toLowerCase();
    return data.notes
      .filter((n) => !qq || n.title.toLowerCase().includes(qq) || n.body.toLowerCase().includes(qq))
      .sort((a, b) => Number(b.pinned) - Number(a.pinned) || b.updatedAt - a.updatedAt);
  }, [data.notes, q]);

  return (
    <View style={{ flex: 1 }}>
      <FlatList
        data={notes}
        keyExtractor={(n) => n.id}
        numColumns={2}
        columnWrapperStyle={{ gap: 10, paddingHorizontal: 16 }}
        contentContainerStyle={{ gap: 10, paddingBottom: 110 }}
        keyboardShouldPersistTaps="handled"
        ListHeaderComponent={
          <View>
            <ScreenHeader title="메모" subtitle={`${data.notes.length}개의 메모`} />
            <View style={{ paddingHorizontal: 16 }}>
              <Field value={q} onChangeText={setQ} placeholder="🔍 메모 검색" style={{ paddingVertical: 10 }} />
            </View>
          </View>
        }
        renderItem={({ item: n }) => (
          <Pressable onPress={() => open(n)} style={({ pressed }) => [st.note, { backgroundColor: t.dark ? NOTE_COLORS_DARK[n.color] ?? t.card : n.color, opacity: pressed ? 0.85 : 1 }]}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 4 }}>
              <Text style={{ color: t.text, fontWeight: '800', fontSize: 15, flex: 1 }} numberOfLines={2}>{n.title || '제목 없음'}</Text>
              {n.pinned ? <Text>📌</Text> : null}
            </View>
            <Text style={{ color: t.sub, fontSize: 13, marginTop: 6, lineHeight: 19 }} numberOfLines={6}>{n.body}</Text>
            <Text style={{ color: t.faint, fontSize: 11, marginTop: 'auto', paddingTop: 8 }}>
              {n.date ? `📅 ${formatDue(n.date)}` : new Date(n.updatedAt).toLocaleDateString('ko-KR')}
            </Text>
          </Pressable>
        )}
        ListEmptyComponent={<Empty emoji="🗒" title={q ? '검색 결과가 없어요' : '메모가 없어요'} desc="떠오르는 생각을 바로 적어 두세요" />}
      />
      <Fab onPress={() => open({})} />
    </View>
  );
}

const st = StyleSheet.create({
  swatch: { width: 36, height: 36, borderRadius: 18 },
  note: { flex: 1, minHeight: 150, borderRadius: 16, padding: 14, maxWidth: '48.6%' },
});

