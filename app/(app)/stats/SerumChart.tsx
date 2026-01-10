// app/(app)/stats/SerumChart.tsx
"use client";

import React, { useMemo, useEffect } from 'react'; // Added useEffect
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

  // DEBUGGING: Log props when they change
  useEffect(() => {
    console.log("--- SERUM CHART CLIENT DEBUG ---");
    console.log("Peptides Prop:", peptides);
    console.log("Doses Prop (Length):", doses.length);
    
    if (peptides.length > 0 && doses.length > 0) {
      const pId = peptides[0].id;
      const dId = doses[0].peptide_id;
      console.log(`Type Check - Peptide ID: ${pId} (${typeof pId}) vs Dose ID: ${dId} (${typeof dId})`);
      console.log("Do they match loosely?", pId == dId);
      console.log("Do they match strictly as Numbers?", Number(pId) === Number(dId));
    } else {
      console.warn("Either peptides or doses array is empty.");
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
      // Filter for this specific peptide
      const peptideDoses = doses.filter(d => Number(d.peptide_id) === Number(peptide.id));
      
      console.log(`Processing ${peptide.canonical_name}: Found ${peptideDoses.length} matching doses.`);

      const dataPoints = timestamps.map(ts => {
        let totalSerum = 0;
        peptideDoses.forEach(dose => {
            const dateStr = dose.date_for || dose.date;
            if (!dateStr) return;
            
            // Construct timestamp safely
            const doseTime = new Date(`${dateStr}T${dose.time_of_day || '08:00'}:00`).getTime();
            
            // Only calc decay if dose is in the past relative to this timestamp
            if (doseTime <= ts) {
                const elapsed = (ts - doseTime) / (3600000);
                // Cutoff calculation after 6 half-lives to save performance/noise
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

  if (!chartData) {
    console.warn("ChartData is null (peptides length was 0 inside useMemo)");
    return <div className="p-10 text-center text-muted-foreground border border-dashed rounded-xl">No active peptides to display.</div>;
  }

  return <div className="w-full h-[400px]"><Line data={chartData} options={{ responsive: true, maintainAspectRatio: false, scales: { x: { grid: { display: false } } } }} /></div>;
};

export default SerumChart;
