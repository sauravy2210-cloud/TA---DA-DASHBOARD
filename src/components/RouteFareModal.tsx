import { useEffect, useState } from 'react';
import { estimateRoute, type RouteEstimate } from '../lib/routeFareEstimator';

interface RouteFareModalProps {
  from: string;
  to: string;
  onClose: () => void;
}

const RouteFareModal = ({ from, to, onClose }: RouteFareModalProps) => {
  const [loading, setLoading] = useState(true);
  const [estimate, setEstimate] = useState<RouteEstimate | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setFailed(false);
    estimateRoute(from, to)
      .then(res => {
        if (cancelled) return;
        if (!res) setFailed(true);
        else setEstimate(res);
      })
      .catch(() => { if (!cancelled) setFailed(true); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [from, to]);

  const mapsUrl = estimate?.mapsUrl ?? `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(from)}&destination=${encodeURIComponent(to)}&travelmode=driving`;
  const embedUrl = estimate?.embedUrl ?? `https://www.google.com/maps?saddr=${encodeURIComponent(from)}&daddr=${encodeURIComponent(to)}&output=embed`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm" onClick={onClose}>
      <div className="relative bg-white rounded-2xl shadow-2xl max-w-3xl w-full mx-4 max-h-[90vh] flex flex-col overflow-hidden" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-gray-200 bg-gray-50 rounded-t-2xl">
          <div className="min-w-0">
            <span className="text-sm font-semibold text-gray-800">🗺️ Route & Fare Estimate</span>
            <p className="text-[11px] text-gray-500 truncate max-w-[520px]" title={`${from} → ${to}`}>{from} <span className="text-gray-400">→</span> {to}</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700 transition-colors p-1 shrink-0">
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto bg-gray-50">
          {/* Map embed */}
          <div className="relative bg-gray-200" style={{ height: '260px' }}>
            <iframe
              title="Route map"
              src={embedUrl}
              className="w-full h-full border-0"
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
            />
          </div>

          <div className="px-5 py-4 space-y-4">
            <a
              href={mapsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold transition-colors"
            >
              ↗ Open live directions in Google Maps
            </a>

            {loading && (
              <div className="flex items-center gap-2 text-sm text-gray-500 py-6 justify-center">
                <svg className="animate-spin h-4 w-4 text-indigo-500" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
                </svg>
                Calculating route & fare estimates…
              </div>
            )}

            {!loading && failed && (
              <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2.5">
                Couldn't auto-locate one of these addresses to compute distance. Use "Open live directions in Google Maps"
                above to verify the route and fare manually.
              </p>
            )}

            {!loading && estimate && (
              <>
                <div className="flex flex-wrap gap-3 text-xs">
                  <span className="px-2.5 py-1 rounded-full bg-indigo-50 border border-indigo-100 text-indigo-700 font-semibold">
                    📏 {estimate.distanceKm.toFixed(1)} km
                  </span>
                  <span className="px-2.5 py-1 rounded-full bg-teal-50 border border-teal-100 text-teal-800 font-semibold">
                    ⏱ ~{Math.round(estimate.durationMin)} min by road
                  </span>
                  <span className="px-2.5 py-1 rounded-full bg-purple-50 border border-purple-100 text-purple-700 font-semibold">
                    {estimate.contextLabel}
                  </span>
                </div>

                <div className="overflow-x-auto border border-gray-200 rounded-lg">
                  <table className="min-w-full text-xs">
                    <thead className="bg-gray-100 border-b border-gray-200">
                      <tr>
                        {['Transport', 'Approx. Fare', 'Time', 'Notes'].map(h => (
                          <th key={h} className="px-3 py-2 text-left text-gray-500 font-semibold whitespace-nowrap text-[11px]">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 bg-white">
                      {estimate.fareOptions.map(opt => (
                        <tr key={opt.mode} className="hover:bg-indigo-50/30">
                          <td className="px-3 py-2 font-semibold text-gray-800 whitespace-nowrap">{opt.icon} {opt.mode}</td>
                          <td className="px-3 py-2 font-semibold text-green-700 whitespace-nowrap">{opt.fareLabel}</td>
                          <td className="px-3 py-2 text-gray-600 whitespace-nowrap">{opt.etaLabel}</td>
                          <td className="px-3 py-2 text-gray-400 text-[11px]">{opt.note ?? '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <p className="text-[10px] text-gray-400">
                  Fares are estimates from published rate cards for a sanity check while reviewing the submitted bill —
                  not live pricing. Distance/route via OpenStreetMap; use the Google Maps link for live transit lines & pricing.
                </p>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default RouteFareModal;
