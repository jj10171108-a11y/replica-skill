import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, AppState, Pressable, StyleSheet, Text, useColorScheme, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider, SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as LocalAuthentication from 'expo-local-authentication';
import { StoreProvider, useStore } from './src/store';
import { cardShadow, dark, light, ThemeContext, useTheme } from './src/theme';
import { PortalProvider } from './src/components/portal';
import { EntryProvider } from './src/components/EntrySheet';
import { Button, IconName, tap } from './src/components/ui';
import { HomeScreen } from './src/screens/HomeScreen';
import { TransactionsScreen } from './src/screens/TransactionsScreen';
import { PlanScreen } from './src/screens/PlanScreen';
import { InsightsScreen } from './src/screens/InsightsScreen';
import { SettingsScreen } from './src/screens/SettingsScreen';
import { Tour } from './src/screens/Tour';

type Tab = 'home' | 'tx' | 'plan' | 'insights' | 'settings';
const TABS: { key: Tab; icon: IconName; iconOn: IconName; label: string }[] = [
  { key: 'home', icon: 'home-outline', iconOn: 'home', label: '홈' },
  { key: 'tx', icon: 'receipt-outline', iconOn: 'receipt', label: '내역' },
  { key: 'plan', icon: 'calendar-outline', iconOn: 'calendar', label: '계획' },
  { key: 'insights', icon: 'pie-chart-outline', iconOn: 'pie-chart', label: '분석' },
  { key: 'settings', icon: 'settings-outline', iconOn: 'settings', label: '설정' },
];
const RELOCK_MS = 60_000;

function TabBar({ tab, onChange }: { tab: Tab; onChange: (t: Tab) => void }) {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <View style={{ backgroundColor: t.bg, paddingHorizontal: 14, paddingTop: 6, paddingBottom: Math.max(insets.bottom, 10) }}>
      <View style={[st.tabBar, { backgroundColor: t.card }, cardShadow(t), t.dark && { borderWidth: 1, borderColor: t.border }]}>
        {TABS.map((x) => {
          const on = x.key === tab;
          return (
            <Pressable key={x.key} style={st.tabItem} onPress={() => { tap(); onChange(x.key); }} accessibilityRole="tab" accessibilityState={{ selected: on }} accessibilityLabel={x.label}>
              <View style={[st.tabPill, on && { backgroundColor: t.primarySoft }]}>
                <Ionicons name={on ? x.iconOn : x.icon} size={22} color={on ? t.primaryInk : t.faint} />
              </View>
              <Text style={{ fontSize: 11, marginTop: 2, color: on ? t.primaryInk : t.faint, fontWeight: on ? '700' : '500' }}>{x.label}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

function Main() {
  const t = useTheme();
  const { data, updateSettings, loadSample } = useStore();
  const [tab, setTab] = useState<Tab>('home');
  const [planKey, setPlanKey] = useState(0);
  const [settingsFocus, setSettingsFocus] = useState<string | undefined>();
  const [tour, setTour] = useState(!data.settings.onboarded);
  const go = useCallback((k: 'tx' | 'plan' | 'insights' | 'settings', sub?: string) => {
    if (k === 'settings') setSettingsFocus(sub ? `${sub}:${Date.now()}` : undefined);
    if (k === 'plan') setPlanKey((n) => n + 1);
    setTab(k);
  }, []);
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: t.bg }} edges={['top', 'left', 'right']}>
      <View style={{ flex: 1 }}>
        {tab === 'home' && <HomeScreen go={go} />}
        {tab === 'tx' && <TransactionsScreen />}
        {tab === 'plan' && <PlanScreen key={planKey} />}
        {tab === 'insights' && <InsightsScreen />}
        {tab === 'settings' && <SettingsScreen focus={settingsFocus} onTour={() => setTour(true)} />}
      </View>
      <TabBar tab={tab} onChange={(k) => { setSettingsFocus(undefined); setTab(k); }} />
      {tour && (
        <Tour
          onDone={() => { setTour(false); updateSettings({ onboarded: true }); }}
          onSample={data.transactions.length === 0 ? () => { loadSample(); setTour(false); } : undefined}
        />
      )}
    </SafeAreaView>
  );
}

function LockScreen({ onUnlock }: { onUnlock: () => void }) {
  const t = useTheme();
  const [err, setErr] = useState('');
  const auth = useCallback(async () => {
    try {
      const r = await LocalAuthentication.authenticateAsync({ promptMessage: '하루 가계부 열기', cancelLabel: '취소' });
      if (r.success) onUnlock(); else setErr('다시 시도해 주세요');
    } catch { setErr('잠금을 풀 수 없어요'); }
  }, [onUnlock]);
  useEffect(() => { auth(); }, [auth]);
  return (
    <View style={[st.center, { backgroundColor: t.bg, padding: 32 }]}>
      <View style={{ width: 80, height: 80, borderRadius: 40, backgroundColor: t.primarySoft, alignItems: 'center', justifyContent: 'center' }}>
        <Ionicons name="finger-print" size={40} color={t.primaryInk} />
      </View>
      <Text style={{ color: t.text, fontSize: 20, fontWeight: '800', marginTop: 18 }}>하루 가계부가 잠겨 있어요</Text>
      <Text style={{ color: err ? t.danger : t.sub, marginTop: 8 }}>{err || '지문·얼굴·화면 잠금으로 열어 주세요'}</Text>
      <Button label="잠금 풀기" icon="lock-open-outline" onPress={auth} style={{ marginTop: 28, alignSelf: 'stretch' }} />
    </View>
  );
}

function Gate() {
  const { data, loaded } = useStore();
  const system = useColorScheme();
  const mode = data.settings.theme === 'system' ? system : data.settings.theme;
  const theme = mode === 'dark' ? dark : light;
  const [locked, setLocked] = useState<boolean | null>(null);
  const bgAt = useRef<number | null>(null);

  useEffect(() => { if (loaded && locked === null) setLocked(data.settings.lock); }, [loaded, locked, data.settings.lock]);
  useEffect(() => {
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'background') bgAt.current = Date.now();
      if (s === 'active' && bgAt.current && Date.now() - bgAt.current > RELOCK_MS && data.settings.lock) setLocked(true);
      if (s === 'active') bgAt.current = null;
    });
    return () => sub.remove();
  }, [data.settings.lock]);

  let body: React.ReactNode;
  if (!loaded || locked === null) body = <View style={[st.center, { backgroundColor: theme.bg }]}><ActivityIndicator color={theme.primary} /></View>;
  else if (locked) body = <LockScreen onUnlock={() => setLocked(false)} />;
  else body = (
    <PortalProvider>
      <EntryProvider>
        <Main />
      </EntryProvider>
    </PortalProvider>
  );
  return (
    <ThemeContext.Provider value={theme}>
      <StatusBar style={theme.dark ? 'light' : 'dark'} />
      <View style={{ flex: 1, backgroundColor: theme.bg }}>{body}</View>
    </ThemeContext.Provider>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <StoreProvider>
        <Gate />
      </StoreProvider>
    </SafeAreaProvider>
  );
}

const st = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  tabBar: { flexDirection: 'row', borderRadius: 28, paddingVertical: 8, paddingHorizontal: 4 },
  tabItem: { flex: 1, alignItems: 'center' },
  tabPill: { width: 52, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
});
