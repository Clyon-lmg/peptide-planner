// @ts-nocheck
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { setActiveProtocolAndRegenerate } from './protocolEngine';

function createSupabaseMock(state, opts = {}) {
  state.injection_sites = state.injection_sites || [];
  function match(row, filters) {
    return filters.every(f => {
      if (f.type === 'eq') return row[f.col] === f.val;
      if (f.type === 'gte') return row[f.col] >= f.val;
      if (f.type === 'neq') return row[f.col] !== f.val;
      if (f.type === 'in') return f.val.includes(row[f.col]);
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
        in(col, val) { this.filters.push({ type: 'in', col, val }); return this; },
        order(col, opts) { this.order = { col, asc: opts?.ascending !== false }; return this; },
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
            if (table === 'injection_sites') rows = state.injection_sites.filter(r => match(r, this.filters));
            if (this.order && rows.length) {
              const { col, asc } = this.order;
              rows = rows.sort((a,b) => asc ? a[col] - b[col] : b[col] - a[col]);
            }
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
    const res = await setActiveProtocolAndRegenerate(1, 'uid', () => supabaseMock);

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
    const res = await setActiveProtocolAndRegenerate(1, 'uid', () => supabaseMock);

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
    await setActiveProtocolAndRegenerate(1, 'uid', () => supabaseMock);

    assert.equal(state.doses[0].dose_mg, 10);
    assert.equal(state.doses[7].dose_mg, 15);
  });

  it('escalates doses on schedule and handles partial intervals', async () => {
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
          titration_interval_days: 4,
          titration_amount_mg: 2,
        },
      ],
    };
    const supabaseMock = createSupabaseMock(state);
    await setActiveProtocolAndRegenerate(1, 'uid', () => supabaseMock);

    const doses = state.doses.filter(d => d.peptide_id === 1);
    assert.equal(doses[0].dose_mg, 10); // initial
    assert.equal(doses[3].dose_mg, 10); // before first interval completes
    assert.equal(doses[4].dose_mg, 12); // after 4 days
    assert.equal(doses[7].dose_mg, 12); // partial interval
    assert.equal(doses[8].dose_mg, 14); // second escalation
  });

  it('ignores titration when interval or amount is zero', async () => {
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
          titration_interval_days: 0,
          titration_amount_mg: 5,
        },
      ],
    };
    const supabaseMock = createSupabaseMock(state);
    await setActiveProtocolAndRegenerate(1, 'uid', () => supabaseMock);

    const doses = state.doses.filter(d => d.peptide_id === 1);
    assert.equal(new Set(doses.slice(0, 10).map(d => d.dose_mg)).size, 1);
    assert.equal(doses[0].dose_mg, 10);
  });

  it('supports multiple peptides with distinct titration plans', async () => {
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
          titration_interval_days: 3,
          titration_amount_mg: 2,
        },
        {
          id: 2,
          protocol_id: 1,
          peptide_id: 2,
          dose_mg_per_administration: 5,
          schedule: 'EVERYDAY',
          custom_days: null,
          cycle_on_weeks: 0,
          cycle_off_weeks: 0,
          every_n_days: null,
          titration_interval_days: 5,
          titration_amount_mg: 1,
        },
      ],
    };
    const supabaseMock = createSupabaseMock(state);
    await setActiveProtocolAndRegenerate(1, 'uid', () => supabaseMock);

    const p1 = state.doses.filter(d => d.peptide_id === 1);
    const p2 = state.doses.filter(d => d.peptide_id === 2);
    assert.equal(p1[0].dose_mg, 10);
    assert.equal(p1[3].dose_mg, 12);
    assert.equal(p1[6].dose_mg, 14);
    assert.equal(p2[4].dose_mg, 5);
    assert.equal(p2[5].dose_mg, 6);
  });

  it('assigns site labels cycling daily', async () => {
    const state = {
      doses: [],
      protocol_items: [
        {
          id: 1,
          protocol_id: 1,
          peptide_id: 1,
          dose_mg_per_administration: 1,
          schedule: 'EVERY_N_DAYS',
          custom_days: null,
          cycle_on_weeks: 0,
          cycle_off_weeks: 0,
          every_n_days: 2,
          titration_interval_days: null,
          titration_amount_mg: null,
          site_list_id: 1,
        },
      ],
      injection_sites: [
        { list_id: 1, name: 'A', position: 1 },
        { list_id: 1, name: 'B', position: 2 },
        { list_id: 1, name: 'C', position: 3 },
      ],
    };
    const supabaseMock = createSupabaseMock(state);
    await setActiveProtocolAndRegenerate(1, 'uid', () => supabaseMock);

    const labels = state.doses
      .filter(d => d.peptide_id === 1)
      .slice(0, 3)
      .map(d => d.site_label);
    assert.deepEqual(labels, ['A', 'C', 'B']);
  });
});