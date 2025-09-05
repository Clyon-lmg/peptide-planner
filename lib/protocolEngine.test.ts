// @ts-nocheck
import { describe, it, mock } from 'node:test';
import assert from 'node:assert/strict';
import { setActiveProtocolAndRegenerate } from './protocolEngine';
import * as supabaseBrowser from './supabaseBrowser';

function createSupabaseMock(state, opts = {}) {
  function match(row, filters) {
    return filters.every(f => {
      if (f.type === 'eq') return row[f.col] === f.val;
      if (f.type === 'gte') return row[f.col] >= f.val;
      if (f.type === 'neq') return row[f.col] !== f.val;
      return true;
    });
  }

  return {
    auth: {
      async getSession() {
        return { data: { session: { user: { id: 'uid' } } } };
      }
    },
    from(table) {
      const q = {
        action: null,
        filters: [],
        opts: {},
        delete() { this.action = 'delete'; return this; },
        select(_cols, opts) { this.action = 'select'; this.opts = opts || {}; return this; },
        update(_vals) { this.action = 'update'; return this; },
        insert(rows) { state.doses.push(...rows); return Promise.resolve({ error: null }); },
        eq(col, val) { this.filters.push({ type: 'eq', col, val }); return this; },
        gte(col, val) { this.filters.push({ type: 'gte', col, val }); return this; },
        neq(col, val) { this.filters.push({ type: 'neq', col, val }); return this; },
        then(resolve) {
          if (this.action === 'delete' && table === 'doses') {
            if (!opts.skipDelete) {
              state.doses = state.doses.filter(row => !match(row, this.filters));
            }
            resolve({ error: null });
          } else if (this.action === 'select') {
            let rows = [];
            if (table === 'protocol_items') rows = state.protocol_items.filter(r => match(r, this.filters));
            if (table === 'doses') rows = state.doses.filter(r => match(r, this.filters));
            if (this.opts.head) resolve({ count: rows.length, error: null });
            else resolve({ data: rows, error: null });
          } else {
            resolve({ error: null });
          }
        }
      };
      return q;
    }
  };
}

describe('setActiveProtocolAndRegenerate', () => {
  it('retains past doses during regeneration', async () => {
    const state = {
      doses: [
        { protocol_id: 1, user_id: 'uid', peptide_id: 1, dose_mg: 1, date: '2000-01-01', date_for: '2000-01-01', status: 'PENDING' },
        { protocol_id: 1, user_id: 'uid', peptide_id: 1, dose_mg: 1, date: '2999-01-01', date_for: '2999-01-01', status: 'PENDING' },
      ],
      protocol_items: []
    };
    const supabaseMock = createSupabaseMock(state);
    mock.method(supabaseBrowser, 'getSupabaseBrowser', () => supabaseMock);

    const res = await setActiveProtocolAndRegenerate(1, 'uid');

    assert.equal(state.doses.some(d => d.date_for === '2000-01-01'), true);
    assert.equal(state.doses.some(d => d.date_for === '2999-01-01'), false);
  });

  it('reports leftover doses without failing', async () => {
    const state = {
      doses: [
        { protocol_id: 1, user_id: 'uid', peptide_id: 1, dose_mg: 1, date: '2999-01-01', date_for: '2999-01-01', status: 'PENDING' },
      ],
      protocol_items: []
    };
    const supabaseMock = createSupabaseMock(state, { skipDelete: true });
    mock.method(supabaseBrowser, 'getSupabaseBrowser', () => supabaseMock);

    const res = await setActiveProtocolAndRegenerate(1, 'uid');

    assert.equal(res.leftover, 1);
  });
  
  it('applies titration adjustments to doses', async () => {
    const state = {
      doses: [],
      protocol_items: [
        {
          id: 1,
          protocol_id: 1,
          peptide_id: 1,
          dose_mg_per_administration: 10,
          schedule: 'EVERYDAY',
          custom_days: null,
          cycle_on_weeks: 0,
          cycle_off_weeks: 0,
          every_n_days: null,
          titration_interval_days: 7,
          titration_amount_mg: 5,
        },
      ],
    };
    const supabaseMock = createSupabaseMock(state);
    mock.method(supabaseBrowser, 'getSupabaseBrowser', () => supabaseMock);

    await setActiveProtocolAndRegenerate(1, 'uid');

    assert.equal(state.doses[0].dose_mg, 10);
    assert.equal(state.doses[7].dose_mg, 15);
  });
});