// @ts-nocheck
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  isDoseDayUTC,
  generateDailyDoses,
  type ProtocolItem,
  type ScheduleItem,
} from './scheduleEngine';

describe('isDoseDayUTC', () => {
  it('handles WEEKDAYS schedule', () => {
    const item: ScheduleItem & { start_date: string } = {
      schedule: 'WEEKDAYS',
      start_date: '2024-01-01',
    };
    const wed = new Date('2024-01-03T00:00:00Z');
    const sun = new Date('2024-01-07T00:00:00Z');
    assert.equal(isDoseDayUTC(wed, item), true);
    assert.equal(isDoseDayUTC(sun, item), false);
  });

  it('handles EVERY_N_DAYS schedule', () => {
    const item: ScheduleItem & { start_date: string } = {
      schedule: 'EVERY_N_DAYS',
      every_n_days: 2,
      start_date: '2024-01-01',
    };
    const yes = new Date('2024-01-05T00:00:00Z');
    const no = new Date('2024-01-06T00:00:00Z');
    assert.equal(isDoseDayUTC(yes, item), true);
    assert.equal(isDoseDayUTC(no, item), false);
  });

  it('handles cycle on/off weeks', () => {
    const item: ScheduleItem & { start_date: string } = {
      schedule: 'EVERYDAY',
      cycle_on_weeks: 1,
      cycle_off_weeks: 1,
      start_date: '2024-01-01',
    };
    const onDay = new Date('2024-01-03T00:00:00Z'); // first week
    const offDay = new Date('2024-01-10T00:00:00Z'); // second week (off)
    assert.equal(isDoseDayUTC(onDay, item), true);
    assert.equal(isDoseDayUTC(offDay, item), false);
  });
});

describe('generateDailyDoses', () => {
  const items: ProtocolItem[] = [
    { peptide_id: 1, canonical_name: 'A', dose_mg_per_administration: 1, schedule: 'EVERYDAY', time_of_day: '08:00' },
    { peptide_id: 2, canonical_name: 'B', dose_mg_per_administration: 1, schedule: 'WEEKDAYS', time_of_day: '09:00' },
    { peptide_id: 3, canonical_name: 'C', dose_mg_per_administration: 1, schedule: 'CUSTOM', custom_days: [1,3,5], time_of_day: '10:00' },
    { peptide_id: 4, canonical_name: 'D', dose_mg_per_administration: 1, schedule: 'EVERY_N_DAYS', every_n_days: 2, time_of_day: '11:00' },
  ];

  it('filters items correctly for a given date', () => {
    const rows = generateDailyDoses('2024-01-05', '2024-01-01', items); // Friday
    assert.deepEqual(rows.map(r => r.peptide_id), [1,2,3,4]);
    assert.deepEqual(rows.map(r => r.time_of_day), ['08:00', '09:00', '10:00', '11:00']);
  });
  });