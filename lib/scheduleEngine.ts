+33
-1

export function isDoseDay(d: Date, item: any) {
  const dow = d.getDay();
  if (item.schedule === 'EVERYDAY') return true;
  if (item.schedule === 'WEEKDAYS') return dow >= 1 && dow <= 5;
  if (item.schedule === 'CUSTOM') {
    const s = new Set(item.custom_days || []);
    return s.has(dow);
  }
  if (item.schedule === 'EVERY_N_DAYS') {
    const start = item.protocol_start_date
      ? new Date(item.protocol_start_date)
      : item.start_date
      ? new Date(item.start_date)
      : new Date();
    const diff = Math.floor((d.getTime() - start.getTime()) / 86400000);
    const n = Number(item.every_n_days || 0);
    return n > 0 && diff % n === 0;
  }
  return false;
}

export function monthGrid(cur: Date) {
  const first = new Date(cur.getFullYear(), cur.getMonth(), 1);
  const start = new Date(first);
  start.setDate(first.getDate() - first.getDay());
  const days: Date[] = [];
  for (let i = 0; i < 42; i++) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    days.push(d);
  }
  return days;
}