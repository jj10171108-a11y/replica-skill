import React, { useMemo, useState } from 'react';
import { Pressable, SectionList, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLookup, useStore } from '../store';
import { useTheme } from '../theme';
import { fmt } from '../domain/money';
import { addMonthsYM, formatDate, formatYM, monthOf, thisMonth } from '../domain/date';
import { monthSummary } from '../domain/ledger';
import type { Transaction } from '../domain/types';
import { useEntry } from '../components/EntrySheet';
import { TxRow } from '../components/bits';
import { Chip, ChipRow, Empty, Fab, ScreenHeader, SearchField } from '../components/ui';

type F = 'all' | 'expense' | 'income' | 'transfer';

export function TransactionsScreen() {
  const t = useTheme();
  const { data } = useStore();
  const look = useLookup();
  const { openEntry, editTx } = useEntry();
  const [ym, setYm] = useState(thisMonth());
  const [q, setQ] = useState('');
  const [f, setF] = useState<F>('all');
  const [acc, setAcc] = useState<string | null>(null);

  const summary = useMemo(() => monthSummary(data.transactions, ym), [data.transactions, ym]);
  const sections = useMemo(() => {
    const qq = q.trim().toLowerCase();
    const list = data.transactions.filter((x) =>
      (qq ? true : monthOf(x.date) === ym) &&
      (f === 'all' || x.type === f) &&
      (!acc || x.accountId === acc || x.toAccountId === acc) &&
      (!qq || x.note.toLowerCase().includes(qq) || (look.category[x.categoryId ?? '']?.name ?? '').includes(qq) || String(x.amount).includes(qq)));
    const by = new Map<string, Transaction[]>();
    for (const x of [...list].sort((a, b) => b.date.localeCompare(a.date) || b.createdAt - a.createdAt)) {
      if (!by.has(x.date)) by.set(x.date, []);
      by.get(x.date)!.push(x);
    }
    return [...by.entries()].slice(0, 400).map(([date, items]) => ({
      title: date, data: items,
      net: items.reduce((s, x) => s + (x.type === 'income' ? x.amount : x.type === 'expense' ? -x.amount : 0), 0),
    }));
  }, [data.transactions, ym, q, f, acc, look.category]);

  const header = (
    <View>
      <ScreenHeader title="내역" />
      <View style={st.monthRow}>
        <Pressable onPress={() => setYm(addMonthsYM(ym, -1))} hitSlop={10} style={[st.nav, { backgroundColor: t.card }]}><Ionicons name="chevron-back" size={18} color={t.text} /></Pressable>
        <Pressable onPress={() => setYm(thisMonth())} style={{ flex: 1, alignItems: 'center' }}>
          <Text style={{ color: t.text, fontSize: 18, fontWeight: '800' }}>{formatYM(ym)}</Text>
        </Pressable>
        <Pressable onPress={() => setYm(addMonthsYM(ym, 1))} hitSlop={10} style={[st.nav, { backgroundColor: t.card }]}><Ionicons name="chevron-forward" size={18} color={t.text} /></Pressable>
      </View>
      <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 18, marginBottom: 12 }}>
        <Text style={{ color: t.sub }}>수입 <Text style={{ color: t.success, fontWeight: '700' }}>{fmt(summary.income)}</Text></Text>
        <Text style={{ color: t.sub }}>지출 <Text style={{ color: t.text, fontWeight: '700' }}>{fmt(summary.expense)}</Text></Text>
      </View>
      <View style={{ paddingHorizontal: 16, gap: 10, marginBottom: 6 }}>
        <SearchField value={q} onChangeText={setQ} placeholder="메모·카테고리·금액 검색 (전체 기간)" />
        <ChipRow>
          {(['all', 'expense', 'income', 'transfer'] as F[]).map((k) => (
            <Chip key={k} label={{ all: '전체', expense: '지출', income: '수입', transfer: '이체' }[k]} active={f === k} onPress={() => setF(k)} />
          ))}
          <View style={{ width: 8 }} />
          {data.accounts.filter((a) => !a.archived).map((a) => (
            <Chip key={a.id} label={a.name} color={a.color} active={acc === a.id} onPress={() => setAcc(acc === a.id ? null : a.id)} />
          ))}
        </ChipRow>
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
          <View style={st.dayHead}>
            <Text style={{ color: t.sub, fontWeight: '700', fontSize: 13 }}>{formatDate(section.title)}</Text>
            {section.net !== 0 && <Text style={{ color: section.net > 0 ? t.success : t.sub, fontSize: 13, fontWeight: '600' }}>{fmt(section.net, { signed: true })}</Text>}
          </View>
        )}
        renderItem={({ item }) => (
          <View style={{ marginHorizontal: 12 }}>
            <TxRow tx={item} account={look.account[item.accountId]} toAccount={item.toAccountId ? look.account[item.toAccountId] : undefined}
              category={item.categoryId ? look.category[item.categoryId] : undefined} onPress={editTx} />
          </View>
        )}
        ListEmptyComponent={<Empty icon={q ? 'search' : 'receipt-outline'} title={q ? '찾는 기록이 없어요' : '이 달의 기록이 없어요'} desc={q ? undefined : '+ 버튼으로 기록을 추가하세요'} />}
      />
      <Fab onPress={() => openEntry()} />
    </View>
  );
}

const st = StyleSheet.create({
  monthRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, marginBottom: 8 },
  nav: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  dayHead: { flexDirection: 'row', justifyContent: 'space-between', marginHorizontal: 22, marginTop: 16, marginBottom: 4 },
});
