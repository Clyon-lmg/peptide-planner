'use client';

import React from 'react';
import { useEffect, useMemo, useState } from 'react';
import { getDosesForRange, type CalendarDoseRow } from './actions';

// Helpers (client-side, uses user local system time)
function isoDate(d: Date) {
  // Use timezone-offset trick to produce YYYY-MM-DD in local tz
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
  // Sunday as first day: back up to Sunday of the week containing the 1st
  const first = startOfMonth(d);
  const dow = first.getDay(); // 0=Sun
  return addDays(first, -dow);
}
function endOfCalendarGrid(d: Date) {
  // 6 rows x 7 cols = 42 days for stable layout
  const start = startOfCalendarGrid(d);
  return addDays(start, 41);
}

type DosesByDay = Record<string, CalendarDoseRow[]>;

export default function CalendarPage() {
  const [cursor, setCursor] = useState<Date>(new Date());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [byDay, setByDay] = useState<DosesByDay>({});

  const gridStart = useMemo(() => startOfCalendarGrid(cursor), [cursor]);
  const gridEnd = useMemo(() => endOfCalendarGrid(cursor), [cursor]);

  const monthLabel = useMemo(
    () =>
      cursor.toLocaleDateString(undefined, {
        month: 'long',
        year: 'numeric',
      }),
    [cursor]
  );

  // Load all doses for the 6-week grid
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
        setByDay(map);
      } catch (e) {
        console.error('Failed to load doses', e);
        setError(e instanceof Error ? e : new Error(String(e)));
      } finally {
        setLoading(false);
      }
    })();
  }, [gridStart, gridEnd]);

  // Build a stable 6x7 grid of dates
  const days: Date[] = useMemo(() => {
    const arr: Date[] = [];
    for (let i = 0; i < 42; i++) arr.push(addDays(gridStart, i));
    return arr;
  }, [gridStart]);

  // Month navigation
  function prevMonth() {
      setCursor(new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1));
  }
  function nextMonth() {
      setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1));
  }
  function thisMonth() {
      const now = new Date();
      setCursor(new Date(now.getFullYear(), now.getMonth(), 1));
  }

  const todayIso = isoDate(new Date());
  const currentMonth = cursor.getMonth();

  return (
    <div className="max-w-6xl mx-auto p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Calendar</h1>
        <div className="flex gap-2">
          <button onClick={prevMonth} className="rounded-lg border px-3 py-2 text-sm hover:bg-accent">← Prev</button>
          <button onClick={thisMonth} className="rounded-lg border px-3 py-2 text-sm hover:bg-accent">Today</button>
          <button onClick={nextMonth} className="rounded-lg border px-3 py-2 text-sm hover:bg-accent">Next →</button>
        </div>
      </div>

      <div className="flex items-center justify_between mb-1">
        <div className="text-lg font-medium">{monthLabel}</div>
        {loading ? (
          <div className="text-sm text-muted-foreground">Loading…</div>
        ) : error ? (
          <div className="text-sm text-red-600">Unable to load doses.</div>
        ) : null}
      </div>

      {/* Weekday headers (Sun..Sat) */}
      <div className="flex md:grid md:grid-cols-7 text-[11px] font-medium text-muted-foreground mb-1">
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => (
          <div key={d} className="px-2 py-1 flex-1 text-center md:text-left">
            {d}
          </div>
        ))}
      </div>

      {/* Month grid, 6 rows x 7 cols */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-7 gap-2">
        {days.map((d) => {
          const dIso = isoDate(d);
          const inMonth = d.getMonth() === currentMonth;
          const isToday = dIso === todayIso;
          const dayDoses = byDay[dIso] ?? [];

          return (
            <div
              key={dIso}
              className={`min-h-[160px] rounded-xl border p-2 bg-card relative
                ${inMonth ? '' : 'opacity-60'}
                ${isToday ? 'ring-2 ring-blue-500' : ''}`}
            >
              {/* Date number top-left */}
              <div className="text-xs font-semibold">{d.getDate()}</div>

              {/* Doses list (READ-ONLY; color = status) */}
              <div className="mt-2 flex flex-col gap-2">
                {dayDoses.length === 0 ? (
                  <div className="text-[12px] text-muted-foreground">No doses</div>
                ) : (
                  dayDoses.map((r) => <DoseBlock key={r.peptide_id} r={r} />)
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Legend */}
      <div className="text-xs text-muted-foreground mt-2 flex gap-4">
        <Legend className="border-l-4 border-green-600" label="Taken" />
        <Legend className="border-l-4 border-red-600" label="Skipped" />
        <Legend className="border-l-4 border-blue-600" label="Pending" />
      </div>
    </div>
  );
}

function Legend({ className, label }: { className: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-2">
      <span className={`inline-block h-3 ${className}`} />
      {label}
    </span>
  );
}

/** Read-only block with status color (no actions) */
function DoseBlock({ r }: { r: CalendarDoseRow }) {
  const border =
    r.status === 'TAKEN'
      ? 'border-green-600'
      : r.status === 'SKIPPED'
      ? 'border-red-600'
      : 'border-blue-600';

  const bg =
    r.status === 'TAKEN'
      ? 'bg-green-50 dark:bg-white/5'
      : r.status === 'SKIPPED'
      ? 'bg-red-50 dark:bg-white/5'
      : 'bg-blue-50 dark:bg-white/5';

  const text =
    r.status === 'TAKEN'
      ? 'text-green-800'
      : r.status === 'SKIPPED'
      ? 'text-red-800'
      : 'text-blue-800';

  return (
    <div className={`rounded-lg border ${border} border-l-4 ${bg} ${text} p-2`}>
      <div className="text-[13px] font-medium leading-5 break-words whitespace-normal">
        {r.canonical_name}
      </div>
      <div className="text-[12px] opacity-80">{r.dose_mg} mg</div>
    </div>
  );
}
