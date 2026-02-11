/**
 * Surge Pricing Engine
 *
 * Calculates dynamic surge pricing multipliers based on demand/supply pressure.
 * Uses exponential moving average (EMA) smoothing to prevent rapid price fluctuations.
 *
 * Formula:
 *   pressure = demand / supply
 *   normalized_pressure = pressure / historical_avg_pressure
 *   smoothed_pressure = EMA(normalized_pressure)
 *   surge_factor = 1 + α * log(smoothed_pressure)
 *   surge_factor = clamp(surge_factor, minMultiplier, maxMultiplier)
 */

export interface SurgeCalculationParams {
  demand: number;
  supply: number;
  historicalAvgPressure: number;
  alpha: number;  // Sensitivity coefficient (e.g., 0.3)
  minMultiplier: number;  // Floor (e.g., 0.75)
  maxMultiplier: number;  // Ceiling (e.g., 1.8)
  previousSmoothedPressure?: number;  // For EMA continuation
  emaAlpha: number;  // EMA smoothing factor (e.g., 0.3)
}

export interface SurgeCalculationResult {
  surge_factor: number;           // Final multiplier (clamped)
  pressure: number;               // demand / supply
  normalized_pressure: number;    // pressure / historical_avg
  smoothed_pressure: number;      // EMA of normalized
  raw_factor: number;             // Before clamping
  applied: boolean;               // Whether surge was successfully calculated
}

/**
 * Calculate surge pricing factor based on demand/supply dynamics
 *
 * @param params - Demand, supply, and surge configuration parameters
 * @returns Detailed surge calculation result with breakdown
 */
export function calculateSurgeFactor(params: SurgeCalculationParams): SurgeCalculationResult {
  // Validation: prevent division by zero
  if (params.supply === 0) {
    console.warn('Surge calculation: supply is zero, returning neutral factor');
    return {
      surge_factor: 1.0,
      pressure: 0,
      normalized_pressure: 0,
      smoothed_pressure: 0,
      raw_factor: 1.0,
      applied: false
    };
  }

  if (params.historicalAvgPressure === 0) {
    console.warn('Surge calculation: historicalAvgPressure is zero, using pressure directly');
    params.historicalAvgPressure = 1.0;  // Fallback to neutral
  }

  // Step 1: Calculate current pressure ratio
  const pressure = params.demand / params.supply;

  // Step 2: Normalize against historical average
  const normalized_pressure = pressure / params.historicalAvgPressure;

  // Step 3: Apply EMA smoothing
  // EMA formula: smoothed[t] = α * value[t] + (1-α) * smoothed[t-1]
  const smoothed_pressure = params.previousSmoothedPressure !== undefined
    ? params.emaAlpha * normalized_pressure + (1 - params.emaAlpha) * params.previousSmoothedPressure
    : normalized_pressure;  // First calculation, no history

  // Step 4: Calculate surge factor using logarithmic sensitivity
  // Using natural logarithm to provide diminishing returns at high pressure
  const raw_factor = 1 + params.alpha * Math.log(smoothed_pressure);

  // Step 5: Clamp to configured min/max bounds
  const surge_factor = Math.max(
    params.minMultiplier,
    Math.min(params.maxMultiplier, raw_factor)
  );

  return {
    surge_factor,
    pressure,
    normalized_pressure,
    smoothed_pressure,
    raw_factor,
    applied: true
  };
}

/**
 * Apply surge multiplier to a base price
 *
 * @param basePrice - The original price before surge
 * @param surgeResult - Result from calculateSurgeFactor()
 * @returns The surge-adjusted price
 */
export function applySurgeToPrice(
  basePrice: number,
  surgeResult: SurgeCalculationResult
): number {
  if (!surgeResult.applied) {
    return basePrice;
  }

  return basePrice * surgeResult.surge_factor;
}

/**
 * Format surge calculation for display/debugging
 *
 * @param result - Surge calculation result
 * @returns Human-readable string representation
 */
export function formatSurgeCalculation(result: SurgeCalculationResult): string {
  return `
Surge Calculation:
  Pressure: ${result.pressure.toFixed(4)}
  Normalized: ${result.normalized_pressure.toFixed(4)}
  Smoothed (EMA): ${result.smoothed_pressure.toFixed(4)}
  Raw Factor: ${result.raw_factor.toFixed(4)}
  Final Multiplier: ${result.surge_factor.toFixed(4)}x
  Applied: ${result.applied}
  `.trim();
}
