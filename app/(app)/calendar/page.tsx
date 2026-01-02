"use client";

import React from 'react';
import { useEffect, useMemo, useState } from 'react';
import { getDosesForRange, type CalendarDoseRow } from './actions';
import DayDetailModal from '@/components/calendar/DayDetailModal';

// Helpers (client-side, uses user local system time)
function isoDate(d: Date) {
    const t = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
    return t.toISOString().split('T')[0];
}
function startOfMonth(d: Date) {
    return new Date(d.getFullYear(), d.getMonth(), 1);
}
function addDays(d: Date, n: number) {
    const x = new Date(d);
    x.setDate(x.getDate() + n);
    return x;
}
function startOfCalendarGrid(d: Date) {
    const first = startOfMonth(d);
    const dow = first.getDay(); // 0=Sun
    return addDays(first, -dow);
}
function endOfCalendarGrid(d: Date) {
    const start = startOfCalendarGrid(d);
    return addDays(start, 41);
}

type DosesByDay = Record<string, CalendarDoseRow[]>;

export default function CalendarPage() {
    const [cursor, setCursor] = useState<Date>(new Date());
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<Error | null>(null);
    const [byDay, setByDay] = useState<DosesByDay>({});

    // --- NEW STATE FOR MODAL ---
    const [selectedDate, setSelectedDate] = useState<Date | null>(null);
    const [refreshKey, setRefreshKey] = useState(0); // Used to trigger re-fetch

    const gridStart = useMemo(() => startOfCalendarGrid(cursor), [cursor]);
    const gridEnd = useMemo(() => endOfCalendarGrid(cursor), [cursor]);

    const [exportStart, setExportStart] = useState(isoDate(gridStart));
    const [exportEnd, setExportEnd] = useState(isoDate(gridEnd));

    useEffect(() => {
        setExportStart(isoDate(gridStart));
        setExportEnd(isoDate(gridEnd));
    }, [gridStart, gridEnd]);

    function downloadIcs(e: React.FormEvent) {
        e.preventDefault();
        const url = `/api/calendar/export?start=${exportStart}&end=${exportEnd}`;
        window.location.assign(url);
    }

    const monthLabel = useMemo(
        () =>
            cursor.toLocaleDateString(undefined, {
                month: 'long',
                year: 'numeric',
            }),
        [cursor]
    );

    useEffect(() => {
        (async () => {
            setLoading(true);
            setError(null);
            try {
                const rows = await getDosesForRange(isoDate(gridStart), isoDate(gridEnd));
                const map: DosesByDay = {};
                for (const r of rows) {
                    if (!map[r.date_for]) map[r.date_for] = [];
                    map[r.date_for].push(r);
                }
                Object.values(map).forEach((day) =>
                    day.sort((a, b) => {
                        const ta = a.time_of_day ?? '99:99';
                        const tb = b.time_of_day ?? '99:99';
                        if (ta === tb) {
                            return a.canonical_name.localeCompare(b.canonical_name);
                        }
                        return ta < tb ? -1 : 1;
                    })
                );
                setByDay(map);
            } catch (e) {
                console.error('Failed to load doses', e);
                setError(e instanceof Error ? e : new Error(String(e)));
            } finally {
                setLoading(false);
            }
        })();
    }, [gridStart, gridEnd, refreshKey]); // Added refreshKey here

    const days: Date[] = useMemo(() => {
        const arr: Date[] = [];
        for (let i = 0; i < 42; i++) arr.push(addDays(gridStart, i));
        return arr;
    }, [gridStart]);

    function prevMonth() { setCursor(new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1)); }
    function nextMonth() { setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1)); }
    function thisMonth() { const now = new Date(); setCursor(new Date(now.getFullYear(), now.getMonth(), 1)); }

    const todayIso = isoDate(new Date());
    const currentMonth = cursor.getMonth();

    // --- HELPER FOR CLICK ---
    const handleDayClick = (d: Date) => {
        setSelectedDate(d);
    };

    return (
        <div className="max-w-6xl mx-auto p-4 space-y-4">
             {/* --- MODAL --- */}
             {selectedDate && (
                <DayDetailModal 
                    isOpen={!!selectedDate}
                    onClose={() => setSelectedDate(null)}
                    date={selectedDate}
                    doses={byDay[isoDate(selectedDate)] || []}
                    onUpdateSuccess={() => {
                        // Keep modal open? Usually better UX to just refresh data
                        setRefreshKey(k => k + 1);
                    }}
                />
            )}

            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <h1 className="text-2xl font-semibold">Calendar</h1>

                {/* Date Picker & Export Row */}
                <form onSubmit={downloadIcs} className="flex flex-wrap items-center gap-3">
                    <div className="flex items-center gap-2 bg-card border border-border rounded-lg p-1 shadow-sm">
                        <input
                            type="date"
                            value={exportStart}
                            onChange={(e) => setExportStart(e.target.value)}
                            className="bg-transparent border-none text-foreground focus:ring-0 text-xs sm:text-sm h-8 px-2 [color-scheme:light] dark:[color-scheme:dark]"
                        />
                        <span className="text-muted-foreground">-</span>
                        <input
                            type="date"
                            value={exportEnd}
                            onChange={(e) => setExportEnd(e.target.value)}
                            className="bg-transparent border-none text-foreground focus:ring-0 text-xs sm:text-sm h-8 px-2 [color-scheme:light] dark:[color-scheme:dark]"
                        />
                    </div>
                    <button type="submit" className="btn h-10 text-xs px-3">
                        Export ICS
                    </button>
                </form>
            </div>

            <div className="flex items-center justify-between mb-1">
                <div className="text-lg font-medium">{monthLabel}</div>
                <div className="flex gap-2">
                    <button onClick={prevMonth} className="rounded-lg border px-3 py-1 text-sm hover:bg-accent">←</button>
                    <button onClick={thisMonth} className="rounded-lg border px-3 py-1 text-sm hover:bg-accent">Today</button>
                    <button onClick={nextMonth} className="rounded-lg border px-3 py-1 text-sm hover:bg-accent">→</button>
                </div>
            </div>

            <div className="grid grid-cols-7 text-[11px] font-medium text-muted-foreground mb-1">
                {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => (
                    <div key={d} className="px-2 py-1 text-center md:text-left">
                        {d}
                    </div>
                ))}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-7 gap-2 auto-rows-fr">
                {days.map((d) => {
                    const dIso = isoDate(d);
                    const inMonth = d.getMonth() === currentMonth;
                    const isToday = dIso === todayIso;
                    const dayDoses = byDay[dIso] ?? [];
                    const counts = new Map<string, number>();
                    dayDoses.forEach((dr) => {
                        const t = dr.time_of_day ?? '';
                        counts.set(t, (counts.get(t) ?? 0) + 1);
                    });

                    return (
                        <div
                            key={dIso}
                            onClick={() => handleDayClick(d)}
                            className={`min-h-[120px] rounded-xl border p-2 bg-card relative transition-all cursor-pointer hover:border-primary/50
                ${inMonth ? 'opacity-100' : 'opacity-40'}
                ${isToday ? 'ring-2 ring-primary border-primary' : 'border-border'}
              `}
                        >
                            <div className={`text-xs font-semibold mb-2 ${isToday ? 'text-primary' : ''}`}>{d.getDate()}</div>

                            <div className="flex flex-col gap-1.5">
                                {dayDoses.map((r, idx) => (
                                    <DoseBlock
                                        key={`${r.peptide_id}-${r.time_of_day ?? ''}-${idx}`}
                                        r={r}
                                        duplicate={!!r.time_of_day && (counts.get(r.time_of_day) ?? 0) > 1}
                                    />
                                ))}
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

function DoseBlock({ r, duplicate }: { r: CalendarDoseRow; duplicate?: boolean }) {
    const statusColors = {
        TAKEN: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/20',
        SKIPPED: 'bg-red-500/15 text-red-600 dark:text-red-400 border-red-500/20',
        PENDING: 'bg-blue-500/15 text-blue-600 dark:text-blue-400 border-blue-500/20',
    };
    const style = statusColors[r.status] || statusColors.PENDING;

    return (
        <div className={`rounded-md border px-1.5 py-1 text-[10px] leading-tight font-medium truncate ${style}`}>
            {r.canonical_name}
        </div>
    );
}