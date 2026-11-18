import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { parsePhrase } from '../domain/phrase';
import { parseAmount, fmt, getCurrency } from '../domain/money';

const groupDigits = (s: string) => { const [i, f] = s.split('.'); return i.replace(/\B(?=(\d{3})+(?!\d))/g, ',') + (f !== undefined ? '.' + f : ''); };
import { addDays, formatDate, todayKey } from '../domain/date';
import { useStore } from '../store';
import { tint, useTheme } from '../theme';
import type { Transaction, TxType } from '../domain/types';
import { DatePickerSheet } from './Pickers';
import { Button, Chip, ChipRow, Label, Segmented, Sheet, tap } from './ui';

interface Draft {
  type: TxType;
  amountText: string;
  date: string;
  accountId: string | null;
  toAccountId: string | null;
  categoryId: string | null;
  installments: number;
  note: string;
}

const INSTALLMENTS = [1, 2, 3, 6, 10, 12, 24];
const EXAMPLES = ['점심 12000 체크카드', '어제 택시 15000 현금', 'TV 48만 10개월 할부 신용카드', '월급 320만 입금', '통장에서 현금으로 5만 이체'];

function Editor({ initial, editing, onClose }: { initial: Draft & { phrase?: string }; editing: Transaction | null; onClose: () => void }) {
  const t = useTheme();
  const { data, addEntry, updateTx, deleteTx } = useStore();
  const [phrase, setPhrase] = useState(initial.phrase ?? '');
  const [d, setD] = useState<Draft>(initial);
  const [dateOpen, setDateOpen] = useState(false);
  const touched = useRef(new Set<keyof Draft>());
  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => { touched.current.add(k); setD((p) => ({ ...p, [k]: v })); };
  const accounts = data.accounts.filter((a) => !a.archived);
  const acc = accounts.find((a) => a.id === d.accountId);
  const cats = data.categories.filter((c) => c.type === (d.type === 'income' ? 'income' : 'expense'));

  // 문장 → 칸 채우기 (사용자가 직접 바꾼 칸은 덮어쓰지 않음)
  const applyPhrase = useCallback((text: string) => {
    if (!text.trim()) return;
    const r = parsePhrase(text, data.accounts, data.categories);
    setD((p) => {
      const n = { ...p };
      const keep = touched.current;
      if (!keep.has('type')) n.type = r.type;
      if (!keep.has('amountText') && r.amount !== null) n.amountText = String(r.amount);
      if (!keep.has('date')) n.date = r.date;
      if (!keep.has('accountId') && r.accountId) n.accountId = r.accountId;
      if (!keep.has('toAccountId') && r.toAccountId) n.toAccountId = r.toAccountId;
      if (!keep.has('categoryId') && r.categoryId) n.categoryId = r.categoryId;
      if (!keep.has('installments')) n.installments = r.installments;
      if (!keep.has('note')) n.note = r.note;
      return n;
    });
  }, [data.accounts, data.categories]);
  useEffect(() => { if (initial.phrase) applyPhrase(initial.phrase); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const amount = parseAmount(d.amountText);
  const canInstall = d.type === 'expense' && acc?.kind === 'card' && !editing;

  const save = () => {
    if (!amount || amount <= 0) return Alert.alert('금액을 입력해 주세요');
    if (!d.accountId) return Alert.alert('계좌를 골라 주세요');
    if (d.type === 'transfer' && (!d.toAccountId || d.toAccountId === d.accountId)) return Alert.alert('받는 계좌를 골라 주세요');
    if (editing) {
      updateTx({
        ...editing, type: d.type, amount: editing.installment ? editing.amount : amount, date: d.date, accountId: d.accountId,
        toAccountId: d.type === 'transfer' ? d.toAccountId : null, categoryId: d.type === 'transfer' ? null : d.categoryId, note: d.note.trim(),
      });
    } else {
      addEntry({
        type: d.type, amount, date: d.date, accountId: d.accountId, toAccountId: d.toAccountId, categoryId: d.categoryId ?? (d.type === 'income' ? 'income_etc' : d.type === 'expense' ? 'etc' : null),
        note: d.note, installments: canInstall ? d.installments : 1,
      });
    }
    tap();
    onClose();
  };

  const remove = () => {
    if (!editing) return;
    const go = (whole: boolean) => { deleteTx(editing.id, whole); onClose(); };
    if (Platform.OS === 'web') return go(false);
    if (editing.installment) {
      Alert.alert('할부 기록 삭제', `${editing.installment.count}개월 할부 중 하나예요.`, [
        { text: '취소', style: 'cancel' },
        { text: '이 회차만', onPress: () => go(false) },
        { text: '할부 전체', style: 'destructive', onPress: () => go(true) },
      ]);
    } else {
      Alert.alert('기록 삭제', '이 기록을 삭제할까요?', [{ text: '취소', style: 'cancel' }, { text: '삭제', style: 'destructive', onPress: () => go(false) }]);
    }
  };

  const today = todayKey();
  const per = canInstall && amount && d.installments > 1 ? Math.floor(amount / d.installments) : 0;

  return (
    <>
      <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 24 }} keyboardShouldPersistTaps="handled">
        {!editing && (
          <>
            <View style={[st.phraseBox, { backgroundColor: t.primarySoft }]}>
              <Ionicons name="sparkles" size={18} color={t.primaryInk} />
              <TextInput
                value={phrase}
                onChangeText={(v) => { setPhrase(v); applyPhrase(v); }}
                placeholder="예: 점심 12000 체크카드"
                placeholderTextColor={t.faint}
                autoFocus
                style={{ flex: 1, color: t.text, fontSize: 17, fontWeight: '600', paddingVertical: 12 }}
                returnKeyType="done"
                onSubmitEditing={save}
              />
            </View>
            <Text style={{ color: t.sub, fontSize: 12, marginTop: 8, lineHeight: 17 }}>
              문장으로 쓰면 아래 칸이 자동으로 채워져요. 키보드의 🎤 마이크 버튼으로 말해도 돼요.
            </Text>
            {!phrase && (
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 10 }}>
                {EXAMPLES.map((e) => (
                  <Pressable key={e} onPress={() => { setPhrase(e); applyPhrase(e); }} style={[st.example, { borderColor: t.border }]}>
                    <Text style={{ color: t.sub, fontSize: 12.5 }}>{e}</Text>
                  </Pressable>
                ))}
              </View>
            )}
          </>
        )}

        <View style={{ marginTop: 18 }}>
          <Segmented<TxType> value={d.type} onChange={(v) => { set('type', v); if (v !== 'transfer') set('categoryId', null); }} options={[
            { value: 'expense', label: '지출' }, { value: 'income', label: '수입' }, { value: 'transfer', label: '이체' },
          ]} />
        </View>

        <View style={[st.amountRow, { borderBottomColor: t.border }]}>
          <TextInput
            value={d.amountText ? groupDigits(d.amountText) : ''}
            onChangeText={(v) => set('amountText', v.replace(/[^\d.]/g, ''))}
            placeholder="0"
            placeholderTextColor={t.faint}
            keyboardType="numeric"
            style={{ flex: 1, minWidth: 0, color: d.type === 'income' ? t.success : t.text, fontSize: 32, fontWeight: '800', letterSpacing: -0.8, paddingVertical: 6 }}
          />
          <Text style={{ color: t.sub, fontSize: 18, fontWeight: '600' }}>{getCurrency() === 'KRW' ? '원' : getCurrency()}</Text>
        </View>

        <Label icon="calendar-clear-outline">날짜</Label>
        <ChipRow>
          <Chip label="오늘" active={d.date === today} onPress={() => set('date', today)} />
          <Chip label="어제" active={d.date === addDays(today, -1)} onPress={() => set('date', addDays(today, -1))} />
          <Chip icon="calendar-outline" label={d.date !== today && d.date !== addDays(today, -1) ? formatDate(d.date) : '직접 선택'}
            active={d.date !== today && d.date !== addDays(today, -1)} onPress={() => setDateOpen(true)} />
        </ChipRow>

        <Label icon="wallet-outline">{d.type === 'transfer' ? '보내는 계좌' : d.type === 'income' ? '받는 계좌' : '결제 수단'}</Label>
        <ChipRow>
          {accounts.map((a) => <Chip key={a.id} label={a.name} color={a.color} active={d.accountId === a.id} onPress={() => set('accountId', a.id)} />)}
        </ChipRow>

        {d.type === 'transfer' ? (
          <>
            <Label icon="arrow-forward">받는 계좌</Label>
            <ChipRow>
              {accounts.filter((a) => a.id !== d.accountId).map((a) => (
                <Chip key={a.id} label={a.kind === 'card' ? `${a.name} (대금 납부)` : a.name} color={a.color} active={d.toAccountId === a.id} onPress={() => set('toAccountId', a.id)} />
              ))}
            </ChipRow>
          </>
        ) : (
          <>
            <Label icon="pricetags-outline">카테고리</Label>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
              {cats.map((c) => <Chip key={c.id} icon={c.icon as any} label={c.name} color={c.color} active={d.categoryId === c.id} onPress={() => set('categoryId', c.id)} />)}
            </View>
          </>
        )}

        {canInstall && (
          <>
            <Label icon="layers-outline">할부</Label>
            <ChipRow>
              {INSTALLMENTS.map((n) => <Chip key={n} label={n === 1 ? '일시불' : `${n}개월`} active={d.installments === n} onPress={() => set('installments', n)} />)}
            </ChipRow>
            {per ? <Text style={{ color: t.sub, fontSize: 12.5, marginTop: 8 }}>매달 약 {fmt(per)}씩 {d.installments}번, 회차마다 맞는 카드 청구서에 들어가요.</Text> : null}
          </>
        )}

        <Label icon="create-outline">메모</Label>
        <TextInput value={d.note} onChangeText={(v) => set('note', v)} placeholder="무엇에 썼나요?" placeholderTextColor={t.faint}
          style={[st.note, { backgroundColor: t.fill, color: t.text }]} />

        {editing?.installment ? (
          <Text style={{ color: t.sub, fontSize: 12.5, marginTop: 10 }}>할부 {editing.installment.index}/{editing.installment.count}회차 (전체 {fmt(editing.installment.total)}) · 금액은 할부 전체를 지우고 다시 기록해 주세요.</Text>
        ) : null}

        <Button label={editing ? '저장' : '기록하기'} icon="checkmark" onPress={save} style={{ marginTop: 22 }} />
        {editing && <Button label="삭제" kind="danger" onPress={remove} style={{ marginTop: 10 }} />}
      </ScrollView>
      <DatePickerSheet visible={dateOpen} value={d.date} weekStart={0} onClose={() => setDateOpen(false)} onPick={(k) => k && set('date', k)} />
    </>
  );
}

interface EntryApi { openEntry: (phrase?: string, preset?: Partial<Draft>) => void; editTx: (t: Transaction) => void }
const Ctx = createContext<EntryApi | null>(null);

export function EntryProvider({ children }: { children: React.ReactNode }) {
  const { data } = useStore();
  const [state, setState] = useState<{ key: number; initial: Draft & { phrase?: string }; editing: Transaction | null } | null>(null);
  const defaultAcc = data.settings.defaultAccountId ?? data.accounts.find((a) => !a.archived)?.id ?? null;

  const api = useMemo<EntryApi>(() => ({
    openEntry: (phrase, preset) => setState({
      key: Date.now(), editing: null,
      initial: { type: 'expense', amountText: '', date: todayKey(), accountId: defaultAcc, toAccountId: null, categoryId: null, installments: 1, note: '', ...preset, phrase },
    }),
    editTx: (tx) => setState({
      key: Date.now(), editing: tx,
      initial: { type: tx.type, amountText: String(tx.amount), date: tx.date, accountId: tx.accountId, toAccountId: tx.toAccountId ?? null, categoryId: tx.categoryId, installments: 1, note: tx.note },
    }),
  }), [defaultAcc]);

  return (
    <Ctx.Provider value={api}>
      {children}
      <Sheet visible={!!state} onClose={() => setState(null)} title={state?.editing ? '기록 수정' : '빠른 기록'} full>
        {state && <Editor key={state.key} initial={state.initial} editing={state.editing} onClose={() => setState(null)} />}
      </Sheet>
    </Ctx.Provider>
  );
}

export const useEntry = () => {
  const c = useContext(Ctx);
  if (!c) throw new Error('EntryProvider missing');
  return c;
};

const st = StyleSheet.create({
  phraseBox: { flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 18, paddingHorizontal: 16 },
  example: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5 },
  amountRow: { flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1.5, marginTop: 14 },
  note: { borderRadius: 14, paddingHorizontal: 14, paddingVertical: 12, fontSize: 16 },
});

