import { NextRequest, NextResponse } from 'next/server';
import { SurgeConfigRepository } from '@/models/SurgeConfig';
import { calculateSurgeFactor, applySurgeToPrice } from '@/lib/surge-pricing-engine';

/**
 * POST: Calculate surge-adjusted pricing for a time range
 *
 * This endpoint:
 * 1. Gets base pricing from existing pricing API
 * 2. Finds active surge config for the sublocation
 * 3. Calculates surge factor using demand/supply parameters
 * 4. Applies surge multiplier to base prices
 * 5. Returns both base and surge-adjusted prices with breakdown
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      subLocationId,
      startTime,
      endTime,
      eventId,
      includeSurge = true
    } = body;

    // Validate required fields
    if (!subLocationId || !startTime || !endTime) {
      return NextResponse.json(
        { error: 'subLocationId, startTime, and endTime are required' },
        { status: 400 }
      );
    }

    const start = new Date(startTime);
    const end = new Date(endTime);

    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      return NextResponse.json(
        { error: 'Invalid date format for startTime or endTime' },
        { status: 400 }
      );
    }

    if (start >= end) {
      return NextResponse.json(
        { error: 'startTime must be before endTime' },
        { status: 400 }
      );
    }

    // Step 1: Get base pricing from existing pricing API
    const basePricingResponse = await fetch(
      new URL('/api/pricing/calculate-hourly', request.url),
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subLocationId,
          startTime,
          endTime,
          eventId
        })
      }
    );

    if (!basePricingResponse.ok) {
      const error = await basePricingResponse.json();
      return NextResponse.json(
        { error: `Failed to calculate base pricing: ${error.error || 'Unknown error'}` },
        { status: basePricingResponse.status }
      );
    }

    const basePricingData = await basePricingResponse.json();

    // If surge is not requested, return base pricing only
    if (!includeSurge) {
      const hourlyBreakdown = basePricingData.segments.map((segment: any) => ({
        hour: new Date(segment.startTime).toISOString(),
        basePrice: segment.pricePerHour,
        surgeMultiplier: 1.0,
        finalPrice: segment.pricePerHour
      }));

      return NextResponse.json({
        basePrice: basePricingData.totalPrice / basePricingData.totalHours,
        surgeMultiplier: 1.0,
        finalPrice: basePricingData.totalPrice / basePricingData.totalHours,
        surgeDetails: {
          surge_factor: 1.0,
          pressure: 0,
          normalized_pressure: 0,
          smoothed_pressure: 0,
          raw_factor: 1.0,
          applied: false
        },
        hourlyBreakdown
      });
    }

    // Step 2: Find active surge config for the sublocation
    const surgeConfig = await SurgeConfigRepository.findActiveBySubLocation(
      subLocationId,
      start // Use start time for checking applicability
    );

    if (!surgeConfig) {
      // No surge config found, return base pricing with neutral multiplier
      const hourlyBreakdown = basePricingData.segments.map((segment: any) => ({
        hour: new Date(segment.startTime).toISOString(),
        basePrice: segment.pricePerHour,
        surgeMultiplier: 1.0,
        finalPrice: segment.pricePerHour
      }));

      return NextResponse.json({
        basePrice: basePricingData.totalPrice / basePricingData.totalHours,
        surgeMultiplier: 1.0,
        finalPrice: basePricingData.totalPrice / basePricingData.totalHours,
        surgeDetails: {
          surge_factor: 1.0,
          pressure: 0,
          normalized_pressure: 0,
          smoothed_pressure: 0,
          raw_factor: 1.0,
          applied: false
        },
        hourlyBreakdown,
        note: 'No active surge configuration found for this sublocation'
      });
    }

    // Step 3: Calculate surge factor
    console.log('🔥 Surge Config Found:', {
      name: surgeConfig.name,
      demand: surgeConfig.demandSupplyParams.currentDemand,
      supply: surgeConfig.demandSupplyParams.currentSupply,
      historicalAvg: surgeConfig.demandSupplyParams.historicalAvgPressure,
      alpha: surgeConfig.surgeParams.alpha,
      minMult: surgeConfig.surgeParams.minMultiplier,
      maxMult: surgeConfig.surgeParams.maxMultiplier,
    });

    const surgeResult = calculateSurgeFactor({
      demand: surgeConfig.demandSupplyParams.currentDemand,
      supply: surgeConfig.demandSupplyParams.currentSupply,
      historicalAvgPressure: surgeConfig.demandSupplyParams.historicalAvgPressure,
      alpha: surgeConfig.surgeParams.alpha,
      minMultiplier: surgeConfig.surgeParams.minMultiplier,
      maxMultiplier: surgeConfig.surgeParams.maxMultiplier,
      emaAlpha: surgeConfig.surgeParams.emaAlpha,
      // For now, we don't have previous smoothed pressure (would require state management)
      previousSmoothedPressure: undefined
    });

    console.log('🔥 Surge Calculation Result:', surgeResult);

    // Step 4: Apply surge to each hourly price
    const hourlyBreakdown = basePricingData.segments.map((segment: any) => {
      const hourTimestamp = new Date(segment.startTime);
      const basePrice = segment.pricePerHour;

      // Check if this hour matches the surge config's time windows
      let surgeFactor = surgeResult.surge_factor;

      // If surge config has time windows, check if this hour matches
      if (surgeConfig.timeWindows && surgeConfig.timeWindows.length > 0) {
        const dayOfWeek = hourTimestamp.getDay();
        const timeStr = `${hourTimestamp.getHours().toString().padStart(2, '0')}:${hourTimestamp.getMinutes().toString().padStart(2, '0')}`;

        const matchesWindow = surgeConfig.timeWindows.some(window => {
          // Check day of week
          if (window.daysOfWeek && window.daysOfWeek.length > 0) {
            if (!window.daysOfWeek.includes(dayOfWeek)) {
              return false;
            }
          }

          // Check time range
          if (window.startTime && window.endTime) {
            if (timeStr < window.startTime || timeStr > window.endTime) {
              return false;
            }
          }

          return true;
        });

        // If hour doesn't match any time window, use neutral multiplier
        if (!matchesWindow) {
          surgeFactor = 1.0;
        }
      }

      const finalPrice = applySurgeToPrice(basePrice, {
        ...surgeResult,
        surge_factor: surgeFactor
      });

      return {
        hour: hourTimestamp.toISOString(),
        basePrice,
        surgeMultiplier: surgeFactor,
        finalPrice
      };
    });

    console.log('🔥 Sample Hourly Breakdown:', hourlyBreakdown.slice(0, 3));

    // Step 5: Calculate averages
    const totalBasePrice = hourlyBreakdown.reduce((sum: number, h: any) => sum + h.basePrice, 0);
    const totalFinalPrice = hourlyBreakdown.reduce((sum: number, h: any) => sum + h.finalPrice, 0);
    const avgSurgeMultiplier = hourlyBreakdown.reduce((sum: number, h: any) => sum + h.surgeMultiplier, 0) / hourlyBreakdown.length;

    return NextResponse.json({
      basePrice: totalBasePrice / hourlyBreakdown.length,
      surgeMultiplier: avgSurgeMultiplier,
      finalPrice: totalFinalPrice / hourlyBreakdown.length,
      surgeDetails: surgeResult,
      hourlyBreakdown,
      surgeConfigName: surgeConfig.name,
      surgeConfigId: surgeConfig._id?.toString()
    });

  } catch (error) {
    console.error('Failed to calculate surge pricing:', error);
    return NextResponse.json(
      { error: 'Failed to calculate surge pricing' },
      { status: 500 }
    );
  }
}
