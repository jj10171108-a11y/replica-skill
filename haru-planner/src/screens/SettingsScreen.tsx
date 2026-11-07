import React, { useMemo, useState } from 'react';
import { Alert, Modal, Platform, Pressable, ScrollView, Share, StyleSheet, Switch, Text, View } from 'react-native';
import { addDays, startOfWeek, todayKey } from '../date';
import { normalize, useStore } from '../store';
import { useTheme } from '../theme';
import { clearPin, setPin, verifyPin } from '../security';
import { requestPermission } from '../notify';
import { Button, Card, Chip, ChipRow, Field, Label, ScreenHeader, Sheet } from '../components/ui';
import { PinPad } from './LockScreen';

function Row({ title, desc, right, onPress }: { title: string; desc?: string; right?: React.ReactNode; onPress?: () => void }) {
  const t = useTheme();
  return (
    <Pressable onPress={onPress} disabled={!onPress} style={({ pressed }) => [st.row, { opacity: pressed ? 0.6 : 1 }]}>
      <View style={{ flex: 1 }}>
        <Text style={{ color: t.text, fontSize: 16, fontWeight: '600' }}>{title}</Text>
        {desc ? <Text style={{ color: t.sub, fontSize: 13, marginTop: 2 }}>{desc}</Text> : null}
      </View>
      {right ?? (onPress ? <Text style={{ color: t.faint, fontSize: 20 }}>›</Text> : null)}
    </Pressable>
  );
}

export function SettingsScreen() {
  const t = useTheme();
  const { data, updateSettings, replaceAll, resetAll } = useStore();
  const s = data.settings;
  const [pinFlow, setPinFlow] = useState<null | { step: 'verify' | 'new' | 'confirm'; first?: string; err?: string; then: 'set' | 'off' }>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [importText, setImportText] = useState('');

  const stats = useMemo(() => {
    const today = todayKey();
    const doneDays = new Set(data.tasks.filter((x) => x.done && x.doneAt).map((x) => {
      const d = new Date(x.doneAt!);
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    }));
    let streak = 0;
    let k = doneDays.has(today) ? today : addDays(today, -1);
    while (doneDays.has(k)) { streak++; k = addDays(k, -1); }
    const weekStart = startOfWeek(today, s.weekStart);
    const weekStartMs = new Date(weekStart + 'T00:00:00').getTime();
    return {
      total: data.tasks.filter((x) => x.done).length,
      open: data.tasks.filter((x) => !x.done).length,
      week: data.tasks.filter((x) => x.done && (x.doneAt ?? 0) >= weekStartMs).length,
      streak,
    };
  }, [data.tasks, s.weekStart]);

  const onPin = async (pin: string) => {
    if (!pinFlow) return;
    if (pinFlow.step === 'verify') {
      if (!(await verifyPin(pin))) return setPinFlow({ ...pinFlow, err: 'PIN이 일치하지 않아요' });
      if (pinFlow.then === 'off') {
        await clearPin();
        updateSettings({ pinEnabled: false });
        setPinFlow(null);
      } else setPinFlow({ step: 'new', then: 'set' });
      return;
    }
    if (pinFlow.step === 'new') return setPinFlow({ step: 'confirm', first: pin, then: 'set' });
    if (pin !== pinFlow.first) return setPinFlow({ step: 'new', then: 'set', err: '두 PIN이 달라요. 다시 입력해 주세요' });
    await setPin(pin);
    updateSettings({ pinEnabled: true });
    setPinFlow(null);
    Alert.alert('잠금 설정 완료', '앱을 열 때마다 PIN을 입력해야 해요.');
  };

  const exportData = async () => {
    const json = JSON.stringify({ ...data, exportedAt: new Date().toISOString() });
    try {
      await Share.share({ title: '하루 플래너 백업', message: json });
    } catch (e: any) {
      Alert.alert('내보내기 실패', String(e?.message ?? e));
    }
  };

  const doImport = () => {
    try {
      const next = normalize(JSON.parse(importText.trim()));
      Alert.alert('백업 불러오기', `할 일 ${next.tasks.length}개, 메모 ${next.notes.length}개로 현재 데이터를 덮어쓸까요?`, [
        { text: '취소', style: 'cancel' },
        { text: '불러오기', style: 'destructive', onPress: async () => { await replaceAll(next); setImportOpen(false); setImportText(''); } },
      ]);
    } catch (e: any) {
      Alert.alert('불러오기 실패', e?.message?.includes('JSON') ? '백업 텍스트 형식이 올바르지 않아요' : String(e?.message ?? e));
    }
  };

  const reset = () => {
    Alert.alert('모든 데이터 초기화', '할 일, 프로젝트, 목표, 메모가 모두 삭제돼요. 되돌릴 수 없어요.', [
      { text: '취소', style: 'cancel' },
      { text: '초기화', style: 'destructive', onPress: resetAll },
    ]);
  };

  const pinTitle = pinFlow?.step === 'verify' ? '현재 PIN 입력' : pinFlow?.step === 'new' ? '새 PIN 4자리' : 'PIN 한 번 더 입력';

  return (
    <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
      <ScreenHeader title="설정" />

      <View style={st.statsRow}>
        {[
          { n: stats.streak, l: '연속 달성일', e: '🔥' },
          { n: stats.week, l: '이번 주 완료', e: '✅' },
          { n: stats.total, l: '총 완료', e: '🏆' },
        ].map((x) => (
          <Card key={x.l} style={{ flex: 1, alignItems: 'center', paddingVertical: 14, paddingHorizontal: 6 }}>
            <Text style={{ fontSize: 20 }}>{x.e}</Text>
            <Text style={{ color: t.text, fontSize: 22, fontWeight: '800', marginTop: 4 }}>{x.n}</Text>
            <Text style={{ color: t.sub, fontSize: 12 }}>{x.l}</Text>
          </Card>
        ))}
      </View>

      <Text style={[st.section, { color: t.sub }]}>화면</Text>
      <Card style={st.group}>
        <Label>테마</Label>
        <ChipRow>
          <Chip label="시스템 설정" active={s.theme === 'system'} onPress={() => updateSettings({ theme: 'system' })} />
          <Chip label="☀️ 라이트" active={s.theme === 'light'} onPress={() => updateSettings({ theme: 'light' })} />
          <Chip label="🌙 다크" active={s.theme === 'dark'} onPress={() => updateSettings({ theme: 'dark' })} />
        </ChipRow>
        <Label>한 주의 시작</Label>
        <ChipRow>
          <Chip label="일요일" active={s.weekStart === 0} onPress={() => updateSettings({ weekStart: 0 })} />
          <Chip label="월요일" active={s.weekStart === 1} onPress={() => updateSettings({ weekStart: 1 })} />
        </ChipRow>
      </Card>

      <Text style={[st.section, { color: t.sub }]}>알림</Text>
      <Card style={st.group}>
        <Row title="할 일 알림" desc="알림을 켠 할 일을 시간에 맞춰 알려줘요" right={
          <Switch value={s.notifications} trackColor={{ true: t.primary, false: t.border }} thumbColor="#fff"
            onValueChange={async (v) => {
              if (v && !(await requestPermission()) && Platform.OS !== 'web') Alert.alert('알림 권한이 꺼져 있어요', '휴대폰 설정에서 알림을 허용해 주세요.');
              updateSettings({ notifications: v });
            }} />
        } />
        <Label>미리 알림</Label>
        <ChipRow>
          {[0, 5, 10, 30, 60].map((m) => (
            <Chip key={m} label={m === 0 ? '정시' : m === 60 ? '1시간 전' : `${m}분 전`} active={s.defaultReminderMin === m} onPress={() => updateSettings({ defaultReminderMin: m })} />
          ))}
        </ChipRow>
        <Text style={{ color: t.faint, fontSize: 12, marginTop: 8 }}>시간이 없는 할 일은 당일 오전 9시에 알려줘요. 변경 사항은 새로 저장하는 할 일부터 적용돼요.</Text>
      </Card>

      <Text style={[st.section, { color: t.sub }]}>보안 · 개인정보</Text>
      <Card style={st.group}>
        <Row title="PIN 잠금" desc={s.pinEnabled ? '사용 중 · 앱을 열 때 PIN 필요' : '앱을 다른 사람이 열지 못하게 잠가요'} right={
          <Switch value={s.pinEnabled} trackColor={{ true: t.primary, false: t.border }} thumbColor="#fff"
            onValueChange={(v) => setPinFlow(v ? { step: 'new', then: 'set' } : { step: 'verify', then: 'off' })} />
        } />
        {s.pinEnabled && <Row title="PIN 변경" onPress={() => setPinFlow({ step: 'verify', then: 'set' })} />}
        <Text style={{ color: t.faint, fontSize: 12, marginTop: 6, lineHeight: 18 }}>
          모든 데이터는 이 기기에만 저장되고 외부 서버로 전송되지 않아요. 광고·추적 SDK가 없어요. PIN은 기기 보안 저장소에 암호화된 해시로만 보관돼요.
        </Text>
      </Card>

      <Text style={[st.section, { color: t.sub }]}>데이터</Text>
      <Card style={st.group}>
        <Row title="백업 내보내기" desc="카카오톡·메일·메모 앱 등에 백업 텍스트를 저장해요" onPress={exportData} />
        <Row title="백업 불러오기" desc="내보낸 백업 텍스트를 붙여넣어 복원해요" onPress={() => setImportOpen(true)} />
        <Row title="모든 데이터 초기화" onPress={reset} right={<Text style={{ color: t.danger }}>초기화</Text>} />
      </Card>

      <Text style={{ color: t.faint, fontSize: 12, textAlign: 'center', marginTop: 24 }}>
        하루 플래너 v1.0 · 남은 할 일 {stats.open}개
      </Text>

      <Modal visible={!!pinFlow} animationType="fade" onRequestClose={() => setPinFlow(null)}>
        <PinPad title={pinTitle} error={pinFlow?.err} onSubmit={onPin} onCancel={() => setPinFlow(null)} />
      </Modal>

      <Sheet visible={importOpen} onClose={() => setImportOpen(false)} title="백업 불러오기">
        <View style={{ paddingHorizontal: 20 }}>
          <Field value={importText} onChangeText={setImportText} multiline placeholder='{"version":1,"tasks":[...]} 형태의 백업 텍스트를 붙여넣으세요'
            style={{ minHeight: 160, textAlignVertical: 'top', fontSize: 13 }} autoCorrect={false} autoCapitalize="none" />
          <Button label="불러오기" disabled={!importText.trim()} onPress={doImport} style={{ marginTop: 14 }} />
        </View>
      </Sheet>
    </ScrollView>
  );
}

const st = StyleSheet.create({
  statsRow: { flexDirection: 'row', gap: 10, paddingHorizontal: 16 },
  section: { fontSize: 13, fontWeight: '800', marginHorizontal: 20, marginTop: 24, marginBottom: 8 },
  group: { marginHorizontal: 16, paddingTop: 4 },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, gap: 12 },
});
