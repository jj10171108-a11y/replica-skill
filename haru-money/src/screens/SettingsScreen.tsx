import React, { useEffect, useState } from 'react';
import { Alert, Platform, Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as LocalAuthentication from 'expo-local-authentication';
import * as Sharing from 'expo-sharing';
import * as Crypto from 'expo-crypto';
import { File, Paths } from 'expo-file-system';
import { uid, useStore } from '../store';
import { tint, useTheme } from '../theme';
import { fmt, parseAmount } from '../domain/money';
import { balanceOf } from '../domain/ledger';
import { isEncrypted, makeBackup, readBackup, toCsv } from '../domain/backup';
import { INK } from '../domain/defaults';
import { todayKey } from '../domain/date';
import type { Account, Category, Settings } from '../domain/types';
import { ACCOUNT_ICON, ACCOUNT_KIND_LABEL, IconBubble } from '../components/bits';
import { Button, Card, Chip, ChipRow, Field, Label, ListRow, ScreenHeader, SectionTitle, Segmented, Sheet } from '../components/ui';
import { ImportSheet, pickTextFile } from './ImportSheet';

const INKS = Object.values(INK);
const ask = (title: string, msg: string, ok: string, go: () => void) => {
  if (Platform.OS === 'web') return go();
  Alert.alert(title, msg, [{ text: '취소', style: 'cancel' }, { text: ok, style: 'destructive', onPress: go }]);
};

async function shareText(name: string, text: string, mime: string) {
  if (Platform.OS === 'web') {
    const blob = new Blob([text], { type: mime });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = name; a.click();
    return;
  }
  const f = new File(Paths.cache, name);
  if (f.exists) f.delete();
  f.create();
  f.write(text);
  await Sharing.shareAsync(f.uri, { mimeType: mime, dialogTitle: name });
}

function AccountForm({ initial, onClose }: { initial: Account; onClose: () => void }) {
  const t = useTheme();
  const { data, saveAccount, deleteAccount } = useStore();
  const [a, setA] = useState(initial);
  const [initialText, setInitialText] = useState(initial.initial ? String(initial.initial) : '');
  const [limitText, setLimitText] = useState(initial.card?.limit ? String(initial.card.limit) : '');
  const [valueText, setValueText] = useState(initial.invest?.currentValue ? String(initial.invest.currentValue) : '');
  const isNew = !data.accounts.some((x) => x.id === a.id);
  const card = a.card ?? { closingDay: 31, dueDay: 14, limit: 0, payFromId: data.accounts.find((x) => x.kind === 'bank')?.id ?? null };
  const save = () => {
    const next: Account = { ...a, name: a.name.trim(), initial: a.kind === 'card' ? 0 : parseAmount(initialText) ?? 0 };
    if (a.kind === 'card') next.card = { ...card, limit: parseAmount(limitText) ?? 0 }; else delete next.card;
    if (a.kind === 'invest') next.invest = { currentValue: parseAmount(valueText) ?? balanceOf(next, data.transactions), valuedAt: todayKey() }; else delete next.invest;
    saveAccount(next);
    onClose();
  };
  return (
    <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 20 }} keyboardShouldPersistTaps="handled">
      <Label>종류</Label>
      <ChipRow>
        {(['bank', 'cash', 'card', 'invest'] as const).map((k) => <Chip key={k} icon={ACCOUNT_ICON[k]} label={ACCOUNT_KIND_LABEL[k]} active={a.kind === k} onPress={() => isNew && setA({ ...a, kind: k })} />)}
      </ChipRow>
      <Label>이름</Label>
      <Field value={a.name} onChangeText={(v) => setA({ ...a, name: v })} placeholder="예: 국민 체크, 현대카드" />
      {a.kind !== 'card' && (
        <>
          <Label>{isNew ? '지금 잔액' : '시작 잔액'}</Label>
          <Field value={initialText} onChangeText={setInitialText} keyboardType="numeric" placeholder="0" />
        </>
      )}
      {a.kind === 'card' && (
        <>
          <Label>한도</Label>
          <Field value={limitText} onChangeText={setLimitText} keyboardType="numeric" placeholder="예: 300만" />
          <Label>결제일 (매달)</Label>
          <ChipRow>{[1, 5, 10, 12, 14, 15, 17, 20, 23, 25, 27].map((n) => <Chip key={n} label={`${n}일`} active={card.dueDay === n} onPress={() => setA({ ...a, card: { ...card, dueDay: n } })} />)}</ChipRow>
          <Label>사용 기간 마감일</Label>
          <ChipRow>{[31, 5, 10, 12, 15, 20, 25].map((n) => <Chip key={n} label={n === 31 ? '말일' : `${n}일`} active={card.closingDay === n} onPress={() => setA({ ...a, card: { ...card, closingDay: n } })} />)}</ChipRow>
          <Text style={{ color: t.sub, fontSize: 12, marginTop: 8, lineHeight: 17 }}>카드사 앱의 "이용 기간"을 보세요. 예: 전월 1일~말일 사용분을 14일에 결제 → 마감일 말일, 결제일 14일</Text>
          <Label>대금 내는 통장</Label>
          <ChipRow>{data.accounts.filter((x) => x.kind === 'bank' && !x.archived).map((x) => <Chip key={x.id} label={x.name} active={card.payFromId === x.id} onPress={() => setA({ ...a, card: { ...card, payFromId: x.id } })} />)}</ChipRow>
        </>
      )}
      {a.kind === 'invest' && (
        <>
          <Label>현재 평가액</Label>
          <Field value={valueText} onChangeText={setValueText} keyboardType="numeric" placeholder="증권 앱에 보이는 금액" />
          <Text style={{ color: t.sub, fontSize: 12, marginTop: 8 }}>투자금은 통장 → 이 계좌로 "이체"로 기록하면 실제 연 수익률을 계산해요.</Text>
        </>
      )}
      <Label>색</Label>
      <View style={{ flexDirection: 'row', gap: 10 }}>
        {INKS.map((c) => <Pressable key={c} onPress={() => setA({ ...a, color: c })} style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: tint(t, c).bg, borderWidth: a.color === c ? 3 : 1, borderColor: a.color === c ? c : t.border }} />)}
      </View>
      <Button label="저장" style={{ marginTop: 22 }} disabled={!a.name.trim()} onPress={save} />
      {!isNew && <Button label="계좌 삭제" kind="danger" style={{ marginTop: 10 }} onPress={() => ask('계좌 삭제', '기록이 있는 계좌는 숨겨지고 기록은 남아요.', '삭제', () => { deleteAccount(a.id); onClose(); })} />}
    </ScrollView>
  );
}

function CategoryForm({ initial, onClose }: { initial: Category; onClose: () => void }) {
  const t = useTheme();
  const { saveCategory } = useStore();
  const [c, setC] = useState(initial);
  const [kw, setKw] = useState(initial.keywords.join(', '));
  const ICONS = ['pricetag-outline', 'paw-outline', 'barbell-outline', 'airplane-outline', 'car-outline', 'beer-outline', 'game-controller-outline', 'heart-outline', 'happy-outline', 'leaf-outline', 'musical-notes-outline', 'shirt-outline'];
  return (
    <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 20 }} keyboardShouldPersistTaps="handled">
      <Segmented value={c.type} onChange={(v) => setC({ ...c, type: v })} options={[{ value: 'expense', label: '지출' }, { value: 'income', label: '수입' }]} />
      <Label>이름</Label>
      <Field value={c.name} onChangeText={(v) => setC({ ...c, name: v })} placeholder="예: 반려동물" />
      <Label>알아들을 단어 (쉼표로 구분)</Label>
      <Field value={kw} onChangeText={setKw} placeholder="예: 사료, 동물병원, 간식" />
      <Text style={{ color: t.sub, fontSize: 12, marginTop: 6 }}>문장 기록과 내역 가져오기에서 이 단어가 나오면 이 카테고리로 골라요.</Text>
      <Label>아이콘</Label>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {ICONS.map((i) => (
          <Pressable key={i} onPress={() => setC({ ...c, icon: i })} style={{ width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center', backgroundColor: c.icon === i ? tint(t, c.color).bg : t.fill }}>
            <Ionicons name={i as any} size={20} color={c.icon === i ? tint(t, c.color).ink : t.sub} />
          </Pressable>
        ))}
      </View>
      <Label>색</Label>
      <View style={{ flexDirection: 'row', gap: 10 }}>
        {INKS.map((x) => <Pressable key={x} onPress={() => setC({ ...c, color: x })} style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: tint(t, x).bg, borderWidth: c.color === x ? 3 : 1, borderColor: c.color === x ? x : t.border }} />)}
      </View>
      <Button label="저장" style={{ marginTop: 22 }} disabled={!c.name.trim()} onPress={() => { saveCategory({ ...c, name: c.name.trim(), keywords: kw.split(/[,，]/).map((s) => s.trim()).filter(Boolean) }); onClose(); }} />
    </ScrollView>
  );
}

export function SettingsScreen({ onTour, focus }: { onTour: () => void; focus?: string }) {
  const t = useTheme();
  const { data, updateSettings, replaceAll, loadSample, resetAll } = useStore();
  const s = data.settings;
  const [acc, setAcc] = useState<Account | null>(null);
  const [cat, setCat] = useState<Category | null>(null);
  const [catsOpen, setCatsOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [pw, setPw] = useState<{ mode: 'backup' | 'restore'; text: string; text2: string; file?: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [bioOk, setBioOk] = useState(true);

  useEffect(() => {
    if (Platform.OS === 'web') { setBioOk(false); return; }
    LocalAuthentication.hasHardwareAsync().then(async (h) => setBioOk(h || (await LocalAuthentication.isEnrolledAsync()))).catch(() => setBioOk(false));
  }, []);
  useEffect(() => { if (focus?.startsWith('backup')) setPw({ mode: 'backup', text: '', text2: '' }); }, [focus]);

  const toggleLock = async (v: boolean) => {
    if (v) {
      const r = await LocalAuthentication.authenticateAsync({ promptMessage: '잠금을 켜려면 본인 확인이 필요해요', cancelLabel: '취소' });
      if (!r.success) { Alert.alert('잠금을 켜지 못했어요', '휴대폰에 지문·얼굴·화면 잠금이 설정돼 있는지 확인해 주세요.'); return; }
    }
    updateSettings({ lock: v });
  };

  const doBackup = async (password: string | null) => {
    setBusy(true);
    try {
      await new Promise((r) => setTimeout(r, 50));
      const text = makeBackup(data, password, (n) => Crypto.getRandomBytes(n));
      const name = `하루가계부-백업-${todayKey()}${password ? '-암호' : ''}.json`;
      await shareText(name, text, 'application/json');
      updateSettings({ lastBackupAt: Date.now() });
      setPw(null);
    } catch (e: any) {
      Alert.alert('백업 실패', String(e?.message ?? e));
    } finally { setBusy(false); }
  };

  const startRestore = async () => {
    try {
      const f = await pickTextFile();
      if (!f) return;
      if (isEncrypted(f.text)) { setPw({ mode: 'restore', text: '', text2: '', file: f.text }); return; }
      confirmRestore(f.text, null);
    } catch (e: any) { Alert.alert('파일을 읽지 못했어요', String(e?.message ?? e)); }
  };
  const confirmRestore = (text: string, password: string | null) => {
    let next;
    try { next = readBackup(text, password); } catch (e: any) { Alert.alert('복원 실패', String(e?.message ?? e)); return; }
    ask('백업으로 복원', `기록 ${next.transactions.length}건으로 지금 데이터를 바꿀까요? 되돌릴 수 없어요.`, '복원', () => { replaceAll(next!); setPw(null); });
  };

  const accounts = data.accounts.filter((a) => !a.archived);
  const set = (p: Partial<Settings>) => updateSettings(p);
  const sw = (v: boolean, on: (v: boolean) => void) => <Switch value={v} onValueChange={on} trackColor={{ true: t.primary, false: t.fill }} thumbColor="#fff" />;

  return (
    <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
      <ScreenHeader title="설정" />

      <SectionTitle right={<Pressable onPress={() => setAcc({ id: uid(), name: '', kind: 'bank', initial: 0, color: INKS[accounts.length % INKS.length], createdAt: Date.now() })}><Text style={{ color: t.primaryInk, fontWeight: '700' }}>+ 추가</Text></Pressable>}>계좌 · 카드</SectionTitle>
      <Card style={st.group}>
        {accounts.map((a, i) => (
          <Pressable key={a.id} onPress={() => setAcc(a)} style={[st.accRow, i < accounts.length - 1 && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: t.separator }]}>
            <IconBubble icon={ACCOUNT_ICON[a.kind]} color={a.color} size={36} />
            <View style={{ flex: 1 }}>
              <Text style={{ color: t.text, fontWeight: '600', fontSize: 15.5 }}>{a.name}{s.defaultAccountId === a.id ? '  ⭐' : ''}</Text>
              <Text style={{ color: t.sub, fontSize: 12.5 }}>{ACCOUNT_KIND_LABEL[a.kind]}{a.card ? ` · ${a.card.dueDay}일 결제` : ''}</Text>
            </View>
            <Text style={{ color: t.text, fontWeight: '700' }}>{fmt(a.kind === 'invest' ? a.invest?.currentValue ?? 0 : balanceOf(a, data.transactions, todayKey()))}</Text>
          </Pressable>
        ))}
      </Card>
      <View style={{ paddingHorizontal: 16, marginTop: 10 }}>
        <Text style={{ color: t.sub, fontSize: 12.5, marginBottom: 6 }}>기본 결제 수단 ⭐</Text>
        <ChipRow>{accounts.map((a) => <Chip key={a.id} label={a.name} active={s.defaultAccountId === a.id} onPress={() => set({ defaultAccountId: a.id })} />)}</ChipRow>
      </View>

      <SectionTitle>기록</SectionTitle>
      <Card style={st.group}>
        <ListRow icon="pricetags-outline" iconBg={INK.peach} title="카테고리" desc={`${data.categories.length}개 · 단어를 추가하면 더 잘 알아들어요`} onPress={() => setCatsOpen(true)} />
        <ListRow icon="download-outline" iconBg={INK.sky} title="은행 내역 가져오기" desc="CSV · OFX 파일" onPress={() => setImportOpen(true)} />
        <View style={{ padding: 16, paddingTop: 12 }}>
          <Text style={{ color: t.sub, fontSize: 13, marginBottom: 8 }}>통화</Text>
          <Segmented value={s.currency} onChange={(v) => set({ currency: v })} options={[{ value: 'KRW', label: '원 ₩' }, { value: 'USD', label: '$' }, { value: 'EUR', label: '€' }, { value: 'JPY', label: '¥' }]} />
        </View>
      </Card>

      <SectionTitle>화면 · 보안</SectionTitle>
      <Card style={st.group}>
        <View style={{ padding: 16, paddingBottom: 6 }}>
          <Text style={{ color: t.sub, fontSize: 13, marginBottom: 8 }}>테마</Text>
          <Segmented value={s.theme} onChange={(v) => set({ theme: v })} options={[{ value: 'system', label: '시스템' }, { value: 'light', label: '라이트' }, { value: 'dark', label: '다크' }]} />
        </View>
        <ListRow icon="finger-print" iconBg={INK.lavender} title="앱 잠금" desc={bioOk ? '지문·얼굴·화면 잠금으로 열기' : '이 기기에서는 쓸 수 없어요'} right={sw(s.lock, toggleLock)} />
        <ListRow icon="play-circle-outline" iconBg={INK.mint} title="사용법 다시 보기" onPress={onTour} last />
      </Card>

      <SectionTitle>백업</SectionTitle>
      <Card style={st.group}>
        <ListRow icon="cloud-upload-outline" iconBg={INK.butter} title="백업 파일 만들기" desc={s.lastBackupAt ? `마지막 백업 ${new Date(s.lastBackupAt).toLocaleDateString('ko-KR')}` : '드라이브·메일·메신저에 저장해 두세요'} onPress={() => setPw({ mode: 'backup', text: '', text2: '' })} />
        <ListRow icon="refresh-outline" iconBg={INK.sky} title="백업에서 복원" onPress={startRestore} />
        <ListRow icon="grid-outline" iconBg={INK.mint} title="엑셀용 CSV 내보내기" onPress={() => shareText(`하루가계부-${todayKey()}.csv`, toCsv(data.transactions, data.accounts, data.categories), 'text/csv')} />
        <View style={{ padding: 16, paddingTop: 12 }}>
          <Text style={{ color: t.sub, fontSize: 13, marginBottom: 8 }}>백업 알림</Text>
          <Segmented value={s.backupReminder} onChange={(v) => set({ backupReminder: v })} options={[{ value: 'off', label: '끄기' }, { value: 'weekly', label: '매주' }, { value: 'monthly', label: '매달' }]} />
        </View>
      </Card>
      <Text style={[st.foot, { color: t.faint }]}>
        데이터는 이 휴대폰에만 저장되고 서버로 보내지 않아요. 가입·광고·추적이 없어요. 암호 백업은 AES-256으로 잠겨 비밀번호 없이는 열 수 없어요.
      </Text>

      <SectionTitle>데이터</SectionTitle>
      <Card style={st.group}>
        <ListRow icon="sparkles-outline" iconBg={INK.lavender} title="예시 데이터로 둘러보기" desc="지금 데이터를 4개월치 예시로 바꿔요" onPress={() => ask('예시 데이터', '지금 데이터가 예시로 바뀌어요. 계속할까요?', '바꾸기', loadSample)} />
        <ListRow icon="trash-outline" iconBg={INK.rose} title="모든 데이터 지우기" last onPress={() => ask('모든 데이터 지우기', '기록·계좌·계획이 모두 지워져요. 되돌릴 수 없어요.', '지우기', resetAll)} />
      </Card>
      <Text style={{ color: t.faint, fontSize: 12, textAlign: 'center', marginTop: 24 }}>하루 가계부 v1.0 · 기록 {data.transactions.length}건</Text>

      <Sheet visible={!!acc} onClose={() => setAcc(null)} title="계좌" full>
        {acc && <AccountForm key={acc.id} initial={acc} onClose={() => setAcc(null)} />}
      </Sheet>
      <Sheet visible={catsOpen} onClose={() => setCatsOpen(false)} title="카테고리" full right={<Pressable onPress={() => setCat({ id: uid(), name: '', icon: 'pricetag-outline', color: INK.sky, type: 'expense', keywords: [] })}><Text style={{ color: t.primary, fontSize: 15 }}>추가</Text></Pressable>}>
        <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 20 }}>
          {data.categories.map((c) => (
            <Pressable key={c.id} onPress={() => setCat(c)} style={[st.accRow, { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: t.separator }]}>
              <IconBubble icon={c.icon as any} color={c.color} size={34} />
              <View style={{ flex: 1 }}>
                <Text style={{ color: t.text, fontWeight: '600' }}>{c.name} <Text style={{ color: t.faint, fontSize: 12 }}>{c.type === 'income' ? '수입' : ''}</Text></Text>
                <Text style={{ color: t.sub, fontSize: 12 }} numberOfLines={1}>{c.keywords.slice(0, 8).join(', ') || '단어 없음'}</Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color={t.faint} />
            </Pressable>
          ))}
        </ScrollView>
      </Sheet>
      <Sheet visible={!!cat} onClose={() => setCat(null)} title="카테고리 편집" full>
        {cat && <CategoryForm key={cat.id} initial={cat} onClose={() => setCat(null)} />}
      </Sheet>
      <ImportSheet visible={importOpen} onClose={() => setImportOpen(false)} />
      <Sheet visible={!!pw} onClose={() => setPw(null)} title={pw?.mode === 'restore' ? '암호 백업 열기' : '백업 파일 만들기'}>
        {pw && (
          <View style={{ paddingHorizontal: 20 }}>
            {pw.mode === 'backup' ? (
              <>
                <Text style={{ color: t.sub, lineHeight: 20 }}>비밀번호를 정하면 파일이 AES-256으로 잠겨요. 비밀번호를 잊으면 복원할 수 없으니 꼭 기억해 두세요.</Text>
                <Label icon="key-outline">비밀번호 (선택)</Label>
                <Field value={pw.text} onChangeText={(v) => setPw({ ...pw, text: v })} secureTextEntry placeholder="비워 두면 잠그지 않아요" autoCapitalize="none" />
                {pw.text ? <Field value={pw.text2} onChangeText={(v) => setPw({ ...pw, text2: v })} secureTextEntry placeholder="비밀번호 한 번 더" autoCapitalize="none" style={{ marginTop: 8 }} /> : null}
                <Button label={busy ? '만드는 중…' : pw.text ? '잠근 백업 만들기' : '백업 만들기'} icon="cloud-upload-outline" disabled={busy || (!!pw.text && (pw.text !== pw.text2 || pw.text.length < 4))} style={{ marginTop: 18 }} onPress={() => doBackup(pw.text || null)} />
                {pw.text && pw.text2 && pw.text !== pw.text2 ? <Text style={{ color: t.danger, marginTop: 8 }}>두 비밀번호가 달라요</Text> : null}
              </>
            ) : (
              <>
                <Text style={{ color: t.sub }}>이 백업은 비밀번호로 잠겨 있어요.</Text>
                <Label icon="key-outline">비밀번호</Label>
                <Field value={pw.text} onChangeText={(v) => setPw({ ...pw, text: v })} secureTextEntry autoFocus autoCapitalize="none" />
                <Button label="열기" style={{ marginTop: 18 }} disabled={!pw.text} onPress={() => confirmRestore(pw.file!, pw.text)} />
              </>
            )}
          </View>
        )}
      </Sheet>
    </ScrollView>
  );
}

const st = StyleSheet.create({
  group: { marginHorizontal: 16, padding: 0, overflow: 'hidden' },
  accRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 12 },
  foot: { fontSize: 12, lineHeight: 17, marginHorizontal: 24, marginTop: 8 },
});
