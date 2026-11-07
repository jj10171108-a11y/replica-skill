import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, AppState, Linking, Pressable, StyleSheet, Text, useColorScheme, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider, SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { StoreProvider, useStore } from './src/store';
import { cardShadow, dark, light, ThemeContext, useTheme } from './src/theme';
import { EditorProvider, useEditor } from './src/components/TaskEditor';
import { PortalProvider } from './src/components/portal';
import { todayKey } from './src/date';
import { IconName, tap } from './src/components/ui';
import { Ionicons } from '@expo/vector-icons';
import { TasksScreen } from './src/screens/TasksScreen';
import { CalendarScreen } from './src/screens/CalendarScreen';
import { ProjectsScreen } from './src/screens/ProjectsScreen';
import { NoteEditorProvider, NotesScreen } from './src/screens/NotesScreen';
import { SettingsScreen } from './src/screens/SettingsScreen';
import { PinPad } from './src/screens/LockScreen';
import { hasPin, verifyPin } from './src/security';
import { initNotifications } from './src/notify';
import { checkAndApplyUpdate } from './src/updates';

type Tab = 'tasks' | 'calendar' | 'projects' | 'notes' | 'settings';
const TABS: { key: Tab; icon: IconName; iconOn: IconName; label: string }[] = [
  { key: 'tasks', icon: 'checkmark-circle-outline', iconOn: 'checkmark-circle', label: '할 일' },
  { key: 'calendar', icon: 'calendar-clear-outline', iconOn: 'calendar-clear', label: '캘린더' },
  { key: 'projects', icon: 'folder-open-outline', iconOn: 'folder-open', label: '프로젝트' },
  { key: 'notes', icon: 'document-text-outline', iconOn: 'document-text', label: '메모' },
  { key: 'settings', icon: 'settings-outline', iconOn: 'settings', label: '설정' },
];

const RELOCK_AFTER_MS = 60_000;

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

let handledInitialUrl = false;

function Main() {
  const t = useTheme();
  const [tab, setTab] = useState<Tab>('tasks');
  const [focusDate, setFocusDate] = useState<{ date: string; n: number } | null>(null);
  const { openTask } = useEditor();

  // 위젯에서 누른 링크 처리: haruplanner://calendar?date=..., ://tasks, ://new
  useEffect(() => {
    const handle = (url: string | null | undefined) => {
      if (!url) return;
      const m = url.match(/^haruplanner:\/\/([a-z]+)(?:\?date=(\d{4}-\d{2}-\d{2}))?/);
      if (!m) return;
      const [, path, date] = m;
      if (path === 'calendar') {
        setTab('calendar');
        setFocusDate({ date: date ?? todayKey(), n: Date.now() });
      } else if (path === 'tasks') {
        setTab('tasks');
      } else if (path === 'new') {
        setTab('tasks');
        setTimeout(() => openTask({ due: date ?? todayKey() }), 150);
      }
    };
    if (!handledInitialUrl) {
      handledInitialUrl = true;
      Linking.getInitialURL().then(handle).catch(() => {});
    }
    const sub = Linking.addEventListener('url', (e) => handle(e.url));
    return () => sub.remove();
  }, [openTask]);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: t.bg }} edges={['top', 'left', 'right']}>
      <View style={{ flex: 1 }}>
        {tab === 'tasks' && <TasksScreen />}
        {tab === 'calendar' && <CalendarScreen focus={focusDate} />}
        {tab === 'projects' && <ProjectsScreen />}
        {tab === 'notes' && <NotesScreen />}
        {tab === 'settings' && <SettingsScreen />}
      </View>
      <TabBar tab={tab} onChange={setTab} />
    </SafeAreaView>
  );
}

function Gate() {
  const { data, loaded } = useStore();
  const system = useColorScheme();
  const mode = data.settings.theme === 'system' ? system : data.settings.theme;
  const theme = mode === 'dark' ? dark : light;
  const [locked, setLocked] = useState<boolean | null>(null);
  const [err, setErr] = useState('');
  const bgAt = useRef<number | null>(null);

  useEffect(() => { initNotifications(); }, []);

  // 자동 업데이트: 앱을 켤 때 + 30분 넘게 쉬다 돌아왔을 때 새 버전 확인
  const lastCheck = useRef(0);
  useEffect(() => {
    const run = () => { lastCheck.current = Date.now(); checkAndApplyUpdate(); };
    const first = setTimeout(run, 3000);
    const sub = AppState.addEventListener('change', (st) => {
      if (st === 'active' && Date.now() - lastCheck.current > 30 * 60_000) run();
    });
    return () => { clearTimeout(first); sub.remove(); };
  }, []);

  useEffect(() => {
    if (!loaded) return;
    if (locked === null) {
      hasPin().then((has) => setLocked(data.settings.pinEnabled && has)).catch(() => setLocked(false));
    }
  }, [loaded, locked, data.settings.pinEnabled]);

  // 백그라운드에서 일정 시간 지나 돌아오면 다시 잠금
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'background') bgAt.current = Date.now();
      if (state === 'active' && bgAt.current && Date.now() - bgAt.current > RELOCK_AFTER_MS && data.settings.pinEnabled) {
        setLocked(true);
      }
      if (state === 'active') bgAt.current = null;
    });
    return () => sub.remove();
  }, [data.settings.pinEnabled]);

  let body: React.ReactNode;
  if (!loaded || locked === null) {
    body = <View style={[st.center, { backgroundColor: theme.bg }]}><ActivityIndicator color={theme.primary} /></View>;
  } else if (locked) {
    body = (
      <PinPad
        title="하루 플래너 잠금"
        subtitle="PIN 4자리를 입력하세요"
        error={err}
        onSubmit={async (pin) => {
          if (await verifyPin(pin)) { setErr(''); setLocked(false); } else setErr('PIN이 올바르지 않아요');
        }}
      />
    );
  } else {
    body = (
      <PortalProvider>
        <EditorProvider>
          <NoteEditorProvider>
            <Main />
          </NoteEditorProvider>
        </EditorProvider>
      </PortalProvider>
    );
  }

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
  tabPill: { width: 52, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  tabItem: { flex: 1, alignItems: 'center', paddingTop: 2 },
});
