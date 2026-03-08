import { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { format } from 'date-fns';
import { supabase } from '@/lib/supabase';

type Protocol = {
  id: number;
  name: string;
  start_date: string;
  end_date: string | null;
  items: ProtocolItemRow[];
};

type ProtocolItemRow = {
  peptide_id: number;
  canonical_name: string;
  dose_mg_per_administration: number;
  schedule: string;
  time_of_day: string | null;
  custom_days: number[] | null;
  every_n_days: number | null;
  cycle_on_weeks: number | null;
  cycle_off_weeks: number | null;
};

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function scheduleLabel(item: ProtocolItemRow): string {
  switch (item.schedule) {
    case 'EVERYDAY': return 'Every day';
    case 'WEEKDAYS': return 'Mon – Fri';
    case 'CUSTOM':
      return (item.custom_days || []).map((d) => DAY_LABELS[d]).join(', ');
    case 'EVERY_N_DAYS':
      return `Every ${item.every_n_days} days`;
    default: return item.schedule;
  }
}

function cycleLabel(item: ProtocolItemRow): string | null {
  if (!item.cycle_on_weeks || !item.cycle_off_weeks) return null;
  return `${item.cycle_on_weeks}w on / ${item.cycle_off_weeks}w off`;
}

export default function ProtocolsScreen() {
  const [protocols, setProtocols] = useState<Protocol[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadProtocols = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const todayISO = new Date().toISOString().split('T')[0];

    const { data: protoRows } = await supabase
      .from('protocols')
      .select('id, name, start_date, end_date')
      .eq('user_id', user.id)
      .order('start_date', { ascending: false });

    if (!protoRows || protoRows.length === 0) {
      setProtocols([]);
      return;
    }

    const activeIds = protoRows
      .filter((p: any) => {
        if (!p.start_date) return false;
        if (p.start_date > todayISO) return false;
        if (p.end_date && p.end_date < todayISO) return false;
        return true;
      })
      .map((p: any) => p.id);

    const { data: itemRows } = await supabase
      .from('protocol_items')
      .select(
        'protocol_id, peptide_id, dose_mg_per_administration, schedule, time_of_day, custom_days, every_n_days, cycle_on_weeks, cycle_off_weeks, peptides(canonical_name)'
      )
      .in('protocol_id', activeIds);

    const itemsByProto = new Map<number, ProtocolItemRow[]>();
    (itemRows || []).forEach((it: any) => {
      if (!itemsByProto.has(it.protocol_id)) itemsByProto.set(it.protocol_id, []);
      itemsByProto.get(it.protocol_id)!.push({
        peptide_id: it.peptide_id,
        canonical_name: it.peptides?.canonical_name || `Peptide #${it.peptide_id}`,
        dose_mg_per_administration: Number(it.dose_mg_per_administration || 0),
        schedule: it.schedule,
        time_of_day: it.time_of_day,
        custom_days: it.custom_days,
        every_n_days: it.every_n_days,
        cycle_on_weeks: it.cycle_on_weeks,
        cycle_off_weeks: it.cycle_off_weeks,
      });
    });

    const result: Protocol[] = protoRows
      .filter((p: any) => activeIds.includes(p.id))
      .map((p: any) => ({
        id: p.id,
        name: p.name,
        start_date: p.start_date,
        end_date: p.end_date,
        items: itemsByProto.get(p.id) || [],
      }));

    setProtocols(result);
  }, []);

  useEffect(() => {
    loadProtocols().finally(() => setLoading(false));
  }, [loadProtocols]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadProtocols();
    setRefreshing(false);
  }, [loadProtocols]);

  return (
    <SafeAreaView className="flex-1 bg-background" edges={['top']}>
      <ScrollView
        className="flex-1"
        contentContainerClassName="px-4 pb-8 pt-2"
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#6366f1" />
        }
      >
        <Text className="text-3xl font-bold text-foreground tracking-tight mb-1 mt-2">
          Protocols
        </Text>
        <Text className="text-muted text-sm mb-6">Active dosing protocols</Text>

        {loading ? (
          <View className="items-center py-16">
            <ActivityIndicator color="#6366f1" size="large" />
          </View>
        ) : protocols.length === 0 ? (
          <View className="rounded-2xl border-2 border-dashed border-border py-14 items-center">
            <Text className="text-muted">No active protocols</Text>
            <Text className="text-muted-foreground text-sm mt-1">
              Set up protocols at peptideplanner.com
            </Text>
          </View>
        ) : (
          <View className="gap-4">
            {protocols.map((proto) => (
              <View key={proto.id} className="rounded-2xl bg-card border border-border overflow-hidden">
                {/* Protocol header */}
                <View className="px-4 py-3 border-b border-border">
                  <Text className="font-bold text-lg text-foreground">{proto.name}</Text>
                  <Text className="text-muted text-xs mt-0.5">
                    Started {format(new Date(proto.start_date), 'MMM d, yyyy')}
                    {proto.end_date
                      ? ` · ends ${format(new Date(proto.end_date), 'MMM d, yyyy')}`
                      : ' · ongoing'}
                  </Text>
                </View>

                {/* Protocol items */}
                <View className="p-3 gap-2">
                  {proto.items.map((item) => {
                    const cycle = cycleLabel(item);
                    return (
                      <View
                        key={item.peptide_id}
                        className="rounded-xl bg-background/60 border border-border/50 p-3"
                      >
                        <View className="flex-row items-start justify-between">
                          <Text className="font-semibold text-foreground flex-1 mr-2">
                            {item.canonical_name}
                          </Text>
                          <Text className="text-primary font-bold">
                            {item.dose_mg_per_administration} mg
                          </Text>
                        </View>
                        <View className="flex-row flex-wrap gap-x-3 mt-1">
                          <Text className="text-muted text-xs">{scheduleLabel(item)}</Text>
                          {cycle && (
                            <Text className="text-muted text-xs">· {cycle}</Text>
                          )}
                          {item.time_of_day && (
                            <Text className="text-muted text-xs">· {item.time_of_day}</Text>
                          )}
                        </View>
                      </View>
                    );
                  })}
                </View>
              </View>
            ))}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
