import { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Package, Pill } from 'lucide-react-native';
import { supabase } from '@/lib/supabase';
import { unitsFromDose } from '@/lib/forecast';

type VialItem = {
  id: number;
  peptide_id: number;
  canonical_name: string;
  vials: number;
  mg_per_vial: number;
  bac_ml: number | null;
  current_used_mg: number;
};

type CapsuleItem = {
  id: number;
  peptide_id: number;
  canonical_name: string;
  bottles: number;
  caps_per_bottle: number;
  mg_per_cap: number;
  current_used_mg: number;
};

function remainingMgVial(item: VialItem): number {
  const total = item.vials * item.mg_per_vial;
  return Math.max(0, total - item.current_used_mg);
}

function remainingMgCap(item: CapsuleItem): number {
  const total = item.bottles * item.caps_per_bottle * item.mg_per_cap;
  return Math.max(0, total - item.current_used_mg);
}

function stockColor(remaining: number, total: number): string {
  if (total === 0) return '#64748b';
  const pct = remaining / total;
  if (pct <= 0.1) return '#ef4444'; // red
  if (pct <= 0.25) return '#f59e0b'; // amber
  return '#10b981'; // emerald
}

export default function InventoryScreen() {
  const [vials, setVials] = useState<VialItem[]>([]);
  const [capsules, setCapsules] = useState<CapsuleItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadInventory = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const [{ data: vialRows }, { data: capRows }] = await Promise.all([
      supabase
        .from('inventory_items')
        .select('id, peptide_id, vials, mg_per_vial, bac_ml, current_used_mg, peptides(canonical_name)')
        .eq('user_id', user.id),
      supabase
        .from('inventory_capsules')
        .select('id, peptide_id, bottles, caps_per_bottle, mg_per_cap, current_used_mg, peptides(canonical_name)')
        .eq('user_id', user.id),
    ]);

    setVials(
      (vialRows || []).map((r: any) => ({
        id: r.id,
        peptide_id: r.peptide_id,
        canonical_name: r.peptides?.canonical_name || `Peptide #${r.peptide_id}`,
        vials: Number(r.vials || 0),
        mg_per_vial: Number(r.mg_per_vial || 0),
        bac_ml: r.bac_ml ? Number(r.bac_ml) : null,
        current_used_mg: Number(r.current_used_mg || 0),
      }))
    );

    setCapsules(
      (capRows || []).map((r: any) => ({
        id: r.id,
        peptide_id: r.peptide_id,
        canonical_name: r.peptides?.canonical_name || `Peptide #${r.peptide_id}`,
        bottles: Number(r.bottles || 0),
        caps_per_bottle: Number(r.caps_per_bottle || 0),
        mg_per_cap: Number(r.mg_per_cap || 0),
        current_used_mg: Number(r.current_used_mg || 0),
      }))
    );
  }, []);

  useEffect(() => {
    loadInventory().finally(() => setLoading(false));
  }, [loadInventory]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadInventory();
    setRefreshing(false);
  }, [loadInventory]);

  const hasItems = vials.length > 0 || capsules.length > 0;

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
          Inventory
        </Text>
        <Text className="text-muted text-sm mb-6">Current stock levels</Text>

        {loading ? (
          <View className="items-center py-16">
            <ActivityIndicator color="#6366f1" size="large" />
          </View>
        ) : !hasItems ? (
          <View className="rounded-2xl border-2 border-dashed border-border py-14 items-center">
            <Text className="text-muted">No inventory tracked</Text>
            <Text className="text-muted-foreground text-sm mt-1">
              Add inventory at peptideplanner.com
            </Text>
          </View>
        ) : (
          <View className="gap-4">
            {/* Vials */}
            {vials.length > 0 && (
              <View>
                <View className="flex-row items-center gap-2 mb-2.5">
                  <Package size={16} color="#6366f1" />
                  <Text className="text-sm font-semibold text-foreground uppercase tracking-wider">
                    Vials
                  </Text>
                </View>
                <View className="gap-2.5">
                  {vials.map((item) => {
                    const totalMg = item.vials * item.mg_per_vial;
                    const remaining = remainingMgVial(item);
                    const color = stockColor(remaining, totalMg);
                    const units = item.bac_ml
                      ? unitsFromDose(item.mg_per_vial / 10, item.mg_per_vial, item.bac_ml)
                      : null; // units per 0.1mg — just for reference
                    return (
                      <View
                        key={item.id}
                        className="rounded-xl bg-card border border-border p-4"
                      >
                        <View className="flex-row items-start justify-between mb-2">
                          <Text className="font-semibold text-foreground flex-1 mr-2" numberOfLines={1}>
                            {item.canonical_name}
                          </Text>
                          <Text className="text-xs font-medium" style={{ color }}>
                            {item.vials} vial{item.vials !== 1 ? 's' : ''}
                          </Text>
                        </View>

                        {/* Progress bar */}
                        <View className="h-1.5 rounded-full bg-border mb-2">
                          <View
                            className="h-1.5 rounded-full"
                            style={{
                              width: `${totalMg > 0 ? Math.min(100, (remaining / totalMg) * 100) : 0}%`,
                              backgroundColor: color,
                            }}
                          />
                        </View>

                        <View className="flex-row flex-wrap gap-x-3 gap-y-0.5">
                          <Text className="text-xs text-muted">
                            {remaining.toFixed(1)} / {totalMg.toFixed(0)} mg remaining
                          </Text>
                          <Text className="text-xs text-muted">
                            · {item.mg_per_vial} mg/vial
                          </Text>
                          {item.bac_ml && (
                            <Text className="text-xs text-muted">
                              · {item.bac_ml} mL BAC
                            </Text>
                          )}
                        </View>
                      </View>
                    );
                  })}
                </View>
              </View>
            )}

            {/* Capsules */}
            {capsules.length > 0 && (
              <View>
                <View className="flex-row items-center gap-2 mb-2.5">
                  <Pill size={16} color="#6366f1" />
                  <Text className="text-sm font-semibold text-foreground uppercase tracking-wider">
                    Capsules
                  </Text>
                </View>
                <View className="gap-2.5">
                  {capsules.map((item) => {
                    const totalMg = item.bottles * item.caps_per_bottle * item.mg_per_cap;
                    const remaining = remainingMgCap(item);
                    const color = stockColor(remaining, totalMg);
                    const totalCaps = item.bottles * item.caps_per_bottle;
                    const usedCaps = Math.floor(item.current_used_mg / item.mg_per_cap);
                    const remainingCaps = Math.max(0, totalCaps - usedCaps);
                    return (
                      <View
                        key={item.id}
                        className="rounded-xl bg-card border border-border p-4"
                      >
                        <View className="flex-row items-start justify-between mb-2">
                          <Text className="font-semibold text-foreground flex-1 mr-2" numberOfLines={1}>
                            {item.canonical_name}
                          </Text>
                          <Text className="text-xs font-medium" style={{ color }}>
                            {item.bottles} bottle{item.bottles !== 1 ? 's' : ''}
                          </Text>
                        </View>

                        <View className="h-1.5 rounded-full bg-border mb-2">
                          <View
                            className="h-1.5 rounded-full"
                            style={{
                              width: `${totalMg > 0 ? Math.min(100, (remaining / totalMg) * 100) : 0}%`,
                              backgroundColor: color,
                            }}
                          />
                        </View>

                        <View className="flex-row flex-wrap gap-x-3 gap-y-0.5">
                          <Text className="text-xs text-muted">
                            {remainingCaps} / {totalCaps} caps remaining
                          </Text>
                          <Text className="text-xs text-muted">
                            · {item.mg_per_cap} mg/cap
                          </Text>
                        </View>
                      </View>
                    );
                  })}
                </View>
              </View>
            )}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
