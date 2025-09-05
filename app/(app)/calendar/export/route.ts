import { NextRequest, NextResponse } from 'next/server';
import { createEvents, type EventAttributes, type DateArray } from 'ics';
import { getDosesForRange } from '@/app/(app)/calendar/actions';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const start = searchParams.get('start');
  const end = searchParams.get('end');
  if (!start || !end) {
    return new NextResponse('Missing start or end', { status: 400 });
  }

  const rows = await getDosesForRange(start, end);
  const events: EventAttributes[] = rows.map((r) => {
    const [year, month, day] = r.date_for.split('-').map(Number);
    const [hour, minute] = r.time_of_day
      ? r.time_of_day.split(':').map(Number)
      : [0, 0];
    const start: DateArray = [year, month, day, hour, minute];
    return { start, title: `${r.canonical_name} ${r.dose_mg}mg` };
  });

  const { error, value } = createEvents(events);
  if (error || !value) {
    return new NextResponse('Failed to generate calendar', { status: 500 });
  }

  return new NextResponse(value, {
    status: 200,
    headers: {
      'Content-Type': 'text/calendar',
      'Content-Disposition': `attachment; filename="doses-${start}-to-${end}.ics"`,
    },
  });
}