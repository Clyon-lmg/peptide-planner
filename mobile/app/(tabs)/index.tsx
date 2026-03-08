import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  RefreshControl,
  ActivityIndicator,
  Pressable,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { format } from 'date-fns';
import { supabase } from '@/lib/supabase';
import { getScheduledDoses, logDose, resetDose, localISODate } from '@/lib/doseService';
import { cancelDoseNotification, scheduleUpcomingNotifications } from '@/lib/notifications';
import type { TodayDoseRow } from '@/lib/types';
import DoseCard from '@/components/DoseCard';

export default function TodayScreen() {
  const [doses, setDoses] = useState<TodayDoseRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [busyId, setBusyId] = useState<number | null>(null);

  const todayISO = useMemo(localISODate, []);

  const loadDoses = useCallback(async () => {
    try {
      const data = await getScheduledDoses(supabase, todayISO);
      setDoses(data);
    } catch (err) {
      console.error('Failed to load doses', err);
      Alert.alert('Error', 'Failed to load today\'s schedule.');
    }
  }, [todayISO]);

  useEffect(() => {
    loadDoses().finally(() => setLoading(false));
  }, [loadDoses]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadDoses();
    setRefreshing(false);
  }, [loadDoses]);

  const handleToggle = async (dose: TodayDoseRow) => {
    if (busyId === dose.peptide_id) return;
    setBusyId(dose.peptide_id);

    const wasTaken = dose.status === 'TAKEN';
    const newStatus = wasTaken ? 'PENDING' : 'TAKEN';

    // Optimistic update
    setDoses((prev) =>
      prev.map((d) =>
        d.peptide_id === dose.peptide_id ? { ...d, status: newStatus } : d
      )
    );

    await Haptics.impactAsync(
      wasTaken ? Haptics.ImpactFeedbackStyle.Light : Haptics.ImpactFeedbackStyle.Medium
    );

    try {
      if (newStatus === 'TAKEN') {
        await logDose(supabase, dose.peptide_id, todayISO, dose.site_label);
        // Cancel the notification for this dose since it's been taken
        await cancelDoseNotification(dose.peptide_id, todayISO);
      } else {
        await resetDose(supabase, dose.peptide_id, todayISO);
        // Re-add the notification since dose was reset to pending
        await scheduleUpcomingNotifications(supabase);
      }
      const fresh = await getScheduledDoses(supabase, todayISO);
      setDoses(fresh);
    } catch (err) {
      console.error('Failed to update dose', err);
      Alert.alert('Error', 'Failed to update dose status.');
      await loadDoses(); // Revert optimistic update
    } finally {
      setBusyId(null);
    }
  };

  const today = new Date();

  return (
    <SafeAreaView className="flex-1 bg-background" edges={['top']}>
      <ScrollView
        className="flex-1"
        contentContainerClassName="px-4 pb-8 pt-2"
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#6366f1"
          />
        }
      >
        {/* Header */}
        <View className="mb-6 mt-2">
          <Text className="text-3xl font-bold text-foreground tracking-tight">Today</Text>
          <Text className="mt-0.5 text-muted text-base">
            {format(today, 'EEEE, MMMM do')}
          </Text>
        </View>

        {/* Dose list */}
        {loading ? (
          <View className="items-center py-16">
            <ActivityIndicator color="#6366f1" size="large" />
          </View>
        ) : doses.length === 0 ? (
          <View className="rounded-2xl border-2 border-dashed border-border py-14 items-center">
            <Text className="text-4xl mb-3">✓</Text>
            <Text className="text-muted font-medium">No doses scheduled for today</Text>
          </View>
        ) : (
          <View className="gap-3">
            {doses.map((dose) => (
              <DoseCard
                key={dose.peptide_id}
                dose={dose}
                isBusy={busyId === dose.peptide_id}
                onToggle={() => handleToggle(dose)}
              />
            ))}
          </View>
        )}

        {/* Inventory warning summary */}
        {doses.some((d) => d.remainingDoses != null && d.remainingDoses <= 5) && (
          <View className="mt-6 rounded-xl bg-amber-900/30 border border-amber-700/40 p-4">
            <Text className="text-amber-400 font-semibold mb-1">⚠ Low inventory</Text>
            {doses
              .filter((d) => d.remainingDoses != null && d.remainingDoses <= 5)
              .map((d) => (
                <Text key={d.peptide_id} className="text-amber-300 text-sm">
                  {d.canonical_name}: {d.remainingDoses} doses remaining
                  {d.reorderDateISO ? ` · reorder by ${d.reorderDateISO}` : ''}
                </Text>
              ))}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
