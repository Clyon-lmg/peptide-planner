// app/(app)/calendar/actions.test.ts
// Tests for getDosesForRange using mocked Supabase responses.

import assert from 'node:assert/strict';
import { describe, it, beforeEach } from 'node:test';
import { getDosesForRange } from './actions';

function createSupabaseMock({
  user = null,
  protocol = null,
  items = [],
  peptides = [],
  doses = [],
}: any) {
  return {
    auth: {
      getUser: async () => ({ data: { user } }),
    },
    from(table: string) {
      if (table === 'protocols') {
        return {
          select() {
            return this;
          },
          eq() {
            return this;
          },
          maybeSingle: async () => ({ data: protocol }),
        };
      }
      if (table === 'protocol_items') {
        return {
          select() {
            return this;
          },
          eq: async () => ({ data: items }),
        };
      }
      if (table === 'peptides') {
        return {
          select() {
            return this;
          },
          in: async () => ({ data: peptides }),
        };
      }
      if (table === 'doses') {
        return {
          select() {
            return this;
          },
          eq() {
            return this;
          },
          gte() {
            return this;
          },
          lte: async () => ({ data: doses }),
        };
      }
      throw new Error('Unexpected table: ' + table);
    },
  };
}

describe('getDosesForRange', () => {
  beforeEach(() => {
    delete (globalThis as any).__supabaseMock;
  });

  it('returns rows for authenticated user with protocol items', async () => {
    const supabase = createSupabaseMock({
      user: { id: 'user1' },
      protocol: { id: 1, start_date: '2024-01-01' },
      items: [
        {
          peptide_id: 10,
          dose_mg_per_administration: 1,
          schedule: 'EVERY_N_DAYS',
          every_n_days: 2,
          custom_days: null,
          cycle_on_weeks: 0,
          cycle_off_weeks: 0,
          time_of_day: '08:00',
        },
      ],
      peptides: [{ id: 10, canonical_name: 'Test Peptide' }],
      doses: [],
    });

    (globalThis as any).__supabaseMock = supabase;
    const rows = await getDosesForRange('2024-01-01', '2024-01-07');

    assert.equal(rows.length, 4);
    assert.deepEqual(
      rows.map((r: any) => r.date_for),
      ['2024-01-01', '2024-01-03', '2024-01-05', '2024-01-07']
    );
    assert.equal(rows[0].time_of_day, '08:00');
  });

  it('handles non-UTC timezone offsets', async () => {
    const supabase = createSupabaseMock({
      user: { id: 'user1' },
      protocol: { id: 1, start_date: '2024-01-01' },
      items: [
        {
          peptide_id: 10,
          dose_mg_per_administration: 1,
          schedule: 'EVERY_N_DAYS',
          every_n_days: 2,
          custom_days: null,
          cycle_on_weeks: 0,
          cycle_off_weeks: 0,
          time_of_day: '08:00',
        },
      ],
      peptides: [{ id: 10, canonical_name: 'Test Peptide' }],
      doses: [],
    });

    (globalThis as any).__supabaseMock = supabase;
    const originalOffset = Date.prototype.getTimezoneOffset;
    Date.prototype.getTimezoneOffset = () => 300; // UTC-5    
    const rows = await getDosesForRange('2024-01-01', '2024-01-07');
    Date.prototype.getTimezoneOffset = originalOffset;

    assert.equal(rows.length, 4);
    assert.deepEqual(
      rows.map((r: any) => r.date_for),
      ['2024-01-01', '2024-01-03', '2024-01-05', '2024-01-07']
    );
  });

  it('handles UTC+ timezone offsets', async () => {
    const supabase = createSupabaseMock({
      user: { id: 'user1' },
      protocol: { id: 1, start_date: '2024-01-01' },
      items: [
        {
          peptide_id: 10,
          dose_mg_per_administration: 1,
          schedule: 'EVERY_N_DAYS',
          every_n_days: 2,
          custom_days: null,
          cycle_on_weeks: 0,
          cycle_off_weeks: 0,
          time_of_day: '08:00',
        },
      ],
      peptides: [{ id: 10, canonical_name: 'Test Peptide' }],
      doses: [],
    });

    (globalThis as any).__supabaseMock = supabase;
    const originalOffset = Date.prototype.getTimezoneOffset;
    Date.prototype.getTimezoneOffset = () => -540; // UTC+9
    const rows = await getDosesForRange('2024-01-01', '2024-01-07');
    Date.prototype.getTimezoneOffset = originalOffset;

    assert.equal(rows.length, 4);
    assert.deepEqual(
      rows.map((r: any) => r.date_for),
      ['2024-01-01', '2024-01-03', '2024-01-05', '2024-01-07']
    );
  });

    it('does not drift across DST forward transition', async () => {
    const supabase = createSupabaseMock({
      user: { id: 'user1' },
      protocol: { id: 1, start_date: '2024-01-01' },
      items: [
        {
          peptide_id: 10,
          dose_mg_per_administration: 1,
          schedule: 'EVERYDAY',
          custom_days: null,
          cycle_on_weeks: 0,
          cycle_off_weeks: 0,
          time_of_day: '08:00',
        },
      ],
      peptides: [{ id: 10, canonical_name: 'Test Peptide' }],
      doses: [],
    });

    (globalThis as any).__supabaseMock = supabase;
    const originalOffset = Date.prototype.getTimezoneOffset;
    const dtf = new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/Los_Angeles',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    });
    Date.prototype.getTimezoneOffset = function () {
      const parts = Object.fromEntries(
        dtf.formatToParts(this).map((p) => [p.type, p.value])
      );
      const asUTC = Date.UTC(
        Number(parts.year),
        Number(parts.month) - 1,
        Number(parts.day),
        Number(parts.hour),
        Number(parts.minute),
        Number(parts.second)
      );
      return (this.getTime() - asUTC) / 60000;
    };

    const rows = await getDosesForRange('2024-03-03', '2024-03-17');
    Date.prototype.getTimezoneOffset = originalOffset;

    const expected = [
      '2024-03-03',
      '2024-03-04',
      '2024-03-05',
      '2024-03-06',
      '2024-03-07',
      '2024-03-08',
      '2024-03-09',
      '2024-03-10',
      '2024-03-11',
      '2024-03-12',
      '2024-03-13',
      '2024-03-14',
      '2024-03-15',
      '2024-03-16',
      '2024-03-17',
    ];

    assert.equal(rows.length, expected.length);
    assert.deepEqual(
      rows.map((r: any) => r.date_for),
      expected
    );
  });

  it('does not drift across DST backward transition', async () => {
    const supabase = createSupabaseMock({
      user: { id: 'user1' },
      protocol: { id: 1, start_date: '2024-01-01' },
      items: [
        {
          peptide_id: 10,
          dose_mg_per_administration: 1,
          schedule: 'EVERYDAY',
          custom_days: null,
          cycle_on_weeks: 0,
          cycle_off_weeks: 0,
          time_of_day: '08:00',
        },
      ],
      peptides: [{ id: 10, canonical_name: 'Test Peptide' }],
      doses: [],
    });

    (globalThis as any).__supabaseMock = supabase;
    const originalOffset = Date.prototype.getTimezoneOffset;
    const dtf = new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/Los_Angeles',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    });
    Date.prototype.getTimezoneOffset = function () {
      const parts = Object.fromEntries(
        dtf.formatToParts(this).map((p) => [p.type, p.value])
      );
      const asUTC = Date.UTC(
        Number(parts.year),
        Number(parts.month) - 1,
        Number(parts.day),
        Number(parts.hour),
        Number(parts.minute),
        Number(parts.second)
      );
      return (this.getTime() - asUTC) / 60000;
    };

    const rows = await getDosesForRange('2024-10-27', '2024-11-10');
    Date.prototype.getTimezoneOffset = originalOffset;

    const expected = [
      '2024-10-27',
      '2024-10-28',
      '2024-10-29',
      '2024-10-30',
      '2024-10-31',
      '2024-11-01',
      '2024-11-02',
      '2024-11-03',
      '2024-11-04',
      '2024-11-05',
      '2024-11-06',
      '2024-11-07',
      '2024-11-08',
      '2024-11-09',
      '2024-11-10',
    ];

    assert.equal(rows.length, expected.length);
    assert.deepEqual(
      rows.map((r: any) => r.date_for),
      expected
    );
  });

  it('handles protocol start before DST while querying after', async () => {
    const supabase = createSupabaseMock({
      user: { id: 'user1' },
      protocol: { id: 1, start_date: '2024-03-01' },
      items: [
        {
          peptide_id: 10,
          dose_mg_per_administration: 1,
          schedule: 'EVERY_N_DAYS',
          every_n_days: 2,
          custom_days: null,
          cycle_on_weeks: 0,
          cycle_off_weeks: 0,
        },
      ],
      peptides: [{ id: 10, canonical_name: 'Test Peptide' }],
      doses: [],
    });

    (globalThis as any).__supabaseMock = supabase;
    const originalOffset = Date.prototype.getTimezoneOffset;
    const dtf = new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/Los_Angeles',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    });
    Date.prototype.getTimezoneOffset = function () {
      const parts = Object.fromEntries(
        dtf.formatToParts(this).map((p) => [p.type, p.value])
      );
      const asUTC = Date.UTC(
        Number(parts.year),
        Number(parts.month) - 1,
        Number(parts.day),
        Number(parts.hour),
        Number(parts.minute),
        Number(parts.second)
      );
      return (this.getTime() - asUTC) / 60000;
    };

    const rows = await getDosesForRange('2024-03-11', '2024-03-15');
    Date.prototype.getTimezoneOffset = originalOffset;

    assert.deepEqual(
      rows.map((r: any) => r.date_for),
      ['2024-03-11', '2024-03-13', '2024-03-15']
    );
  });

  it('processes every day across a DST change', async () => {
    const supabase = createSupabaseMock({
      user: { id: 'user1' },
      protocol: { id: 1, start_date: '2024-01-01' },
      items: [
        {
          peptide_id: 10,
          dose_mg_per_administration: 1,
          schedule: 'EVERYDAY',
          custom_days: null,
          cycle_on_weeks: 0,
          cycle_off_weeks: 0,
        },
      ],
      peptides: [{ id: 10, canonical_name: 'Test Peptide' }],
      doses: [],
    });

    (globalThis as any).__supabaseMock = supabase;
    const prevTZ = process.env.TZ;
    process.env.TZ = 'America/Los_Angeles';
    const rows = await getDosesForRange('2024-03-09', '2024-03-12');
    process.env.TZ = prevTZ;

    assert.equal(rows.length, 4);
    assert.deepEqual(
      rows.map((r: any) => r.date_for),
      ['2024-03-09', '2024-03-10', '2024-03-11', '2024-03-12']
    );
  });
   
  it('includes recorded doses on scheduled days', async () => {
    const supabase = createSupabaseMock({
      user: { id: 'user1' },
      protocol: { id: 1, start_date: '2024-01-01' },
      items: [
        {
          peptide_id: 10,
          dose_mg_per_administration: 1,
          schedule: 'EVERY_N_DAYS',
          every_n_days: 2,
          custom_days: null,
          cycle_on_weeks: 0,
          cycle_off_weeks: 0,
        },
      ],
      peptides: [{ id: 10, canonical_name: 'Test Peptide' }],
      doses: [
        {
          date_for: '2024-01-05',
          peptide_id: 10,
          dose_mg: 1,
          status: 'TAKEN',
        },
      ],
    });

    (globalThis as any).__supabaseMock = supabase;
    const rows = await getDosesForRange('2024-01-01', '2024-01-07');

    assert.ok(rows.length);
    const taken = rows.find((r: any) => r.date_for === '2024-01-05');
    assert.deepEqual(taken, {
      date_for: '2024-01-05',
      peptide_id: 10,
      canonical_name: 'Test Peptide',
      dose_mg: 1,
      status: 'TAKEN',
    });
  });

  for (const tzOffset of [120, -420]) {
    it(`handles cycle on/off weeks with timezone offset ${tzOffset}`, async () => {
      const supabase = createSupabaseMock({
        user: { id: 'user1' },
        protocol: { id: 1, start_date: '2024-01-01' },
        items: [
          {
            peptide_id: 10,
            dose_mg_per_administration: 1,
            schedule: 'EVERY_N_DAYS',
            every_n_days: 2,
            custom_days: null,
            cycle_on_weeks: 1,
            cycle_off_weeks: 1,
          },
        ],
        peptides: [{ id: 10, canonical_name: 'Test Peptide' }],
        doses: [],
      });

      (globalThis as any).__supabaseMock = supabase;
      const originalOffset = Date.prototype.getTimezoneOffset;
      Date.prototype.getTimezoneOffset = () => tzOffset;
      const rows = await getDosesForRange('2024-01-01', '2024-01-28');
      Date.prototype.getTimezoneOffset = originalOffset;

      assert.ok(rows.length);
      assert.deepEqual(
        rows.map((r: any) => r.date_for),
        [
          '2024-01-01',
          '2024-01-03',
          '2024-01-05',
          '2024-01-07',
          '2024-01-15',
          '2024-01-17',
          '2024-01-19',
          '2024-01-21',
        ]
      );
    });
  }

  it('throws when user is unauthenticated', async () => {
    const supabase = createSupabaseMock({ user: null });
    (globalThis as any).__supabaseMock = supabase;

    await assert.rejects(
      () => getDosesForRange('2024-01-01', '2024-01-02'),
      /Not authenticated/
    );
  });
});
