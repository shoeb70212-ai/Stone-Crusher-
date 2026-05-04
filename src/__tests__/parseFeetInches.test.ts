import { describe, it, expect } from 'vitest';
import { parseFeetInches } from '../lib/utils';

describe('parseFeetInches', () => {
  it.each([
    ['5.6', 5.5],
    ['0', 0],
    ['abc', 0],
    ['', 0],
    ['-1.6', -0.5],
    ['  5.6  ', 5.5],
    ['5.0', 5],
    ['5.11', 5 + 11 / 12],
    ['5.12', 5 + 11 / 12], // clamped
    ['6', 6],
    ['10.3', 10 + 3 / 12],
    ['3.9', 3 + 9 / 12],
    ['0.6', 0.5],
    ['12.0', 12],
    ['5.06', 5 + 6 / 12],
    ['5.6.7', 5.5],
  ])('parseFeetInches(%s) => %s', (input, expected) => {
    expect(parseFeetInches(input)).toBeCloseTo(expected, 4);
  });
});
