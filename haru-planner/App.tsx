import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, AppState, Pressable, StyleSheet, Text, useColorScheme, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider, SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { StoreProvider, useStore } from './src/store';
import { dark, light, ThemeContext, useTheme } from './src/theme';
import { EditorProvider } from './src/components/TaskEditor';
import { tap } from './src/components/ui';
import { TasksScreen } from './src/screens/TasksScreen';
import { CalendarScreen } from './src/screens/CalendarScreen';
import { ProjectsScreen } from './src/screens/ProjectsScreen';
import { NoteEditorProvider, NotesScreen } from './src/screens/NotesScreen';
import { SettingsScreen } from './src/screens/SettingsScreen';
import { PinPad } from './src/screens/LockScreen';
import { hasPin, verifyPin } from './src/security';
import { initNotifications } from './src/notify';

type Tab = 'tasks' | 'calendar' | 'projects' | 'notes' | 'settings';
const TABS: { key: Tab; icon: string; label: string }[] = [
  { key: 'tasks', icon: '✅', label: '할 일' },
  { key: 'calendar', icon: '📅', label: '캘린더' },
  { key: 'projects', icon: '🎯', label: '프로젝트' },
  { key: 'notes', icon: '📝', label: '메모' },
  { key: 'settings', icon: '⚙️', label: '설정' },
];

const RELOCK_AFTER_MS = 60_000;

function TabBar({ tab, onChange }: { tab: Tab; onChange: (t: Tab) => void }) {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <View style={[st.tabBar, { backgroundColor: t.card, borderTopColor: t.border, paddingBottom: Math.max(insets.bottom, 8) }]}>
      {TABS.map((x) => {
        const on = x.key === tab;
        return (
          <Pressable key={x.key} style={st.tabItem} onPress={() => { tap(); onChange(x.key); }} accessibilityRole="tab" accessibilityState={{ selected: on }}>
            <View style={[st.tabIcon, on && { backgroundColor: t.primarySoft }]}>
              <Text style={{ fontSize: 18, opacity: on ? 1 : 0.55 }}>{x.icon}</Text>
            </View>
            <Text style={{ fontSize: 11, marginTop: 2, color: on ? t.primary : t.sub, fontWeight: on ? '800' : '500' }}>{x.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function Main() {
  const t = useTheme();
  const [tab, setTab] = useState<Tab>('tasks');
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: t.bg }} edges={['top', 'left', 'right']}>
      <View style={{ flex: 1 }}>
        {tab === 'tasks' && <TasksScreen />}
        {tab === 'calendar' && <CalendarScreen />}
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
      <EditorProvider>
        <NoteEditorProvider>
          <Main />
        </NoteEditorProvider>
      </EditorProvider>
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
  tabBar: { flexDirection: 'row', borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 6 },
  tabItem: { flex: 1, alignItems: 'center' },
  tabIcon: { width: 48, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
});
