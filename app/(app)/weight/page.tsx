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
        borderColor: "rgb(53, 162, 235)",
        backgroundColor: "rgba(53, 162, 235, 0.5)",
      },
    ],
  };

  return (
    <div className="space-y-4">
      <Card>
        <form onSubmit={addEntry} className="flex flex-col gap-2 sm:flex-row sm:items-end">
          <label className="flex flex-col">
            <span className="text-sm">Weight</span>
            <input
              type="number"
              step="0.1"
              value={weight}
              onChange={(e) => setWeight(e.target.value)}
              className="input"
              required
            />
          </label>
          <label className="flex flex-col flex-1">
            <span className="text-sm">Note</span>
            <input
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="input"
            />
          </label>
          <button type="submit" className="btn">
            Add
          </button>
        </form>
      </Card>

      {entries.length > 0 && (
        <Card>
          <Line
            data={data}
            options={{
              responsive: true,
              plugins: { legend: { display: false } },
            }}
          />
        </Card>
      )}

      {entries.length > 0 && (
        <Card>
          <ul className="space-y-2">
            {entries.map((e, idx) => (
              <li key={idx} className="flex justify-between">
                <span>
                  {e.date}: {e.weight}
                </span>
                {e.note && <span className="text-muted">{e.note}</span>}
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
