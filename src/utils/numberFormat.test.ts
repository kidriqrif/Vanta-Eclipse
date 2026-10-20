import { describe, expect, it } from 'vitest';
import {
  formatDuration,
  formatMs,
  formatNumber,
  formatPercent,
  formatPercentTight,
  formatScore,
  formatTenths,
} from './numberFormat';

describe('formatNumber', () => {
  it('prints small numbers plainly', () => {
    expect(formatNumber(0)).toBe('0');
    expect(formatNumber(999)).toBe('999');
    expect(formatNumber(2.345)).toBe('2.3');
    expect(formatNumber(12.6)).toBe('13');
    expect(formatNumber(-42)).toBe('-42');
  });

  it('abbreviates with suffixes', () => {
    expect(formatNumber(1000)).toBe('1.00K');
    expect(formatNumber(1_130_000)).toBe('1.13M');
    expect(formatNumber(5e9)).toBe('5.00B');
  });

  it('never shows a four-digit mantissa when rounding carries over', () => {
    expect(formatNumber(999.7)).toBe('1.00K');
    expect(formatNumber(999_999.9)).toBe('1.00M');
    expect(formatNumber(999_999_851)).toBe('1.00B');
    expect(formatNumber(999_994)).toBe('999.99K');
  });

  it('handles non-finite input', () => {
    expect(formatNumber(NaN)).toBe('0');
    expect(formatNumber(Infinity)).toBe('∞');
    expect(formatNumber(1e80)).toBe('1.00e+80');
  });
});

describe('formatPercent and formatDuration', () => {
  it('formats', () => {
    expect(formatPercent(0.105)).toBe('+10.5%');
    expect(formatDuration(59)).toBe('59s');
    expect(formatDuration(125)).toBe('2m 5s');
    expect(formatDuration(3 * 3600 + 60)).toBe('3h 1m');
  });
});

describe('formatPercentTight, formatTenths, formatMs and formatScore', () => {
  it('keeps a decimal only when the value needs one', () => {
    expect(formatPercentTight(0.1)).toBe('+10%');
    expect(formatPercentTight(0.005)).toBe('+0.5%');
    expect(formatPercentTight(0.07)).toBe('+7%');
  });

  it('formats a countdown to the tenth', () => {
    expect(formatTenths(29.64)).toBe('29.6s');
    expect(formatTenths(0)).toBe('0.0s');
    expect(formatTenths(-1)).toBe('0.0s');
  });

  it('switches milliseconds to seconds from one second up', () => {
    expect(formatMs(286)).toBe('286ms');
    expect(formatMs(1240)).toBe('1.2s');
    expect(formatScore(1240, 'ms')).toBe('1.2s');
    expect(formatScore(7, 'moves')).toBe('7 moves');
  });
});
