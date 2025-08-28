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
});