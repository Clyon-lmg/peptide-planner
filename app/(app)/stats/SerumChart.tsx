"use client";

import React, { useMemo } from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  TimeScale,
  Filler
} from 'chart.js';
import { Line } from 'react-chartjs-2';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend, TimeScale, Filler);

interface SerumChartProps {
  doses: any[];
  peptides: any[];
}

function calculateDecay(initialAmount: number, hoursElapsed: number, halfLifeHours: number) {
  if (hoursElapsed < 0) return 0;
  const hl = halfLifeHours || 24; 
  return initialAmount * Math.pow(0.5, hoursElapsed / hl);
}

const SerumChart: React.FC<SerumChartProps> = ({ doses = [], peptides = [] }) => {
  const chartData = useMemo(() => {
    if (!peptides || peptides.length === 0) return null;

    const now = new Date();
    const startDate = new Date(); 
    startDate.setDate(now.getDate() - 21);
    const endDate = new Date(); 
    endDate.setDate(now.getDate() + 14);
    
    const labels: string[] = [];
    const timestamps: number[] = [];
    let current = new Date(startDate);
    current.setHours(0, 0, 0, 0);

    while (current <= endDate) {
      if (current.getHours() === 0) {
        labels.push(current.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }));
      } else { labels.push(""); }
      timestamps.push(current.getTime());
      current.setHours(current.getHours() + 12);
    }

    const datasets = peptides.map((peptide, idx) => {
      // 🟢 FIX: Number() cast
      const peptideDoses = doses.filter(d => Number(d.peptide_id) === Number(peptide.id));

      const dataPoints = timestamps.map(ts => {
        let totalSerum = 0;
        peptideDoses.forEach(dose => {
            // 🟢 FIX: Use date_for
            const dateStr = dose.date_for || dose.date;
            if (!dateStr) return;
            const doseTime = new Date(`${dateStr}T${dose.time_of_day || '08:00'}:00`).getTime();
            
            if (doseTime <= ts) {
                const elapsed = (ts - doseTime) / (3600000);
                if (elapsed < (Number(peptide.half_life_hours) || 24) * 6) {
                    totalSerum += calculateDecay(Number(dose.dose_mg), elapsed, Number(peptide.half_life_hours) || 24);
                }
            }
        });
        return totalSerum;
      });

      const hue = (idx * 137) % 360; 
      return {
        label: peptide.canonical_name,
        data: dataPoints,
        borderColor: `hsl(${hue}, 70%, 50%)`,
        backgroundColor: `hsla(${hue}, 70%, 50%, 0.1)`,
        borderWidth: 2,
        tension: 0.4,
        pointRadius: 0,
        fill: true,
      };
    });

    return { labels, datasets };
  }, [doses, peptides]);

  if (!chartData) return <div className="p-10 text-center text-muted-foreground border border-dashed rounded-xl">No active peptides.</div>;

  return <div className="w-full h-[400px]"><Line data={chartData} options={{ responsive: true, maintainAspectRatio: false, scales: { x: { grid: { display: false } } } }} /></div>;
};

export default SerumChart;
