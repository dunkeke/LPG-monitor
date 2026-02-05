import React, { useState, useEffect } from 'react';

/**
 * A simple React dashboard component to display LPG arbitrage metrics.
 *
 * This component fetches PG arbitrage data from the provided API endpoint
 * and renders a table.  It serves as a starting point for the front‑end
 * portion of the LPG market tracking application described in the design
 * report.  You can customize styles using Tailwind CSS or your preferred
 * CSS framework.  Note that the backend API must be running (see
 * lpg_app.py) at the same origin or properly configured for CORS.
 */
export default function LpgDashboard() {
  const [pgArbData, setPgArbData] = useState([]);

  useEffect(() => {
    async function loadData() {
      try {
        // Example payload: replace with real data source or user input
        const payload = [
          { month: 'Apr/2604', PG: 4515, FEI: 520, CP: 523, FX: 6.9236 },
          { month: 'May/2605', PG: 4422, FEI: 512, CP: 523, FX: 6.9236 },
          { month: 'Jun/2606', PG: 4384, FEI: 517, CP: 523, FX: 6.9236 }
        ];
        const response = await fetch('/pg/arbitrage', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        const result = await response.json();
        setPgArbData(result);
      } catch (error) {
        console.error('Failed to load PG arbitrage data', error);
      }
    }
    loadData();
  }, []);

  return (
    <div className="p-6 space-y-4">
      <h1 className="text-2xl font-bold">LPG Arbitrage Dashboard</h1>
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200 text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-2 text-left font-medium text-gray-500">Month</th>
              <th className="px-4 py-2 text-left font-medium text-gray-500">PG/FEI Diff (USD/t)</th>
              <th className="px-4 py-2 text-left font-medium text-gray-500">PG/FEI Arbitrage (¥/t)</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {pgArbData.map((item) => (
              <tr key={item.month}>
                <td className="px-4 py-2 whitespace-nowrap">{item.month}</td>
                <td className="px-4 py-2 whitespace-nowrap">{item.pg_fei_diff_usd}</td>
                <td className="px-4 py-2 whitespace-nowrap">{item.pg_fei_arb}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
