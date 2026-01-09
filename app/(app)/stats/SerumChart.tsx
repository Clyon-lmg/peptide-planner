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

// Register ChartJS components
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend
);

// Formula: Amount = Dose * 0.5 ^ (hours_elapsed / half_life)
function calculateDecay(initialAmount: number, hoursElapsed: number, halfLifeHours: number) {
  if (hoursElapsed < 0) return 0;
  return initialAmount * Math.pow(0.5, hoursElapsed / halfLifeHours);
}

export default function SerumChart({ doses, peptides }: { doses: any[], peptides: any[] }) {
  
  const chartData = useMemo(() => {
    // 1. Setup Time Range: Past 21 days -> Future 14 days
    const now = new Date();
    const startDate = new Date(); 
    startDate.setDate(now.getDate() - 21);
    
    const endDate = new Date(); 
    endDate.setDate(now.getDate() + 14);
    
    // Generate timestamps (every 6 hours for smoother graph)
    const labels: string[] = [];
    const timestamps: number[] = [];
    let current = new Date(startDate);
    
    while (current <= endDate) {
      // Label only midnight for cleaner X-axis
      if (current.getHours() === 0) {
        labels.push(current.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }));
      } else {
        labels.push(""); // Empty label for inter-day points
      }
      timestamps.push(current.getTime());
      current.setHours(current.getHours() + 6);
    }

    // 2. Build Datasets
    const datasets = peptides.map((peptide, idx) => {
      // Filter doses for this peptide
      const peptideDoses = doses.filter(d => d.peptide_id === peptide.id);
      if (peptideDoses.length === 0) return null;

      // Calculate serum level at each timestamp
      const dataPoints = timestamps.map(ts => {
        let totalSerum = 0;
        
        peptideDoses.forEach(dose => {
            // Parse Dose Time
            const dateStr = dose.date; 
            const timeStr = dose.time_of_day || '08:00';
            const doseTime = new Date(`${dateStr}T${timeStr}:00`).getTime();
            
            // Only sum doses that occurred BEFORE this timestamp
            if (doseTime <= ts) {
                const hoursElapsed = (ts - doseTime) / (1000 * 60 * 60);
                
                // Cut off calculation after 5 half-lives to save performance
                const halfLife = peptide.half_life_hours || 24;
                if (hoursElapsed < halfLife * 6) {
                    const remaining = calculateDecay(dose.dose_mg, hoursElapsed, halfLife);
                    totalSerum += remaining;
                }
            }
        });
        return totalSerum;
      });

      // Colors
      const hue = (idx * 137) % 360; 
      const color = `hsl(${hue}, 70%, 50%)`;

      return {
        label: `${peptide.canonical_name} (mg)`,
        data: dataPoints,
        borderColor: color,
        backgroundColor: color,
        borderWidth: 2,
        tension: 0.4, // Smooth cubic interpolation
        pointRadius: 0,
        pointHitRadius: 10,
      };
    }).filter(Boolean); // Remove nulls (peptides with no doses)

    return { labels, datasets };
  }, [doses, peptides]);

  // @ts-ignore
  return (
    <div className="w-full h-[400px]">
        {/* @ts-ignore - ChartJS types can be finicky */}
        <Line 
            data={chartData as any} 
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
                        grid: { color: '#f3f4f6' }
                    }
                },
                plugins: {
                    legend: {
                        position: 'bottom' as const,
                        labels: { usePointStyle: true, boxWidth: 8 }
                    },
                    tooltip: {
                        callbacks: {
                            label: (ctx) => ` ${ctx.dataset.label}: ${Number(ctx.raw).toFixed(2)} mg`
                        }
                    }
                }
            }} 
        />
    </div>
  );
}
