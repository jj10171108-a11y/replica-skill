import { Alert, Platform } from 'react-native';
import * as Updates from 'expo-updates';

/** 자동 업데이트가 켜진 빌드(APK)인지. Expo Go·웹·개발 모드에서는 false */
export const updatesEnabled = Platform.OS !== 'web' && !__DEV__ && Updates.isEnabled;

let busy = false;

/**
 * 새 업데이트가 있으면 내려받고, 다 받으면 바로 적용할지 묻는다.
 * silent=false 이면 "최신 버전" / 오류도 알려 준다 (설정 화면의 수동 확인용).
 */
export async function checkAndApplyUpdate(silent = true) {
  if (!updatesEnabled) {
    if (!silent) Alert.alert('업데이트 확인', '이 실행 환경에서는 자동 업데이트를 쓸 수 없어요 (APK에서만 동작).');
    return;
  }
  if (busy) return;
  busy = true;
  try {
    const res = await Updates.checkForUpdateAsync();
    if (!res.isAvailable) {
      if (!silent) Alert.alert('최신 버전이에요', '이미 가장 새로운 버전을 쓰고 있어요.');
      return;
    }
    const fetched = await Updates.fetchUpdateAsync();
    if (!fetched.isNew) return;
    Alert.alert('새 버전이 준비됐어요', '지금 적용할까요? 앱이 잠깐 다시 시작돼요.\n(나중에 앱을 다시 켜도 적용돼요)', [
      { text: '나중에', style: 'cancel' },
      { text: '지금 적용', onPress: () => { Updates.reloadAsync().catch(() => {}); } },
    ]);
  } catch (e: any) {
    if (!silent) Alert.alert('업데이트 확인 실패', '인터넷 연결을 확인해 주세요.');
  } finally {
    busy = false;
  }
}

export function currentVersionLabel() {
  if (!updatesEnabled) return '개발 버전';
  if (Updates.isEmbeddedLaunch || !Updates.createdAt) return '설치 버전';
  const d = Updates.createdAt;
  return `업데이트 ${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}
