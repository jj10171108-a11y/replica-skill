import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import { fromKey } from './date';
import { Task } from './types';

const CHANNEL = 'reminders';
let ready = false;

export async function initNotifications() {
  if (Platform.OS === 'web' || ready) return;
  try {
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowBanner: true,
        shouldShowList: true,
        shouldPlaySound: true,
        shouldSetBadge: false,
      }),
    });
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync(CHANNEL, {
        name: '할 일 알림',
        importance: Notifications.AndroidImportance.HIGH,
        vibrationPattern: [0, 200, 120, 200],
      });
    }
    ready = true;
  } catch (e) {
    console.warn('알림 초기화 실패', e);
  }
}

export async function requestPermission(): Promise<boolean> {
  if (Platform.OS === 'web') return false;
  try {
    const cur = await Notifications.getPermissionsAsync();
    if (cur.granted) return true;
    const res = await Notifications.requestPermissionsAsync();
    return res.granted;
  } catch {
    return false;
  }
}

export async function cancelReminder(id?: string | null) {
  if (!id || Platform.OS === 'web') return;
  try {
    await Notifications.cancelScheduledNotificationAsync(id);
  } catch {}
}

/** Schedules a reminder for the task and returns the notification id (or null). */
export async function scheduleReminder(task: Task, offsetMin: number): Promise<string | null> {
  if (Platform.OS === 'web') return null;
  if (!task.remind || !task.due || task.done) return null;
  const at = fromKey(task.due);
  if (task.time) {
    const [h, m] = task.time.split(':').map(Number);
    at.setHours(h, m, 0, 0);
    at.setMinutes(at.getMinutes() - offsetMin);
  } else {
    at.setHours(9, 0, 0, 0); // 시간이 없으면 당일 오전 9시
  }
  if (at.getTime() <= Date.now() + 5000) return null;
  try {
    await initNotifications();
    return await Notifications.scheduleNotificationAsync({
      content: {
        title: task.title,
        body: task.time ? (offsetMin ? `${offsetMin}분 후 예정된 일정이에요` : '지금 할 시간이에요') : '오늘 할 일이 있어요',
        data: { taskId: task.id },
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: at,
        channelId: CHANNEL,
      },
    });
  } catch (e) {
    console.warn('알림 예약 실패', e);
    return null;
  }
}
