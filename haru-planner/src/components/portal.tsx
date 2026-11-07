import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';

/**
 * 시트를 별도 Modal 창이 아니라 메인 화면 맨 위 레이어에 그리기 위한 포털.
 * 안드로이드 최신 버전에서는 Modal(Dialog) 창이 키보드에 맞춰 줄어들지 않아
 * 입력창이 키보드에 가려지는 문제가 있어서, 메인 창에서 직접 키보드 높이를 받아 처리한다.
 */
interface PortalApi {
  set: (key: string, node: React.ReactNode) => void;
  remove: (key: string) => void;
}
const PortalCtx = createContext<PortalApi | null>(null);

export function PortalProvider({ children }: { children: React.ReactNode }) {
  const [nodes, setNodes] = useState<{ key: string; node: React.ReactNode }[]>([]);
  const set = useCallback((key: string, node: React.ReactNode) => {
    setNodes((prev) => {
      const i = prev.findIndex((x) => x.key === key);
      if (i === -1) return [...prev, { key, node }];
      const next = prev.slice();
      next[i] = { key, node };
      return next;
    });
  }, []);
  const remove = useCallback((key: string) => setNodes((prev) => (prev.some((x) => x.key === key) ? prev.filter((x) => x.key !== key) : prev)), []);
  const api = useMemo(() => ({ set, remove }), [set, remove]);
  return (
    <PortalCtx.Provider value={api}>
      {children}
      {nodes.length > 0 && (
        <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
          {nodes.map((n) => (
            <View key={n.key} style={StyleSheet.absoluteFill} pointerEvents="box-none">{n.node}</View>
          ))}
        </View>
      )}
    </PortalCtx.Provider>
  );
}

let seq = 0;

/** children 을 포털 호스트에 그린다. visible=false 이면 제거 */
export function Portal({ visible, children }: { visible: boolean; children: React.ReactNode }) {
  const api = useContext(PortalCtx);
  const key = useRef(`p${++seq}`).current;
  useEffect(() => {
    if (!api) return;
    if (visible) api.set(key, children);
    else api.remove(key);
  });
  useEffect(() => () => api?.remove(key), [api, key]);
  return null;
}
