import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../theme';
import { Ionicons } from '@expo/vector-icons';
import { tap } from '../components/ui';

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', 'del'];

/** 4자리 PIN 입력 패드. mode=verify 는 잠금 해제, mode=set 은 두 번 입력해 설정 */
export function PinPad({ title, subtitle, onSubmit, onCancel, error }: {
  title: string; subtitle?: string; onSubmit: (pin: string) => void | Promise<void>; onCancel?: () => void; error?: string;
}) {
  const t = useTheme();
  const [pin, setPin] = useState('');

  useEffect(() => {
    if (error) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
      setPin('');
    }
  }, [error]);

  const press = (k: string) => {
    if (!k) return;
    tap();
    if (k === 'del') return setPin((p) => p.slice(0, -1));
    const next = (pin + k).slice(0, 4);
    setPin(next);
    if (next.length === 4) setTimeout(() => { onSubmit(next); setPin(''); }, 120);
  };

  return (
    <View style={[st.wrap, { backgroundColor: t.bg }]}>
      <View style={{ width: 64, height: 64, borderRadius: 22, backgroundColor: t.primarySoft, alignItems: 'center', justifyContent: 'center' }}>
        <Ionicons name="lock-closed" size={28} color={t.primary} />
      </View>
      <Text style={{ color: t.text, fontSize: 20, fontWeight: '800', marginTop: 12 }}>{title}</Text>
      <Text style={{ color: error ? t.danger : t.sub, fontSize: 14, marginTop: 6, minHeight: 20 }}>{error || subtitle || ' '}</Text>
      <View style={st.dots}>
        {[0, 1, 2, 3].map((i) => (
          <View key={i} style={[st.dot, { borderColor: t.primary, backgroundColor: i < pin.length ? t.primary : 'transparent' }]} />
        ))}
      </View>
      <View style={st.pad}>
        {KEYS.map((k, i) => (
          <Pressable key={i} onPress={() => press(k)} disabled={!k} accessibilityLabel={k === 'del' ? '지우기' : k}
            style={({ pressed }) => [st.key, { backgroundColor: k && k !== 'del' ? (pressed ? t.primarySoft : t.fill) : 'transparent' }]}>
            {k === 'del' ? <Ionicons name="backspace-outline" size={26} color={t.text} /> : <Text style={{ color: t.text, fontSize: 26, fontWeight: '500' }}>{k}</Text>}
          </Pressable>
        ))}
      </View>
      {onCancel && (
        <Pressable onPress={onCancel} hitSlop={12} style={{ marginTop: 16 }}>
          <Text style={{ color: t.sub, fontSize: 16 }}>취소</Text>
        </Pressable>
      )}
    </View>
  );
}

const st = StyleSheet.create({
  wrap: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  dots: { flexDirection: 'row', gap: 18, marginVertical: 28 },
  dot: { width: 14, height: 14, borderRadius: 7, borderWidth: 2 },
  pad: { flexDirection: 'row', flexWrap: 'wrap', width: 280, justifyContent: 'space-between', rowGap: 14 },
  key: { width: 80, height: 80, borderRadius: 40, alignItems: 'center', justifyContent: 'center' },
});
