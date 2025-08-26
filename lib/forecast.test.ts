// @ts-nocheck
import { describe, it, beforeEach, afterEach, mock } from 'node:test';
import assert from 'node:assert/strict';
import { forecastRemainingDoses } from './forecast';

describe('forecastRemainingDoses', () => {
  beforeEach(() => {
    mock.timers.enable({ now: new Date('2024-01-01T00:00:00Z') });
  });

  afterEach(() => {
    mock.timers.reset();
  });

  it('handles continuous dosing without cycles', () => {
    const result = forecastRemainingDoses(100, 10, 'EVERYDAY', null, 0, 0, null);
    assert.deepEqual(result, { remainingDoses: 10, reorderDateISO: '2024-01-15' });
  });

  it('handles cycled protocols with on/off weeks', () => {
    const result = forecastRemainingDoses(100, 10, 'EVERYDAY', null, 1, 1, null);
    assert.deepEqual(result, { remainingDoses: 10, reorderDateISO: '2024-01-22' });
  });

  it('returns nulls when dose is zero', () => {
    const result = forecastRemainingDoses(100, 0, 'EVERYDAY', null, 0, 0, null);
    assert.deepEqual(result, { remainingDoses: null, reorderDateISO: null });
  });

  it('handles zero inventory with immediate reorder date', () => {
    const result = forecastRemainingDoses(0, 10, 'EVERYDAY', null, 0, 0, null);
    assert.deepEqual(result, { remainingDoses: 0, reorderDateISO: '2024-01-01' });
  });
});