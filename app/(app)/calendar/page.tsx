"use client";

import React, { useEffect, useMemo, useState } from 'react';
import { getDosesForRange, type CalendarDoseRow } from './actions';
import DayDetailModal from '@/components/calendar/DayDetailModal';

function isoDate(d: Date) {
    const t = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
    return t.toISOString().split('T')[0];
}
function startOfMonth(d: Date) { return new Date(d.getFullYear(), d.getMonth(), 1); }
function addDays(d: Date, n: number) { const x = new Date(d); x.setDate(x.getDate() + n); return x; }
function startOfCalendarGrid(d: Date) { const f = startOfMonth(d); return addDays(f, -f.getDay()); }
function endOfCalendarGrid(d: Date) { return addDays(startOfCalendarGrid(d), 41); }

type DosesByDay = Record<string, CalendarDoseRow[]>;

export default function CalendarPage() {
    const [cursor, setCursor] = useState<Date>(new Date());
    const [loading, setLoading] = useState(false);
    const [byDay, setByDay] = useState<DosesByDay>({});

    const [selectedDate, setSelectedDate] = useState<Date | null>(null);
    const [refreshKey, setRefreshKey] = useState(0);

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

    const monthLabel = useMemo(() => cursor.toLocaleDateString(undefined, { month: 'long', year: 'numeric' }), [cursor]);

    useEffect(() => {
        (async () => {
            setLoading(true);
            try {
                const rows = await getDosesForRange(isoDate(gridStart), isoDate(gridEnd));
                const map: DosesByDay = {};
                for (const r of rows) {
                    if (!map[r.date_for]) map[r.date_for] = [];
                    map[r.date_for].push(r);
                }
                setByDay(map);
            } catch (e) {
                console.error(e);
            } finally {
                setLoading(false);
            }
        })();
    }, [gridStart, gridEnd, refreshKey]);

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

    return (
        <div className="max-w-6xl mx-auto p-4 space-y-4">
             {selectedDate && (
                <DayDetailModal 
                    date={isoDate(selectedDate)}
                    doses={byDay[isoDate(selectedDate)] || []}
                    onClose={() => setSelectedDate(null)}
                    onUpdate={() => setRefreshKey(k => k + 1)}
                />
            )}

            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <h1 className="text-2xl font-semibold">Calendar</h1>
                <form onSubmit={downloadIcs} className="flex flex-wrap items-center gap-3">
                    <button type="submit" className="btn h-10 text-xs px-3">Export ICS</button>
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
                    <div key={d} className="px-2 py-1 text-center md:text-left">{d}</div>
                ))}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-7 gap-2 auto-rows-fr">
                {days.map((d) => {
                    const dIso = isoDate(d);
                    const inMonth = d.getMonth() === currentMonth;
                    const isToday = dIso === todayIso;
                    const dayDoses = byDay[dIso] ?? [];

                    return (
                        <div
                            key={dIso}
                            onClick={() => setSelectedDate(d)}
                            className={`min-h-[80px] sm:min-h-[120px] rounded-xl border p-2 bg-card relative transition-all cursor-pointer hover:border-primary/50
                                ${inMonth ? 'opacity-100' : 'opacity-40'}
                                ${isToday ? 'ring-2 ring-primary border-primary' : 'border-border'}
                            `}
                        >
                            <div className={`text-xs font-semibold mb-2 ${isToday ? 'text-primary' : ''}`}>{d.getDate()}</div>
                            <div className="flex flex-col gap-1.5">
                                {dayDoses.map((r, idx) => (
                                    <div key={idx} className={`rounded-md border px-1.5 py-1 text-[10px] font-medium truncate 
                                        ${r.status === 'TAKEN' ? 'bg-emerald-500/15 text-emerald-600 border-emerald-500/20' : 'bg-blue-500/15 text-blue-600 border-blue-500/20'}`}>
                                        {r.canonical_name}
                                    </div>
                                ))}
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
