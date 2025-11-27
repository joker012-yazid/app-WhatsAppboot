import { describe, expect, it } from 'vitest';

import { parseDurationMs } from './time';

describe('parseDurationMs', () => {
  it('parses supported durations in milliseconds', () => {
    expect(parseDurationMs('500ms')).toBe(500);
    expect(parseDurationMs('30s')).toBe(30_000);
    expect(parseDurationMs('15m')).toBe(900_000);
    expect(parseDurationMs('1h')).toBe(3_600_000);
    expect(parseDurationMs('2d')).toBe(172_800_000);
  });

  it('accepts mixed casing for units', () => {
    expect(parseDurationMs('500MS')).toBe(500);
    expect(parseDurationMs('30S')).toBe(30_000);
    expect(parseDurationMs('15M')).toBe(900_000);
    expect(parseDurationMs('1H')).toBe(3_600_000);
    expect(parseDurationMs('2D')).toBe(172_800_000);
  });

  it('rejects invalid inputs', () => {
    expect(() => parseDurationMs('')).toThrow('Invalid duration');
    expect(() => parseDurationMs('abc')).toThrow('Invalid duration');
    expect(() => parseDurationMs('ms')).toThrow('Invalid duration');
    expect(() => parseDurationMs('w')).toThrow('Invalid duration');
    expect(() => parseDurationMs('10w')).toThrow('Invalid duration');
  });
});
