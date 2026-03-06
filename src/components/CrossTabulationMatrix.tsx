'use client';

import {
  PhysicalStatus,
  CommercialStatus,
  OperationalStatus,
  CrossTabulationResult,
  CrossTabulationCell,
} from '@/models/types';
import OperationalStatusBadge from './OperationalStatusBadge';

interface CrossTabulationMatrixProps {
  crossTabulation: CrossTabulationResult;
  totalCapacity: number;
}

// Color mapping for operational status cells
const opStatusBg: Record<OperationalStatus, string> = {
  [OperationalStatus.SELLABLE]: 'bg-emerald-50 border-emerald-200',
  [OperationalStatus.NON_SELLABLE]: 'bg-gray-50 border-gray-200',
  [OperationalStatus.ATTENTION_REQUIRED]: 'bg-amber-50 border-amber-200',
  [OperationalStatus.BILLING_REQUIRED]: 'bg-red-50 border-red-200',
  [OperationalStatus.OTHER]: 'bg-purple-50 border-purple-200',
};

// Display labels
const physicalLabels: Record<PhysicalStatus, string> = {
  [PhysicalStatus.FREE]: 'Free',
  [PhysicalStatus.OCCUPIED]: 'Occupied',
  [PhysicalStatus.OCCUPIED_UNCONFIRMED]: 'Unconfirmed',
  [PhysicalStatus.UNKNOWN]: 'Unknown',
};

const commercialLabels: Record<CommercialStatus, string> = {
  [CommercialStatus.NONE]: 'None',
  [CommercialStatus.RESERVED_UPCOMING]: 'Upcoming',
  [CommercialStatus.RESERVED_ACTIVE]: 'Active',
  [CommercialStatus.NO_SHOW]: 'No-Show',
  [CommercialStatus.OVERSTAY]: 'Overstay',
};

// Build a lookup map: "physical|commercial" → cell
function buildCellMap(cells: CrossTabulationCell[]): Map<string, CrossTabulationCell> {
  const map = new Map<string, CrossTabulationCell>();
  for (const cell of cells) {
    map.set(`${cell.physicalStatus}|${cell.commercialStatus}`, cell);
  }
  return map;
}

export default function CrossTabulationMatrix({
  crossTabulation,
  totalCapacity,
}: CrossTabulationMatrixProps) {
  const { cells, assumptions } = crossTabulation;
  const cellMap = buildCellMap(cells);

  // Only show rows/cols that have at least one non-zero cell
  const physicalValues = Object.values(PhysicalStatus);
  const commercialValues = Object.values(CommercialStatus);

  const activePhysical = physicalValues.filter((p) =>
    commercialValues.some((c) => {
      const cell = cellMap.get(`${p}|${c}`);
      return cell && cell.count > 0;
    })
  );

  const activeCommercial = commercialValues.filter((c) =>
    physicalValues.some((p) => {
      const cell = cellMap.get(`${p}|${c}`);
      return cell && cell.count > 0;
    })
  );

  // If no active cells, show a message
  if (activePhysical.length === 0 || activeCommercial.length === 0) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <h2 className="text-lg font-bold text-gray-900 mb-4">Cross-Tabulation Matrix</h2>
        <p className="text-gray-500 text-sm">
          No cross-tabulation data available. Set physical status to see the derivation matrix.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
      <h2 className="text-lg font-bold text-gray-900 mb-2">Cross-Tabulation Matrix</h2>
      <p className="text-sm text-gray-500 mb-4">
        Physical (rows) x Commercial (columns) = Operational Status
      </p>

      <div className="overflow-x-auto">
        <table className="w-full border-collapse">
          <thead>
            <tr>
              <th className="p-2 text-left text-xs font-semibold text-gray-500 uppercase border-b">
                Physical \ Commercial
              </th>
              {activeCommercial.map((c) => (
                <th key={c} className="p-2 text-center text-xs font-semibold text-gray-500 uppercase border-b">
                  {commercialLabels[c]}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {activePhysical.map((p) => (
              <tr key={p}>
                <td className="p-2 text-sm font-medium text-gray-700 border-b">
                  {physicalLabels[p]}
                </td>
                {activeCommercial.map((c) => {
                  const cell = cellMap.get(`${p}|${c}`);
                  if (!cell || cell.count === 0) {
                    return (
                      <td key={c} className="p-2 text-center border-b">
                        <span className="text-gray-300 text-sm">—</span>
                      </td>
                    );
                  }
                  const bg = opStatusBg[cell.operationalStatus];
                  return (
                    <td key={c} className={`p-2 text-center border-b`}>
                      <div className={`rounded-lg border p-2 ${bg}`}>
                        <div className="text-lg font-bold text-gray-900">{cell.count}</div>
                        <OperationalStatusBadge status={cell.operationalStatus} size="sm" />
                        <div className="mt-1 text-xs text-gray-500 leading-tight">{cell.reason}</div>
                      </div>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Assumptions */}
      {assumptions.length > 0 && (
        <div className="mt-4 p-3 bg-gray-50 rounded-lg border border-gray-200">
          <p className="text-xs font-semibold text-gray-500 uppercase mb-1">Derivation Assumptions</p>
          <ul className="text-xs text-gray-600 space-y-1">
            {assumptions.map((a, i) => (
              <li key={i} className="flex gap-1">
                <span className="text-gray-400">*</span> {a}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
