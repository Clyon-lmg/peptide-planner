import { View, Text, Pressable, ActivityIndicator } from 'react-native';
import { Check, Clock, Syringe, Target } from 'lucide-react-native';
import type { TodayDoseRow } from '@/lib/types';

type Props = {
  dose: TodayDoseRow;
  isBusy: boolean;
  onToggle: () => void;
};

function fmt(n: number | null | undefined, digits = 2): string {
  if (n == null || Number.isNaN(Number(n))) return '—';
  return Number(n).toFixed(digits);
}

export default function DoseCard({ dose, isBusy, onToggle }: Props) {
  const isTaken = dose.status === 'TAKEN';

  return (
    <View
      className={`rounded-2xl border p-4 ${
        isTaken
          ? 'bg-emerald-900/20 border-emerald-700/50'
          : 'bg-card border-border'
      }`}
    >
      <View className="flex-row items-center justify-between gap-4">
        {/* Info */}
        <View className="flex-1 min-w-0">
          {/* Name */}
          <Text
            className={`font-bold text-lg mb-1 ${
              isTaken ? 'text-muted line-through' : 'text-foreground'
            }`}
            numberOfLines={1}
          >
            {dose.canonical_name}
          </Text>

          {/* Dose details */}
          <View className="flex-row flex-wrap gap-x-2.5 gap-y-0.5 items-center">
            <Text className="text-sm font-semibold text-foreground">
              {fmt(dose.dose_mg)} mg
            </Text>

            {dose.syringe_units != null && (
              <>
                <Text className="text-muted">·</Text>
                <View className="flex-row items-center gap-1">
                  <Syringe size={12} color="#94a3b8" />
                  <Text className="text-sm text-muted">
                    {fmt(dose.syringe_units, 0)} units
                  </Text>
                </View>
              </>
            )}

            {dose.site_label && (
              <>
                <Text className="text-muted">·</Text>
                <View className="flex-row items-center gap-1">
                  <Target size={12} color="#94a3b8" />
                  <Text className="text-sm text-muted">{dose.site_label}</Text>
                </View>
              </>
            )}

            {dose.time_of_day && (
              <>
                <Text className="text-muted">·</Text>
                <View className="flex-row items-center gap-1">
                  <Clock size={12} color="#94a3b8" />
                  <Text className="text-sm text-muted">{dose.time_of_day}</Text>
                </View>
              </>
            )}
          </View>
        </View>

        {/* Toggle button */}
        <Pressable
          onPress={onToggle}
          disabled={isBusy}
          className={`size-12 rounded-full items-center justify-center ${
            isTaken
              ? 'bg-emerald-600'
              : 'bg-primary/15 border border-primary/30'
          }`}
          style={{ opacity: isBusy ? 0.5 : 1 }}
        >
          {isBusy ? (
            <ActivityIndicator size="small" color={isTaken ? '#fff' : '#6366f1'} />
          ) : isTaken ? (
            <Check size={22} color="#fff" strokeWidth={2.5} />
          ) : (
            <View className="size-3 rounded-full bg-primary/60" />
          )}
        </Pressable>
      </View>

      {/* Inventory warning */}
      {dose.remainingDoses != null && dose.remainingDoses <= 5 && (
        <View className="mt-2 pt-2 border-t border-border/50 flex-row items-center gap-1.5">
          <Text className="text-amber-400 text-xs font-medium">
            ⚠ {dose.remainingDoses} doses remaining
            {dose.reorderDateISO ? ` · reorder by ${dose.reorderDateISO}` : ''}
          </Text>
        </View>
      )}
    </View>
  );
}
