'use client';

import React, { useState } from 'react';
import { X, Check, Ban, Pill, Loader2 } from 'lucide-react';
import { updateDoseStatus, type CalendarDoseRow } from '@/app/(app)/calendar/actions';

type DayDetailModalProps = {
  isOpen: boolean;
  onClose: () => void;
  onUpdateSuccess: () => void; // Callback to refresh grid
  date: Date;
  doses: CalendarDoseRow[];
};

export default function DayDetailModal({ 
  isOpen, 
  onClose, 
  onUpdateSuccess, 
  date, 
  doses 
}: DayDetailModalProps) {
  const [updatingId, setUpdatingId] = useState<number | null>(null);

  if (!isOpen) return null;

  const handleStatusUpdate = async (dose: CalendarDoseRow, newStatus: 'TAKEN' | 'SKIPPED') => {
    setUpdatingId(dose.peptide_id);
    try {
      await updateDoseStatus(dose.date_for, dose.peptide_id, newStatus, dose.dose_mg);
      onUpdateSuccess(); // Refresh the parent
    } catch (e) {
      alert("Failed to update status");
    } finally {
      setUpdatingId(null);
    }
  };

  const dateStr = date.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white dark:bg-slate-900 w-full max-w-md rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
        
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-100 dark:border-slate-800">
          <div>
            <h2 className="text-lg font-bold">Daily Log</h2>
            <p className="text-sm text-slate-500">{dateStr}</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors">
            <X size={20} />
          </button>
        </div>

        {/* Dose List */}
        <div className="p-4 space-y-3 max-h-[60vh] overflow-y-auto">
          {doses.length === 0 ? (
            <div className="text-center py-8 text-slate-500">
              No doses scheduled for this day.
            </div>
          ) : (
            doses.map((dose) => (
              <div key={`${dose.peptide_id}_${dose.time_of_day}`} className="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-slate-900/50 border border-slate-100 dark:border-slate-800">
                
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-lg ${
                    dose.status === 'TAKEN' ? 'bg-emerald-100 text-emerald-600' :
                    dose.status === 'SKIPPED' ? 'bg-red-100 text-red-500' :
                    'bg-blue-100 text-blue-600'
                  }`}>
                    <Pill size={20} />
                  </div>
                  <div>
                    <div className="font-semibold text-sm">{dose.canonical_name}</div>
                    <div className="text-xs text-slate-500">
                      {dose.dose_mg}mg • {dose.time_of_day || 'Any time'}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {updatingId === dose.peptide_id ? (
                    <Loader2 className="animate-spin text-slate-400" size={18} />
                  ) : dose.status === 'PENDING' ? (
                    <>
                      <button 
                        onClick={() => handleStatusUpdate(dose, 'SKIPPED')}
                        className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                        title="Skip Dose"
                      >
                        <Ban size={18} />
                      </button>
                      <button 
                        onClick={() => handleStatusUpdate(dose, 'TAKEN')}
                        className="p-2 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors"
                        title="Mark Taken"
                      >
                        <Check size={18} />
                      </button>
                    </>
                  ) : (
                    // Allow un-doing status (optional, but useful)
                    <div className="flex items-center gap-2">
                      <span className={`text-[10px] font-bold px-2 py-1 rounded-md uppercase ${
                        dose.status === 'TAKEN' ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'
                      }`}>
                        {dose.status}
                      </span>
                    </div>
                  )}
                </div>

              </div>
            ))
          )}
        </div>

      </div>
    </div>
  );
}