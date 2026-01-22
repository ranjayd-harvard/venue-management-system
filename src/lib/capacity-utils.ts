import { CapacityConfig, DailyCapacity, RevenueGoal, HourlyCapacityOverride } from '@/models/types';

/**
 * Capacity & Revenue Goal Utilities
 *
 * This module provides helper functions for managing capacity configurations
 * and revenue goals across entities (Customer, Location, SubLocation, Event).
 */

// Type alias for revenue goal type
export type RevenueGoalType = 'max' | 'allocated' | 'custom';

// ===== INITIALIZATION =====

/**
 * Creates a default capacity configuration
 */
export function createDefaultCapacityConfig(): CapacityConfig {
  return {
    minCapacity: 0,
    maxCapacity: 100,
    dailyCapacities: [],
    revenueGoals: [],
  };
}

/**
 * Initializes capacity config with custom bounds
 */
export function initializeCapacityConfig(
  minCapacity: number = 0,
  maxCapacity: number = 100
): CapacityConfig {
  return {
    minCapacity,
    maxCapacity,
    dailyCapacities: [],
    revenueGoals: [],
  };
}

// ===== VALIDATION =====

/**
 * Validates that capacity value is within bounds
 */
export function isCapacityValid(
  capacity: number,
  minCapacity: number,
  maxCapacity: number
): boolean {
  return capacity >= minCapacity && capacity <= maxCapacity;
}

/**
 * Validates capacity configuration
 */
export function validateCapacityConfig(config: CapacityConfig): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  // Validate bounds
  if (config.minCapacity < 0) {
    errors.push('minCapacity cannot be negative');
  }

  if (config.maxCapacity < config.minCapacity) {
    errors.push('maxCapacity must be greater than or equal to minCapacity');
  }

  // Validate daily capacities
  for (const daily of config.dailyCapacities) {
    if (!isCapacityValid(daily.capacity, config.minCapacity, config.maxCapacity)) {
      errors.push(
        `Daily capacity ${daily.capacity} on ${daily.date} is outside bounds [${config.minCapacity}, ${config.maxCapacity}]`
      );
    }

    // Validate date format (YYYY-MM-DD)
    if (!/^\d{4}-\d{2}-\d{2}$/.test(daily.date)) {
      errors.push(`Invalid date format: ${daily.date}. Expected YYYY-MM-DD`);
    }
  }

  // Validate revenue goals
  for (const goal of config.revenueGoals) {
    // Validate date formats
    if (!/^\d{4}-\d{2}-\d{2}$/.test(goal.startDate)) {
      errors.push(`Invalid startDate format: ${goal.startDate}. Expected YYYY-MM-DD`);
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(goal.endDate)) {
      errors.push(`Invalid endDate format: ${goal.endDate}. Expected YYYY-MM-DD`);
    }

    // Validate date range
    if (goal.startDate > goal.endDate) {
      errors.push(`Revenue goal startDate ${goal.startDate} is after endDate ${goal.endDate}`);
    }

    // Daily goal is required
    if (!goal.dailyGoal) {
      errors.push(`Revenue goal for period ${goal.startDate} to ${goal.endDate} must have a daily goal set`);
    }

    // Validate positive value
    if (goal.dailyGoal !== undefined && goal.dailyGoal < 0) {
      errors.push(`Daily goal cannot be negative: ${goal.dailyGoal}`);
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

// ===== CAPACITY QUERIES =====

/**
 * Gets capacity for a specific date
 * Falls back to maxCapacity if no explicit value is set
 */
export function getCapacityForDate(
  config: CapacityConfig | undefined,
  date: string // YYYY-MM-DD
): number {
  if (!config) {
    return 100; // System default
  }

  // Look for explicit daily capacity
  const dailyCapacity = config.dailyCapacities?.find((dc) => dc.date === date);

  if (dailyCapacity) {
    return dailyCapacity.capacity;
  }

  // Fall back to maxCapacity
  return config.maxCapacity;
}

/**
 * Gets capacities for a date range
 */
export function getCapacitiesForDateRange(
  config: CapacityConfig | undefined,
  startDate: string, // YYYY-MM-DD
  endDate: string    // YYYY-MM-DD
): { date: string; capacity: number }[] {
  if (!config) {
    return [];
  }

  const result: { date: string; capacity: number }[] = [];
  const start = new Date(startDate);
  const end = new Date(endDate);

  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    const dateStr = d.toISOString().split('T')[0];
    result.push({
      date: dateStr,
      capacity: getCapacityForDate(config, dateStr),
    });
  }

  return result;
}

/**
 * Sets capacity for a specific date
 */
export function setCapacityForDate(
  config: CapacityConfig,
  date: string,
  capacity: number
): CapacityConfig {
  // Ensure dailyCapacities array exists
  if (!config.dailyCapacities) {
    config.dailyCapacities = [];
  }

  // Validate capacity is within bounds
  if (!isCapacityValid(capacity, config.minCapacity, config.maxCapacity)) {
    throw new Error(
      `Capacity ${capacity} is outside bounds [${config.minCapacity}, ${config.maxCapacity}]`
    );
  }

  // Find existing entry
  const existingIndex = config.dailyCapacities.findIndex((dc) => dc.date === date);

  if (existingIndex >= 0) {
    // Update existing
    config.dailyCapacities[existingIndex].capacity = capacity;
  } else {
    // Add new
    config.dailyCapacities.push({ date, capacity });
    // Sort by date
    config.dailyCapacities.sort((a, b) => a.date.localeCompare(b.date));
  }

  return config;
}

/**
 * Sets capacity for a date range
 */
export function setCapacityForDateRange(
  config: CapacityConfig,
  startDate: string,
  endDate: string,
  capacity: number
): CapacityConfig {
  const start = new Date(startDate);
  const end = new Date(endDate);

  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    const dateStr = d.toISOString().split('T')[0];
    setCapacityForDate(config, dateStr, capacity);
  }

  return config;
}

/**
 * Removes capacity override for a specific date (will fall back to maxCapacity)
 */
export function removeCapacityForDate(
  config: CapacityConfig,
  date: string
): CapacityConfig {
  if (config.dailyCapacities) {
    config.dailyCapacities = config.dailyCapacities.filter((dc) => dc.date !== date);
  }
  return config;
}

// ===== REVENUE GOAL QUERIES =====

/**
 * Gets revenue goals for a specific date
 */
export function getRevenueGoalsForDate(
  config: CapacityConfig | undefined,
  date: string // YYYY-MM-DD
): RevenueGoal | undefined {
  if (!config || !config.revenueGoals) {
    return undefined;
  }

  // Find goal that encompasses this date
  return config.revenueGoals.find(
    (goal) => goal.startDate <= date && goal.endDate >= date
  );
}

/**
 * Adds or updates a revenue goal for a date range
 */
export function setRevenueGoal(
  config: CapacityConfig,
  startDate: string,
  endDate: string,
  dailyGoal: number,
  weeklyGoal?: number,
  monthlyGoal?: number,
  revenueGoalType?: RevenueGoalType
): CapacityConfig {
  // Ensure revenueGoals array exists
  if (!config.revenueGoals) {
    config.revenueGoals = [];
  }

  // Validate daily goal is set
  if (dailyGoal === undefined || dailyGoal <= 0) {
    throw new Error('Daily goal must be set and greater than 0');
  }

  // Validate date range
  if (startDate > endDate) {
    throw new Error('startDate must be before or equal to endDate');
  }

  // Remove any overlapping goals
  config.revenueGoals = config.revenueGoals.filter(
    (goal) => goal.endDate < startDate || goal.startDate > endDate
  );

  // Add new goal
  const newGoal: RevenueGoal = {
    startDate,
    endDate,
    dailyGoal,
    ...(weeklyGoal && { weeklyGoal }),
    ...(monthlyGoal && { monthlyGoal }),
    ...(revenueGoalType && { revenueGoalType }),
  };

  config.revenueGoals.push(newGoal);

  // Sort by startDate
  config.revenueGoals.sort((a, b) => a.startDate.localeCompare(b.startDate));

  return config;
}

/**
 * Removes revenue goal for a specific date range
 */
export function removeRevenueGoal(
  config: CapacityConfig,
  startDate: string,
  endDate: string
): CapacityConfig {
  if (config.revenueGoals) {
    config.revenueGoals = config.revenueGoals.filter(
      (goal) => !(goal.startDate === startDate && goal.endDate === endDate)
    );
  }
  return config;
}

// ===== AGGREGATION HELPERS =====

/**
 * Calculates total capacity across multiple entities for a specific date
 */
export function aggregateCapacityForDate(
  configs: (CapacityConfig | undefined)[],
  date: string
): number {
  return configs.reduce((total, config) => {
    return total + getCapacityForDate(config, date);
  }, 0);
}

/**
 * Calculates total revenue goals across multiple entities
 */
export function aggregateRevenueGoals(
  configs: (CapacityConfig | undefined)[],
  date: string
): {
  dailyGoal: number;
  weeklyGoal: number;
  monthlyGoal: number;
} {
  const result = {
    dailyGoal: 0,
    weeklyGoal: 0,
    monthlyGoal: 0,
  };

  for (const config of configs) {
    const goals = getRevenueGoalsForDate(config, date);
    if (goals) {
      result.dailyGoal += goals.dailyGoal || 0;
      result.weeklyGoal += goals.weeklyGoal || 0;
      result.monthlyGoal += goals.monthlyGoal || 0;
    }
  }

  return result;
}

// ===== REVENUE GOAL CALCULATIONS =====

/**
 * Calculates default daily revenue goal for a sublocation
 * Formula: Average Hourly Rate × Capacity × Hours per Day
 */
export function calculateDefaultDailyGoal(
  hourlyRate: number,
  capacity: number,
  hoursPerDay: number = 24
): number {
  return hourlyRate * capacity * hoursPerDay;
}

/**
 * Gets the calculated default daily goal for a sublocation on a specific date
 * Returns null if sublocation doesn't have defaultHourlyRate
 */
export function getCalculatedDailyGoal(
  sublocation: { defaultHourlyRate?: number; capacityConfig?: CapacityConfig },
  date: string
): number | null {
  if (!sublocation.defaultHourlyRate) {
    return null;
  }

  const capacity = getCapacityForDate(sublocation.capacityConfig, date);
  const hoursPerDay = sublocation.capacityConfig?.hoursPerDay || 24;

  return calculateDefaultDailyGoal(sublocation.defaultHourlyRate, capacity, hoursPerDay);
}

// ===== AGGREGATED GOAL CALCULATIONS =====

/**
 * Calculates total revenue goals for a week
 * Week is defined as Sunday through Saturday containing the given date
 *
 * @param config - Capacity configuration
 * @param referenceDate - YYYY-MM-DD date string
 * @param options - Optional parameters for including calculated goals
 * @returns Object with setGoals, calculatedGoals, and total
 */
export function getWeeklyGoalTotal(
  config: CapacityConfig | undefined,
  referenceDate: string, // YYYY-MM-DD
  options?: {
    includeCalculated?: boolean;
    hourlyRate?: number;
    dayCells?: Array<{
      dateStr: string;
      revenueGoal?: { dailyGoal?: number };
      hourlyBreakdown?: Array<{ allocatedCapacity: number }>;
    }>;
  }
): { setGoals: number; calculatedGoals: number; total: number; daysWithSetGoals: number; daysCalculated: number } {
  if (!config) {
    return { setGoals: 0, calculatedGoals: 0, total: 0, daysWithSetGoals: 0, daysCalculated: 0 };
  }

  const date = new Date(referenceDate);
  const dayOfWeek = date.getDay(); // 0 = Sunday, 6 = Saturday

  // Calculate week start (Sunday) and end (Saturday)
  const weekStart = new Date(date);
  weekStart.setDate(date.getDate() - dayOfWeek);
  const weekStartStr = weekStart.toISOString().split('T')[0];

  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate() + 6);
  const weekEndStr = weekEnd.toISOString().split('T')[0];

  let setGoals = 0;
  let calculatedGoals = 0;
  let daysWithSetGoals = 0;
  let daysCalculated = 0;

  // Iterate through each day in the week
  for (let d = new Date(weekStart); d <= weekEnd; d.setDate(d.getDate() + 1)) {
    const dateStr = d.toISOString().split('T')[0];

    // Check if there's a set revenue goal
    const goal = getRevenueGoalsForDate(config, dateStr);
    if (goal && goal.dailyGoal) {
      setGoals += goal.dailyGoal;
      daysWithSetGoals++;
    } else if (options?.includeCalculated && options.hourlyRate && options.dayCells) {
      // Calculate from allocated capacity if no goal is set
      const cell = options.dayCells.find(c => c.dateStr === dateStr);
      if (cell?.hourlyBreakdown) {
        const totalAllocated = cell.hourlyBreakdown.reduce((sum, seg) => sum + seg.allocatedCapacity, 0);
        const allocatedGoal = Math.round(options.hourlyRate * totalAllocated);
        if (allocatedGoal > 0) {
          calculatedGoals += allocatedGoal;
          daysCalculated++;
        }
      }
    }
  }

  return {
    setGoals,
    calculatedGoals,
    total: setGoals + calculatedGoals,
    daysWithSetGoals,
    daysCalculated
  };
}

/**
 * Calculates total revenue goals for a month
 *
 * @param config - Capacity configuration
 * @param referenceDate - YYYY-MM-DD date string
 * @param options - Optional parameters for including calculated goals
 * @returns Object with setGoals, calculatedGoals, and total
 */
export function getMonthlyGoalTotal(
  config: CapacityConfig | undefined,
  referenceDate: string, // YYYY-MM-DD
  options?: {
    includeCalculated?: boolean;
    hourlyRate?: number;
    dayCells?: Array<{
      dateStr: string;
      revenueGoal?: { dailyGoal?: number };
      hourlyBreakdown?: Array<{ allocatedCapacity: number }>;
    }>;
  }
): { setGoals: number; calculatedGoals: number; total: number; daysWithSetGoals: number; daysCalculated: number } {
  if (!config) {
    return { setGoals: 0, calculatedGoals: 0, total: 0, daysWithSetGoals: 0, daysCalculated: 0 };
  }

  const date = new Date(referenceDate);
  const year = date.getFullYear();
  const month = date.getMonth();

  // First day of month
  const monthStart = new Date(year, month, 1);
  const monthStartStr = monthStart.toISOString().split('T')[0];

  // Last day of month
  const monthEnd = new Date(year, month + 1, 0);
  const monthEndStr = monthEnd.toISOString().split('T')[0];

  let setGoals = 0;
  let calculatedGoals = 0;
  let daysWithSetGoals = 0;
  let daysCalculated = 0;

  // Iterate through each day in the month
  for (let d = new Date(monthStart); d <= monthEnd; d.setDate(d.getDate() + 1)) {
    const dateStr = d.toISOString().split('T')[0];

    // Check if there's a set revenue goal
    const goal = getRevenueGoalsForDate(config, dateStr);
    if (goal && goal.dailyGoal) {
      setGoals += goal.dailyGoal;
      daysWithSetGoals++;
    } else if (options?.includeCalculated && options.hourlyRate && options.dayCells) {
      // Calculate from allocated capacity if no goal is set
      const cell = options.dayCells.find(c => c.dateStr === dateStr);
      if (cell?.hourlyBreakdown) {
        const totalAllocated = cell.hourlyBreakdown.reduce((sum, seg) => sum + seg.allocatedCapacity, 0);
        const allocatedGoal = Math.round(options.hourlyRate * totalAllocated);
        if (allocatedGoal > 0) {
          calculatedGoals += allocatedGoal;
          daysCalculated++;
        }
      }
    }
  }

  return {
    setGoals,
    calculatedGoals,
    total: setGoals + calculatedGoals,
    daysWithSetGoals,
    daysCalculated
  };
}

/**
 * Calculates occupancy percentage for a month based on allocated capacity
 * Occupancy = (Sum of daily allocated capacities / Sum of daily max capacities) × 100
 *
 * This represents how much of the max capacity is being allocated/planned
 *
 * @param entity - Entity with capacity config (or just the config)
 * @param referenceDate - YYYY-MM-DD date string
 * @param dayCells - Optional pre-computed day cells with hourly breakdowns for accurate calculation
 * @returns Occupancy percentage (0-100)
 */
export function getMonthlyOccupancyPercentage(
  entity: {
    defaultHourlyRate?: number;
    capacityConfig?: CapacityConfig;
  },
  referenceDate: string, // YYYY-MM-DD
  dayCells?: Array<{
    dateStr: string;
    hourlyBreakdown?: Array<{ maxCapacity: number; allocatedCapacity: number }>;
  }>
): number {
  if (!entity.capacityConfig) {
    return 0;
  }

  const date = new Date(referenceDate);
  const year = date.getFullYear();
  const month = date.getMonth();

  // Calculate days in month
  const monthStart = new Date(year, month, 1);
  const monthEnd = new Date(year, month + 1, 0);

  let totalAllocated = 0;
  let totalMax = 0;

  // If dayCells are provided, use hourly breakdowns for accurate calculation
  if (dayCells && dayCells.length > 0) {
    for (let d = new Date(monthStart); d <= monthEnd; d.setDate(d.getDate() + 1)) {
      const dateStr = d.toISOString().split('T')[0];
      const cell = dayCells.find(c => c.dateStr === dateStr);

      if (cell?.hourlyBreakdown) {
        const dayMax = cell.hourlyBreakdown.reduce((sum, seg) => sum + seg.maxCapacity, 0);
        const dayAllocated = cell.hourlyBreakdown.reduce((sum, seg) => sum + seg.allocatedCapacity, 0);
        totalMax += dayMax;
        totalAllocated += dayAllocated;
      }
    }
  } else {
    // Fallback: use simple capacity values
    const maxCapacity = entity.capacityConfig.maxCapacity || 0;
    const daysInMonth = monthEnd.getDate();

    if (maxCapacity === 0) {
      return 0;
    }

    for (let d = new Date(monthStart); d <= monthEnd; d.setDate(d.getDate() + 1)) {
      const dateStr = d.toISOString().split('T')[0];
      const capacity = getCapacityForDate(entity.capacityConfig, dateStr);
      totalAllocated += capacity;
    }

    totalMax = maxCapacity * daysInMonth;
  }

  if (totalMax === 0) {
    return 0;
  }

  // Calculate percentage: allocated vs max
  const percentage = (totalAllocated / totalMax) * 100;

  return Math.min(Math.round(percentage), 100); // Cap at 100%
}

// ===== DATE UTILITIES =====

/**
 * Formats a Date object to YYYY-MM-DD string
 */
export function formatDateToISO(date: Date): string {
  return date.toISOString().split('T')[0];
}

/**
 * Gets today's date as YYYY-MM-DD string
 */
export function getTodayISO(): string {
  return formatDateToISO(new Date());
}

/**
 * Parses YYYY-MM-DD string to Date object
 */
export function parseISODate(dateStr: string): Date {
  return new Date(dateStr + 'T00:00:00.000Z');
}

// ===== HOURLY CAPACITY UTILITIES =====

/**
 * Gets hourly capacity override for a specific date and hour
 */
export function getHourlyCapacityOverride(
  config: CapacityConfig | undefined,
  date: string, // YYYY-MM-DD
  hour: number  // 0-23
): HourlyCapacityOverride | undefined {
  if (!config || !config.hourlyCapacities) {
    return undefined;
  }

  return config.hourlyCapacities.find(
    (hc) => hc.date === date && hc.hour === hour
  );
}

/**
 * Sets hourly capacity override for a specific date and hour
 */
export function setHourlyCapacityOverride(
  config: CapacityConfig,
  date: string, // YYYY-MM-DD
  hour: number, // 0-23
  override: Partial<Omit<HourlyCapacityOverride, 'date' | 'hour'>>
): CapacityConfig {
  // Ensure hourlyCapacities array exists
  if (!config.hourlyCapacities) {
    config.hourlyCapacities = [];
  }

  // Validate hour range
  if (hour < 0 || hour > 23) {
    throw new Error(`Hour must be between 0 and 23, got ${hour}`);
  }

  // Find existing entry
  const existingIndex = config.hourlyCapacities.findIndex(
    (hc) => hc.date === date && hc.hour === hour
  );

  if (existingIndex >= 0) {
    // Update existing - merge with existing values
    config.hourlyCapacities[existingIndex] = {
      ...config.hourlyCapacities[existingIndex],
      ...override
    };
  } else {
    // Add new
    config.hourlyCapacities.push({ date, hour, ...override });
    // Sort by date, then hour
    config.hourlyCapacities.sort((a, b) => {
      const dateCompare = a.date.localeCompare(b.date);
      return dateCompare !== 0 ? dateCompare : a.hour - b.hour;
    });
  }

  return config;
}

/**
 * Removes hourly capacity override for a specific date and hour
 */
export function removeHourlyCapacityOverride(
  config: CapacityConfig,
  date: string,
  hour: number
): CapacityConfig {
  if (config.hourlyCapacities) {
    config.hourlyCapacities = config.hourlyCapacities.filter(
      (hc) => !(hc.date === date && hc.hour === hour)
    );
  }
  return config;
}

/**
 * Removes all hourly capacity overrides for a specific date
 */
export function removeAllHourlyCapacityOverridesForDate(
  config: CapacityConfig,
  date: string
): CapacityConfig {
  if (config.hourlyCapacities) {
    config.hourlyCapacities = config.hourlyCapacities.filter(
      (hc) => hc.date !== date
    );
  }
  return config;
}

/**
 * Gets all hourly capacity overrides for a specific date
 */
export function getHourlyCapacityOverridesForDate(
  config: CapacityConfig | undefined,
  date: string
): HourlyCapacityOverride[] {
  if (!config || !config.hourlyCapacities) {
    return [];
  }

  return config.hourlyCapacities
    .filter((hc) => hc.date === date)
    .sort((a, b) => a.hour - b.hour);
}
