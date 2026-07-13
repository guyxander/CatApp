import * as Location from "expo-location";
import * as Notifications from "expo-notifications";

export type NativeResult = {
  ok: boolean;
  message: string;
};

export type LocationResult = NativeResult & {
  coords?: {
    latitude: number;
    longitude: number;
  };
};

export async function requestCurrentLocation(): Promise<LocationResult> {
  try {
    const permission = await Location.requestForegroundPermissionsAsync();
    if (permission.status !== "granted") {
      return { ok: false, message: "Location permission was not granted." };
    }
    const current = await Location.getCurrentPositionAsync({});
    return {
      ok: true,
      message: "Location found. Parish distances are updated.",
      coords: {
        latitude: current.coords.latitude,
        longitude: current.coords.longitude,
      },
    };
  } catch {
    return { ok: false, message: "Location is unavailable on this device." };
  }
}

export async function scheduleDailyPrayerReminder(hour: number, minute: number): Promise<NativeResult> {
  try {
    const permission = await Notifications.requestPermissionsAsync();
    if (!permission.granted) return { ok: false, message: "Notification permission was not granted." };
    await Notifications.scheduleNotificationAsync({
      content: { title: "CatApp Prayer Reminder", body: "Take a quiet moment for prayer." },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DAILY, hour, minute },
    });
    return { ok: true, message: "Daily prayer reminder scheduled." };
  } catch {
    return { ok: false, message: "Prayer reminders are unavailable on this device." };
  }
}

export async function cancelPrayerReminders(): Promise<NativeResult> {
  try {
    await Notifications.cancelAllScheduledNotificationsAsync();
    return { ok: true, message: "Prayer reminders cancelled." };
  } catch {
    return { ok: false, message: "Could not cancel prayer reminders." };
  }
}
