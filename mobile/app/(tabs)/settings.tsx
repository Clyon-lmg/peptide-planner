import { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  Switch,
  Pressable,
  ScrollView,
  Alert,
  TextInput,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Bell, Clock, LogOut } from 'lucide-react-native';
import { supabase } from '@/lib/supabase';
import {
  loadNotifPrefs,
  saveNotifPrefs,
  requestNotificationPermission,
  scheduleUpcomingNotifications,
} from '@/lib/notifications';
import type { NotifPrefs } from '@/lib/types';
import { DEFAULT_NOTIF_PREFS } from '@/lib/types';

// ─── Advance options ─────────────────────────────────────────────────────────

const ADVANCE_OPTIONS = [
  { label: 'At dose time', value: 0 },
  { label: '15 min before', value: 15 },
  { label: '30 min before', value: 30 },
  { label: '1 hour before', value: 60 },
];

// ─── Time picker (simple HH:MM text input) ───────────────────────────────────

type TimePickerModalProps = {
  visible: boolean;
  value: string;
  onSave: (time: string) => void;
  onClose: () => void;
};

function TimePickerModal({ visible, value, onSave, onClose }: TimePickerModalProps) {
  const [input, setInput] = useState(value);

  useEffect(() => {
    if (visible) setInput(value);
  }, [visible, value]);

  const handleSave = () => {
    const match = input.match(/^(\d{1,2}):(\d{2})$/);
    if (!match) {
      Alert.alert('Invalid time', 'Please enter a time in HH:MM format (e.g. 08:00).');
      return;
    }
    const h = parseInt(match[1], 10);
    const m = parseInt(match[2], 10);
    if (h < 0 || h > 23 || m < 0 || m > 59) {
      Alert.alert('Invalid time', 'Hours must be 0–23 and minutes 0–59.');
      return;
    }
    onSave(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`);
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View className="flex-1 justify-center items-center bg-black/60 px-8">
        <View className="w-full rounded-2xl bg-card border border-border p-6">
          <Text className="text-lg font-bold text-foreground mb-1">Default Dose Time</Text>
          <Text className="text-muted text-sm mb-5">
            Used when a protocol item has no time set.
          </Text>
          <TextInput
            className="rounded-xl bg-background border border-border px-4 py-3 text-foreground text-center text-2xl font-bold tracking-widest mb-5"
            value={input}
            onChangeText={setInput}
            placeholder="08:00"
            placeholderTextColor="#64748b"
            keyboardType="numbers-and-punctuation"
            maxLength={5}
            autoFocus
          />
          <View className="flex-row gap-3">
            <Pressable
              onPress={onClose}
              className="flex-1 py-3 rounded-xl bg-border items-center"
            >
              <Text className="text-foreground font-semibold">Cancel</Text>
            </Pressable>
            <Pressable
              onPress={handleSave}
              className="flex-1 py-3 rounded-xl bg-primary items-center"
            >
              <Text className="text-white font-semibold">Save</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

// ─── Settings row ─────────────────────────────────────────────────────────────

type RowProps = {
  label: string;
  description?: string;
  right?: React.ReactNode;
  onPress?: () => void;
};

function Row({ label, description, right, onPress }: RowProps) {
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      className="flex-row items-center justify-between px-4 py-3.5"
    >
      <View className="flex-1 mr-4">
        <Text className="text-foreground font-medium">{label}</Text>
        {description && (
          <Text className="text-muted text-xs mt-0.5">{description}</Text>
        )}
      </View>
      {right}
    </Pressable>
  );
}

// ─── Section ─────────────────────────────────────────────────────────────────

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View className="mb-5">
      <Text className="text-xs font-semibold text-muted uppercase tracking-wider px-4 mb-2">
        {title}
      </Text>
      <View className="rounded-2xl bg-card border border-border overflow-hidden divide-y divide-border">
        {children}
      </View>
    </View>
  );
}

// ─── Screen ──────────────────────────────────────────────────────────────────

export default function SettingsScreen() {
  const [prefs, setPrefs] = useState<NotifPrefs>(DEFAULT_NOTIF_PREFS);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadNotifPrefs().then(setPrefs);
    supabase.auth.getUser().then(({ data }) => setUserEmail(data.user?.email ?? null));
  }, []);

  const persistPrefs = useCallback(async (updated: NotifPrefs) => {
    setPrefs(updated);
    setSaving(true);
    try {
      await saveNotifPrefs(updated);
      await scheduleUpcomingNotifications(supabase, updated);
    } finally {
      setSaving(false);
    }
  }, []);

  const handleToggleNotifs = async (enabled: boolean) => {
    if (enabled) {
      const granted = await requestNotificationPermission();
      if (!granted) {
        Alert.alert(
          'Permission required',
          'Please enable notifications for Peptide Planner in your device Settings.'
        );
        return;
      }
    }
    await persistPrefs({ ...prefs, enabled });
  };

  const handleAdvanceChange = (minutes: number) => {
    persistPrefs({ ...prefs, advanceMinutes: minutes });
  };

  const handleTimeChange = (time: string) => {
    persistPrefs({ ...prefs, defaultTime: time });
  };

  const handleSignOut = () => {
    Alert.alert('Sign out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign out',
        style: 'destructive',
        onPress: () => supabase.auth.signOut(),
      },
    ]);
  };

  return (
    <SafeAreaView className="flex-1 bg-background" edges={['top']}>
      <ScrollView className="flex-1" contentContainerClassName="px-4 pb-8 pt-2">
        <View className="mb-6 mt-2 flex-row items-center gap-2">
          <Text className="text-3xl font-bold text-foreground tracking-tight">Settings</Text>
          {saving && (
            <Text className="text-xs text-muted mt-1 self-end mb-1">Saving…</Text>
          )}
        </View>

        {/* Notifications section */}
        <Section title="Notifications">
          <Row
            label="Dose Reminders"
            description="Get notified at your scheduled dose times"
            right={
              <Switch
                value={prefs.enabled}
                onValueChange={handleToggleNotifs}
                trackColor={{ false: '#334155', true: '#6366f1' }}
                thumbColor="#ffffff"
              />
            }
          />

          {prefs.enabled && (
            <>
              <Row
                label="Default Time"
                description="Used when no time is set on a protocol item"
                onPress={() => setShowTimePicker(true)}
                right={
                  <View className="flex-row items-center gap-2">
                    <Text className="text-primary font-semibold">{prefs.defaultTime}</Text>
                    <Clock size={14} color="#6366f1" />
                  </View>
                }
              />

              <View className="px-4 pb-4">
                <Text className="text-xs text-muted mb-3 mt-1">Advance notice</Text>
                <View className="flex-row flex-wrap gap-2">
                  {ADVANCE_OPTIONS.map((opt) => (
                    <Pressable
                      key={opt.value}
                      onPress={() => handleAdvanceChange(opt.value)}
                      className={`px-3 py-1.5 rounded-full border ${
                        prefs.advanceMinutes === opt.value
                          ? 'bg-primary border-primary'
                          : 'bg-transparent border-border'
                      }`}
                    >
                      <Text
                        className={`text-xs font-medium ${
                          prefs.advanceMinutes === opt.value ? 'text-white' : 'text-muted'
                        }`}
                      >
                        {opt.label}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </View>
            </>
          )}
        </Section>

        {/* Account section */}
        <Section title="Account">
          {userEmail && (
            <Row
              label="Email"
              description={userEmail}
            />
          )}
          <Row
            label="Subscription"
            description="Manage at peptideplanner.com"
          />
          <Row
            label="Sign Out"
            onPress={handleSignOut}
            right={<LogOut size={16} color="#ef4444" />}
          />
        </Section>

        <Text className="text-center text-xs text-muted-foreground mt-2">
          Peptide Planner v1.0.0
        </Text>
      </ScrollView>

      <TimePickerModal
        visible={showTimePicker}
        value={prefs.defaultTime}
        onSave={handleTimeChange}
        onClose={() => setShowTimePicker(false)}
      />
    </SafeAreaView>
  );
}
