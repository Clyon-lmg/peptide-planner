"use client";

import React, { useMemo, useEffect } from 'react';
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

  // DEBUGGING: Monitor props
  useEffect(() => {
    if (peptides.length === 0) {
       console.log("SerumChart: No peptides received yet.");
    } else {
       console.log(`SerumChart: Received ${peptides.length} peptides. Sample:`, peptides[0]);
    }
  }, [doses, peptides]);

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
      const peptideDoses = doses.filter(d => Number(d.peptide_id) === Number(peptide.id));
      
      const dataPoints = timestamps.map(ts => {
        let totalSerum = 0;
        peptideDoses.forEach(dose => {
            if (dose.status === 'SKIPPED') return;

            const dateStr = dose.date_for || dose.date;
            if (!dateStr) return;
            
            const timeStr = dose.time_of_day ? dose.time_of_day : '08:00';
            const doseTime = new Date(`${dateStr}T${timeStr}:00`).getTime();
            
            if (doseTime <= ts) {
                const elapsed = (ts - doseTime) / (3600000);
                // Use the attached half_life_hours or default to 24
                const hl = Number(peptide.half_life_hours) || 24;
                if (elapsed < hl * 6) {
                    totalSerum += calculateDecay(Number(dose.dose_mg), elapsed, hl);
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

  if (!chartData) return <div className="p-10 text-center text-muted-foreground border border-dashed rounded-xl">No active peptides to display.</div>;

  return <div className="w-full h-[400px]"><Line data={chartData} options={{ responsive: true, maintainAspectRatio: false, scales: { x: { grid: { display: false } } } }} /></div>;
};

export default SerumChart;
