// @ts-nocheck
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { generateDoses } from './scheduler';

describe('generateDoses', () => {
  it('handles EVERYDAY schedule', () => {
    const items = [
      {
        peptide_id: 1,
        canonical_name: 'A',
        dose_mg_per_administration: 1,
        schedule: 'EVERYDAY',
        custom_days: null,
        cycle_on_weeks: 0,
        cycle_off_weeks: 0,
      },
    ];
    const rows = generateDoses('2024-01-01', '2024-01-03', '2024-01-01', items);
    assert.deepEqual(
      rows.map((r) => r.date_for),
      ['2024-01-01', '2024-01-02', '2024-01-03']
    );
  });

  it('handles WEEKDAYS schedule', () => {
    const items = [
      {
        peptide_id: 1,
        canonical_name: 'B',
        dose_mg_per_administration: 1,
        schedule: 'WEEKDAYS',
        custom_days: null,
        cycle_on_weeks: 0,
        cycle_off_weeks: 0,
      },
    ];
    const rows = generateDoses('2024-01-01', '2024-01-07', '2024-01-01', items);
    assert.deepEqual(
      rows.map((r) => r.date_for),
      ['2024-01-01', '2024-01-02', '2024-01-03', '2024-01-04', '2024-01-05']
    );
  });

  it('handles CUSTOM schedule', () => {
    const items = [
      {
        peptide_id: 1,
        canonical_name: 'C',
        dose_mg_per_administration: 1,
        schedule: 'CUSTOM',
        custom_days: [1, 3, 5],
        cycle_on_weeks: 0,
        cycle_off_weeks: 0,
      },
    ];
    const rows = generateDoses('2024-01-01', '2024-01-07', '2024-01-01', items);
    assert.deepEqual(
      rows.map((r) => r.date_for),
      ['2024-01-01', '2024-01-03', '2024-01-05']
    );
  });

  it('handles EVERY_N_DAYS schedule', () => {
    const items = [
      {
        peptide_id: 1,
        canonical_name: 'D',
        dose_mg_per_administration: 1,
        schedule: 'EVERY_N_DAYS',
        every_n_days: 2,
        custom_days: null,
        cycle_on_weeks: 0,
        cycle_off_weeks: 0,
      },
    ];
    const rows = generateDoses('2024-01-01', '2024-01-07', '2024-01-01', items);
    assert.deepEqual(
      rows.map((r) => r.date_for),
      ['2024-01-01', '2024-01-03', '2024-01-05', '2024-01-07']
    );
  });

  it('works across DST change', () => {
    const items = [
      {
        peptide_id: 1,
        canonical_name: 'E',
        dose_mg_per_administration: 1,
        schedule: 'EVERYDAY',
        custom_days: null,
        cycle_on_weeks: 0,
        cycle_off_weeks: 0,
      },
    ];
    const prevTZ = process.env.TZ;
    process.env.TZ = 'America/Los_Angeles';
    const rows = generateDoses('2024-03-09', '2024-03-12', '2024-03-01', items);
    process.env.TZ = prevTZ;
    assert.deepEqual(
      rows.map((r) => r.date_for),
      ['2024-03-09', '2024-03-10', '2024-03-11', '2024-03-12']
    );
  });
});