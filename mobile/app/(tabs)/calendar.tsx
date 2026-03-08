import { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ChevronLeft, ChevronRight } from 'lucide-react-native';
import { format, addDays, subDays, startOfWeek, isSameDay } from 'date-fns';
import { supabase } from '@/lib/supabase';
import { getScheduledDoses } from '@/lib/doseService';
import type { TodayDoseRow } from '@/lib/types';

function toISO(d: Date): string {
  const offset = d.getTimezoneOffset() * 60000;
  return new Date(d.getTime() - offset).toISOString().split('T')[0];
}

// ─── Week strip ──────────────────────────────────────────────────────────────

type WeekDayProps = {
  date: Date;
  isSelected: boolean;
  isToday: boolean;
  onPress: () => void;
};

function WeekDay({ date, isSelected, isToday, onPress }: WeekDayProps) {
  return (
    <Pressable onPress={onPress} className="flex-1 items-center py-2">
      <Text className="text-xs text-muted mb-1">
        {format(date, 'EEE').toUpperCase()}
      </Text>
      <View
        className={`size-9 rounded-full items-center justify-center ${
          isSelected ? 'bg-primary' : isToday ? 'border border-primary' : ''
        }`}
      >
        <Text
          className={`text-sm font-semibold ${
            isSelected ? 'text-white' : isToday ? 'text-primary' : 'text-foreground'
          }`}
        >
          {format(date, 'd')}
        </Text>
      </View>
    </Pressable>
  );
}

// ─── Dose status badge ────────────────────────────────────────────────────────

const STATUS_STYLES = {
  TAKEN: 'bg-emerald-600',
  SKIPPED: 'bg-slate-600',
  PENDING: 'bg-primary/20',
} as const;

const STATUS_TEXT = {
  TAKEN: 'Taken',
  SKIPPED: 'Skipped',
  PENDING: 'Pending',
} as const;

// ─── Screen ──────────────────────────────────────────────────────────────────

export default function CalendarScreen() {
  const today = new Date();
  const [selectedDate, setSelectedDate] = useState(today);
  const [weekStart, setWeekStart] = useState(startOfWeek(today, { weekStartsOn: 1 }));
  const [doses, setDoses] = useState<TodayDoseRow[]>([]);
  const [loading, setLoading] = useState(false);

  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  const loadDoses = useCallback(async (date: Date) => {
    setLoading(true);
    try {
      const data = await getScheduledDoses(supabase, toISO(date));
      setDoses(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDoses(selectedDate);
  }, [selectedDate, loadDoses]);

  const selectDate = (date: Date) => {
    setSelectedDate(date);
  };

  const prevWeek = () => setWeekStart((w) => subDays(w, 7));
  const nextWeek = () => setWeekStart((w) => addDays(w, 7));

  const isCurrentWeek = isSameDay(weekStart, startOfWeek(today, { weekStartsOn: 1 }));

  return (
    <SafeAreaView className="flex-1 bg-background" edges={['top']}>
      {/* Week navigation */}
      <View className="px-4 pt-2 pb-3 border-b border-border">
        <View className="flex-row items-center justify-between mb-3">
          <Text className="text-2xl font-bold text-foreground">
            {format(selectedDate, 'MMMM yyyy')}
          </Text>
          <View className="flex-row gap-1">
            <Pressable
              onPress={prevWeek}
              className="size-9 rounded-lg bg-card items-center justify-center"
            >
              <ChevronLeft size={18} color="#94a3b8" />
            </Pressable>
            <Pressable
              onPress={nextWeek}
              disabled={isCurrentWeek}
              className="size-9 rounded-lg bg-card items-center justify-center disabled:opacity-40"
            >
              <ChevronRight size={18} color="#94a3b8" />
            </Pressable>
          </View>
        </View>

        <View className="flex-row">
          {weekDays.map((date) => (
            <WeekDay
              key={date.toISOString()}
              date={date}
              isSelected={isSameDay(date, selectedDate)}
              isToday={isSameDay(date, today)}
              onPress={() => selectDate(date)}
            />
          ))}
        </View>
      </View>

      {/* Dose list for selected day */}
      <ScrollView className="flex-1" contentContainerClassName="p-4 pb-8">
        <Text className="text-base font-semibold text-foreground mb-3">
          {isSameDay(selectedDate, today)
            ? "Today's Doses"
            : format(selectedDate, 'EEEE, MMMM do')}
        </Text>

        {loading ? (
          <View className="items-center py-12">
            <ActivityIndicator color="#6366f1" />
          </View>
        ) : doses.length === 0 ? (
          <View className="rounded-2xl border-2 border-dashed border-border py-10 items-center">
            <Text className="text-muted">No doses scheduled</Text>
          </View>
        ) : (
          <View className="gap-2.5">
            {doses.map((dose) => (
              <View
                key={dose.peptide_id}
                className="rounded-xl bg-card border border-border p-4 flex-row items-center justify-between"
              >
                <View className="flex-1 min-w-0 mr-3">
                  <Text
                    className={`font-semibold text-base text-foreground ${
                      dose.status === 'TAKEN' ? 'line-through text-muted' : ''
                    }`}
                    numberOfLines={1}
                  >
                    {dose.canonical_name}
                  </Text>
                  <View className="flex-row flex-wrap gap-x-2 mt-0.5">
                    <Text className="text-sm text-muted">{dose.dose_mg} mg</Text>
                    {dose.syringe_units != null && (
                      <Text className="text-sm text-muted">
                        · {Math.round(dose.syringe_units)} units
                      </Text>
                    )}
                    {dose.site_label && (
                      <Text className="text-sm text-muted">· {dose.site_label}</Text>
                    )}
                    {dose.time_of_day && (
                      <Text className="text-sm text-muted">· {dose.time_of_day}</Text>
                    )}
                  </View>
                </View>

                <View
                  className={`px-2.5 py-1 rounded-full ${STATUS_STYLES[dose.status]}`}
                >
                  <Text className="text-xs font-medium text-white">
                    {STATUS_TEXT[dose.status]}
                  </Text>
                </View>
              </View>
            ))}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
