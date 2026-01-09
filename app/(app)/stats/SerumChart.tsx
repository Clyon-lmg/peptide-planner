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
  Filler // 🟢 Added Filler for area effects if desired
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

// Calculation: Amount = Dose * 0.5 ^ (hours_elapsed / half_life)
function calculateDecay(initialAmount: number, hoursElapsed: number, halfLifeHours: number) {
  if (hoursElapsed < 0) return 0;
  // If half-life is missing/zero, assume rapid clearance (e.g. 2 hours) to avoid division by zero
  const hl = halfLifeHours || 2; 
  return initialAmount * Math.pow(0.5, hoursElapsed / hl);
}

export default function SerumChart({ doses, peptides }: { doses: any[], peptides: any[] }) {
  
  const chartData = useMemo(() => {
    if (!doses || doses.length === 0) return null;

    // 1. Setup Time Range
    // Look back 45 days (to capture long half-life buildup) and forward 10 days
    const now = new Date();
    const startDate = new Date(); 
    startDate.setDate(now.getDate() - 45);
    
    const endDate = new Date(); 
    endDate.setDate(now.getDate() + 10);
    
    // Generate timestamps (every 12 hours to reduce computation load but keep curve smooth)
    const labels: string[] = [];
    const timestamps: number[] = [];
    let current = new Date(startDate);
    // Align to midnight to keep graph clean
    current.setHours(0, 0, 0, 0); 
    
    while (current <= endDate) {
      if (current.getHours() === 0) {
        // Shorter label: "Jan 1"
        labels.push(current.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }));
      } else {
        labels.push("");
      }
      timestamps.push(current.getTime());
      current.setHours(current.getHours() + 12);
    }

    // 2. Build Datasets
    const datasets = peptides.map((peptide, idx) => {
      // Get all doses for this peptide
      const peptideDoses = doses.filter(d => d.peptide_id === peptide.id);
      if (peptideDoses.length === 0) return null;

      // Calculate serum level at each timestamp point
      const dataPoints = timestamps.map(ts => {
        let totalSerum = 0;
        
        peptideDoses.forEach(dose => {
            // Robust Date Parsing
            // dose.date is usually "YYYY-MM-DD". We assume 08:00 AM if no time specified.
            const datePart = dose.date;
            const timePart = dose.time_of_day || '08:00';
            // Construct ISO string for safer parsing
            const doseDate = new Date(`${datePart}T${timePart}:00`);
            const doseTime = doseDate.getTime();
            
            // Only add dose if it happened BEFORE this graph timestamp
            if (doseTime <= ts) {
                const hoursElapsed = (ts - doseTime) / (1000 * 60 * 60);
                
                // Optimization: If > 6 half-lives passed, amount is negligible (~1.5%)
                const hl = Number(peptide.half_life_hours) || 24;
                if (hoursElapsed < hl * 6) {
                    const remaining = calculateDecay(Number(dose.dose_mg), hoursElapsed, hl);
                    totalSerum += remaining;
                }
            }
        });
        return totalSerum;
      });

      // Styling
      const hue = (idx * 137) % 360; 
      const color = `hsl(${hue}, 70%, 50%)`;

      return {
        label: peptide.canonical_name,
        data: dataPoints,
        borderColor: color,
        backgroundColor: color.replace(')', ', 0.1)'), // Transparent fill
        borderWidth: 2,
        tension: 0.4, // Smooths the line
        pointRadius: 0, // Hides dots for cleaner look
        pointHitRadius: 20, // Easy to hover
        fill: true, // Fills area under curve
      };
    }).filter(Boolean); // Filter out nulls

    if (datasets.length === 0) return null;

    return { labels, datasets };
  }, [doses, peptides]);

  if (!chartData) {
      return (
          <div className="h-64 flex items-center justify-center border-2 border-dashed border-border rounded-xl bg-muted/5">
              <p className="text-muted-foreground text-sm">No dose history found to generate graph.</p>
          </div>
      );
  }

  return (
    <div className="w-full h-[350px]">
        {/* @ts-ignore */}
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
                        ticks: { maxTicksLimit: 8, autoSkip: true }
                    },
                    y: {
                        beginAtZero: true,
                        grid: { color: 'rgba(0,0,0,0.05)' },
                        title: { display: true, text: 'Active mg' }
                    }
                },
                plugins: {
                    legend: {
                        position: 'bottom',
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
