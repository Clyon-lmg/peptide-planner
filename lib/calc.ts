// lib/calc.ts

// mg per ml based on mg per vial and BAC ml
export function concentrationMgPerMl(mgPerVial?: number | null, bacMl?: number | null) {
    const mg = Number(mgPerVial ?? 0);
    const ml = Number(bacMl ?? 0);
    if (mg <= 0 || ml <= 0) return null;
    return mg / ml;
}

// syringe "units" for a given dose (U-100 scale)
export function unitsForDose(doseMg: number, mgPerMl: number) {
    if (doseMg <= 0 || mgPerMl <= 0) return null;
    const ml = doseMg / mgPerMl;
    return Math.round(ml * 100); // insulin units
}

// number of remaining doses from total mg available
export function remainingDoses(totalMg: number, doseMg: number) {
    if (totalMg <= 0 || doseMg <= 0) return null;
    return Math.floor(totalMg / doseMg);
}

// frequency per week given schedule type
export function freqPerWeek(
    schedule: 'EVERYDAY' | 'WEEKDAYS' | 'CUSTOM',
    customDays?: number[] | null
) {
    if (schedule === 'EVERYDAY') return 7;
    if (schedule === 'WEEKDAYS') return 5;
    const set = new Set(customDays ?? []);
    return Math.max(0, Math.min(7, set.size));
}

// projected run-out date based on remaining doses & doses/week
export function projectedRunoutDate(remaining: number, dosesPerWeek: number) {
    if (remaining <= 0 || dosesPerWeek <= 0) return null;
    const weeks = remaining / dosesPerWeek;
    const days = Math.ceil(weeks * 7);
    const dt = new Date();
    dt.setDate(dt.getDate() + days);
    return dt.toISOString().split('T')[0];
}
