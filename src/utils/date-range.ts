/**
 * Date range utilities for calculating previous week periods
 */

import type { DateRange } from '../types/index.js';

/**
 * Format a date as YYYY-MM-DD
 */
export function formatDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Format a date for TPAD input fields
 * The new TPAD uses HTML5 date inputs which expect YYYY-MM-DD format
 */
export function formatDateForTpad(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Parse a date string in YYYY-MM-DD format
 */
export function parseDate(dateStr: string): Date {
  const [year, month, day] = dateStr.split('-').map(Number);
  return new Date(year, month - 1, day);
}

/**
 * Get the Monday of the week containing the given date
 */
export function getMonday(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  // getDay() returns 0 for Sunday, so we need to handle that
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

/**
 * Get the Sunday of the week containing the given date
 */
export function getSunday(date: Date): Date {
  const monday = getMonday(date);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  sunday.setHours(23, 59, 59, 999);
  return sunday;
}

/**
 * Calculate the previous week's date range (Monday to Sunday)
 * 
 * @param referenceDate - The reference date (defaults to today)
 * @returns DateRange object with start (Monday) and end (Sunday) of previous week
 */
export function getPreviousWeekRange(referenceDate: Date = new Date()): DateRange {
  // Get Monday of current week
  const currentMonday = getMonday(referenceDate);
  
  // Go back 7 days to get previous week's Monday
  const previousMonday = new Date(currentMonday);
  previousMonday.setDate(currentMonday.getDate() - 7);
  
  // Get previous week's Sunday
  const previousSunday = new Date(previousMonday);
  previousSunday.setDate(previousMonday.getDate() + 6);
  previousSunday.setHours(23, 59, 59, 999);
  
  const label = `Week of ${formatDate(previousMonday)}`;
  
  return {
    start: previousMonday,
    end: previousSunday,
    label,
  };
}

/**
 * Get date range for a specific week starting on the given Monday
 * 
 * @param mondayStr - Monday date in YYYY-MM-DD format
 * @returns DateRange object
 */
export function getWeekRangeFromMonday(mondayStr: string): DateRange {
  const monday = parseDate(mondayStr);
  
  // Validate it's a Monday
  if (monday.getDay() !== 1) {
    throw new Error(`Date ${mondayStr} is not a Monday`);
  }
  
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  sunday.setHours(23, 59, 59, 999);
  
  const label = `Week of ${formatDate(monday)}`;
  
  return {
    start: monday,
    end: sunday,
    label,
  };
}

/**
 * Check if a date falls within a date range
 */
export function isDateInRange(date: Date | string, range: DateRange): boolean {
  const d = typeof date === 'string' ? parseDate(date) : date;
  return d >= range.start && d <= range.end;
}

/**
 * Format a date range for display
 */
export function formatDateRange(range: DateRange): string {
  return `${formatDate(range.start)} to ${formatDate(range.end)}`;
}

/**
 * Generate a filename-safe date range string
 */
export function getDateRangeFilename(range: DateRange): string {
  const start = formatDate(range.start).replace(/-/g, '_');
  return `week_${start}`;
}

