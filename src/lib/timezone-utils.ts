// src/lib/timezone-utils.ts
// Comprehensive timezone utilities for pricing system

export const COMMON_TIMEZONES = [
  { value: 'America/New_York', label: 'Eastern Time (New York)' },
  { value: 'America/Detroit', label: 'Eastern Time (Detroit)' },
  { value: 'America/Chicago', label: 'Central Time (Chicago)' },
  { value: 'America/Denver', label: 'Mountain Time (Denver)' },
  { value: 'America/Phoenix', label: 'Mountain Time (Phoenix - No DST)' },
  { value: 'America/Los_Angeles', label: 'Pacific Time (Los Angeles)' },
  { value: 'America/Anchorage', label: 'Alaska Time' },
  { value: 'Pacific/Honolulu', label: 'Hawaii Time' },
  { value: 'Europe/London', label: 'GMT (London)' },
  { value: 'Europe/Paris', label: 'Central European Time (Paris)' },
  { value: 'Asia/Tokyo', label: 'Japan Time (Tokyo)' },
  { value: 'Asia/Shanghai', label: 'China Time (Shanghai)' },
  { value: 'Australia/Sydney', label: 'Australian Eastern Time (Sydney)' },
  { value: 'UTC', label: 'UTC (Universal Time)' },
];

/**
 * Convert a date string (YYYY-MM-DD) to start of day in specified timezone
 * Returns a Date object in UTC that represents midnight in the local timezone
 * 
 * Example: 
 *   Input: "2026-01-13" in "America/Detroit" (UTC-5)
 *   Output: Date("2026-01-13T05:00:00.000Z") <- midnight Detroit time
 */
export function toStartOfDayInTimezone(dateString: string, timezone: string): Date {
  // Parse YYYY-MM-DD
  const [year, month, day] = dateString.split('-').map(Number);
  
  // Create a date string at midnight in the specified timezone
  const dateTimeString = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}T00:00:00`;
  
  // Use Intl.DateTimeFormat to get the UTC offset for this date in this timezone
  const localDate = new Date(dateTimeString);
  
  // Get the timezone offset in minutes for this specific date
  const utcDate = new Date(localDate.toLocaleString('en-US', { timeZone: 'UTC' }));
  const tzDate = new Date(localDate.toLocaleString('en-US', { timeZone: timezone }));
  const offsetMs = utcDate.getTime() - tzDate.getTime();
  
  // Adjust the date by the offset
  return new Date(localDate.getTime() + offsetMs);
}

/**
 * Convert a date string (YYYY-MM-DD) to end of day in specified timezone
 * Returns a Date object in UTC that represents 23:59:59.999 in the local timezone
 */
export function toEndOfDayInTimezone(dateString: string, timezone: string): Date {
  const [year, month, day] = dateString.split('-').map(Number);
  const dateTimeString = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}T23:59:59.999`;
  
  const localDate = new Date(dateTimeString);
  
  const utcDate = new Date(localDate.toLocaleString('en-US', { timeZone: 'UTC' }));
  const tzDate = new Date(localDate.toLocaleString('en-US', { timeZone: timezone }));
  const offsetMs = utcDate.getTime() - tzDate.getTime();
  
  return new Date(localDate.getTime() + offsetMs);
}

/**
 * Format a UTC date for display in a specific timezone
 */
export function formatDateInTimezone(date: Date, timezone: string, format: 'date' | 'datetime' | 'time' = 'date'): string {
  const options: Intl.DateTimeFormatOptions = {
    timeZone: timezone,
  };
  
  if (format === 'date' || format === 'datetime') {
    options.year = 'numeric';
    options.month = '2-digit';
    options.day = '2-digit';
  }
  
  if (format === 'time' || format === 'datetime') {
    options.hour = '2-digit';
    options.minute = '2-digit';
    options.hour12 = true;
  }
  
  return date.toLocaleString('en-US', options);
}

/**
 * Convert Date to YYYY-MM-DD string in specified timezone
 */
export function dateToString(date: Date, timezone: string): string {
  const year = date.toLocaleString('en-US', { timeZone: timezone, year: 'numeric' });
  const month = date.toLocaleString('en-US', { timeZone: timezone, month: '2-digit' });
  const day = date.toLocaleString('en-US', { timeZone: timezone, day: '2-digit' });
  
  return `${year}-${month}-${day}`;
}

/**
 * Get timezone offset in hours for display
 */
export function getTimezoneOffsetDisplay(timezone: string): string {
  const date = new Date();
  const tzString = date.toLocaleString('en-US', { 
    timeZone: timezone, 
    timeZoneName: 'short' 
  });
  
  const match = tzString.match(/([A-Z]{3,4})/);
  return match ? match[1] : timezone;
}

/**
 * Check if a booking time overlaps with a ratesheet's effective period
 * Handles timezone-aware comparisons
 */
export function isDateInRange(
  checkDate: Date,
  rangeStart: Date,
  rangeEnd: Date | null
): boolean {
  if (rangeEnd) {
    return checkDate >= rangeStart && checkDate <= rangeEnd;
  }
  return checkDate >= rangeStart;
}

/**
 * Convert time string (HH:MM) to minutes since midnight
 */
export function timeToMinutes(timeString: string): number {
  const [hours, minutes] = timeString.split(':').map(Number);
  return hours * 60 + minutes;
}

/**
 * Convert minutes since midnight to time string (HH:MM)
 */
export function minutesToTime(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;
}

/**
 * Get booking time in specified timezone as HH:MM
 */
export function getTimeInTimezone(date: Date, timezone: string): string {
  // Use Intl.DateTimeFormat for reliable formatting with guaranteed leading zeros
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  });

  const parts = formatter.formatToParts(date);
  const hour = parts.find(p => p.type === 'hour')?.value || '00';
  const minute = parts.find(p => p.type === 'minute')?.value || '00';

  return `${hour}:${minute}`;
}
