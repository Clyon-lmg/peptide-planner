// Notification service for Peptide Planner mobile app.
// Schedules local dose reminders based on the user's protocol schedule.

import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SupabaseClient } from '@supabase/supabase-js';
import { getScheduledDosesForRange } from './doseService';
import type { NotifPrefs, TodayDoseRow } from './types';
import { DEFAULT_NOTIF_PREFS } from './types';

const PREFS_KEY = 'notif_prefs_v1';
const LOOKAHEAD_DAYS = 7;
const MAX_NOTIFICATIONS = 64; // iOS hard limit

// ─── Notification handler (show alerts while app is foregrounded) ───────────

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

// ─── Preferences ────────────────────────────────────────────────────────────

export async function loadNotifPrefs(): Promise<NotifPrefs> {
  try {
    const raw = await AsyncStorage.getItem(PREFS_KEY);
    if (!raw) return { ...DEFAULT_NOTIF_PREFS };
    return { ...DEFAULT_NOTIF_PREFS, ...JSON.parse(raw) };
  } catch {
    return { ...DEFAULT_NOTIF_PREFS };
  }
}

export async function saveNotifPrefs(prefs: NotifPrefs): Promise<void> {
  await AsyncStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
}

// ─── Permission Request ──────────────────────────────────────────────────────

export async function requestNotificationPermission(): Promise<boolean> {
  if (!Device.isDevice) {
    // Emulators don't support push notifications; return true for dev convenience
    return true;
  }

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('dose-reminders', {
      name: 'Dose Reminders',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#6366f1',
    });
  }

  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  if (existingStatus === 'granted') return true;

  const { status } = await Notifications.requestPermissionsAsync();
  return status === 'granted';
}

// ─── Schedule Notifications ──────────────────────────────────────────────────

function buildNotifBody(dose: TodayDoseRow): string {
  const parts: string[] = [];
  parts.push(`${dose.dose_mg} mg`);
  if (dose.syringe_units != null) {
    parts.push(`${Math.round(dose.syringe_units)} units`);
  }
  if (dose.site_label) {
    parts.push(dose.site_label);
  }
  return parts.join('  ·  ');
}

function parseTriggerDate(dateISO: string, timeStr: string, advanceMinutes: number): Date | null {
  const [hours, minutes] = timeStr.split(':').map(Number);
  if (isNaN(hours) || isNaN(minutes)) return null;

  // Parse date as local midnight (not UTC) so notifications fire at correct local time
  const [year, month, day] = dateISO.split('-').map(Number);
  const trigger = new Date(year, month - 1, day, hours, minutes, 0, 0);
  trigger.setMinutes(trigger.getMinutes() - advanceMinutes);

  return trigger;
}

export async function scheduleUpcomingNotifications(
  supabase: SupabaseClient,
  prefs?: NotifPrefs
): Promise<void> {
  // Always cancel existing scheduled notifications first
  await Notifications.cancelAllScheduledNotificationsAsync();

  const resolvedPrefs = prefs ?? (await loadNotifPrefs());
  if (!resolvedPrefs.enabled) return;

  const hasPermission = await requestNotificationPermission();
  if (!hasPermission) return;

  // Build list of upcoming dates
  const dates: string[] = [];
  for (let i = 0; i < LOOKAHEAD_DAYS; i++) {
    const d = new Date();
    d.setDate(d.getDate() + i);
    const offset = d.getTimezoneOffset() * 60000;
    dates.push(new Date(d.getTime() - offset).toISOString().split('T')[0]);
  }

  const allDoses = await getScheduledDosesForRange(supabase, dates);
  const now = new Date();

  type PendingNotif = {
    triggerDate: Date;
    content: Notifications.NotificationContentInput;
  };

  const pendingNotifs: PendingNotif[] = [];

  for (const dose of allDoses) {
    if (dose.status === 'TAKEN' || dose.status === 'SKIPPED') continue;

    const timeStr = dose.time_of_day ?? resolvedPrefs.defaultTime;
    const triggerDate = parseTriggerDate(
      dose.date_for,
      timeStr,
      resolvedPrefs.advanceMinutes
    );

    if (!triggerDate || triggerDate <= now) continue;

    pendingNotifs.push({
      triggerDate,
      content: {
        title: `Time to dose · ${dose.canonical_name}`,
        body: buildNotifBody(dose),
        data: { peptide_id: dose.peptide_id, date_for: dose.date_for },
        sound: 'default',
      },
    });
  }

  // Sort by soonest first, respect iOS 64-notification limit
  const sorted = pendingNotifs
    .sort((a, b) => a.triggerDate.getTime() - b.triggerDate.getTime())
    .slice(0, MAX_NOTIFICATIONS);

  for (const notif of sorted) {
    await Notifications.scheduleNotificationAsync({
      content: notif.content,
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: notif.triggerDate,
      },
    });
  }
}

// ─── Cancel a single dose notification ──────────────────────────────────────

export async function cancelDoseNotification(
  peptide_id: number,
  date_for: string
): Promise<void> {
  const scheduled = await Notifications.getAllScheduledNotificationsAsync();
  for (const notif of scheduled) {
    if (
      notif.content.data?.peptide_id === peptide_id &&
      notif.content.data?.date_for === date_for
    ) {
      await Notifications.cancelScheduledNotificationAsync(notif.identifier);
    }
  }
}
