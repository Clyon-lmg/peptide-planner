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

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  TimeScale,
  Filler
);

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
      } else {
        labels.push(""); 
      }
      timestamps.push(current.getTime());
      current.setHours(current.getHours() + 12);
    }

    const datasets = peptides.map((peptide, idx) => {
      // 🟢 FIX: Safe ID Comparison
      const peptideDoses = doses.filter(d => Number(d.peptide_id) === Number(peptide.id));

      const dataPoints = timestamps.map(ts => {
        let totalSerum = 0;
        
        peptideDoses.forEach(dose => {
            // 🟢 FIX: Use 'date_for' primarily
            const dateStr = dose.date_for || dose.date;
            if (!dateStr) return;

            const timeStr = dose.time_of_day || '08:00';
            const doseTime = new Date(`${dateStr}T${timeStr}:00`).getTime();
            
            if (doseTime <= ts) {
                const hoursElapsed = (ts - doseTime) / (1000 * 60 * 60);
                const halfLife = Number(peptide.half_life_hours) || 24;
                if (hoursElapsed < halfLife * 6) {
                    const remaining = calculateDecay(Number(dose.dose_mg), hoursElapsed, halfLife);
                    totalSerum += remaining;
                }
            }
        });
        return totalSerum;
      });

      const hue = (idx * 137) % 360; 
      const color = `hsl(${hue}, 70%, 50%)`;

      return {
        label: peptide.canonical_name,
        data: dataPoints,
        borderColor: color,
        backgroundColor: color.replace(')', ', 0.1)'),
        borderWidth: 2,
        tension: 0.4,
        pointRadius: 0,
        pointHitRadius: 10,
        fill: true,
      };
    });

    return { labels, datasets };
  }, [doses, peptides]);

  if (!chartData) {
      return (
        <div className="w-full h-[300px] flex items-center justify-center border-2 border-dashed border-border rounded-xl">
             <p className="text-muted-foreground text-sm">No peptides available to graph.</p>
        </div>
      );
  }

  return (
    <div className="w-full h-[400px]">
        <Line 
            data={chartData} 
            options={{
                responsive: true,
                maintainAspectRatio: false,
                interaction: {
                    mode: 'index',
                    intersect: false,
                },
                scales: {
                    x: {
                        grid: { display: false },
                        ticks: { maxTicksLimit: 10, autoSkip: true }
                    },
                    y: {
                        beginAtZero: true,
                        grid: { color: 'rgba(0,0,0,0.05)' }
                    }
                },
                plugins: {
                    legend: {
                        position: 'bottom' as const,
                        labels: { usePointStyle: true, boxWidth: 8 }
                    },
                    tooltip: {
                        callbacks: {
                            label: (ctx) => ` ${ctx.dataset.label}: ${Number(ctx.raw).toFixed(3)} mg`
                        }
                    }
                }
            }} 
        />
    </div>
  );
};

export default SerumChart;
