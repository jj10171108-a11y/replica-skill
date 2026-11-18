import React, { useMemo, useState } from 'react';
import { Alert, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import { File } from 'expo-file-system';
import { uid, useLookup, useStore } from '../store';
import { tint, useTheme } from '../theme';
import { fmt } from '../domain/money';
import { buildCandidates, ImportCandidate, parseStatement } from '../domain/importer';
import { billMonthFor } from '../domain/ledger';
import type { Transaction } from '../domain/types';
import { Button, Chip, ChipRow, Label, Sheet } from '../components/ui';

export async function pickTextFile(): Promise<{ name: string; text: string } | null> {
  const res = await DocumentPicker.getDocumentAsync({ type: '*/*', copyToCacheDirectory: true, multiple: false });
  if (res.canceled || !res.assets?.[0]) return null;
  const a = res.assets[0];
  if (/\.(xlsx|xls|pdf)$/i.test(a.name)) {
    Alert.alert('아직 읽을 수 없는 형식이에요', '엑셀(XLSX)·PDF 내역은 은행 앱에서 CSV로 저장하거나, 엑셀에서 "다른 이름으로 저장 → CSV"로 바꿔서 가져와 주세요.');
    return null;
  }
  let text: string;
  if (a.file && typeof (a.file as any).text === 'function') text = await (a.file as any).text(); // 웹
  else text = await new File(a.uri).text();
  return { name: a.name, text };
}

export function ImportSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const t = useTheme();
  const { data, addMany } = useStore();
  const look = useLookup();
  const accounts = data.accounts.filter((a) => !a.archived && a.kind !== 'invest');
  const [accountId, setAccountId] = useState<string | null>(data.settings.defaultAccountId);
  const [rows, setRows] = useState<ImportCandidate[] | null>(null);
  const [fileName, setFileName] = useState('');
  const [catFor, setCatFor] = useState<string | null>(null);

  const reset = () => { setRows(null); setFileName(''); setCatFor(null); };
  const close = () => { reset(); onClose(); };

  const pick = async () => {
    if (!accountId) return;
    try {
      const f = await pickTextFile();
      if (!f) return;
      const parsed = parseStatement(f.text, f.name);
      if (!parsed.length) {
        Alert.alert('내역을 찾지 못했어요', '날짜와 금액 칸이 있는 CSV 또는 OFX 파일인지 확인해 주세요.');
        return;
      }
      setFileName(f.name);
      setRows(buildCandidates(parsed, accountId, data.transactions, data.accounts, data.categories));
    } catch (e: any) {
      Alert.alert('파일을 읽지 못했어요', String(e?.message ?? e));
    }
  };

  const checked = useMemo(() => rows?.filter((r) => r.checked) ?? [], [rows]);
  const doImport = () => {
    if (!rows || !accountId) return;
    const acc = data.accounts.find((a) => a.id === accountId)!;
    const now = Date.now();
    const txs: Transaction[] = checked.map((r, i) => ({
      id: uid(), type: r.type, amount: r.row.amount, date: r.row.date, accountId,
      toAccountId: r.type === 'transfer' ? r.cardPaymentToId : null, categoryId: r.type === 'transfer' ? null : r.categoryId,
      note: r.row.description.slice(0, 80), cardPayment: !!r.cardPaymentToId,
      billMonth: acc.kind === 'card' && acc.card && r.type === 'expense' ? billMonthFor(r.row.date, acc.card.closingDay, acc.card.dueDay) : null,
      createdAt: now + i,
    }));
    addMany(txs);
    Alert.alert('가져오기 완료', `${txs.length}건을 기록했어요.`);
    close();
  };

  const setRow = (key: string, p: Partial<ImportCandidate>) => setRows((rs) => rs?.map((r) => (r.key === key ? { ...r, ...p } : r)) ?? null);

  return (
    <Sheet visible={visible} onClose={close} title="은행 내역 가져오기" full>
      {!rows ? (
        <View style={{ paddingHorizontal: 20 }}>
          <Text style={{ color: t.sub, lineHeight: 20 }}>은행·카드사 앱에서 내려받은 거래 내역 파일(CSV, OFX)을 읽어요. 저장하기 전에 목록을 확인할 수 있어요.</Text>
          <Label icon="wallet-outline">어느 계좌의 내역인가요?</Label>
          <ChipRow>{accounts.map((a) => <Chip key={a.id} label={a.name} color={a.color} active={accountId === a.id} onPress={() => setAccountId(a.id)} />)}</ChipRow>
          <Button label="파일 고르기" icon="document-outline" onPress={pick} disabled={!accountId} style={{ marginTop: 22 }} />
          <View style={[st.help, { backgroundColor: t.fill }]}>
            <Text style={{ color: t.sub, fontSize: 12.5, lineHeight: 19 }}>
              · 날짜·내용·금액(또는 출금/입금) 칸을 알아서 찾아요{'\n'}
              · 이미 기록된 거래는 체크가 꺼진 채로 보여요{'\n'}
              · "카드 대금" 같은 출금은 카드 대금 납부(이체)로 인식해요{'\n'}
              · 엑셀·PDF 내역은 CSV로 저장해서 가져와 주세요
            </Text>
          </View>
        </View>
      ) : (
        <View style={{ flex: 1 }}>
          <View style={{ paddingHorizontal: 20, paddingBottom: 8 }}>
            <Text style={{ color: t.text, fontWeight: '700' }} numberOfLines={1}>{fileName}</Text>
            <Text style={{ color: t.sub, fontSize: 12.5, marginTop: 2 }}>{rows.length}건 중 {checked.length}건 선택 · 이미 있는 것 {rows.filter((r) => r.duplicate).length}건</Text>
          </View>
          <FlatList
            data={rows}
            keyExtractor={(r) => r.key}
            contentContainerStyle={{ paddingHorizontal: 12, paddingBottom: 12 }}
            renderItem={({ item: r }) => {
              const c = r.categoryId ? look.category[r.categoryId] : null;
              return (
                <View style={[st.row, { borderBottomColor: t.separator, opacity: r.checked ? 1 : 0.5 }]}>
                  <Pressable onPress={() => setRow(r.key, { checked: !r.checked })} hitSlop={8}>
                    <Ionicons name={r.checked ? 'checkbox' : 'square-outline'} size={22} color={r.checked ? t.primary : t.faint} />
                  </Pressable>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: t.text, fontWeight: '600' }} numberOfLines={1}>{r.row.description || '(내용 없음)'}</Text>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 3 }}>
                      <Text style={{ color: t.sub, fontSize: 12 }}>{r.row.date.slice(5).replace('-', '/')}</Text>
                      {r.type === 'transfer' ? (
                        <View style={[st.tag, { backgroundColor: t.primarySoft }]}><Text style={{ color: t.primaryInk, fontSize: 11, fontWeight: '700' }}>카드 대금</Text></View>
                      ) : (
                        <Pressable onPress={() => setCatFor(catFor === r.key ? null : r.key)} style={[st.tag, { backgroundColor: tint(t, c?.color ?? '#5A5560').bg }]}>
                          <Text style={{ color: tint(t, c?.color ?? '#5A5560').ink, fontSize: 11, fontWeight: '700' }}>{c?.name ?? '카테고리'} ▾</Text>
                        </Pressable>
                      )}
                      {r.duplicate && <Text style={{ color: t.warn, fontSize: 11.5, fontWeight: '600' }}>이미 있음</Text>}
                    </View>
                    {catFor === r.key && (
                      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 5, marginTop: 8 }}>
                        {data.categories.filter((x) => x.type === (r.type === 'income' ? 'income' : 'expense')).map((x) => (
                          <Chip key={x.id} label={x.name} color={x.color} active={r.categoryId === x.id} onPress={() => { setRow(r.key, { categoryId: x.id }); setCatFor(null); }} />
                        ))}
                      </View>
                    )}
                  </View>
                  <Pressable onPress={() => r.type !== 'transfer' && setRow(r.key, { type: r.type === 'income' ? 'expense' : 'income', categoryId: r.type === 'income' ? 'etc' : 'income_etc' })}>
                    <Text style={{ color: r.type === 'income' ? t.success : t.text, fontWeight: '700' }}>{fmt(r.type === 'income' ? r.row.amount : -r.row.amount)}</Text>
                  </Pressable>
                </View>
              );
            }}
          />
          <View style={{ paddingHorizontal: 20, flexDirection: 'row', gap: 10 }}>
            <Button label="다시 고르기" kind="ghost" onPress={reset} style={{ flex: 1 }} />
            <Button label={`${checked.length}건 가져오기`} onPress={doImport} disabled={!checked.length} style={{ flex: 1.4 }} />
          </View>
        </View>
      )}
    </Sheet>
  );
}

const st = StyleSheet.create({
  help: { borderRadius: 14, padding: 14, marginTop: 18 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, paddingHorizontal: 8, borderBottomWidth: StyleSheet.hairlineWidth },
  tag: { paddingHorizontal: 7, paddingVertical: 2, borderRadius: 6 },
});
