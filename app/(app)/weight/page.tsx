"use client";

import { useState, useEffect } from "react";
import Card from "@/components/layout/Card";
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

ChartJS.register(
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    Title,
    Tooltip,
    Legend
);

type Entry = {
    date: string;
    weight: number;
    note: string;
};

export default function WeightPage() {
    const [weight, setWeight] = useState("");
    const [note, setNote] = useState("");
    const [entries, setEntries] = useState<Entry[]>([]);

    useEffect(() => {
        const stored = localStorage.getItem("weightEntries");
        if (stored) {
            try {
                setEntries(JSON.parse(stored));
            } catch {
                /* ignore */
            }
        }
    }, []);

    useEffect(() => {
        localStorage.setItem("weightEntries", JSON.stringify(entries));
    }, [entries]);

    function addEntry(e: React.FormEvent) {
        e.preventDefault();
        const w = parseFloat(weight);
        if (Number.isNaN(w)) return;
        const entry: Entry = {
            date: new Date().toISOString().slice(0, 10),
            weight: w,
            note: note.trim(),
        };
        setEntries([...entries, entry]);
        setWeight("");
        setNote("");
    }

    const data = {
        labels: entries.map((e) => e.date),
        datasets: [
            {
                label: "Weight",
                data: entries.map((e) => e.weight),
                borderColor: "rgb(59, 130, 246)",
                backgroundColor: "rgba(59, 130, 246, 0.5)",
                tension: 0.3,
            },
        ],
    };

    return (
        <div className="space-y-6 max-w-4xl mx-auto p-4">
            <h1 className="pp-h1">Weight Tracker</h1>

            <Card>
                <form onSubmit={addEntry} className="flex flex-col sm:flex-row gap-4 items-end">
                    <label className="flex flex-col gap-1.5 w-full sm:w-32">
                        <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Weight</span>
                        <input
                            type="number"
                            step="0.1"
                            value={weight}
                            onChange={(e) => setWeight(e.target.value)}
                            className="input"
                            placeholder="0.0"
                            required
                        />
                    </label>

                    {/* FIXED: Removed fixed width, used flex-1 to fill space */}
                    <label className="flex flex-col gap-1.5 flex-1 w-full">
                        <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Note</span>
                        <input
                            type="text"
                            value={note}
                            onChange={(e) => setNote(e.target.value)}
                            className="input w-full"
                            placeholder="Optional note..."
                            maxLength={200}
                        />
                    </label>

                    <button type="submit" className="btn bg-primary text-primary-foreground hover:bg-primary/90 w-full sm:w-auto">
                        Log Entry
                    </button>
                </form>
            </Card>

            {entries.length > 0 && (
                <Card>
                    <div className="h-[300px] w-full">
                        <Line
                            data={data}
                            options={{
                                responsive: true,
                                maintainAspectRatio: false,
                                plugins: { legend: { display: false } },
                                scales: {
                                    x: { grid: { display: false } },
                                    y: { grid: { color: 'rgba(0,0,0,0.05)' } }
                                }
                            }}
                        />
                    </div>
                </Card>
            )}

            {entries.length > 0 && (
                <div className="space-y-2">
                    <h3 className="text-sm font-bold text-muted-foreground uppercase tracking-wider px-1">History</h3>
                    {entries.slice().reverse().map((e, idx) => (
                        <Card key={idx} className="flex justify-between items-center py-3 px-4">
                            <div>
                                <span className="font-mono font-medium">{e.date}</span>
                                <span className="mx-2 text-muted-foreground">•</span>
                                <span className="font-bold">{e.weight}</span>
                            </div>
                            {e.note && <span className="text-sm text-muted-foreground truncate max-w-[200px]">{e.note}</span>}
                        </Card>
                    ))}
                </div>
            )}
        </div>
    );
}