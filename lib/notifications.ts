import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import Constants from 'expo-constants';
import { usersApi } from './api';

// Show notification alert while app is foregrounded
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export async function registerForPushNotificationsAsync(): Promise<string | null> {
  if (Platform.OS === 'web') return null;

  const { status: existing } = await Notifications.getPermissionsAsync();
  let finalStatus = existing;
  if (existing !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }
  if (finalStatus !== 'granted') return null;

  // Android needs a notification channel
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'Ping notifications',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#7C3AED',
    });
  }

  const projectId = Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
  if (!projectId) return null;

  const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId });
  return token;
}

export async function setupNotifications(): Promise<void> {
  try {
    const token = await registerForPushNotificationsAsync();
    if (token) {
      await usersApi.updatePushToken(token);
    }
  } catch {
    // Non-fatal — app works without notifications
  }
}

export async function clearPushToken(): Promise<void> {
  try {
    await usersApi.updatePushToken(null);
  } catch {}
}

export async function scheduleStartingNotification(
  activityId: string,
  title: string,
  startsAt: Date,
): Promise<void> {
  const triggerMs = startsAt.getTime() - 15 * 60 * 1000;
  if (triggerMs <= Date.now()) return;

  try {
    await Notifications.scheduleNotificationAsync({
      identifier: `ping-start-${activityId}`,
      content: {
        title: '⏰ Ping starting soon!',
        body: `"${title}" starts in 15 minutes`,
        data: { type: 'ping_starting', activityId },
        sound: 'default',
      },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: new Date(triggerMs) },
    });
  } catch {}
}

export async function cancelStartingNotification(activityId: string): Promise<void> {
  try {
    await Notifications.cancelScheduledNotificationAsync(`ping-start-${activityId}`);
  } catch {}
}

export async function scheduleSafetyReminder(
  activityId: string,
  title: string,
  startsAt: Date,
): Promise<void> {
  const triggerMs = startsAt.getTime() - 30 * 60 * 1000;
  if (triggerMs <= Date.now()) return;

  try {
    await Notifications.scheduleNotificationAsync({
      identifier: `ping-safety-${activityId}`,
      content: {
        title: '🛡️ Safety reminder',
        body: `"${title}" starts in 30 min. Share your location with a trusted contact.`,
        data: { type: 'ping_starting', activityId },
        sound: 'default',
      },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: new Date(triggerMs) },
    });
  } catch {}
}

export async function cancelSafetyReminder(activityId: string): Promise<void> {
  try {
    await Notifications.cancelScheduledNotificationAsync(`ping-safety-${activityId}`);
  } catch {}
}

export type NotificationPayload = {
  type: 'ping_join' | 'ping_cancel' | 'friend_accept' | 'friend_reject' | 'participant_nearby' | 'ping_starting';
  activityId?: string;
  userId?: string;
};

export function addResponseListener(
  onPress: (payload: NotificationPayload) => void,
): Notifications.Subscription {
  return Notifications.addNotificationResponseReceivedListener((response) => {
    const data = response.notification.request.content.data as NotificationPayload;
    if (data?.type) onPress(data);
  });
}

export function addReceivedListener(
  onReceive: (title: string, body: string) => void,
): Notifications.Subscription {
  return Notifications.addNotificationReceivedListener((notification) => {
    const { title = '', body = '' } = notification.request.content;
    onReceive(title, body);
  });
}
