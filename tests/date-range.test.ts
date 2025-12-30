/**
 * Tests for date-range utilities
 */

import { describe, it, expect } from 'vitest';
import {
  formatDate,
  formatDateForTpad,
  parseDate,
  getMonday,
  getSunday,
  getPreviousWeekRange,
  getWeekRangeFromMonday,
  isDateInRange,
  formatDateRange,
  getDateRangeFilename,
} from '../src/utils/date-range.js';

describe('formatDate', () => {
  it('formats date as YYYY-MM-DD', () => {
    const date = new Date(2025, 0, 15); // January 15, 2025
    expect(formatDate(date)).toBe('2025-01-15');
  });

  it('pads single digit months and days', () => {
    const date = new Date(2025, 0, 5); // January 5, 2025
    expect(formatDate(date)).toBe('2025-01-05');
  });
});

describe('formatDateForTpad', () => {
  it('formats date as YYYY-MM-DD for TPAD HTML5 date input', () => {
    const date = new Date(2025, 0, 15);
    expect(formatDateForTpad(date)).toBe('2025-01-15');
  });
});

describe('parseDate', () => {
  it('parses YYYY-MM-DD string to Date', () => {
    const date = parseDate('2025-01-15');
    expect(date.getFullYear()).toBe(2025);
    expect(date.getMonth()).toBe(0); // January
    expect(date.getDate()).toBe(15);
  });
});

describe('getMonday', () => {
  it('returns Monday for a Wednesday', () => {
    const wednesday = new Date(2025, 0, 8); // Wednesday, Jan 8, 2025
    const monday = getMonday(wednesday);
    expect(monday.getDay()).toBe(1); // Monday
    expect(formatDate(monday)).toBe('2025-01-06');
  });

  it('returns same day for a Monday', () => {
    const monday = new Date(2025, 0, 6); // Monday, Jan 6, 2025
    const result = getMonday(monday);
    expect(formatDate(result)).toBe('2025-01-06');
  });

  it('returns previous Monday for a Sunday', () => {
    const sunday = new Date(2025, 0, 12); // Sunday, Jan 12, 2025
    const monday = getMonday(sunday);
    expect(formatDate(monday)).toBe('2025-01-06');
  });
});

describe('getSunday', () => {
  it('returns Sunday of the same week', () => {
    const wednesday = new Date(2025, 0, 8);
    const sunday = getSunday(wednesday);
    expect(sunday.getDay()).toBe(0); // Sunday
    expect(formatDate(sunday)).toBe('2025-01-12');
  });
});

describe('getPreviousWeekRange', () => {
  it('returns previous week Mon-Sun when reference is Monday', () => {
    const monday = new Date(2025, 0, 13); // Monday, Jan 13, 2025
    const range = getPreviousWeekRange(monday);
    
    expect(formatDate(range.start)).toBe('2025-01-06');
    expect(formatDate(range.end)).toBe('2025-01-12');
    expect(range.label).toBe('Week of 2025-01-06');
  });

  it('returns previous week when reference is mid-week', () => {
    const thursday = new Date(2025, 0, 16); // Thursday, Jan 16, 2025
    const range = getPreviousWeekRange(thursday);
    
    expect(formatDate(range.start)).toBe('2025-01-06');
    expect(formatDate(range.end)).toBe('2025-01-12');
  });

  it('returns correct week when reference is Sunday', () => {
    const sunday = new Date(2025, 0, 19); // Sunday, Jan 19, 2025
    const range = getPreviousWeekRange(sunday);
    
    // Current week is Jan 13-19, so previous week is Jan 6-12
    expect(formatDate(range.start)).toBe('2025-01-06');
    expect(formatDate(range.end)).toBe('2025-01-12');
  });
});

describe('getWeekRangeFromMonday', () => {
  it('returns week range for valid Monday', () => {
    const range = getWeekRangeFromMonday('2025-01-06');
    
    expect(formatDate(range.start)).toBe('2025-01-06');
    expect(formatDate(range.end)).toBe('2025-01-12');
    expect(range.label).toBe('Week of 2025-01-06');
  });

  it('throws error for non-Monday date', () => {
    expect(() => getWeekRangeFromMonday('2025-01-07')).toThrow('not a Monday');
  });
});

describe('isDateInRange', () => {
  const range = getWeekRangeFromMonday('2025-01-06');

  it('returns true for date within range', () => {
    expect(isDateInRange('2025-01-08', range)).toBe(true);
  });

  it('returns true for start date', () => {
    expect(isDateInRange('2025-01-06', range)).toBe(true);
  });

  it('returns true for end date', () => {
    expect(isDateInRange('2025-01-12', range)).toBe(true);
  });

  it('returns false for date before range', () => {
    expect(isDateInRange('2025-01-05', range)).toBe(false);
  });

  it('returns false for date after range', () => {
    expect(isDateInRange('2025-01-13', range)).toBe(false);
  });
});

describe('formatDateRange', () => {
  it('formats range as "start to end"', () => {
    const range = getWeekRangeFromMonday('2025-01-06');
    expect(formatDateRange(range)).toBe('2025-01-06 to 2025-01-12');
  });
});

describe('getDateRangeFilename', () => {
  it('generates filename-safe date string', () => {
    const range = getWeekRangeFromMonday('2025-01-06');
    expect(getDateRangeFilename(range)).toBe('week_2025_01_06');
  });
});

