import React, { useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useStore, useLookup } from '../store';
import { tint, useTheme } from '../theme';
import { fmt } from '../domain/money';
import { addDays, dayInMonth, daysInMonth, formatDate, fromKey, monthOf, thisMonth, todayKey, diffDays } from '../domain/date';
import { cardStatus, monthSummary, totals } from '../domain/ledger';
import { allRecurring, findAlerts, forecastMonth } from '../domain/engine';
import { debtSummary } from '../domain/debts';
import { useEntry } from '../components/EntrySheet';
import { Bar, StatTile, TxRow } from '../components/bits';
import { Card, Fab, ScreenHeader, SectionTitle } from '../components/ui';

export function HomeScreen({ go }: { go: (tab: 'tx' | 'plan' | 'insights' | 'settings', sub?: string) => void }) {
  const t = useTheme();
  const { data } = useStore();
  const look = useLookup();
  const { openEntry, editTx } = useEntry();
  const today = todayKey();
  const ym = thisMonth();

  const tot = useMemo(() => totals(data, today), [data, today]);
  const month = useMemo(() => monthSummary(data.transactions.filter((x) => x.date <= today), ym), [data.transactions, ym, today]);
  const fc = useMemo(() => forecastMonth(data, today), [data, today]);
  const alerts = useMemo(() => findAlerts(data, today).slice(0, 3), [data, today]);
  const recent = useMemo(() => data.transactions.filter((x) => x.date <= today).slice(0, 5), [data.transactions, today]);

  // 다가오는 납부 (14일 안)
  const upcoming = useMemo(() => {
    const out: { key: string; label: string; date: string; amount: number; icon: any; color: string }[] = [];
    const until = addDays(today, 14);
    for (const a of data.accounts) {
      if (a.kind !== 'card' || a.archived) continue;
      const next = cardStatus(a, data.transactions, today).next;
      if (next && next.dueDate <= until) out.push({ key: 'c' + a.id, label: `${a.name} 대금`, date: next.dueDate, amount: next.amount - next.paid, icon: 'card-outline', color: a.color });
    }
    for (const r of allRecurring(data, today)) {
      if (r.type !== 'expense') continue;
      const thisM = dayInMonth(ym, r.day);
      const date = thisM >= today ? thisM : dayInMonth(monthOf(addDays(`${ym}-01`, 40)), r.day);
      if (date <= until) out.push({ key: 'r' + r.name, label: r.name, date, amount: r.amount, icon: 'repeat', color: '#5B45B8' });
    }
    for (const d of data.debts) {
      const s = debtSummary(d, today);
      if (s.next && s.next.date <= until) out.push({ key: 'd' + d.id, label: `${d.name} ${s.next.n}회차`, date: s.next.date, amount: d.installment, icon: 'document-text-outline', color: '#A8335E' });
    }
    return out.sort((a, b) => a.date.localeCompare(b.date)).slice(0, 5);
  }, [data, today, ym]);

  const backupDue = data.settings.backupReminder !== 'off' && data.transactions.length > 0 &&
    (!data.settings.lastBackupAt || Date.now() - data.settings.lastBackupAt > (data.settings.backupReminder === 'weekly' ? 7 : 30) * 86400000);

  const progress = fromKey(today).getDate() / daysInMonth(ym);
  const riskColor = fc.probNegative >= 0.3 ? '#A8335E' : fc.probNegative >= 0.05 ? '#A84B24' : '#1F7A55';
  const risk = tint(t, riskColor);
  const empty = data.transactions.length === 0;

  return (
    <View style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={{ paddingBottom: 110 }}>
        <ScreenHeader title="하루 가계부" subtitle={formatDate(today).replace('오늘', `${fromKey(today).getMonth() + 1}월 ${fromKey(today).getDate()}일`)} />

        {/* 잔액 카드 */}
        <View style={[st.hero, { backgroundColor: t.primary }]}>
          <Text style={{ color: t.onPrimary, opacity: 0.85, fontSize: 13, fontWeight: '600' }}>쓸 수 있는 돈 (통장 + 현금)</Text>
          <Text style={{ color: t.onPrimary, fontSize: 32, fontWeight: '800', letterSpacing: -1, marginTop: 4 }}>{fmt(tot.liquid)}</Text>
          <View style={{ flexDirection: 'row', gap: 16, marginTop: 12 }}>
            <View>
              <Text style={[st.heroSub, { color: t.onPrimary }]}>카드 대금</Text>
              <Text style={[st.heroVal, { color: t.onPrimary }]}>{fmt(tot.cardDebt)}</Text>
            </View>
            {tot.invest ? (
              <View>
                <Text style={[st.heroSub, { color: t.onPrimary }]}>투자</Text>
                <Text style={[st.heroVal, { color: t.onPrimary }]}>{fmt(tot.invest)}</Text>
              </View>
            ) : null}
            <View>
              <Text style={[st.heroSub, { color: t.onPrimary }]}>순자산</Text>
              <Text style={[st.heroVal, { color: t.onPrimary }]}>{fmt(tot.net)}</Text>
            </View>
          </View>
        </View>

        {/* 빠른 기록 */}
        <Pressable onPress={() => openEntry()} style={({ pressed }) => [st.quick, { backgroundColor: t.card, opacity: pressed ? 0.8 : 1 }]}>
          <Ionicons name="sparkles" size={18} color={t.primaryInk} />
          <Text style={{ color: t.faint, fontSize: 15, flex: 1 }}>"점심 12000 체크카드" 처럼 써 보세요</Text>
          <Ionicons name="mic-outline" size={20} color={t.sub} />
        </Pressable>

        {backupDue && (
          <Pressable onPress={() => go('settings', 'backup')} style={[st.notice, { backgroundColor: tint(t, '#7D5F00').bg }]}>
            <Ionicons name="cloud-upload-outline" size={18} color={tint(t, '#7D5F00').ink} />
            <Text style={{ color: tint(t, '#7D5F00').ink, fontWeight: '600', flex: 1 }}>백업할 때가 됐어요. 눌러서 백업하기</Text>
          </Pressable>
        )}

        {/* 이번 달 */}
        <View style={{ flexDirection: 'row', gap: 10, paddingHorizontal: 16, marginTop: 14 }}>
          <StatTile label="이번 달 수입" value={fmt(month.income, { compact: true })} color="#1F7A55" icon="arrow-down-circle-outline" onPress={() => go('tx')} />
          <StatTile label="이번 달 지출" value={fmt(month.expense, { compact: true })} color="#A84B24" icon="arrow-up-circle-outline" onPress={() => go('tx')} />
          <StatTile label="남은 돈" value={fmt(month.income - month.expense, { compact: true })} color="#5B45B8" icon="wallet-outline" onPress={() => go('insights')} />
        </View>

        {/* 월말 예측 */}
        {!empty && (
          <Card style={{ marginHorizontal: 16, marginTop: 14 }} onPress={() => go('insights')}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Ionicons name="analytics-outline" size={18} color={t.primaryInk} />
              <Text style={{ color: t.text, fontWeight: '700', fontSize: 15, flex: 1 }}>월말 예상</Text>
              <View style={[st.pill, { backgroundColor: risk.bg }]}>
                <Text style={{ color: risk.ink, fontSize: 12, fontWeight: '700' }}>적자 확률 {Math.round(fc.probNegative * 100)}%</Text>
              </View>
            </View>
            <Text style={{ color: t.sub, fontSize: 13, marginTop: 12 }}>월말 통장 잔액</Text>
            <Text style={{ color: fc.balance.p50 < 0 ? t.danger : t.text, fontSize: 24, fontWeight: '800', letterSpacing: -0.6 }}>{fmt(Math.round(fc.balance.p50 / 1000) * 1000)}</Text>
            <Text style={{ color: t.sub, fontSize: 12.5, marginTop: 2 }}>
              {fmt(Math.round(fc.balance.p10 / 1000) * 1000, { compact: true })} ~ {fmt(Math.round(fc.balance.p90 / 1000) * 1000, { compact: true })} 사이일 가능성이 80%예요
            </Text>
            <View style={{ marginTop: 14 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }}>
                <Text style={{ color: t.sub, fontSize: 12.5 }}>이번 달 예상 지출 {fmt(Math.round(fc.spend.p50 / 1000) * 1000, { compact: true })}</Text>
                <Text style={{ color: t.sub, fontSize: 12.5 }}>지금까지 {fmt(fc.spend.soFar, { compact: true })}</Text>
              </View>
              <Bar value={fc.spend.p50 ? fc.spend.soFar / fc.spend.p50 : 0} color={t.primary} />
              <Text style={{ color: t.faint, fontSize: 11.5, marginTop: 6 }}>내 기록으로 {fc.sims.toLocaleString()}가지 경우를 계산했어요 · 이번 달 {Math.round(progress * 100)}% 지남</Text>
            </View>
          </Card>
        )}

        {/* 알림 */}
        {alerts.length > 0 && (
          <>
            <SectionTitle>확인해 보세요</SectionTitle>
            <Card style={{ marginHorizontal: 16, paddingVertical: 6, paddingHorizontal: 6 }}>
              {alerts.map((a) => (
                <Pressable key={a.kind + a.tx.id} onPress={() => editTx(a.tx)} style={st.alertRow}>
                  <Ionicons name={a.kind === 'duplicate' ? 'copy-outline' : 'alert-circle-outline'} size={20} color={a.kind === 'duplicate' ? t.warn : t.danger} />
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: t.text, fontWeight: '600' }} numberOfLines={1}>{a.tx.note || look.category[a.tx.categoryId ?? '']?.name} {fmt(a.tx.installment?.total ?? a.tx.amount)}</Text>
                    <Text style={{ color: t.sub, fontSize: 12.5 }}>
                      {a.kind === 'duplicate' ? `${formatDate(a.tx.date)} 같은 금액이 두 번 기록됐어요` : `평소(${fmt(a.typical ?? 0, { compact: true })})보다 훨씬 많아요`}
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={16} color={t.faint} />
                </Pressable>
              ))}
            </Card>
          </>
        )}

        {/* 다가오는 납부 */}
        {upcoming.length > 0 && (
          <>
            <SectionTitle right={<Pressable onPress={() => go('plan')}><Text style={{ color: t.primaryInk, fontSize: 13, fontWeight: '600' }}>계획 보기</Text></Pressable>}>다가오는 납부</SectionTitle>
            <Card style={{ marginHorizontal: 16, paddingVertical: 8, paddingHorizontal: 16 }}>
              {upcoming.map((u) => {
                const dd = diffDays(u.date, today);
                return (
                  <View key={u.key} style={st.upRow}>
                    <View style={[st.upIcon, { backgroundColor: tint(t, u.color).bg }]}><Ionicons name={u.icon} size={16} color={tint(t, u.color).ink} /></View>
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: t.text, fontWeight: '600' }}>{u.label}</Text>
                      <Text style={{ color: dd <= 2 ? t.danger : t.sub, fontSize: 12.5 }}>{dd === 0 ? '오늘' : `${dd}일 뒤`} · {formatDate(u.date)}</Text>
                    </View>
                    <Text style={{ color: t.text, fontWeight: '700' }}>{fmt(u.amount)}</Text>
                  </View>
                );
              })}
            </Card>
          </>
        )}

        {/* 최근 기록 */}
        <SectionTitle right={!empty ? <Pressable onPress={() => go('tx')}><Text style={{ color: t.primaryInk, fontSize: 13, fontWeight: '600' }}>전체 보기</Text></Pressable> : undefined}>최근 기록</SectionTitle>
        {empty ? (
          <Card style={{ marginHorizontal: 16, alignItems: 'center', paddingVertical: 28 }}>
            <Ionicons name="receipt-outline" size={30} color={t.primaryInk} />
            <Text style={{ color: t.text, fontWeight: '700', fontSize: 16, marginTop: 10 }}>첫 기록을 남겨 보세요</Text>
            <Text style={{ color: t.sub, marginTop: 6, textAlign: 'center', lineHeight: 20 }}>+ 버튼을 누르고 "커피 4500"처럼 쓰면 끝이에요.{'\n'}설정에서 예시 데이터로 둘러볼 수도 있어요.</Text>
          </Card>
        ) : (
          <Card style={{ marginHorizontal: 16, padding: 4 }}>
            {recent.map((x) => (
              <TxRow key={x.id} tx={x} account={look.account[x.accountId]} toAccount={x.toAccountId ? look.account[x.toAccountId] : undefined}
                category={x.categoryId ? look.category[x.categoryId] : undefined} onPress={editTx} showDate />
            ))}
          </Card>
        )}
      </ScrollView>
      <Fab onPress={() => openEntry()} />
    </View>
  );
}

const st = StyleSheet.create({
  hero: { marginHorizontal: 16, borderRadius: 26, padding: 20 },
  heroSub: { fontSize: 12, opacity: 0.8 },
  heroVal: { fontSize: 15, fontWeight: '700', marginTop: 2 },
  quick: { flexDirection: 'row', alignItems: 'center', gap: 10, marginHorizontal: 16, marginTop: 12, borderRadius: 999, paddingHorizontal: 18, height: 52 },
  notice: { flexDirection: 'row', alignItems: 'center', gap: 10, marginHorizontal: 16, marginTop: 10, borderRadius: 16, padding: 14 },
  pill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999 },
  alertRow: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 10 },
  upRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 9 },
  upIcon: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
});
