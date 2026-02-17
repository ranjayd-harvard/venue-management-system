/**
 * Time Window Alignment Validation
 *
 * The pricing/capacity engines evaluate time windows against full-hour boundaries only.
 * This utility detects non-aligned windows and dead zones to warn users in the UI.
 */

export interface TimeWindowAlignmentResult {
  isAligned: boolean;
  isDeadZone: boolean;
  effectiveHours: string[];
  warningMessage: string;
}

function timeToMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
}

function formatHour(hour: number): string {
  const period = hour < 12 ? 'AM' : 'PM';
  const h = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
  return `${h}:00 ${period}`;
}

export function analyzeTimeWindowAlignment(
  startTime: string | undefined,
  endTime: string | undefined
): TimeWindowAlignmentResult | null {
  if (!startTime || !endTime) return null;

  const startMinutes = timeToMinutes(startTime);
  const endMinutes = timeToMinutes(endTime);

  const startOnHour = startMinutes % 60 === 0;
  const endOnHour = endMinutes % 60 === 0;

  if (startOnHour && endOnHour) {
    return { isAligned: true, isDeadZone: false, effectiveHours: [], warningMessage: '' };
  }

  // Simulate the engine's matching: iterate all 24 hour boundaries
  const isOvernight = endMinutes <= startMinutes;
  const effectiveHours: string[] = [];

  for (let hour = 0; hour < 24; hour++) {
    const hourMinutes = hour * 60;
    let matches: boolean;

    if (isOvernight) {
      matches = hourMinutes >= startMinutes || hourMinutes < endMinutes;
    } else {
      matches = hourMinutes >= startMinutes && hourMinutes < endMinutes;
    }

    if (matches) {
      effectiveHours.push(formatHour(hour));
    }
  }

  const isDeadZone = effectiveHours.length === 0;

  let warningMessage: string;
  if (isDeadZone) {
    warningMessage = `This window (${startTime}–${endTime}) won't match any hourly slot. The engine evaluates at hour boundaries (:00). Consider adjusting to align with hour boundaries.`;
  } else {
    warningMessage = `This window (${startTime}–${endTime}) doesn't align to hour boundaries. Effective coverage: ${effectiveHours.join(', ')}.`;
  }

  return { isAligned: false, isDeadZone, effectiveHours, warningMessage };
}
