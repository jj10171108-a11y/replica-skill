import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import Svg, { Circle, Defs, LinearGradient, Line, Path, Rect, Stop, Text as SvgText } from 'react-native-svg';
import { Ionicons } from '@expo/vector-icons';
import { useLookup, useStore } from '../store';
import { tint, useTheme, Theme } from '../theme';
import { fmt } from '../domain/money';
import { addMonthsYM, daysInMonth, formatYM, fromKey, thisMonth, todayKey, WEEKDAYS } from '../domain/date';
import { monthSummary } from '../domain/ledger';
import { dailyTotals, detectRecurring, findAlerts, forecastMonth, healthScore, investReturn, moneyFlow, projection, weekdayPattern } from '../domain/engine';
import { INK } from '../domain/defaults';
import { useEntry } from '../components/EntrySheet';
import { Bar, IconBubble } from '../components/bits';
import { Card, Empty, ScreenHeader, SectionTitle } from '../components/ui';

function HealthRing({ score, t }: { score: number; t: Theme }) {
  const r = 46, c = 2 * Math.PI * r;
  const color = score >= 75 ? tint(t, INK.mint).ink : score >= 50 ? tint(t, INK.butter).ink : tint(t, INK.rose).ink;
  return (
    <Svg width={112} height={112}>
      <Circle cx={56} cy={56} r={r} stroke={t.fill} strokeWidth={10} fill="none" />
      <Circle cx={56} cy={56} r={r} stroke={color} strokeWidth={10} fill="none" strokeLinecap="round"
        strokeDasharray={`${(c * score) / 100} ${c}`} transform="rotate(-90 56 56)" />
      <SvgText x={56} y={65} fontSize={28} fontWeight="800" fontFamily="sans-serif" fill={t.text} textAnchor="middle">{score}</SvgText>
    </Svg>
  );
}

function LineChart({ points, width, t }: { points: { ym: string; balance: number }[]; width: number; t: Theme }) {
  const h = 150, padL = 8, padR = 8, padT = 14, padB = 22;
  const vals = points.map((p) => p.balance);
  const min = Math.min(0, ...vals), max = Math.max(...vals, 1);
  const x = (i: number) => padL + (i * (width - padL - padR)) / (points.length - 1);
  const y = (v: number) => padT + (1 - (v - min) / (max - min || 1)) * (h - padT - padB);
  const d = points.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(p.balance).toFixed(1)}`).join(' ');
  const area = `${d} L${x(points.length - 1)},${h - padB} L${x(0)},${h - padB} Z`;
  const neg = vals.some((v) => v < 0);
  const color = neg ? t.danger : t.primary;
  return (
    <Svg width={width} height={h}>
      <Defs>
        <LinearGradient id="g" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={color} stopOpacity={0.25} />
          <Stop offset="1" stopColor={color} stopOpacity={0} />
        </LinearGradient>
      </Defs>
      {min < 0 && <Line x1={padL} x2={width - padR} y1={y(0)} y2={y(0)} stroke={t.danger} strokeDasharray="4 4" strokeWidth={1} />}
      <Path d={area} fill="url(#g)" />
      <Path d={d} stroke={color} strokeWidth={2.5} fill="none" strokeLinejoin="round" />
      {points.map((p, i) => (i % 3 === 0 || i === points.length - 1) && (
        <SvgText key={p.ym} x={x(i)} y={h - 6} fontSize={10} fontFamily="sans-serif" fill={t.sub} textAnchor="middle">{`${Number(p.ym.slice(5))}월`}</SvgText>
      ))}
      <Circle cx={x(points.length - 1)} cy={y(vals[vals.length - 1])} r={4} fill={color} />
    </Svg>
  );
}

function Heatmap({ ym, totals, t, width }: { ym: string; totals: Record<string, number>; t: Theme; width: number }) {
  const first = fromKey(`${ym}-01`).getDay();
  const days = daysInMonth(ym);
  const max = Math.max(1, ...Object.values(totals));
  const cell = (width - 6 * 6) / 7;
  const ink = tint(t, INK.peach).ink;
  const cells: React.ReactNode[] = [];
  for (let i = 0; i < first; i++) cells.push(<View key={'e' + i} style={{ width: cell, height: cell }} />);
  for (let d = 1; d <= days; d++) {
    const k = `${ym}-${String(d).padStart(2, '0')}`;
    const v = totals[k] ?? 0;
    const a = v ? 0.15 + 0.85 * Math.sqrt(v / max) : 0;
    const future = k > todayKey();
    cells.push(
      <View key={k} style={{ width: cell, height: cell, borderRadius: 10, backgroundColor: v ? ink : t.fill, opacity: future ? 0.35 : v ? a : 1, alignItems: 'center', justifyContent: 'center' }}>
        <Text style={{ fontSize: 11, fontWeight: '600', color: a > 0.55 ? '#fff' : t.sub }}>{d}</Text>
      </View>,
    );
  }
  return (
    <View>
      <View style={{ flexDirection: 'row', gap: 6, marginBottom: 6 }}>
        {WEEKDAYS.map((w) => <Text key={w} style={{ width: cell, textAlign: 'center', color: t.faint, fontSize: 11 }}>{w}</Text>)}
      </View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>{cells}</View>
    </View>
  );
}

function FlowChart({ sources: src, sinks: snk, label, width, t }: {
  sources: { id: string; value: number }[]; sinks: { id: string; value: number }[]; label: (id: string) => { name: string; color: string }; width: number; t: Theme;
}) {
  let sources = src, sinks = snk;
  // 작은 항목은 '그 외'로 묶기
  const squash = (list: { id: string; value: number }[], keep: number) => {
    if (list.length <= keep + 1) return list;
    const rest = list.slice(keep).reduce((s, x) => s + x.value, 0);
    return [...list.slice(0, keep), { id: '__other', value: rest }];
  };
  sources = squash(sources, 3);
  sinks = squash(sinks, 5);
  const total = Math.max(1, sources.reduce((s, x) => s + x.value, 0), sinks.reduce((s, x) => s + x.value, 0));
  const gap = 8, nodeW = 10, colL = 96, colR = width - 96, MIN = 30, BASE = 230;
  const layout = (list: { id: string; value: number }[]) => {
    let y = 0;
    return list.map((n) => { const hh = Math.max(MIN, (n.value / total) * BASE); const r = { ...n, y, h: hh }; y += hh + gap; return r; });
  };
  const L = layout(sources), R = layout(sinks);
  const h = Math.max(...[L, R].map((list) => (list.length ? list[list.length - 1].y + list[list.length - 1].h : 0)), 120);
  const midX = width / 2, midW = 14;
  // 가운데 막대 기준으로 왼쪽 → 가운데, 가운데 → 오른쪽 띠
  const midTop = 0, midH = h;
  let accL = midTop, accR = midTop;
  const ribbons: React.ReactNode[] = [];
  L.forEach((n) => {
    const hh = (n.value / total) * midH;
    const c = tint(t, label(n.id).color).ink;
    ribbons.push(<Path key={'l' + n.id} d={`M${colL + nodeW},${n.y} C${(colL + midX) / 2},${n.y} ${(colL + midX) / 2},${accL} ${midX - midW / 2},${accL} L${midX - midW / 2},${accL + hh} C${(colL + midX) / 2},${accL + hh} ${(colL + midX) / 2},${n.y + n.h} ${colL + nodeW},${n.y + n.h} Z`} fill={c} opacity={0.22} />);
    accL += hh;
  });
  R.forEach((n) => {
    const hh = (n.value / total) * midH;
    const c = tint(t, label(n.id).color).ink;
    ribbons.push(<Path key={'r' + n.id} d={`M${midX + midW / 2},${accR} C${(colR + midX) / 2},${accR} ${(colR + midX) / 2},${n.y} ${colR - nodeW},${n.y} L${colR - nodeW},${n.y + n.h} C${(colR + midX) / 2},${n.y + n.h} ${(colR + midX) / 2},${accR + hh} ${midX + midW / 2},${accR + hh} Z`} fill={c} opacity={0.22} />);
    accR += hh;
  });
  return (
    <Svg width={width} height={h}>
      {ribbons}
      <Rect x={midX - midW / 2} y={0} width={midW} height={h} rx={5} fill={t.primary} opacity={0.8} />
      {L.map((n) => {
        const lb = label(n.id);
        return [
          <Rect key={'ln' + n.id} x={colL} y={n.y} width={nodeW} height={n.h} rx={3} fill={tint(t, lb.color).ink} />,
          <SvgText key={'lt' + n.id} x={colL - 6} y={n.y + n.h / 2 - 2} fontSize={11} fontFamily="sans-serif" fill={t.text} textAnchor="end">{lb.name}</SvgText>,
          <SvgText key={'lv' + n.id} x={colL - 6} y={n.y + n.h / 2 + 11} fontSize={10} fontFamily="sans-serif" fill={t.sub} textAnchor="end">{fmt(n.value, { compact: true })}</SvgText>,
        ];
      })}
      {R.map((n) => {
        const lb = label(n.id);
        return [
          <Rect key={'rn' + n.id} x={colR - nodeW} y={n.y} width={nodeW} height={n.h} rx={3} fill={tint(t, lb.color).ink} />,
          <SvgText key={'rt' + n.id} x={colR + 6} y={n.y + n.h / 2 - 2} fontSize={11} fontFamily="sans-serif" fill={t.text}>{lb.name}</SvgText>,
          <SvgText key={'rv' + n.id} x={colR + 6} y={n.y + n.h / 2 + 11} fontSize={10} fontFamily="sans-serif" fill={t.sub}>{fmt(n.value, { compact: true })}</SvgText>,
        ];
      })}
    </Svg>
  );
}

export function InsightsScreen() {
  const t = useTheme();
  const { data } = useStore();
  const look = useLookup();
  const { editTx } = useEntry();
  const { width } = useWindowDimensions();
  const inner = Math.min(width, 520) - 32 - 36;
  const today = todayKey();
  const [ym, setYm] = useState(thisMonth());

  const health = useMemo(() => healthScore(data, today), [data, today]);
  const proj = useMemo(() => projection(data, today), [data, today]);
  const fc = useMemo(() => forecastMonth(data, today), [data, today]);
  const heat = useMemo(() => dailyTotals(data.transactions, ym), [data.transactions, ym]);
  const week = useMemo(() => weekdayPattern(data.transactions, today), [data.transactions, today]);
  const flow = useMemo(() => moneyFlow(data, ym), [data, ym]);
  const month = useMemo(() => monthSummary(data.transactions, ym), [data.transactions, ym]);
  const rec = useMemo(() => detectRecurring(data, today), [data, today]);
  const alerts = useMemo(() => findAlerts(data, today), [data, today]);
  const invests = data.accounts.filter((a) => a.kind === 'invest' && !a.archived);

  if (data.transactions.length === 0) {
    return (
      <ScrollView>
        <ScreenHeader title="분석" />
        <Empty icon="analytics-outline" title="기록이 쌓이면 분석해 드려요" desc="월말 예측, 고정 지출 찾기, 재정 건강 점수 같은 분석이 여기 나와요" />
      </ScrollView>
    );
  }

  const label = (id: string) => {
    if (id === '__saved') return { name: '남은 돈', color: INK.mint };
    if (id === '__savings_used') return { name: '모아둔 돈에서', color: INK.rose };
    if (id === '__other') return { name: '그 외', color: INK.stone };
    const c = look.category[id];
    return { name: c?.name ?? '기타', color: c?.color ?? INK.stone };
  };
  const maxW = Math.max(1, ...week);
  const cats = Object.entries(month.byCategory).sort((a, b) => b[1] - a[1]);
  const last = proj.points[proj.points.length - 1];
  const KIND: Record<string, string> = { salary: '급여', rent: '월세', subscription: '구독', bill: '고정 지출', income: '고정 수입' };

  return (
    <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
      <ScreenHeader title="분석" subtitle="모든 계산은 이 휴대폰 안에서만 해요" />

      {/* 재정 건강 */}
      <Card style={{ marginHorizontal: 16 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
          <HealthRing score={health.score} t={t} />
          <View style={{ flex: 1, gap: 7 }}>
            <Text style={{ color: t.text, fontWeight: '800', fontSize: 16 }}>재정 건강 점수</Text>
            {health.parts.map((p) => (
              <View key={p.key}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                  <Text style={{ color: t.sub, fontSize: 12 }}>{p.label}</Text>
                  <Text style={{ color: t.sub, fontSize: 12 }}>{p.score}/{p.max}</Text>
                </View>
                <Bar value={p.score / p.max} color={t.primary} height={5} />
              </View>
            ))}
          </View>
        </View>
        <View style={{ marginTop: 14, gap: 6 }}>
          {health.parts.map((p) => <Text key={p.key} style={{ color: t.sub, fontSize: 12.5 }}>· {p.label}: {p.detail}</Text>)}
        </View>
        <View style={[st.tips, { backgroundColor: t.primarySoft }]}>
          {health.tips.map((tip, i) => (
            <View key={i} style={{ flexDirection: 'row', gap: 8 }}>
              <Ionicons name="bulb-outline" size={16} color={t.primaryInk} style={{ marginTop: 1 }} />
              <Text style={{ color: t.primaryInk, flex: 1, lineHeight: 19, fontSize: 13.5 }}>{tip}</Text>
            </View>
          ))}
        </View>
      </Card>

      {/* 월말 예측 */}
      <SectionTitle>이번 달 월말 예측</SectionTitle>
      <Card style={{ marginHorizontal: 16 }}>
        <Text style={{ color: t.sub, fontSize: 13 }}>{fc.sims.toLocaleString()}가지 시나리오 · 지난 {fc.historyDays}일 기록 기준</Text>
        <View style={{ flexDirection: 'row', marginTop: 12 }}>
          {[['나쁠 때', fc.balance.p10], ['보통', fc.balance.p50], ['좋을 때', fc.balance.p90]].map(([l, v]) => (
            <View key={l as string} style={{ flex: 1 }}>
              <Text style={{ color: t.sub, fontSize: 12 }}>{l}</Text>
              <Text style={{ color: (v as number) < 0 ? t.danger : t.text, fontWeight: '800', fontSize: 15.5 }}>{fmt(Math.round((v as number) / 1000) * 1000, { compact: true })}</Text>
            </View>
          ))}
        </View>
        <Text style={{ color: t.text, marginTop: 12, lineHeight: 20 }}>
          월말에 통장이 마이너스가 될 확률은 <Text style={{ fontWeight: '800', color: fc.probNegative > 0.1 ? t.danger : t.success }}>{Math.round(fc.probNegative * 100)}%</Text>예요.
          {fc.knownIncome ? ` 들어올 돈 ${fmt(fc.knownIncome, { compact: true })},` : ''}{fc.knownExpense ? ` 나갈 고정 지출 ${fmt(fc.knownExpense, { compact: true })},` : ''}{fc.cardDue ? ` 카드 대금 ${fmt(fc.cardDue, { compact: true })}을` : ''} 반영했어요.
        </Text>
      </Card>

      {/* 12개월 전망 */}
      <SectionTitle>앞으로 12개월 잔액 전망</SectionTitle>
      <Card style={{ marginHorizontal: 16 }}>
        <Text style={{ color: t.text, lineHeight: 20 }}>
          지금처럼 쓰면 {formatYM(last.ym)}에 약 <Text style={{ fontWeight: '800' }}>{fmt(Math.round(last.balance / 10000) * 10000, { compact: true })}</Text>이 돼요
          <Text style={{ color: t.sub }}> (매달 {fmt(Math.round(proj.monthlyNet / 1000) * 1000, { signed: true, compact: true })})</Text>
        </Text>
        <View style={{ marginTop: 12 }}><LineChart points={proj.points} width={inner} t={t} /></View>
        <Text style={{ color: t.faint, fontSize: 11.5, marginTop: 6 }}>고정 수입 {fmt(proj.recIncome, { compact: true })} − 고정 지출 {fmt(proj.recExpense, { compact: true })} − 평소 지출 {fmt(Math.round(proj.variable), { compact: true })}, 빚 상환 일정 반영</Text>
      </Card>

      {/* 월 선택 */}
      <View style={st.monthRow}>
        <Pressable onPress={() => setYm(addMonthsYM(ym, -1))} hitSlop={10} style={[st.nav, { backgroundColor: t.card }]}><Ionicons name="chevron-back" size={18} color={t.text} /></Pressable>
        <Text style={{ color: t.text, fontSize: 17, fontWeight: '800', flex: 1, textAlign: 'center' }}>{formatYM(ym)}</Text>
        <Pressable onPress={() => setYm(addMonthsYM(ym, 1))} hitSlop={10} style={[st.nav, { backgroundColor: t.card }]}><Ionicons name="chevron-forward" size={18} color={t.text} /></Pressable>
      </View>

      <SectionTitle>지출 캘린더</SectionTitle>
      <Card style={{ marginHorizontal: 16 }}>
        <Heatmap ym={ym} totals={heat} t={t} width={inner} />
        <Text style={{ color: t.sub, fontSize: 13, marginTop: 14, marginBottom: 8 }}>요일별 하루 평균 (최근 90일)</Text>
        <View style={{ flexDirection: 'row', alignItems: 'flex-end', height: 80, gap: 8 }}>
          {week.map((v, i) => (
            <View key={i} style={{ flex: 1, alignItems: 'center' }}>
              <View style={{ width: '100%', height: Math.max(3, (v / maxW) * 60), borderRadius: 6, backgroundColor: v === maxW ? tint(t, INK.peach).ink : tint(t, INK.peach).bg }} />
              <Text style={{ color: t.sub, fontSize: 11, marginTop: 4 }}>{WEEKDAYS[i]}</Text>
            </View>
          ))}
        </View>
        <Text style={{ color: t.text, fontSize: 13, marginTop: 10 }}>{WEEKDAYS[week.indexOf(maxW)]}요일에 가장 많이 써요 (평균 {fmt(Math.round(maxW / 100) * 100)})</Text>
      </Card>

      <SectionTitle>돈의 흐름</SectionTitle>
      <Card style={{ marginHorizontal: 16 }}>
        {flow.income + flow.expense > 0 ? (
          <>
            <Text style={{ color: t.sub, fontSize: 12.5, marginBottom: 10 }}>왼쪽: 들어온 곳 · 오른쪽: 나간 곳</Text>
            <FlowChart sources={flow.sources} sinks={flow.sinks} label={label} width={inner} t={t} />
          </>
        ) : <Text style={{ color: t.sub }}>이 달의 기록이 없어요</Text>}
      </Card>

      {cats.length > 0 && (
        <>
          <SectionTitle>카테고리별 지출</SectionTitle>
          <Card style={{ marginHorizontal: 16, gap: 12 }}>
            {cats.map(([id, v]) => {
              const c = look.category[id];
              return (
                <View key={id} style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                  <IconBubble icon={(c?.icon ?? 'pricetag-outline') as any} color={c?.color ?? INK.stone} size={32} />
                  <View style={{ flex: 1 }}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
                      <Text style={{ color: t.text, fontWeight: '600' }}>{c?.name ?? '기타'}</Text>
                      <Text style={{ color: t.text, fontWeight: '700' }}>{fmt(v)} <Text style={{ color: t.sub, fontWeight: '400', fontSize: 12 }}>{Math.round((v / month.expense) * 100)}%</Text></Text>
                    </View>
                    <Bar value={v / cats[0][1]} color={tint(t, c?.color ?? INK.stone).ink} height={6} />
                  </View>
                </View>
              );
            })}
          </Card>
        </>
      )}

      {rec.length > 0 && (
        <>
          <SectionTitle>스스로 찾은 고정 수입·지출</SectionTitle>
          <Card style={{ marginHorizontal: 16, paddingVertical: 8 }}>
            {rec.map((r) => (
              <View key={r.key} style={st.recRow}>
                <View style={[st.tag, { backgroundColor: tint(t, r.type === 'income' ? INK.mint : r.kind === 'subscription' ? INK.lavender : INK.stone).bg }]}>
                  <Text style={{ color: tint(t, r.type === 'income' ? INK.mint : r.kind === 'subscription' ? INK.lavender : INK.stone).ink, fontSize: 11.5, fontWeight: '700' }}>{KIND[r.kind]}</Text>
                </View>
                <Text style={{ color: t.text, flex: 1, fontWeight: '600' }}>{r.name}</Text>
                <Text style={{ color: t.sub, fontSize: 12.5 }}>매달 {r.day}일</Text>
                <Text style={{ color: r.type === 'income' ? t.success : t.text, fontWeight: '700', minWidth: 80, textAlign: 'right' }}>{fmt(r.amount, { compact: true })}</Text>
              </View>
            ))}
            {rec.some((r) => r.kind === 'subscription') && (
              <Text style={{ color: t.sub, fontSize: 12.5, marginTop: 6 }}>
                구독료 합계 매달 {fmt(rec.filter((r) => r.kind === 'subscription').reduce((s, r) => s + r.amount, 0))} · 1년이면 {fmt(rec.filter((r) => r.kind === 'subscription').reduce((s, r) => s + r.amount, 0) * 12, { compact: true })}
              </Text>
            )}
          </Card>
        </>
      )}

      {alerts.length > 0 && (
        <>
          <SectionTitle>평소와 다른 지출 · 중복 결제</SectionTitle>
          <Card style={{ marginHorizontal: 16, paddingVertical: 6 }}>
            {alerts.map((a) => (
              <Pressable key={a.kind + a.tx.id} onPress={() => editTx(a.tx)} style={st.recRow}>
                <Ionicons name={a.kind === 'duplicate' ? 'copy-outline' : 'alert-circle-outline'} size={18} color={a.kind === 'duplicate' ? t.warn : t.danger} />
                <Text style={{ color: t.text, flex: 1 }} numberOfLines={1}>{a.tx.note || look.category[a.tx.categoryId ?? '']?.name} · {a.tx.date.slice(5).replace('-', '/')}</Text>
                <Text style={{ color: t.sub, fontSize: 12 }}>{a.kind === 'duplicate' ? '같은 날 두 번' : `평소 ${fmt(a.typical ?? 0, { compact: true })}`}</Text>
                <Text style={{ color: t.text, fontWeight: '700' }}>{fmt(a.tx.installment?.total ?? a.tx.amount, { compact: true })}</Text>
              </Pressable>
            ))}
          </Card>
        </>
      )}

      {invests.length > 0 && (
        <>
          <SectionTitle>투자 수익률</SectionTitle>
          {invests.map((a) => {
            const r = investReturn(data, a.id, today);
            if (!r) return null;
            const up = r.gain >= 0;
            return (
              <Card key={a.id} style={{ marginHorizontal: 16, marginBottom: 10 }}>
                <Text style={{ color: t.text, fontWeight: '800', fontSize: 15.5 }}>{a.name}</Text>
                <View style={{ flexDirection: 'row', marginTop: 10 }}>
                  <View style={{ flex: 1 }}><Text style={{ color: t.sub, fontSize: 12 }}>넣은 돈</Text><Text style={{ color: t.text, fontWeight: '700' }}>{fmt(r.contributed, { compact: true })}</Text></View>
                  <View style={{ flex: 1 }}><Text style={{ color: t.sub, fontSize: 12 }}>평가액</Text><Text style={{ color: t.text, fontWeight: '700' }}>{fmt(r.value, { compact: true })}</Text></View>
                  <View style={{ flex: 1 }}><Text style={{ color: t.sub, fontSize: 12 }}>수익</Text><Text style={{ color: up ? t.success : t.danger, fontWeight: '700' }}>{fmt(r.gain, { signed: true, compact: true })}</Text></View>
                </View>
                <Text style={{ color: t.sub, fontSize: 12.5, marginTop: 10, lineHeight: 18 }}>
                  {r.simple !== null ? `누적 ${(r.simple * 100).toFixed(1)}%` : ''}{r.annual !== null ? ` · 넣은 시점을 반영한 실제 연 수익률 ${(r.annual * 100).toFixed(1)}%` : ''}
                </Text>
                <Text style={{ color: t.faint, fontSize: 11.5, marginTop: 4 }}>평가액은 설정 › 계좌에서 직접 업데이트해요</Text>
              </Card>
            );
          })}
        </>
      )}
    </ScrollView>
  );
}

const st = StyleSheet.create({
  tips: { borderRadius: 16, padding: 12, marginTop: 14, gap: 8 },
  monthRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, marginTop: 26 },
  nav: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  recRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 9 },
  tag: { paddingHorizontal: 7, paddingVertical: 2, borderRadius: 6 },
});
