// app/(app)/today/page.tsx
'use client';

import { useEffect, useMemo, useState, useCallback } from 'react';
import {
  getTodayDosesWithUnits,
  logDose,
  resetDose,
  skipDose,
  type TodayDoseRow,
} from './actions';

function fmt(n: number | null | undefined, digits = 2) {
  if (n == null || isNaN(Number(n))) return '—';
  return Number(n).toFixed(digits);
}

/** Local system YYYY-MM-DD (uses the user's OS/browser timezone) */
function localISODate(): string {
  return new Date().toLocaleDateString('en-CA');
}

// Extend at the usage site so we can render optional inventory forecast fields
type TodayDoseRowExtended = TodayDoseRow & {
  remainingDoses?: number | null;
  reorderDateISO?: string | null;
};

export default function TodayPage() {
  const [rows, setRows] = useState<TodayDoseRowExtended[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<number | null>(null);

  const today = useMemo(localISODate, []); // freeze to page-load day

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getTodayDosesWithUnits(today);
      // If your server action doesn't yet include remainingDoses/reorderDateISO,
      // this still works (falls back to "—" in the UI).
      setRows(data as TodayDoseRowExtended[]);
    } finally {
      setLoading(false);
    }
  }, [today]);

  useEffect(() => {
    load();
  }, [load]);

  async function mutateStatus(
    peptide_id: number,
    act: (id: number, d: string) => Promise<any>
  ) {
    setBusyId(peptide_id);
    try {
      await act(peptide_id, today); // pass local date to the server action
      // optimistic update: flip status in-place without refetch
      setRows((prev) =>
        (prev ?? []).map((r) =>
          r.peptide_id === peptide_id
            ? {
                ...r,
                status:
                  act === logDose ? 'TAKEN' : act === skipDose ? 'SKIPPED' : 'PENDING',
              }
            : r
        )
      );
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="max-w-3xl mx-auto p-4 space-y-6">
      <h1 className="text-2xl font-semibold">Today</h1>

      {loading && <div>Loading…</div>}
      {!loading && (rows?.length ?? 0) === 0 && (
        <div className="text-sm text-muted-foreground">No doses scheduled for today.</div>
      )}

      {!loading && rows && rows.length > 0 && (
        <div className="space-y-3">
          {rows.map((r) => {
            const needsSetup =
              !r.mg_per_vial || r.mg_per_vial <= 0 || !r.bac_ml || r.bac_ml <= 0;

            return (
              <div key={r.peptide_id} className="rounded-xl border p-4 bg-card shadow-sm space-y-3 relative">
                {/* top-right status badge */}
                <div className="absolute right-3 top-3">
                  <StatusBadge status={r.status} />
                </div>

                <div className="flex items-center justify-between pr-24">
                  <div className="min-w-0">
                    <div className="text-lg font-medium truncate">{r.canonical_name}</div>

                    {/* Bold numbers for dose and syringe */}
                    <div className="text-xs text-muted-foreground">
                      Dose:{' '}
                      <span className="font-mono font-bold">{fmt(r.dose_mg)}</span>{' '}
                      mg{'  '}•{'  '}
                      Syringe:{' '}
                      <span className="font-mono font-bold">
                        {fmt(r.syringe_units, 2)}
                      </span>{' '}
                      units
                    </div>
                  </div>
                </div>

                {/* Inventory mix line */}
                <div className="text-xs text-muted-foreground">
                  Inventory mix: {fmt(r.mg_per_vial)} mg/vial • {fmt(r.bac_ml)} mL BAC
                </div>
                {needsSetup && (
                  <div className="text-xs text-amber-600">Set mg/vial &amp; BAC in Inventory</div>
                )}

                {/* NEW: Forecast pills if available (falls back to —) */}
                <div className="flex gap-2 text-xs" aria-live="polite">
                  <span className="inline-flex items-center rounded-full border px-2 py-0.5">
                    Remaining doses:{' '}
                    <span className="ml-1 font-semibold">
                      {r.remainingDoses ?? '—'}
                    </span>
                  </span>
                  <span className="inline-flex items-center rounded-full border px-2 py-0.5">
                    Est. reorder:{' '}
                    <span className="ml-1 font-semibold">
                      {r.reorderDateISO ?? '—'}
                    </span>
                  </span>
                </div>

                <div className="pt-1 flex flex-wrap gap-2">
                  <button
                    disabled={busyId === r.peptide_id}
                    onClick={() => mutateStatus(r.peptide_id, logDose)}
                    className={`rounded-lg border px-3 py-2 text-sm
                      ${r.status === 'TAKEN' ? 'bg-green-600 text-white border-green-700' : 'hover:bg-accent'}`}
                  >
                    Log
                  </button>

                  <button
                    disabled={busyId === r.peptide_id}
                    onClick={() => mutateStatus(r.peptide_id, skipDose)}
                    className={`rounded-lg border px-3 py-2 text-sm
                      ${r.status === 'SKIPPED' ? 'bg-red-600 text-white border-red-700' : 'hover:bg-accent'}`}
                  >
                    Skip
                  </button>

                  <button
                    disabled={busyId === r.peptide_id}
                    onClick={() => mutateStatus(r.peptide_id, resetDose)}
                    className="rounded-lg border px-3 py-2 text-sm hover:bg-accent"
                  >
                    Reset
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: TodayDoseRow['status'] }) {
  const base = 'text-xs px-2 py-1 rounded-full border';
  if (status === 'TAKEN') return <span className={`${base} border-green-600 text-green-700`}>Taken</span>;
  if (status === 'SKIPPED') return <span className={`${base} border-red-600 text-red-700`}>Skipped</span>;
  return <span className={`${base} border-slate-400 text-slate-600`}>Pending</span>;
}
