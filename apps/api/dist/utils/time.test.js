"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const time_1 = require("./time");
(0, vitest_1.describe)('parseDurationMs', () => {
    (0, vitest_1.it)('parses supported durations in milliseconds', () => {
        (0, vitest_1.expect)((0, time_1.parseDurationMs)('500ms')).toBe(500);
        (0, vitest_1.expect)((0, time_1.parseDurationMs)('30s')).toBe(30_000);
        (0, vitest_1.expect)((0, time_1.parseDurationMs)('15m')).toBe(900_000);
        (0, vitest_1.expect)((0, time_1.parseDurationMs)('1h')).toBe(3_600_000);
        (0, vitest_1.expect)((0, time_1.parseDurationMs)('2d')).toBe(172_800_000);
    });
    (0, vitest_1.it)('accepts mixed casing for units', () => {
        (0, vitest_1.expect)((0, time_1.parseDurationMs)('500MS')).toBe(500);
        (0, vitest_1.expect)((0, time_1.parseDurationMs)('30S')).toBe(30_000);
        (0, vitest_1.expect)((0, time_1.parseDurationMs)('15M')).toBe(900_000);
        (0, vitest_1.expect)((0, time_1.parseDurationMs)('1H')).toBe(3_600_000);
        (0, vitest_1.expect)((0, time_1.parseDurationMs)('2D')).toBe(172_800_000);
    });
    (0, vitest_1.it)('rejects invalid inputs', () => {
        (0, vitest_1.expect)(() => (0, time_1.parseDurationMs)('')).toThrow('Invalid duration');
        (0, vitest_1.expect)(() => (0, time_1.parseDurationMs)('abc')).toThrow('Invalid duration');
        (0, vitest_1.expect)(() => (0, time_1.parseDurationMs)('ms')).toThrow('Invalid duration');
        (0, vitest_1.expect)(() => (0, time_1.parseDurationMs)('w')).toThrow('Invalid duration');
        (0, vitest_1.expect)(() => (0, time_1.parseDurationMs)('10w')).toThrow('Invalid duration');
    });
});
