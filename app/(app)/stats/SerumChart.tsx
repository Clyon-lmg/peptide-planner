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
  TimeScale
} from 'chart.js';
import { Line } from 'react-chartjs-2';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend
);

// Half-life calculation: Amount = Dose * 0.5 ^ (hours_elapsed / half_life_hours)
function calculateDecay(initialAmount: number, hoursElapsed: number, halfLifeHours: number) {
  if (hoursElapsed < 0) return 0;
  return initialAmount * Math.pow(0.5, hoursElapsed / halfLifeHours);
}

export default function SerumChart({ doses, peptides }: { doses: any[], peptides: any[] }) {
  
  const chartData = useMemo(() => {
    // 1. Setup Time Range (e.g. Past 7 days to Future 7 days)
    const now = new Date();
    const startDate = new Date(); startDate.setDate(now.getDate() - 14);
    const endDate = new Date(); endDate.setDate(now.getDate() + 14);
    
    // Generate hourly timestamps for the graph
    const labels: string[] = [];
    const timestamps: number[] = [];
    let current = new Date(startDate);
    while (current <= endDate) {
      labels.push(current.toLocaleDateString());
      timestamps.push(current.getTime());
      current.setHours(current.getHours() + 6); // 6-hour granularity
    }

    // 2. Group Doses by Peptide
    const datasets = peptides.map(peptide => {
      const peptideDoses = doses.filter(d => d.peptide_id === peptide.id);
      if (peptideDoses.length === 0) return null;

      const dataPoints = timestamps.map(ts => {
        // For this specific timestamp, sum up the remaining amount of ALL previous doses
        let totalSerum = 0;
        
        peptideDoses.forEach(dose => {
            const doseTime = new Date(`${dose.date}T${dose.time_of_day || '08:00'}:00`).getTime();
            
            // Only count doses that have happened before this timestamp
            if (doseTime <= ts) {
                const hoursElapsed = (ts - doseTime) / (1000 * 60 * 60);
                const remaining = calculateDecay(
                    dose.dose_mg, 
                    hoursElapsed, 
                    peptide.half_life_hours || 24 // Default 24h if missing
                );
                totalSerum += remaining;
            }
        });
        return totalSerum;
      });

      // Random color generator based on ID
      const color = `hsl(${(peptide.id * 137) % 360}, 70%, 50%)`;

      return {
        label: peptide.canonical_name,
        data: dataPoints,
        borderColor: color,
        backgroundColor: color + '20',
        tension: 0.4, // Smooth curve
        pointRadius: 0, // Hide points for clean look
        pointHitRadius: 10,
      };
    }).filter(Boolean); // Remove nulls

    return { labels, datasets };
  }, [doses, peptides]);

  // @ts-ignore
  return <div className="h-64 w-full"><Line options={{ responsive: true, maintainAspectRatio: false }} data={chartData} /></div>;
}
