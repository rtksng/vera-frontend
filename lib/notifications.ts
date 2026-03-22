import * as Notifications from "expo-notifications";
import { Platform } from "react-native";
import { API_URL } from "./api";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export async function registerForPushNotifications(
  getToken: () => Promise<string | null>,
): Promise<string | null> {
  try {
    const { status: existing } = await Notifications.getPermissionsAsync();
    let finalStatus = existing;
    if (existing !== "granted") {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }
    if (finalStatus !== "granted") return null;

    if (Platform.OS === "android") {
      await Notifications.setNotificationChannelAsync("default", {
        name: "default",
        importance: Notifications.AndroidImportance.DEFAULT,
      });
    }

    const pushToken = (await Notifications.getExpoPushTokenAsync()).data;

    const authToken = await getToken();
    if (authToken) {
      fetch(`${API_URL}/engagement/push-token`, {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({ token: pushToken }),
      }).catch(() => {});
    }

    return pushToken;
  } catch (e) {
    console.log("[Notifications] registration error:", e);
    return null;
  }
}

export function scheduleRitualReminder(
  type: "morning" | "night",
  hour: number,
  minute: number = 0,
) {
  const id = type === "morning" ? "ritual-morning" : "ritual-night";
  const title = type === "morning" ? "Good morning" : "Wind down";
  const body =
    type === "morning"
      ? "What's the one thing you want to feel good about today?"
      : "How did today actually go? Take a minute to reflect.";

  Notifications.cancelScheduledNotificationAsync(id).catch(() => {});

  return Notifications.scheduleNotificationAsync({
    identifier: id,
    content: { title, body, sound: true, data: { type: `ritual_${type}` } },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DAILY,
      hour,
      minute,
    },
  });
}
