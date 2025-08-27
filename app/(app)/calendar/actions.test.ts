// app/(app)/calendar/actions.test.ts
// Tests for getDosesForRange using mocked Supabase responses.

import assert from 'node:assert/strict';
import { describe, it, beforeEach } from 'node:test';
import Module from 'node:module';

const require = Module.createRequire(import.meta.url);

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
    const path = require.resolve('@supabase/auth-helpers-nextjs');
    delete require.cache[path];
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
        },
      ],
      peptides: [{ id: 10, canonical_name: 'Test Peptide' }],
      doses: [],
    });

    const path = require.resolve('@supabase/auth-helpers-nextjs');
    require.cache[path] = { exports: { createServerActionClient: () => supabase } };

    const { getDosesForRange } = require('./actions');
    const rows = await getDosesForRange('2024-01-01', '2024-01-07');

    assert.equal(rows.length, 4);
    assert.deepEqual(
      rows.map((r: any) => r.date_for),
      ['2024-01-01', '2024-01-03', '2024-01-05', '2024-01-07']
    );
  });

  it('throws when user is unauthenticated', async () => {
    const supabase = createSupabaseMock({ user: null });
    const path = require.resolve('@supabase/auth-helpers-nextjs');
    require.cache[path] = { exports: { createServerActionClient: () => supabase } };

    const { getDosesForRange } = require('./actions');
    await assert.rejects(
      () => getDosesForRange('2024-01-01', '2024-01-02'),
      /Not authenticated/
    );
  });
});
