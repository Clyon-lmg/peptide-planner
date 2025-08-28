// app/(app)/today/actions.test.ts
// Tests for getTodayDosesWithUnits using mocked Supabase responses.

import assert from 'node:assert/strict';
import { describe, it, beforeEach } from 'node:test';
import { getTodayDosesWithUnits } from './actions';

function createSupabaseMock({
  user = null,
  protocol = null,
  items = [],
  peptides = [],
  invVials = [],
  invCaps = [],
  doses = [],
}: any) {
  return {
    auth: {
      getUser: async () => ({ data: { user } }),
    },
    from(table: string) {
      if (table === 'protocols') {
        return {
          select() { return this; },
          eq() { return this; },
          maybeSingle: async () => ({ data: protocol }),
        } as any;
      }
      if (table === 'protocol_items') {
        return {
          select() { return this; },
          eq: async () => ({ data: items }),
        } as any;
      }
      if (table === 'peptides') {
        return {
          select() { return this; },
          in: async () => ({ data: peptides }),
        } as any;
      }
      if (table === 'inventory_items') {
        const q: any = {
          select() { return q; },
          eq() { return q; },
          in: async () => ({ data: invVials }),
        };
        return q;
      }
      if (table === 'inventory_capsules') {
        const q: any = {
          select() { return q; },
          eq() { return q; },
          in: async () => ({ data: invCaps }),
        };
        return q;
      }
      if (table === 'doses') {
        const q: any = {
          select() { return q; },
          eq() { return q; },
          in: async () => ({ data: doses }),
        };
        return q;
      }
      throw new Error('Unexpected table: ' + table);
    },
  };
}

describe('getTodayDosesWithUnits', () => {
  beforeEach(() => {
    delete (globalThis as any).__supabaseMock;
  });

  it('returns rows only on scheduled days', async () => {
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
      invVials: [],
      invCaps: [],
      doses: [],
    });
    (globalThis as any).__supabaseMock = supabase;

    const yes = await getTodayDosesWithUnits('2024-01-03');
    assert.equal(yes.length, 1);
    assert.equal(yes[0].peptide_id, 10);

    const no = await getTodayDosesWithUnits('2024-01-02');
    assert.equal(no.length, 0);
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
      invVials: [],
      invCaps: [],
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

    const rows = await getTodayDosesWithUnits('2024-03-11');
    Date.prototype.getTimezoneOffset = originalOffset;

    assert.equal(rows.length, 1);
    assert.equal(rows[0].peptide_id, 10);
  });
});