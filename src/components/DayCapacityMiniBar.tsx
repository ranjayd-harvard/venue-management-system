'use client';

/**
 * Mini capacity allocation bar for daily tiles
 * Shows: Allocated (Transient + Events + Reserved) vs Unallocated (Unavailable + ReadyToUse)
 */

interface CapacityBreakdown {
  // Allocated
  transient: number;
  events: number;
  reserved: number;
  // Unallocated
  unavailable: number;
  readyToUse: number;
}

interface DayCapacityMiniBarProps {
  breakdown: CapacityBreakdown;
  totalCapacity: number;
  isClosed?: boolean;
  compact?: boolean;
}

const COLORS = {
  // Allocated colors
  transient: '#14B8A6',    // teal-500
  events: '#EC4899',       // pink-500
  reserved: '#8B5CF6',     // violet-500
  // Unallocated colors
  unavailable: '#9CA3AF',  // gray-400
  readyToUse: '#F59E0B',   // amber-500
};

export default function DayCapacityMiniBar({
  breakdown,
  totalCapacity,
  isClosed = false,
  compact = true,
}: DayCapacityMiniBarProps) {
  // If closed, show 100% unavailable
  if (isClosed || totalCapacity === 0) {
    return (
      <div className="flex flex-col gap-0.5">
        <div className="h-2 rounded-full overflow-hidden bg-gray-200">
          <div
            className="h-full transition-all duration-300"
            style={{ width: '100%', backgroundColor: COLORS.unavailable }}
          />
        </div>
        {!compact && (
          <span className="text-xs text-gray-500">Closed</span>
        )}
      </div>
    );
  }

  // Calculate percentages
  const total = breakdown.transient + breakdown.events + breakdown.reserved + breakdown.unavailable + breakdown.readyToUse;
  const safeTotal = total > 0 ? total : 1;

  const percentages = {
    transient: Math.round((breakdown.transient / safeTotal) * 100),
    events: Math.round((breakdown.events / safeTotal) * 100),
    reserved: Math.round((breakdown.reserved / safeTotal) * 100),
    unavailable: Math.round((breakdown.unavailable / safeTotal) * 100),
    readyToUse: Math.round((breakdown.readyToUse / safeTotal) * 100),
  };

  // Allocated total (transient + events + reserved)
  const allocatedPercent = percentages.transient + percentages.events + percentages.reserved;

  return (
    <div className="flex flex-col gap-0.5">
      {/* Mini stacked bar */}
      <div className="h-2 rounded-full overflow-hidden bg-gray-200 flex">
        {/* Allocated: Transient */}
        {percentages.transient > 0 && (
          <div
            className="h-full transition-all duration-300"
            style={{
              width: `${percentages.transient}%`,
              backgroundColor: COLORS.transient,
            }}
            title={`Transient: ${percentages.transient}%`}
          />
        )}
        {/* Allocated: Events */}
        {percentages.events > 0 && (
          <div
            className="h-full transition-all duration-300"
            style={{
              width: `${percentages.events}%`,
              backgroundColor: COLORS.events,
            }}
            title={`Events: ${percentages.events}%`}
          />
        )}
        {/* Allocated: Reserved */}
        {percentages.reserved > 0 && (
          <div
            className="h-full transition-all duration-300"
            style={{
              width: `${percentages.reserved}%`,
              backgroundColor: COLORS.reserved,
            }}
            title={`Reserved: ${percentages.reserved}%`}
          />
        )}
        {/* Unallocated: Unavailable */}
        {percentages.unavailable > 0 && (
          <div
            className="h-full transition-all duration-300"
            style={{
              width: `${percentages.unavailable}%`,
              backgroundColor: COLORS.unavailable,
            }}
            title={`Unavailable: ${percentages.unavailable}%`}
          />
        )}
        {/* Unallocated: Ready To Use */}
        {percentages.readyToUse > 0 && (
          <div
            className="h-full transition-all duration-300"
            style={{
              width: `${percentages.readyToUse}%`,
              backgroundColor: COLORS.readyToUse,
            }}
            title={`Ready To Use: ${percentages.readyToUse}%`}
          />
        )}
      </div>

      {/* Summary text (non-compact mode) */}
      {!compact && (
        <div className="flex items-center justify-between text-xs">
          <span className="text-teal-600 font-medium">{allocatedPercent}% allocated</span>
          <span className="text-gray-500">{totalCapacity} cap</span>
        </div>
      )}
    </div>
  );
}

// Export for detailed view with legend
export function DayCapacityDetailedView({
  breakdown,
  totalCapacity,
  isClosed = false,
}: DayCapacityMiniBarProps) {
  if (isClosed || totalCapacity === 0) {
    return (
      <div className="bg-gray-50 rounded-lg p-4">
        <div className="text-center text-gray-500">
          <p className="font-medium">Day is closed</p>
          <p className="text-sm">100% Unavailable</p>
        </div>
      </div>
    );
  }

  const total = breakdown.transient + breakdown.events + breakdown.reserved + breakdown.unavailable + breakdown.readyToUse;
  const safeTotal = total > 0 ? total : 1;

  const percentages = {
    transient: Math.round((breakdown.transient / safeTotal) * 100),
    events: Math.round((breakdown.events / safeTotal) * 100),
    reserved: Math.round((breakdown.reserved / safeTotal) * 100),
    unavailable: Math.round((breakdown.unavailable / safeTotal) * 100),
    readyToUse: Math.round((breakdown.readyToUse / safeTotal) * 100),
  };

  const allocated = breakdown.transient + breakdown.events + breakdown.reserved;
  const unallocated = breakdown.unavailable + breakdown.readyToUse;
  const allocatedPercent = percentages.transient + percentages.events + percentages.reserved;
  const unallocatedPercent = percentages.unavailable + percentages.readyToUse;

  return (
    <div className="space-y-4">
      {/* Main stacked bar */}
      <div className="space-y-2">
        <div className="flex justify-between text-sm text-gray-600">
          <span>Capacity Distribution</span>
          <span className="font-medium">{totalCapacity} total</span>
        </div>
        <div className="h-6 rounded-lg overflow-hidden bg-gray-200 flex">
          {percentages.transient > 0 && (
            <div
              className="h-full flex items-center justify-center text-white text-xs font-medium"
              style={{
                width: `${percentages.transient}%`,
                backgroundColor: COLORS.transient,
              }}
            >
              {percentages.transient > 10 && `${percentages.transient}%`}
            </div>
          )}
          {percentages.events > 0 && (
            <div
              className="h-full flex items-center justify-center text-white text-xs font-medium"
              style={{
                width: `${percentages.events}%`,
                backgroundColor: COLORS.events,
              }}
            >
              {percentages.events > 10 && `${percentages.events}%`}
            </div>
          )}
          {percentages.reserved > 0 && (
            <div
              className="h-full flex items-center justify-center text-white text-xs font-medium"
              style={{
                width: `${percentages.reserved}%`,
                backgroundColor: COLORS.reserved,
              }}
            >
              {percentages.reserved > 10 && `${percentages.reserved}%`}
            </div>
          )}
          {percentages.unavailable > 0 && (
            <div
              className="h-full flex items-center justify-center text-white text-xs font-medium"
              style={{
                width: `${percentages.unavailable}%`,
                backgroundColor: COLORS.unavailable,
              }}
            >
              {percentages.unavailable > 10 && `${percentages.unavailable}%`}
            </div>
          )}
          {percentages.readyToUse > 0 && (
            <div
              className="h-full flex items-center justify-center text-white text-xs font-medium"
              style={{
                width: `${percentages.readyToUse}%`,
                backgroundColor: COLORS.readyToUse,
              }}
            >
              {percentages.readyToUse > 10 && `${percentages.readyToUse}%`}
            </div>
          )}
        </div>
      </div>

      {/* Two-column breakdown */}
      <div className="grid grid-cols-2 gap-4">
        {/* Allocated */}
        <div className="bg-teal-50 rounded-lg p-3 border border-teal-200">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-2 h-2 rounded-full bg-teal-500" />
            <span className="text-sm font-semibold text-teal-800">Allocated</span>
            <span className="ml-auto text-sm font-bold text-teal-700">{allocatedPercent}%</span>
          </div>
          <div className="space-y-1.5 text-sm">
            <div className="flex justify-between items-center">
              <span className="flex items-center gap-1.5 text-gray-700">
                <span className="w-2.5 h-2.5 rounded" style={{ backgroundColor: COLORS.transient }} />
                Transient
              </span>
              <span className="font-semibold text-gray-900">{breakdown.transient} ({percentages.transient}%)</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="flex items-center gap-1.5 text-gray-700">
                <span className="w-2.5 h-2.5 rounded" style={{ backgroundColor: COLORS.events }} />
                Events
              </span>
              <span className="font-semibold text-gray-900">{breakdown.events} ({percentages.events}%)</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="flex items-center gap-1.5 text-gray-700">
                <span className="w-2.5 h-2.5 rounded" style={{ backgroundColor: COLORS.reserved }} />
                Reserved
              </span>
              <span className="font-semibold text-gray-900">{breakdown.reserved} ({percentages.reserved}%)</span>
            </div>
          </div>
        </div>

        {/* Unallocated */}
        <div className="bg-amber-50 rounded-lg p-3 border border-amber-200">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-2 h-2 rounded-full bg-amber-500" />
            <span className="text-sm font-semibold text-amber-800">Unallocated</span>
            <span className="ml-auto text-sm font-bold text-amber-700">{unallocatedPercent}%</span>
          </div>
          <div className="space-y-1.5 text-sm">
            <div className="flex justify-between items-center">
              <span className="flex items-center gap-1.5 text-gray-700">
                <span className="w-2.5 h-2.5 rounded" style={{ backgroundColor: COLORS.unavailable }} />
                Unavailable
              </span>
              <span className="font-semibold text-gray-900">{breakdown.unavailable} ({percentages.unavailable}%)</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="flex items-center gap-1.5 text-gray-700">
                <span className="w-2.5 h-2.5 rounded" style={{ backgroundColor: COLORS.readyToUse }} />
                Ready To Use
              </span>
              <span className="font-semibold text-gray-900">{breakdown.readyToUse} ({percentages.readyToUse}%)</span>
            </div>
          </div>
        </div>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-4 justify-center text-xs text-gray-600 pt-2 border-t border-gray-100">
        <span className="flex items-center gap-1">
          <span className="w-3 h-3 rounded" style={{ backgroundColor: COLORS.transient }} />
          Transient
        </span>
        <span className="flex items-center gap-1">
          <span className="w-3 h-3 rounded" style={{ backgroundColor: COLORS.events }} />
          Events
        </span>
        <span className="flex items-center gap-1">
          <span className="w-3 h-3 rounded" style={{ backgroundColor: COLORS.reserved }} />
          Reserved
        </span>
        <span className="flex items-center gap-1">
          <span className="w-3 h-3 rounded" style={{ backgroundColor: COLORS.unavailable }} />
          Unavailable
        </span>
        <span className="flex items-center gap-1">
          <span className="w-3 h-3 rounded" style={{ backgroundColor: COLORS.readyToUse }} />
          Ready To Use
        </span>
      </div>
    </div>
  );
}
