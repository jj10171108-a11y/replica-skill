import React, { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, Easing, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { tint, useTheme } from '../theme';
import { INK } from '../domain/defaults';
import { Button } from '../components/ui';

const STEPS = [
  { icon: 'sparkles' as const, color: INK.lavender, title: '말하듯 쓰면 기록 끝', body: '"점심 12000 체크카드", "TV 48만 10개월 할부"처럼 쓰거나 키보드 마이크로 말하세요. 금액·카테고리·계좌·날짜·할부를 알아서 채워요.' },
  { icon: 'analytics' as const, color: INK.sky, title: '월말을 미리 알려 줘요', body: '내 기록으로 2,000가지 경우를 계산해서 월말 잔액과 적자 확률을 보여 줘요. 급여·월세·구독도 스스로 찾아요.' },
  { icon: 'card' as const, color: INK.peach, title: '카드·할부·빚을 한눈에', body: '할부 회차는 맞는 청구서에, 남은 한도와 결제일, 빚의 숨은 이자와 다 갚는 날까지 정리해요.' },
  { icon: 'lock-closed' as const, color: INK.mint, title: '내 휴대폰에만 저장', body: '가입·광고·추적이 없어요. 지문으로 잠그고, 원할 때 암호 백업을 드라이브에 저장하세요.' },
];

export function Tour({ onDone, onSample }: { onDone: () => void; onSample?: () => void }) {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const [i, setI] = useState(0);
  const anim = useRef(new Animated.Value(0)).current;
  const float = useRef(new Animated.Value(0)).current;
  const [reduce, setReduce] = useState(false);

  useEffect(() => { AccessibilityInfo.isReduceMotionEnabled().then(setReduce).catch(() => {}); }, []);
  useEffect(() => {
    anim.setValue(reduce ? 1 : 0);
    if (!reduce) Animated.timing(anim, { toValue: 1, duration: 420, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
  }, [i, reduce, anim]);
  useEffect(() => {
    if (reduce) return;
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(float, { toValue: 1, duration: 1400, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      Animated.timing(float, { toValue: 0, duration: 1400, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
    ]));
    loop.start();
    return () => loop.stop();
  }, [reduce, float]);

  const s = STEPS[i];
  const p = tint(t, s.color);
  const last = i === STEPS.length - 1;
  return (
    <View style={[st.wrap, { backgroundColor: t.bg, paddingTop: insets.top + 12, paddingBottom: insets.bottom + 16 }]}>
      <Pressable onPress={onDone} style={{ alignSelf: 'flex-end', padding: 12 }}><Text style={{ color: t.sub, fontSize: 15 }}>건너뛰기</Text></Pressable>
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 28 }}>
        <Animated.View style={[st.blob, { backgroundColor: p.bg, opacity: anim, transform: [
          { scale: anim.interpolate({ inputRange: [0, 1], outputRange: [0.8, 1] }) },
          { translateY: float.interpolate({ inputRange: [0, 1], outputRange: [0, -10] }) },
        ] }]}>
          <Ionicons name={s.icon} size={72} color={p.ink} />
        </Animated.View>
        <Animated.Text style={{ color: t.text, fontSize: 26, fontWeight: '800', textAlign: 'center', marginTop: 36, letterSpacing: -0.6, opacity: anim,
          transform: [{ translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [16, 0] }) }] }}>{s.title}</Animated.Text>
        <Animated.Text style={{ color: t.sub, fontSize: 16, lineHeight: 24, textAlign: 'center', marginTop: 14, opacity: anim }}>{s.body}</Animated.Text>
      </View>
      <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 8, marginBottom: 22 }}>
        {STEPS.map((_, k) => <View key={k} style={{ width: k === i ? 22 : 8, height: 8, borderRadius: 4, backgroundColor: k === i ? t.primary : t.border }} />)}
      </View>
      <View style={{ paddingHorizontal: 20, gap: 10 }}>
        <Button label={last ? '시작하기' : '다음'} onPress={() => (last ? onDone() : setI(i + 1))} />
        {last && onSample ? <Button label="예시 데이터로 둘러보기" kind="ghost" onPress={onSample} /> : null}
      </View>
    </View>
  );
}

const st = StyleSheet.create({
  wrap: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  blob: { width: 180, height: 180, borderRadius: 90, alignItems: 'center', justifyContent: 'center' },
});
