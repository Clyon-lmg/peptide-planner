"use client";

import { useState } from "react";
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
import { Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowser } from "@/lib/supabaseBrowser"; // Adjust import if needed
import { toast } from "sonner";

ChartJS.register(
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    Title,
    Tooltip,
    Legend
);

type WeightEntry = {
    id: number;
    date: string;
    weight: number;
    note?: string;
};

export default function WeightClient({ initialEntries }: { initialEntries: WeightEntry[] }) {
    const [entries, setEntries] = useState<WeightEntry[]>(initialEntries);
    const [weight, setWeight] = useState("");
    const [note, setNote] = useState("");
    const [loading, setLoading] = useState(false);
    const router = useRouter();
    const supabase = createSupabaseBrowser();

    async function addEntry(e: React.FormEvent) {
        e.preventDefault();
        const w = parseFloat(weight);
        if (Number.isNaN(w)) return;
        
        setLoading(true);
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const dateStr = new Date().toISOString().slice(0, 10);
        
        const { data, error } = await supabase
            .from("weight_logs")
            .insert({
                user_id: user.id,
                weight: w,
                note: note.trim() || null,
                date: dateStr
            })
            .select()
            .single();

        if (error) {
            toast.error("Failed to save weight");
        } else if (data) {
            setEntries([...entries, data]);
            setWeight("");
            setNote("");
            toast.success("Weight logged");
            router.refresh();
        }
        setLoading(false);
    }

    async function deleteEntry(id: number) {
        if (!confirm("Remove this entry?")) return;
        const { error } = await supabase.from("weight_logs").delete().eq("id", id);
        if (error) {
            toast.error("Failed to delete");
        } else {
            setEntries(entries.filter(e => e.id !== id));
            router.refresh();
        }
    }

    // Chart Data
    const sorted = [...entries].sort((a, b) => a.date.localeCompare(b.date));
    const data = {
        labels: sorted.map((e) => e.date),
        datasets: [
            {
                label: "Weight",
                data: sorted.map((e) => e.weight),
                borderColor: "rgb(59, 130, 246)",
                backgroundColor: "rgba(59, 130, 246, 0.5)",
                tension: 0.3,
                pointRadius: 4,
            },
        ],
    };

    return (
        <div className="space-y-6">
            {/* Input Form */}
            <div className="pp-card p-4">
                <form onSubmit={addEntry} className="flex flex-col sm:flex-row gap-4 items-end">
                    <label className="flex flex-col gap-1.5 w-full sm:w-32">
                        <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Weight</span>
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

                    <label className="flex flex-col gap-1.5 flex-1 w-full">
                        <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Note</span>
                        <input
                            type="text"
                            value={note}
                            onChange={(e) => setNote(e.target.value)}
                            className="input w-full"
                            placeholder="Optional note..."
                            maxLength={200}
                        />
                    </label>

                    <button type="submit" disabled={loading} className="btn bg-primary text-primary-foreground hover:bg-primary/90 w-full sm:w-auto">
                        {loading ? "..." : "Log Entry"}
                    </button>
                </form>
            </div>

            {/* Chart */}
            {entries.length > 0 && (
                <div className="pp-card p-4">
                    <div className="h-[300px] w-full">
                        <Line
                            data={data}
                            options={{
                                responsive: true,
                                maintainAspectRatio: false,
                                plugins: { legend: { display: false } },
                                scales: {
                                    x: { grid: { display: false }, ticks: { maxTicksLimit: 8 } },
                                    y: { grid: { color: 'rgba(0,0,0,0.05)' } }
                                }
                            }}
                        />
                    </div>
                </div>
            )}

            {/* History List */}
            {entries.length > 0 && (
                <div className="space-y-2">
                    <h3 className="text-sm font-bold text-muted-foreground uppercase tracking-wider px-1">History</h3>
                    <div className="space-y-2 max-h-60 overflow-y-auto">
                        {sorted.slice().reverse().map((e) => (
                            <div key={e.id} className="pp-card flex justify-between items-center py-3 px-4 group">
                                <div>
                                    <span className="font-mono text-sm font-medium text-muted-foreground">{e.date}</span>
                                    <span className="mx-3 font-bold text-lg">{e.weight}</span>
                                    {e.note && <span className="text-sm text-muted-foreground border-l pl-3 ml-1">{e.note}</span>}
                                </div>
                                <button 
                                    onClick={() => deleteEntry(e.id)}
                                    className="text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity p-2"
                                >
                                    <Trash2 className="size-4" />
                                </button>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}
