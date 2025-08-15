'use client';
import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { startOfMonth, endOfMonth, startOfWeek, endOfWeek, addDays, addMonths, isSameMonth, isSameDay, format } from 'date-fns';
import clsx from 'clsx';

type Protocol = { id: number; created_at: string };
type Item = {
  id: number; peptide_id: number; dose_mg_per_administration: number;
  schedule: 'EVERYDAY'|'WEEKDAYS'|'CUSTOM'; custom_days: number[]|null;
  cycle_on_weeks: number; cycle_off_weeks: number;
};
type InvRow = { peptide_id: number; peptides: { canonical_name: string } };
type DoseRow = { peptide_id: number; date: string; status: 'PENDING'|'LOGGED'|'SKIPPED' };

export default function CalendarPage() {
  const [proto, setProto] = useState<Protocol | null>(null);
  const [items, setItems] = useState<Item[]>([]);
  const [inv, setInv] = useState<Record<number, InvRow>>({});
  const [doses, setDoses] = useState<Record<string, Record<number, 'LOGGED'|'SKIPPED'>>>({}); // date -> peptide_id -> status
  const [cursor, setCursor] = useState(new Date());
  const today = new Date();

  useEffect(() => {
    (async () => {
      const { data: p } = await supabase.from('protocols')
        .select('id, created_at').eq('is_active', true).maybeSingle();
      if (!p) return;
      setProto(p as any);

      const { data: it } = await supabase.from('protocol_items')
        .select('id, peptide_id, dose_mg_per_administration, schedule, custom_days, cycle_on_weeks, cycle_off_weeks')
        .eq('protocol_id', p.id).order('id');
      setItems(it ?? []);

      const { data: invRows } = await supabase.from('inventory_items')
        .select('peptide_id, peptides!inner(canonical_name)');
      const invMap: any = {};
      (invRows ?? []).forEach((r: any) => invMap[r.peptide_id] = r);
      setInv(invMap);

      // load doses for month
      const start = startOfWeek(startOfMonth(cursor), { weekStartsOn: 0 });
      const end = endOfWeek(endOfMonth(cursor), { weekStartsOn: 0 });
      const { data: d } = await supabase.from('doses')
        .select('peptide_id, date, status')
        .gte('date', start.toISOString().slice(0,10))
        .lte('date', end.toISOString().slice(0,10));
      const map: any = {};
      (d ?? []).forEach((row: any) => {
        map[row.date] = map[row.date] || {};
        if (row.status !== 'PENDING') map[row.date][row.peptide_id] = row.status;
      });
      setDoses(map);
    })();
  }, [cursor]);

  const isDue = (item: Item, day: Date) => {
    const dow = day.getDay();
    if (item.schedule === 'EVERYDAY') return true;
    if (item.schedule === 'WEEKDAYS') return dow >= 1 && dow <= 5;
    if (item.schedule === 'CUSTOM') return (item.custom_days ?? []).includes(dow);
    return false;
  };

  const onCycle = (item: Item, day: Date) => {
    if (!proto) return true;
    if (!item.cycle_on_weeks) return true;
    const on = item.cycle_on_weeks;
    const off = item.cycle_off_weeks || 0;
    if (off === 0) return true;
    const created = new Date(proto.created_at);
    const diffWeeks = Math.floor((day.getTime() - created.getTime()) / (7*24*3600*1000));
    const period = on + off;
    return (diffWeeks % period) < on;
  };

  const monthStart = startOfWeek(startOfMonth(cursor), { weekStartsOn: 0 });
  const monthEnd = endOfWeek(endOfMonth(cursor), { weekStartsOn: 0 });
  const days: Date[] = [];
  for (let d = monthStart; d <= monthEnd; d = addDays(d, 1)) days.push(d);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <button onClick={()=>setCursor(addMonths(cursor,-1))} className="px-2 py-1 rounded border border-neutral-300 dark:border-neutral-700 text-sm">Prev</button>
        <div className="text-lg font-semibold">{format(cursor, 'MMMM yyyy')}</div>
        <div className="space-x-2">
          <button onClick={()=>setCursor(new Date())} className="px-2 py-1 rounded border border-neutral-300 dark:border-neutral-700 text-sm">Today</button>
          <button onClick={()=>setCursor(addMonths(cursor,1))} className="px-2 py-1 rounded border border-neutral-300 dark:border-neutral-700 text-sm">Next</button>
        </div>
      </div>

      <div className="grid grid-cols-7 text-xs text-neutral-500">
        {['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map(d => <div key={d} className="p-2">{d}</div>)}
      </div>

      <div className="grid grid-cols-7 gap-px bg-neutral-200 dark:bg-neutral-800 rounded overflow-hidden">
        {days.map((day, idx) => {
          const due = items.filter(i => isDue(i, day) && onCycle(i, day));
          const key = day.toISOString().slice(0,10);
          const statuses = doses[key] || {};
          const isToday = isSameDay(day, today);
          const inMonth = isSameMonth(day, cursor);
          return (
            <div key={idx} className={clsx("min-h-[90px] bg-white dark:bg-neutral-900 p-2",
              !inMonth && "opacity-50", isToday && "ring-2 ring-blue-500")}>
              <div className="text-xs mb-1">{format(day,'d')}</div>
              <div className="space-y-1">
                {due.map(i => {
                  const name = inv[i.peptide_id]?.peptides?.canonical_name ?? `P#${i.peptide_id}`;
                  const s = statuses[i.peptide_id];
                  return (
                    <div key={i.id} className="flex items-center justify-between text-[11px] border border-neutral-200 dark:border-neutral-800 rounded px-1">
                      <span className="truncate">{name} {i.dose_mg_per_administration}mg</span>
                      {s === 'LOGGED' && <span className="text-green-600">✓</span>}
                      {s === 'SKIPPED' && <span className="text-red-600">✕</span>}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
