"use client";

import { useMemo } from "react";
import { Line } from "react-chartjs-2";
import Card from "@/components/layout/Card";
import {
    Chart as ChartJS,
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    Title,
    Tooltip,
    Legend,
    Filler
} from "chart.js";
import { isDoseDayUTC } from "@/lib/scheduleEngine";
import type { ProtocolItemState, InventoryPeptide } from "./ProtocolItemRow";

ChartJS.register(
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    Title,
    Tooltip,
    Legend,
    Filler
);

export default function ProtocolGraph({
    items,
    peptides,
}: {
    items: ProtocolItemState[];
    peptides: InventoryPeptide[];
}) {
    const data = useMemo(() => {
        // REDUCED RANGE: 28 Days (4 weeks) for better readability
        const N = 28;
        const start = new Date(new Date().toISOString().slice(0, 10) + "T00:00:00Z");
        const startISO = start.toISOString().slice(0, 10);

        const labels: string[] = [];
        // Shorten date labels to "Dec 12" style
        const dateOptions: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' };

        for (let i = 0; i < N; i++) {
            const d = new Date(start);
            d.setUTCDate(start.getUTCDate() + i);
            labels.push(d.toLocaleDateString('en-US', dateOptions));
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
                const d = new Date(start);
                d.setUTCDate(start.getUTCDate() + i);

                // Decay from previous day
                level = level * decay;

                const dailyDose = its.reduce((sum, item) => {
                    return isDoseDayUTC(d, { ...item, start_date: startISO })
                        ? sum + item.dose_mg_per_administration
                        : sum;
                }, 0);

                // Add new dose
                level += dailyDose;
                points.push(level);
            }

            const color = its[0]?.color || "#000000";

            return {
                label: peptide?.canonical_name || `Peptide ${pid}`,
                data: points,
                borderWidth: 2,
                borderColor: color,
                backgroundColor: color + "10", // Very light fill
                fill: true,
                // CURVE SMOOTHING
                tension: 0.4,
                // HIDE DOTS (Show only on hover)
                pointRadius: 0,
                pointHoverRadius: 6,
                pointHitRadius: 10,
            };
        });

        return { labels, datasets };
    }, [items, peptides]);

    if (!data.datasets.length) return null;

    return (
        <Card className="mt-6">
            <div className="mb-4">
                <h3 className="text-sm font-bold text-muted-foreground uppercase tracking-wider">Projected Release Levels (28 Days)</h3>
                <p className="text-xs text-muted-foreground">Estimated daily concentration based on protocol and half-life.</p>
            </div>
            <div className="h-[300px] w-full">
                <Line
                    data={data}
                    options={{
                        responsive: true,
                        maintainAspectRatio: false,
                        interaction: {
                            mode: 'index',
                            intersect: false,
                        },
                        plugins: {
                            legend: {
                                position: 'bottom',
                                labels: {
                                    usePointStyle: true,
                                    boxWidth: 8,
                                    font: { size: 11 }
                                }
                            },
                            tooltip: {
                                backgroundColor: 'rgba(0,0,0,0.8)',
                                padding: 10,
                                cornerRadius: 8,
                                titleFont: { size: 13 },
                                bodyFont: { size: 12 },
                            }
                        },
                        scales: {
                            x: {
                                grid: { display: false }, // Remove vertical grid lines
                                ticks: {
                                    maxRotation: 0,
                                    autoSkip: true,
                                    font: { size: 10 }
                                }
                            },
                            y: {
                                beginAtZero: true,
                                grid: { color: 'rgba(0,0,0,0.05)' }, // Subtle horizontal lines
                                border: { display: false },
                                ticks: { font: { size: 10 } }
                            }
                        }
                    }}
                />
            </div>
        </Card>
    );
}