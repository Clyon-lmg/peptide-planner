"use client";

import { useMemo } from "react";
import { Line } from "react-chartjs-2";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
} from "chart.js";
import { isDoseDayLocal } from "@/lib/scheduleEngine";
import type { ProtocolItemState, InventoryPeptide } from "./ProtocolItemRow";

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend
);

export default function ProtocolGraph({
  items,
  peptides,
}: {
  items: ProtocolItemState[];
  peptides: InventoryPeptide[];
}) {
  const data = useMemo(() => {
    const N = 60;
    const today = new Date();
    const labels: string[] = [];
    for (let i = 0; i < N; i++) {
      const d = new Date(today);
      d.setDate(today.getDate() + i);
      labels.push(d.toISOString().split("T")[0]);
    }

    const peptideMap: Record<number, InventoryPeptide> = {};
    peptides.forEach((p) => {
      peptideMap[p.id] = p;
    });

    const grouped: Record<number, ProtocolItemState[]> = {};
    items.forEach((it) => {
      if (!it.peptide_id) return;
      if (!grouped[it.peptide_id]) grouped[it.peptide_id] = [];
      grouped[it.peptide_id].push(it);
    });

    const datasets = Object.entries(grouped).map(([pid, its]) => {
      const peptide = peptideMap[Number(pid)];
      const halfLife = peptide?.half_life_hours || 0;
      const decay = halfLife > 0 ? Math.pow(0.5, 24 / halfLife) : 0;
      let level = 0;
      const points: number[] = [];
      for (let i = 0; i < N; i++) {
        const d = new Date(today);
        d.setDate(today.getDate() + i);
        level = level * decay;
        const dailyDose = its.reduce((sum, item) => {
          return isDoseDayLocal(d, item) ? sum + item.dose_mg_per_administration : sum;
        }, 0);
        level += dailyDose;
        points.push(level);
      }
            const color = its[0]?.color || "#000000";
      return {
        label: peptide?.canonical_name || `Peptide ${pid}`,
        data: points,
        borderWidth: 2,
        borderColor: color,
        backgroundColor: color,
      };
    });

    return { labels, datasets };
  }, [items, peptides]);

  if (!data.datasets.length) return null;

  return (
    <div className="rounded-xl border border-gray-200 dark:border-gray-700 p-4 bg-white dark:bg-gray-900">
      <Line
        data={data}
        options={{
          responsive: true,
          plugins: { legend: { position: "bottom" as const } },
        }}
      />
    </div>
  );
}