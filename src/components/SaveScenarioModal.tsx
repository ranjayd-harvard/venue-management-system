'use client';

interface SaveScenarioModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: () => void;
  scenarioName: string;
  onScenarioNameChange: (name: string) => void;
  scenarioDescription: string;
  onScenarioDescriptionChange: (desc: string) => void;
  enabledLayersCount: number;
  selectedDuration: number;
  isEventBooking: boolean;
  surgeEnabled: boolean;
  activeSurgeConfigName?: string;
  hasPricingCoefficients: boolean;
}

export default function SaveScenarioModal({
  isOpen,
  onClose,
  onSubmit,
  scenarioName,
  onScenarioNameChange,
  scenarioDescription,
  onScenarioDescriptionChange,
  enabledLayersCount,
  selectedDuration,
  isEventBooking,
  surgeEnabled,
  activeSurgeConfigName,
  hasPricingCoefficients,
}: SaveScenarioModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full mx-4 overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-pink-600 to-purple-600 px-6 py-4">
          <h2 className="text-2xl font-bold text-white">Save Scenario</h2>
          <p className="text-pink-100 text-sm mt-1">Save current simulation configuration</p>
        </div>

        {/* Body */}
        <div className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Scenario Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={scenarioName}
              onChange={(e) => onScenarioNameChange(e.target.value)}
              placeholder="e.g., Peak Season Pricing"
              className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl text-black focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all"
              autoFocus
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Description (Optional)
            </label>
            <textarea
              value={scenarioDescription}
              onChange={(e) => onScenarioDescriptionChange(e.target.value)}
              placeholder="Brief description of this scenario..."
              rows={3}
              className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all resize-none"
            />
          </div>

          {/* Summary of what will be saved */}
          <div className="bg-purple-50 border-2 border-purple-200 rounded-xl p-4">
            <p className="text-xs font-semibold text-purple-800 mb-2">What will be saved:</p>
            <div className="grid grid-cols-2 gap-2 text-xs text-purple-700">
              <div>&#10003; {enabledLayersCount} enabled layers</div>
              <div>&#10003; {selectedDuration}h duration</div>
              <div>&#10003; Time window settings</div>
              <div>&#10003; {isEventBooking ? 'Event' : 'Standard'} booking</div>
              {surgeEnabled && activeSurgeConfigName && (
                <div>&#10003; Surge pricing ({activeSurgeConfigName})</div>
              )}
              {hasPricingCoefficients && (
                <div className="col-span-2">&#10003; Pricing coefficients</div>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="bg-gray-50 px-6 py-4 flex justify-end gap-3 border-t border-gray-200">
          <button
            onClick={onClose}
            className="px-6 py-2 rounded-xl font-semibold text-gray-700 hover:bg-gray-200 transition-all"
          >
            Cancel
          </button>
          <button
            onClick={onSubmit}
            disabled={!scenarioName.trim()}
            className="px-6 py-2 bg-gradient-to-r from-pink-600 to-purple-600 text-white rounded-xl font-semibold hover:from-pink-700 hover:to-purple-700 transition-all shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Save Scenario
          </button>
        </div>
      </div>
    </div>
  );
}
