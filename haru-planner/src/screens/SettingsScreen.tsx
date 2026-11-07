import React, { useMemo, useState } from 'react';
import { Alert, Modal, Platform, ScrollView, Share, StyleSheet, Switch, Text, View } from 'react-native';
import { addDays, startOfWeek, todayKey } from '../date';
import { normalize, useStore } from '../store';
import { useTheme } from '../theme';
import { clearPin, setPin, verifyPin } from '../security';
import { requestPermission } from '../notify';
import { Button, Card, Chip, ChipRow, Field, ListRow, ScreenHeader, SectionTitle, Segmented, Sheet } from '../components/ui';
import { Ionicons } from '@expo/vector-icons';
import { PinPad } from './LockScreen';

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

  const sw = (value: boolean, onChange: (v: boolean) => void) => (
    <Switch value={value} onValueChange={onChange} trackColor={{ true: t.primary, false: t.fill }} thumbColor="#fff" ios_backgroundColor={t.fill} />
  );

  return (
    <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
      <ScreenHeader title="설정" />

      <View style={st.statsRow}>
        {[
          { n: stats.streak, l: '연속 달성일', i: 'flame' as const, c: '#F76707' },
          { n: stats.week, l: '이번 주 완료', i: 'checkmark-done' as const, c: t.primary },
          { n: stats.total, l: '총 완료', i: 'trophy' as const, c: '#F59F00' },
        ].map((x) => (
          <Card key={x.l} style={{ flex: 1, paddingVertical: 14, paddingHorizontal: 14 }}>
            <Ionicons name={x.i} size={18} color={x.c} />
            <Text style={{ color: t.text, fontSize: 24, fontWeight: '800', marginTop: 8, letterSpacing: -0.5 }}>{x.n}</Text>
            <Text style={{ color: t.sub, fontSize: 12, marginTop: 1 }}>{x.l}</Text>
          </Card>
        ))}
      </View>

      <SectionTitle>화면</SectionTitle>
      <Card style={st.group}>
        <View style={{ padding: 16, paddingBottom: 6 }}>
          <Text style={[st.caption, { color: t.sub }]}>테마</Text>
          <Segmented value={s.theme} onChange={(v) => updateSettings({ theme: v })} options={[
            { value: 'system', label: '시스템' }, { value: 'light', label: '라이트' }, { value: 'dark', label: '다크' },
          ]} />
          <Text style={[st.caption, { color: t.sub, marginTop: 16 }]}>한 주의 시작</Text>
          <Segmented value={String(s.weekStart) as '0' | '1'} onChange={(v) => updateSettings({ weekStart: v === '1' ? 1 : 0 })} options={[
            { value: '0', label: '일요일' }, { value: '1', label: '월요일' },
          ]} />
        </View>
        <View style={{ height: 10 }} />
      </Card>

      <SectionTitle>알림</SectionTitle>
      <Card style={st.group}>
        <ListRow icon="notifications" iconBg="#F03E3E" title="할 일 알림" desc="알림을 켠 할 일을 시간에 맞춰 알려줘요"
          right={sw(s.notifications, async (v) => {
            if (v && !(await requestPermission()) && Platform.OS !== 'web') Alert.alert('알림 권한이 꺼져 있어요', '휴대폰 설정에서 알림을 허용해 주세요.');
            updateSettings({ notifications: v });
          })} />
        <View style={{ paddingHorizontal: 16, paddingTop: 12, paddingBottom: 14 }}>
          <Text style={[st.caption, { color: t.sub }]}>미리 알림</Text>
          <ChipRow>
            {[0, 5, 10, 30, 60].map((m) => (
              <Chip key={m} label={m === 0 ? '정시' : m === 60 ? '1시간 전' : `${m}분 전`} active={s.defaultReminderMin === m} onPress={() => updateSettings({ defaultReminderMin: m })} />
            ))}
          </ChipRow>
          <Text style={{ color: t.faint, fontSize: 12, marginTop: 10, lineHeight: 17 }}>시간이 없는 할 일은 당일 오전 9시에 알려줘요.</Text>
        </View>
      </Card>

      <SectionTitle>보안</SectionTitle>
      <Card style={st.group}>
        <ListRow icon="lock-closed" iconBg="#495057" title="PIN 잠금" desc={s.pinEnabled ? '앱을 열 때 PIN이 필요해요' : '다른 사람이 앱을 열지 못하게 잠가요'}
          last={!s.pinEnabled}
          right={sw(s.pinEnabled, (v) => setPinFlow(v ? { step: 'new', then: 'set' } : { step: 'verify', then: 'off' }))} />
        {s.pinEnabled && <ListRow icon="keypad" iconBg="#868E96" title="PIN 변경" last onPress={() => setPinFlow({ step: 'verify', then: 'set' })} />}
      </Card>
      <Text style={[st.foot, { color: t.faint }]}>
        모든 데이터는 이 기기에만 저장되며 외부로 전송되지 않아요. 광고·추적 도구가 없고, PIN은 기기 보안 저장소에 암호화된 해시로만 보관돼요.
      </Text>

      <SectionTitle>데이터</SectionTitle>
      <Card style={st.group}>
        <ListRow icon="share-outline" iconBg="#1098AD" title="백업 내보내기" desc="메신저·메일·메모 앱에 백업을 저장해요" onPress={exportData} />
        <ListRow icon="download-outline" iconBg="#2B9A66" title="백업 불러오기" desc="저장해 둔 백업 텍스트로 복원해요" onPress={() => setImportOpen(true)} />
        <ListRow icon="trash-outline" iconBg="#E03131" title="모든 데이터 초기화" last onPress={reset} />
      </Card>

      <Text style={{ color: t.faint, fontSize: 12, textAlign: 'center', marginTop: 28 }}>
        하루 플래너 v1.1 · 남은 할 일 {stats.open}개
      </Text>

      <Modal visible={!!pinFlow} animationType="fade" onRequestClose={() => setPinFlow(null)}>
        <PinPad title={pinTitle} error={pinFlow?.err} onSubmit={onPin} onCancel={() => setPinFlow(null)} />
      </Modal>

      <Sheet visible={importOpen} onClose={() => setImportOpen(false)} title="백업 불러오기">
        <View style={{ paddingHorizontal: 20 }}>
          <Field value={importText} onChangeText={setImportText} multiline placeholder='내보낸 백업 텍스트를 붙여넣으세요'
            style={{ minHeight: 160, textAlignVertical: 'top', fontSize: 13 }} autoCorrect={false} autoCapitalize="none" />
          <Button label="불러오기" disabled={!importText.trim()} onPress={doImport} style={{ marginTop: 14 }} />
        </View>
      </Sheet>
    </ScrollView>
  );
}

const st = StyleSheet.create({
  statsRow: { flexDirection: 'row', gap: 10, paddingHorizontal: 16, marginBottom: 6 },
  group: { marginHorizontal: 16, padding: 0, overflow: 'hidden' },
  caption: { fontSize: 13, fontWeight: '600', marginBottom: 8 },
  foot: { fontSize: 12, lineHeight: 17, marginHorizontal: 24, marginTop: 8 },
});
