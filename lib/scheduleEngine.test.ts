// @ts-nocheck
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { isDoseDayLocal, isDoseDayUTC } from './scheduleEngine';

describe('isDoseDay helpers', () => {
  it('handles WEEKDAYS schedule', () => {
    const item = { schedule: 'WEEKDAYS' };
    const wed = new Date('2024-01-03T12:00:00Z');
    const sun = new Date('2024-01-07T12:00:00Z');
    assert.equal(isDoseDayLocal(wed, item), true);
    assert.equal(isDoseDayUTC(wed, item), true);
    assert.equal(isDoseDayLocal(sun, item), false);
    assert.equal(isDoseDayUTC(sun, item), false);
  });

  it('handles EVERY_N_DAYS schedule', () => {
    const item = {
      schedule: 'EVERY_N_DAYS',
      every_n_days: 2,
      start_date: '2024-01-01',
    };
    const yes = new Date('2024-01-05T12:00:00Z');
    const no = new Date('2024-01-06T12:00:00Z');
    assert.equal(isDoseDayLocal(yes, item), true);
    assert.equal(isDoseDayUTC(yes, item), true);
    assert.equal(isDoseDayLocal(no, item), false);
    assert.equal(isDoseDayUTC(no, item), false);
  });
});