import React, { useMemo, useState } from 'react';
import { Alert, Platform, Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { uid, useLookup, useStore } from '../store';
import { tint, useTheme } from '../theme';
import { fmt, parseAmount } from '../domain/money';
import { addMonthsYM, daysInMonth, formatDate, formatYM, fromKey, monthOf, monthsBetween, thisMonth, todayKey } from '../domain/date';
import { cardStatus, monthSummary } from '../domain/ledger';
import { detectRecurring } from '../domain/engine';
import { debtSummary, payoffPlan } from '../domain/debts';
import { INK } from '../domain/defaults';
import type { Debt, Goal, Recurring } from '../domain/types';
import { useEntry } from '../components/EntrySheet';
import { Bar, IconBubble, TxRow } from '../components/bits';
import { DatePickerSheet } from '../components/Pickers';
import { Button, Card, Chip, ChipRow, Empty, Fab, Field, Label, ScreenHeader, SectionTitle, Segmented, Sheet } from '../components/ui';

export type PlanTab = 'budget' | 'goals' | 'fixed' | 'debts' | 'cards';
const confirm = (title: string, msg: string, go: () => void) => {
  if (Platform.OS === 'web') return go();
  Alert.alert(title, msg, [{ text: '취소', style: 'cancel' }, { text: '삭제', style: 'destructive', onPress: go }]);
};
const PASTEL_INKS = Object.values(INK);

// ───────── 예산 ─────────
function Budgets() {
  const t = useTheme();
  const { data, setBudget } = useStore();
  const look = useLookup();
  const [edit, setEdit] = useState<{ categoryId: string | null; amount: string } | null>(null);
  const ym = thisMonth();
  const s = useMemo(() => monthSummary(data.transactions, ym), [data.transactions, ym]);
  const pace = fromKey(todayKey()).getDate() / daysInMonth(ym);
  const total = data.budgets.reduce((x, b) => x + b.amount, 0);
  const used = data.budgets.reduce((x, b) => x + (s.byCategory[b.categoryId] ?? 0), 0);
  return (
    <View style={{ paddingHorizontal: 16, gap: 10 }}>
      {data.budgets.length > 0 && (
        <Card>
          <Text style={{ color: t.sub, fontSize: 13 }}>{formatYM(ym)} 예산</Text>
          <Text style={{ color: t.text, fontSize: 22, fontWeight: '800', marginTop: 2 }}>{fmt(used)} <Text style={{ color: t.sub, fontSize: 15, fontWeight: '500' }}>/ {fmt(total)}</Text></Text>
          <View style={{ marginTop: 10 }}><Bar value={total ? used / total : 0} color={used > total ? t.danger : t.primary} /></View>
          <Text style={{ color: t.sub, fontSize: 12.5, marginTop: 8 }}>이번 달 {Math.round(pace * 100)}% 지남 · 남은 예산 {fmt(Math.max(0, total - used))}</Text>
        </Card>
      )}
      {data.budgets.map((b) => {
        const c = look.category[b.categoryId];
        const spent = s.byCategory[b.categoryId] ?? 0;
        const ratio = spent / b.amount;
        const color = ratio > 1 ? t.danger : ratio > pace + 0.15 ? t.warn : (c ? tint(t, c.color).ink : t.primary);
        return (
          <Card key={b.categoryId} onPress={() => setEdit({ categoryId: b.categoryId, amount: String(b.amount) })}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <IconBubble icon={(c?.icon ?? 'pricetag-outline') as any} color={c?.color ?? INK.stone} />
              <View style={{ flex: 1 }}>
                <Text style={{ color: t.text, fontWeight: '700', fontSize: 15.5 }}>{c?.name ?? '카테고리'}</Text>
                <Text style={{ color: t.sub, fontSize: 12.5 }}>{fmt(spent)} / {fmt(b.amount)}</Text>
              </View>
              <Text style={{ color, fontWeight: '800' }}>{ratio > 1 ? `${fmt(spent - b.amount, { compact: true })} 초과` : `${fmt(b.amount - spent, { compact: true })} 남음`}</Text>
            </View>
            <View style={{ marginTop: 12 }}>
              <Bar value={ratio} color={color} />
              <View style={[st.paceMark, { left: `${Math.min(100, pace * 100)}%`, backgroundColor: t.text }]} />
            </View>
          </Card>
        );
      })}
      {data.budgets.length === 0 && <Empty icon="pie-chart-outline" title="카테고리별 월 예산을 정해 보세요" desc="쓰는 속도가 빠르면 미리 알려 드려요" />}
      <Button label="예산 추가" icon="add" kind="ghost" onPress={() => setEdit({ categoryId: null, amount: '' })} />
      <Sheet visible={!!edit} onClose={() => setEdit(null)} title="예산">
        {edit && (
          <View style={{ paddingHorizontal: 20 }}>
            <Label icon="pricetags-outline">카테고리</Label>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
              {data.categories.filter((c) => c.type === 'expense').map((c) => (
                <Chip key={c.id} label={c.name} icon={c.icon as any} color={c.color} active={edit.categoryId === c.id} onPress={() => setEdit({ ...edit, categoryId: c.id, amount: edit.amount || String(data.budgets.find((b) => b.categoryId === c.id)?.amount ?? '') })} />
              ))}
            </View>
            <Label icon="cash-outline">한 달 예산</Label>
            <Field value={edit.amount} onChangeText={(v) => setEdit({ ...edit, amount: v })} keyboardType="numeric" placeholder="예: 300000 또는 30만" />
            <Button label="저장" style={{ marginTop: 18 }} disabled={!edit.categoryId || !parseAmount(edit.amount)} onPress={() => { setBudget({ categoryId: edit.categoryId!, amount: parseAmount(edit.amount)! }); setEdit(null); }} />
            {data.budgets.some((b) => b.categoryId === edit.categoryId) && (
              <Button label="예산 지우기" kind="danger" style={{ marginTop: 10 }} onPress={() => { setBudget({ categoryId: edit.categoryId!, amount: 0 }); setEdit(null); }} />
            )}
          </View>
        )}
      </Sheet>
    </View>
  );
}

// ───────── 저축 목표 ─────────
function Goals() {
  const t = useTheme();
  const { data, saveGoal, deleteGoal } = useStore();
  const [g, setG] = useState<(Goal & { targetText: string; savedText: string }) | null>(null);
  const [deposit, setDeposit] = useState<{ goal: Goal; text: string } | null>(null);
  const [dateOpen, setDateOpen] = useState(false);
  const ym = thisMonth();
  return (
    <View style={{ paddingHorizontal: 16, gap: 10 }}>
      {data.goals.map((x) => {
        const p = tint(t, x.color);
        const left = Math.max(0, x.target - x.saved);
        const months = x.deadline ? Math.max(1, monthsBetween(ym, monthOf(x.deadline)) + (x.deadline.slice(8) >= '15' ? 1 : 0)) : null;
        return (
          <Card key={x.id} style={{ backgroundColor: p.bg, shadowOpacity: 0, elevation: 0 }} onPress={() => setG({ ...x, targetText: String(x.target), savedText: String(x.saved) })}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Text style={{ color: t.text, fontWeight: '800', fontSize: 16, flex: 1 }}>{x.name}</Text>
              <Text style={{ color: p.ink, fontWeight: '800', fontSize: 16 }}>{Math.round((x.saved / Math.max(1, x.target)) * 100)}%</Text>
            </View>
            <Text style={{ color: t.sub, fontSize: 13, marginTop: 4 }}>{fmt(x.saved)} / {fmt(x.target)}{x.deadline ? ` · ${formatDate(x.deadline)}까지` : ''}</Text>
            <View style={{ marginTop: 12 }}><Bar value={x.saved / Math.max(1, x.target)} color={p.ink} track={t.dark ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.85)'} /></View>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 12 }}>
              <Text style={{ color: p.ink, fontWeight: '700', flex: 1, fontSize: 13 }}>
                {left === 0 ? '목표 달성! 🎉' : months ? `매달 ${fmt(Math.ceil(left / months / 1000) * 1000)}씩 모으면 돼요` : `${fmt(left)} 남았어요`}
              </Text>
              {left > 0 && (
                <Pressable onPress={() => setDeposit({ goal: x, text: '' })} style={[st.smallBtn, { backgroundColor: t.dark ? 'rgba(255,255,255,0.08)' : '#fff' }]}>
                  <Text style={{ color: p.ink, fontWeight: '700', fontSize: 13 }}>+ 모으기</Text>
                </Pressable>
              )}
            </View>
          </Card>
        );
      })}
      {data.goals.length === 0 && <Empty icon="flag-outline" title="저축 목표를 만들어 보세요" desc="기한을 정하면 매달 얼마씩 모으면 되는지 알려 드려요" />}
      <Button label="목표 추가" icon="add" kind="ghost" onPress={() => setG({ id: uid(), name: '', target: 0, saved: 0, deadline: null, color: PASTEL_INKS[data.goals.length % PASTEL_INKS.length], createdAt: Date.now(), targetText: '', savedText: '' })} />

      <Sheet visible={!!g} onClose={() => setG(null)} title="저축 목표">
        {g && (
          <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 10 }} keyboardShouldPersistTaps="handled">
            <Label>이름</Label>
            <Field value={g.name} onChangeText={(v) => setG({ ...g, name: v })} placeholder="예: 여행 자금, 비상금" />
            <Label>목표 금액</Label>
            <Field value={g.targetText} onChangeText={(v) => setG({ ...g, targetText: v })} keyboardType="numeric" placeholder="예: 200만" />
            <Label>지금까지 모은 돈</Label>
            <Field value={g.savedText} onChangeText={(v) => setG({ ...g, savedText: v })} keyboardType="numeric" placeholder="0" />
            <Label>기한</Label>
            <ChipRow>
              <Chip icon="calendar-outline" label={g.deadline ? formatDate(g.deadline) : '날짜 선택'} active={!!g.deadline} onPress={() => setDateOpen(true)} />
              {g.deadline ? <Chip label="기한 없음" onPress={() => setG({ ...g, deadline: null })} /> : null}
            </ChipRow>
            <Label>색</Label>
            <View style={{ flexDirection: 'row', gap: 10 }}>
              {PASTEL_INKS.map((c) => <Pressable key={c} onPress={() => setG({ ...g, color: c })} style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: tint(t, c).bg, borderWidth: g.color === c ? 3 : 1, borderColor: g.color === c ? c : t.border }} />)}
            </View>
            <Button label="저장" style={{ marginTop: 20 }} disabled={!g.name.trim() || !parseAmount(g.targetText)} onPress={() => {
              const { targetText, savedText, ...rest } = g;
              saveGoal({ ...rest, name: g.name.trim(), target: parseAmount(targetText)!, saved: parseAmount(savedText) ?? 0 });
              setG(null);
            }} />
            {data.goals.some((x) => x.id === g.id) && <Button label="목표 삭제" kind="danger" style={{ marginTop: 10 }} onPress={() => confirm('목표 삭제', '이 목표를 삭제할까요?', () => { deleteGoal(g.id); setG(null); })} />}
          </ScrollView>
        )}
      </Sheet>
      <DatePickerSheet visible={dateOpen} value={g?.deadline ?? null} weekStart={0} onClose={() => setDateOpen(false)} onPick={(k) => g && setG({ ...g, deadline: k })} />
      <Sheet visible={!!deposit} onClose={() => setDeposit(null)} title={deposit ? `${deposit.goal.name}에 모으기` : ''}>
        {deposit && (
          <View style={{ paddingHorizontal: 20 }}>
            <Field value={deposit.text} onChangeText={(v) => setDeposit({ ...deposit, text: v })} keyboardType="numeric" placeholder="얼마를 모았나요?" autoFocus />
            <Button label="더하기" style={{ marginTop: 14 }} disabled={!parseAmount(deposit.text)} onPress={() => { saveGoal({ ...deposit.goal, saved: deposit.goal.saved + parseAmount(deposit.text)! }); setDeposit(null); }} />
          </View>
        )}
      </Sheet>
    </View>
  );
}

// ───────── 고정 수입·지출 ─────────
function Fixed() {
  const t = useTheme();
  const { data, saveRecurring, deleteRecurring, addEntry } = useStore();
  const look = useLookup();
  const [r, setR] = useState<(Recurring & { amountText: string }) | null>(null);
  const today = todayKey();
  const detected = useMemo(() => detectRecurring(data, today).filter((d) => !data.recurring.some((x) => x.name.replace(/\s/g, '') === d.name.replace(/\s/g, ''))), [data, today]);
  const ym = thisMonth();
  const recorded = (x: Recurring) => data.transactions.some((tx) => tx.recurringId === x.id && monthOf(tx.date) === ym) ||
    data.transactions.some((tx) => monthOf(tx.date) === ym && tx.note.replace(/\s/g, '') === x.name.replace(/\s/g, '') && Math.abs(tx.amount - x.amount) <= x.amount * 0.2);
  const KIND: Record<string, string> = { salary: '급여', rent: '월세', subscription: '구독', bill: '고정 지출', income: '고정 수입' };
  const blank = (): Recurring & { amountText: string } => ({ id: uid(), name: '', type: 'expense', amount: 0, categoryId: null, accountId: data.settings.defaultAccountId ?? data.accounts[0]?.id, day: 1, remind: true, active: true, amountText: '' });
  const monthlyIn = data.recurring.filter((x) => x.active && x.type === 'income').reduce((s, x) => s + x.amount, 0);
  const monthlyOut = data.recurring.filter((x) => x.active && x.type === 'expense').reduce((s, x) => s + x.amount, 0);

  return (
    <View style={{ paddingHorizontal: 16, gap: 10 }}>
      {data.recurring.length > 0 && (
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <Card style={{ flex: 1 }}><Text style={{ color: t.sub, fontSize: 12.5 }}>매달 들어오는 돈</Text><Text style={{ color: t.success, fontWeight: '800', fontSize: 17, marginTop: 2 }}>{fmt(monthlyIn)}</Text></Card>
          <Card style={{ flex: 1 }}><Text style={{ color: t.sub, fontSize: 12.5 }}>매달 나가는 돈</Text><Text style={{ color: t.text, fontWeight: '800', fontSize: 17, marginTop: 2 }}>{fmt(monthlyOut)}</Text></Card>
        </View>
      )}
      {data.recurring.map((x) => {
        const done = recorded(x);
        const c = x.categoryId ? look.category[x.categoryId] : undefined;
        return (
          <Card key={x.id} onPress={() => setR({ ...x, amountText: String(x.amount) })}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <IconBubble icon={(c?.icon ?? 'repeat') as any} color={c?.color ?? INK.lavender} />
              <View style={{ flex: 1 }}>
                <Text style={{ color: t.text, fontWeight: '700', fontSize: 15.5 }}>{x.name}</Text>
                <Text style={{ color: t.sub, fontSize: 12.5 }}>매달 {x.day}일 · {look.account[x.accountId]?.name ?? ''}{x.remind ? ' · 🔔' : ''}</Text>
              </View>
              <Text style={{ color: x.type === 'income' ? t.success : t.text, fontWeight: '800' }}>{fmt(x.type === 'income' ? x.amount : -x.amount)}</Text>
            </View>
            <View style={{ flexDirection: 'row', justifyContent: 'flex-end', marginTop: 10 }}>
              {done ? (
                <Text style={{ color: t.success, fontWeight: '700', fontSize: 13 }}>✓ 이번 달 기록됨</Text>
              ) : (
                <Pressable onPress={() => addEntry({ type: x.type, amount: x.amount, date: today, accountId: x.accountId, categoryId: x.categoryId, note: x.name, recurringId: x.id })}
                  style={[st.smallBtn, { backgroundColor: t.primarySoft }]}>
                  <Text style={{ color: t.primaryInk, fontWeight: '700', fontSize: 13 }}>오늘 날짜로 기록</Text>
                </Pressable>
              )}
            </View>
          </Card>
        );
      })}
      {detected.length > 0 && (
        <>
          <SectionTitle>자동으로 찾은 고정 항목</SectionTitle>
          <Card style={{ padding: 6 }}>
            {detected.map((d) => (
              <View key={d.key} style={st.detRow}>
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Text style={{ color: t.text, fontWeight: '700' }}>{d.name}</Text>
                    <View style={[st.tag, { backgroundColor: tint(t, d.type === 'income' ? INK.mint : INK.lavender).bg }]}>
                      <Text style={{ color: tint(t, d.type === 'income' ? INK.mint : INK.lavender).ink, fontSize: 11, fontWeight: '700' }}>{KIND[d.kind]}</Text>
                    </View>
                  </View>
                  <Text style={{ color: t.sub, fontSize: 12.5 }}>매달 {d.day}일쯤 · {fmt(d.amount)} · {d.months}개월 연속</Text>
                </View>
                <Pressable onPress={() => saveRecurring({ id: uid(), name: d.name, type: d.type, amount: d.amount, categoryId: d.categoryId, accountId: d.accountId, day: d.day, remind: true, active: true })}
                  style={[st.smallBtn, { backgroundColor: t.primarySoft }]}>
                  <Text style={{ color: t.primaryInk, fontWeight: '700', fontSize: 13 }}>등록</Text>
                </Pressable>
              </View>
            ))}
          </Card>
        </>
      )}
      {data.recurring.length === 0 && detected.length === 0 && <Empty icon="repeat" title="월세·구독·급여를 등록해 보세요" desc="납부일에 알림을 드리고, 3달 이상 기록되면 자동으로 찾아 드려요" />}
      <Button label="고정 항목 추가" icon="add" kind="ghost" onPress={() => setR(blank())} />

      <Sheet visible={!!r} onClose={() => setR(null)} title="고정 수입·지출" full>
        {r && (
          <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 20 }} keyboardShouldPersistTaps="handled">
            <Segmented value={r.type} onChange={(v) => setR({ ...r, type: v, categoryId: null })} options={[{ value: 'expense', label: '지출' }, { value: 'income', label: '수입' }]} />
            <Label>이름</Label>
            <Field value={r.name} onChangeText={(v) => setR({ ...r, name: v })} placeholder="예: 월세, 넷플릭스, 월급" />
            <Label>금액</Label>
            <Field value={r.amountText} onChangeText={(v) => setR({ ...r, amountText: v })} keyboardType="numeric" placeholder="예: 17000" />
            <Label>매달 며칠</Label>
            <ChipRow>
              {[1, 5, 10, 14, 15, 20, 25, 28].map((n) => <Chip key={n} label={`${n}일`} active={r.day === n} onPress={() => setR({ ...r, day: n })} />)}
            </ChipRow>
            <Label>계좌</Label>
            <ChipRow>{data.accounts.filter((a) => !a.archived).map((a) => <Chip key={a.id} label={a.name} color={a.color} active={r.accountId === a.id} onPress={() => setR({ ...r, accountId: a.id })} />)}</ChipRow>
            <Label>카테고리</Label>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
              {data.categories.filter((c) => c.type === r.type).map((c) => <Chip key={c.id} label={c.name} color={c.color} active={r.categoryId === c.id} onPress={() => setR({ ...r, categoryId: c.id })} />)}
            </View>
            <View style={[st.switchRow, { backgroundColor: t.fill }]}>
              <Ionicons name="notifications-outline" size={18} color={t.sub} />
              <Text style={{ color: t.text, flex: 1, fontSize: 15 }}>날짜 오전 9시에 알림</Text>
              <Switch value={r.remind} onValueChange={(v) => setR({ ...r, remind: v })} trackColor={{ true: t.primary, false: t.border }} thumbColor="#fff" />
            </View>
            <Button label="저장" style={{ marginTop: 20 }} disabled={!r.name.trim() || !parseAmount(r.amountText)} onPress={() => {
              const { amountText, ...rest } = r;
              saveRecurring({ ...rest, name: r.name.trim(), amount: parseAmount(amountText)! });
              setR(null);
            }} />
            {data.recurring.some((x) => x.id === r.id) && <Button label="삭제" kind="danger" style={{ marginTop: 10 }} onPress={() => confirm('고정 항목 삭제', '기록은 그대로 남아요.', () => { deleteRecurring(r.id); setR(null); })} />}
          </ScrollView>
        )}
      </Sheet>
    </View>
  );
}

// ───────── 빚 ─────────
const DEBT_KIND: Record<Debt['kind'], string> = { loan: '대출', financing: '할부 계약', agreement: '분할 합의', personal: '개인에게 빌린 돈' };

function Debts() {
  const t = useTheme();
  const { data, saveDebt, deleteDebt, addEntry } = useStore();
  const [form, setForm] = useState<(Debt & { principalText: string; installmentText: string; countText: string }) | null>(null);
  const [detail, setDetail] = useState<string | null>(null);
  const [extra, setExtra] = useState(100000);
  const [dateOpen, setDateOpen] = useState(false);
  const today = todayKey();
  const ym = thisMonth();
  const income = [1, 2, 3].map((i) => monthSummary(data.transactions, addMonthsYM(ym, -i)).income).filter(Boolean);
  const avgIncome = income.length ? income.reduce((a, b) => a + b, 0) / income.length : 0;
  const sums = data.debts.map((d) => ({ d, s: debtSummary(d, today) }));
  const active = sums.filter((x) => x.s.remainingCount > 0);
  const monthly = active.reduce((s, x) => s + x.d.installment, 0);
  const totalLeft = active.reduce((s, x) => s + x.s.remainingAmount, 0);
  const freeDate = active.map((x) => x.s.freeDate!).sort().pop();
  const plan = useMemo(() => payoffPlan(data.debts, extra, today), [data.debts, extra, today]);
  const cur = detail ? sums.find((x) => x.d.id === detail) : null;

  const markPaid = (d: Debt, n: number, paid: boolean) => {
    const next = { ...d, paid: paid ? [...new Set([...d.paid, n])] : d.paid.filter((x) => x !== n) };
    saveDebt(next);
    if (paid && Platform.OS !== 'web') {
      Alert.alert('지출로도 기록할까요?', `${d.name} ${n}회차 ${fmt(d.installment)}`, [
        { text: '아니요', style: 'cancel' },
        { text: '기록', onPress: () => addEntry({ type: 'expense', amount: d.installment, date: today, accountId: data.settings.defaultAccountId ?? data.accounts[0].id, categoryId: 'etc', note: `${d.name} ${n}회차` }) },
      ]);
    }
  };

  return (
    <View style={{ paddingHorizontal: 16, gap: 10 }}>
      {active.length > 0 && (
        <Card>
          <Text style={{ color: t.sub, fontSize: 13 }}>남은 빚</Text>
          <Text style={{ color: t.text, fontSize: 24, fontWeight: '800', marginTop: 2 }}>{fmt(totalLeft)}</Text>
          <View style={{ flexDirection: 'row', gap: 16, marginTop: 10, flexWrap: 'wrap' }}>
            <Text style={{ color: t.sub, fontSize: 13 }}>매달 <Text style={{ color: t.text, fontWeight: '700' }}>{fmt(monthly)}</Text></Text>
            {avgIncome > 0 && <Text style={{ color: t.sub, fontSize: 13 }}>수입의 <Text style={{ color: monthly / avgIncome > 0.3 ? t.danger : t.text, fontWeight: '700' }}>{Math.round((monthly / avgIncome) * 100)}%</Text></Text>}
            {freeDate && <Text style={{ color: t.sub, fontSize: 13 }}>다 갚는 날 <Text style={{ color: t.text, fontWeight: '700' }}>{formatYM(monthOf(freeDate))}</Text></Text>}
          </View>
        </Card>
      )}
      {sums.map(({ d, s }) => {
        const p = tint(t, s.lateCount ? INK.rose : INK.stone);
        return (
          <Card key={d.id} onPress={() => setDetail(d.id)}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Text style={{ color: t.text, fontWeight: '800', fontSize: 16, flex: 1 }}>{d.name}</Text>
              {s.lateCount > 0 && <View style={[st.tag, { backgroundColor: p.bg }]}><Text style={{ color: p.ink, fontSize: 11.5, fontWeight: '700' }}>{s.lateCount}회 연체</Text></View>}
              <Text style={{ color: t.sub, fontSize: 12.5 }}>{DEBT_KIND[d.kind]}</Text>
            </View>
            <Text style={{ color: t.sub, fontSize: 13, marginTop: 4 }}>{s.paidCount}/{d.count}회 · 남은 {fmt(s.remainingAmount)}{s.next ? ` · 다음 ${formatDate(s.next.date)}` : ''}</Text>
            <View style={{ marginTop: 10 }}><Bar value={s.progress} color={t.primary} /></View>
            {s.annualRate > 0 && <Text style={{ color: t.sub, fontSize: 12.5, marginTop: 8 }}>숨은 이자 연 {(s.annualRate * 100).toFixed(1)}% · 총 이자 {fmt(s.totalInterest)}</Text>}
          </Card>
        );
      })}
      {active.length > 0 && plan.order.length > 0 && (
        <Card style={{ backgroundColor: tint(t, INK.lavender).bg, shadowOpacity: 0, elevation: 0 }}>
          <Text style={{ color: tint(t, INK.lavender).ink, fontWeight: '800', fontSize: 15 }}>상환 계획</Text>
          <Text style={{ color: t.text, marginTop: 6, lineHeight: 20 }}>이자가 높은 순서로 먼저 갚는 게 가장 아껴요:{'\n'}{plan.order.map((o, i) => `${i + 1}. ${o.name}${o.annualRate ? ` (연 ${(o.annualRate * 100).toFixed(1)}%)` : ''}`).join('\n')}</Text>
          <Text style={{ color: t.sub, fontSize: 13, marginTop: 10 }}>매달 더 갚으면</Text>
          <ChipRow>{[50000, 100000, 300000, 500000].map((v) => <Chip key={v} label={fmt(v, { compact: true })} active={extra === v} onPress={() => setExtra(v)} />)}</ChipRow>
          <Text style={{ color: t.text, fontWeight: '700', marginTop: 10 }}>
            {plan.monthsSaved > 0 ? `${plan.monthsSaved}개월 빨리 끝나고 이자 ${fmt(Math.round(plan.interestSaved / 100) * 100)}을 아껴요` : '이자가 없는 빚이라 일찍 갚아도 이자는 같아요'}
          </Text>
        </Card>
      )}
      {data.debts.length === 0 && <Empty icon="document-text-outline" title="대출·할부 계약을 따로 관리해요" desc="남은 금액, 연체, 숨은 이자, 다 갚는 날을 알려 드려요" />}
      <Button label="빚 추가" icon="add" kind="ghost" onPress={() => setForm({ id: uid(), name: '', kind: 'loan', principal: 0, installment: 0, count: 12, firstDue: today, paid: [], remind: true, createdAt: Date.now(), principalText: '', installmentText: '', countText: '12' })} />

      <Sheet visible={!!cur} onClose={() => setDetail(null)} title={cur?.d.name} full right={cur ? <Pressable onPress={() => { const d = cur.d; setDetail(null); setForm({ ...d, principalText: String(d.principal), installmentText: String(d.installment), countText: String(d.count) }); }}><Text style={{ color: t.primary, fontSize: 15 }}>편집</Text></Pressable> : undefined}>
        {cur && (
          <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 20 }}>
            <Text style={{ color: t.sub, marginBottom: 8, paddingHorizontal: 4 }}>회차를 눌러 납부 여부를 바꿔요</Text>
            {cur.s.schedule.map((x) => (
              <Pressable key={x.n} onPress={() => markPaid(cur.d, x.n, !x.paid)} style={[st.schedRow, { borderBottomColor: t.separator }]}>
                <Ionicons name={x.paid ? 'checkmark-circle' : x.late ? 'alert-circle' : 'ellipse-outline'} size={22} color={x.paid ? t.success : x.late ? t.danger : t.faint} />
                <Text style={{ color: t.text, flex: 1 }}>{x.n}회차 · {formatDate(x.date)}</Text>
                <Text style={{ color: x.late ? t.danger : t.sub, fontWeight: '600' }}>{x.paid ? '납부' : x.late ? '연체' : fmt(cur.d.installment)}</Text>
              </Pressable>
            ))}
          </ScrollView>
        )}
      </Sheet>

      <Sheet visible={!!form} onClose={() => setForm(null)} title="빚" full>
        {form && (
          <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 20 }} keyboardShouldPersistTaps="handled">
            <Label>이름</Label>
            <Field value={form.name} onChangeText={(v) => setForm({ ...form, name: v })} placeholder="예: 학자금 대출, 자동차 할부" />
            <Label>종류</Label>
            <ChipRow>{(Object.keys(DEBT_KIND) as Debt['kind'][]).map((k) => <Chip key={k} label={DEBT_KIND[k]} active={form.kind === k} onPress={() => setForm({ ...form, kind: k })} />)}</ChipRow>
            <Label>빌린 원금</Label>
            <Field value={form.principalText} onChangeText={(v) => setForm({ ...form, principalText: v })} keyboardType="numeric" placeholder="예: 500만" />
            <Label>매달 내는 금액</Label>
            <Field value={form.installmentText} onChangeText={(v) => setForm({ ...form, installmentText: v })} keyboardType="numeric" placeholder="예: 23만" />
            <Label>총 회차 (개월)</Label>
            <Field value={form.countText} onChangeText={(v) => setForm({ ...form, countText: v })} keyboardType="numeric" />
            <Label>첫 납부일</Label>
            <Chip icon="calendar-outline" label={formatDate(form.firstDue)} active onPress={() => setDateOpen(true)} />
            <View style={[st.switchRow, { backgroundColor: t.fill }]}>
              <Ionicons name="notifications-outline" size={18} color={t.sub} />
              <Text style={{ color: t.text, flex: 1, fontSize: 15 }}>납부일 오전 9시에 알림</Text>
              <Switch value={form.remind} onValueChange={(v) => setForm({ ...form, remind: v })} trackColor={{ true: t.primary, false: t.border }} thumbColor="#fff" />
            </View>
            {parseAmount(form.principalText) && parseAmount(form.installmentText) && Number(form.countText) ? (
              <Text style={{ color: t.sub, marginTop: 12, lineHeight: 19 }}>
                총 {fmt(parseAmount(form.installmentText)! * Number(form.countText))}을 갚아요 · 이자 {fmt(Math.max(0, parseAmount(form.installmentText)! * Number(form.countText) - parseAmount(form.principalText)!))}
              </Text>
            ) : null}
            <Button label="저장" style={{ marginTop: 20 }} disabled={!form.name.trim() || !parseAmount(form.installmentText) || !(Number(form.countText) > 0)} onPress={() => {
              const { principalText, installmentText, countText, ...rest } = form;
              const count = Math.round(Number(countText));
              saveDebt({ ...rest, name: form.name.trim(), principal: parseAmount(principalText) ?? parseAmount(installmentText)! * count, installment: parseAmount(installmentText)!, count, paid: rest.paid.filter((n) => n <= count) });
              setForm(null);
            }} />
            {data.debts.some((x) => x.id === form.id) && <Button label="삭제" kind="danger" style={{ marginTop: 10 }} onPress={() => confirm('빚 삭제', '이 빚을 목록에서 지울까요?', () => { deleteDebt(form.id); setForm(null); })} />}
          </ScrollView>
        )}
      </Sheet>
      <DatePickerSheet visible={dateOpen} value={form?.firstDue ?? null} weekStart={0} onClose={() => setDateOpen(false)} onPick={(k) => form && k && setForm({ ...form, firstDue: k })} />
    </View>
  );
}

// ───────── 카드 ─────────
function Cards() {
  const t = useTheme();
  const { data, addEntry } = useStore();
  const look = useLookup();
  const { editTx } = useEntry();
  const [open, setOpen] = useState<string | null>(null);
  const today = todayKey();
  const cards = data.accounts.filter((a) => a.kind === 'card' && !a.archived);
  const STATUS = { paid: '납부 완료', open: '이번 청구서', late: '연체', upcoming: '예정' } as const;
  if (!cards.length) return <Empty icon="card-outline" title="신용카드가 없어요" desc="설정 › 계좌에서 카드를 추가하세요" />;
  return (
    <View style={{ paddingHorizontal: 16, gap: 10 }}>
      {cards.map((c) => {
        const s = cardStatus(c, data.transactions, today);
        const p = tint(t, c.color);
        const bills = s.bills.filter((b) => b.status !== 'paid' || b.billMonth >= addMonthsYM(thisMonth(), -1)).slice(0, 6);
        return (
          <View key={c.id} style={{ gap: 10 }}>
            <Card style={{ backgroundColor: p.bg, shadowOpacity: 0, elevation: 0 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Ionicons name="card" size={20} color={p.ink} />
                <Text style={{ color: t.text, fontWeight: '800', fontSize: 16, flex: 1 }}>{c.name}</Text>
                <Text style={{ color: p.ink, fontSize: 12.5, fontWeight: '600' }}>매달 {c.card!.dueDay}일 결제</Text>
              </View>
              <Text style={{ color: t.sub, fontSize: 13, marginTop: 12 }}>남은 한도</Text>
              <Text style={{ color: t.text, fontSize: 22, fontWeight: '800' }}>{fmt(s.available)}</Text>
              <View style={{ marginTop: 10 }}><Bar value={s.limit ? s.outstanding / s.limit : 0} color={p.ink} track={t.dark ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.85)'} /></View>
              <Text style={{ color: t.sub, fontSize: 12.5, marginTop: 8 }}>사용 중 {fmt(s.outstanding)} / 한도 {fmt(s.limit)} (할부 남은 금액 포함)</Text>
            </Card>
            {bills.map((b) => {
              const key = c.id + b.billMonth;
              const left = b.amount - b.paid;
              const color = b.status === 'late' ? t.danger : b.status === 'paid' ? t.success : b.status === 'open' ? t.primaryInk : t.sub;
              return (
                <Card key={key} onPress={() => setOpen(open === key ? null : key)}>
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: t.text, fontWeight: '700', fontSize: 15 }}>{formatYM(b.billMonth)} 청구서</Text>
                      <Text style={{ color, fontSize: 12.5, fontWeight: '600', marginTop: 2 }}>{STATUS[b.status]} · {formatDate(b.dueDate)} 결제</Text>
                    </View>
                    <Text style={{ color: t.text, fontWeight: '800', fontSize: 16 }}>{fmt(b.amount)}</Text>
                  </View>
                  {(b.status === 'open' || b.status === 'late') && c.card?.payFromId && (
                    <Pressable onPress={() => addEntry({ type: 'transfer', amount: left, date: today, accountId: c.card!.payFromId!, toAccountId: c.id, categoryId: null, note: `${c.name} 대금`, cardPayment: true })}
                      style={[st.smallBtn, { backgroundColor: t.primarySoft, alignSelf: 'flex-end', marginTop: 10 }]}>
                      <Text style={{ color: t.primaryInk, fontWeight: '700', fontSize: 13 }}>{look.account[c.card.payFromId]?.name}에서 {fmt(left)} 납부</Text>
                    </Pressable>
                  )}
                  {open === key && (
                    <View style={{ marginTop: 8, marginHorizontal: -12 }}>
                      {b.items.map((x) => <TxRow key={x.id} tx={x} category={look.category[x.categoryId ?? '']} account={c} onPress={editTx} showDate />)}
                    </View>
                  )}
                </Card>
              );
            })}
          </View>
        );
      })}
    </View>
  );
}

export function PlanScreen({ initial = 'budget' }: { initial?: PlanTab }) {
  const [tab, setTab] = useState<PlanTab>(initial);
  const { openEntry } = useEntry();
  return (
    <View style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={{ paddingBottom: 110 }} keyboardShouldPersistTaps="handled">
        <ScreenHeader title="계획" />
        <View style={{ paddingHorizontal: 16, marginBottom: 14 }}>
          <ChipRow>
            {([['budget', '예산', 'pie-chart-outline'], ['goals', '저축 목표', 'flag-outline'], ['fixed', '고정 지출', 'repeat'], ['debts', '빚', 'document-text-outline'], ['cards', '카드', 'card-outline']] as const).map(([k, l, i]) => (
              <Chip key={k} label={l} icon={i} active={tab === k} onPress={() => setTab(k)} />
            ))}
          </ChipRow>
        </View>
        {tab === 'budget' && <Budgets />}
        {tab === 'goals' && <Goals />}
        {tab === 'fixed' && <Fixed />}
        {tab === 'debts' && <Debts />}
        {tab === 'cards' && <Cards />}
      </ScrollView>
      <Fab onPress={() => openEntry()} />
    </View>
  );
}

const st = StyleSheet.create({
  paceMark: { position: 'absolute', top: -3, width: 2, height: 14, borderRadius: 1, opacity: 0.35 },
  smallBtn: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 999 },
  detRow: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 10 },
  tag: { paddingHorizontal: 7, paddingVertical: 2, borderRadius: 6 },
  switchRow: { flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 8, marginTop: 18 },
  schedRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 13, paddingHorizontal: 4, borderBottomWidth: StyleSheet.hairlineWidth },
});
