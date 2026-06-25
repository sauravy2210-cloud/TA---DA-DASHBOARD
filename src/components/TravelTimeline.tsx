import React, { useMemo } from 'react';
import { Plane, Train, Bus, Car, AlertTriangle, MapPin, ArrowRight, Calendar, Clock, Hash } from 'lucide-react';
import type { TravelLeg, TravelMode } from '../types';

interface TravelTimelineProps {
  travelLegs: TravelLeg[];
  showContinuityCheck?: boolean;
}

function ModeIcon({ mode, className }: { mode: TravelMode; className?: string }) {
  const cls = className ?? 'w-5 h-5';
  switch (mode) {
    case 'Flight': return <Plane className={cls} />;
    case 'Train': return <Train className={cls} />;
    case 'Bus': return <Bus className={cls} />;
    case 'Cab':
    case 'Own Vehicle': return <Car className={cls} />;
    default: return <Car className={cls} />;
  }
}

function modeBg(mode: TravelMode): string {
  switch (mode) {
    case 'Flight': return 'bg-blue-100 text-blue-700 border-blue-300';
    case 'Train': return 'bg-purple-100 text-purple-700 border-purple-300';
    case 'Bus': return 'bg-green-100 text-green-700 border-green-300';
    case 'Cab':
    case 'Own Vehicle': return 'bg-amber-100 text-amber-700 border-amber-300';
    default: return 'bg-gray-100 text-gray-700 border-gray-300';
  }
}

function modeCircleBg(mode: TravelMode): string {
  switch (mode) {
    case 'Flight': return 'bg-blue-600';
    case 'Train': return 'bg-purple-600';
    case 'Bus': return 'bg-green-600';
    case 'Cab':
    case 'Own Vehicle': return 'bg-amber-500';
    default: return 'bg-gray-500';
  }
}

function formatDate(dateStr: string): string {
  try {
    return new Date(dateStr).toLocaleDateString('en-IN', {
      day: '2-digit', month: 'short', year: 'numeric',
    });
  } catch {
    return dateStr;
  }
}

function formatINR(amount: number): string {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(amount);
}

export const TravelTimeline: React.FC<TravelTimelineProps> = ({
  travelLegs,
  showContinuityCheck = true,
}) => {
  const sorted = useMemo(
    () => [...travelLegs].sort((a, b) => {
      const da = a.departureDate + a.departureTime;
      const db = b.departureDate + b.departureTime;
      return da.localeCompare(db);
    }),
    [travelLegs],
  );

  const continuityWarnings = useMemo(() => {
    if (!showContinuityCheck) return [];
    const warnings: { index: number; prevTo: string; nextFrom: string }[] = [];
    for (let i = 0; i < sorted.length - 1; i++) {
      const current = sorted[i];
      const next = sorted[i + 1];
      if (current.to.trim().toLowerCase() !== next.from.trim().toLowerCase()) {
        warnings.push({ index: i, prevTo: current.to, nextFrom: next.from });
      }
    }
    return warnings;
  }, [sorted, showContinuityCheck]);

  const totalFare = useMemo(() => sorted.reduce((sum, l) => sum + l.fare, 0), [sorted]);

  if (sorted.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-gray-400 bg-gray-50 rounded-xl border border-dashed border-gray-300">
        <MapPin className="w-10 h-10 mb-3 opacity-40" />
        <p className="text-sm font-medium">No travel legs recorded</p>
      </div>
    );
  }

  const cities = [sorted[0].from, ...sorted.map((l) => l.to)];
  const uniqueCities = Array.from(new Set(cities));

  return (
    <div className="space-y-4">
      {/* Header stats */}
      <div className="flex flex-wrap gap-3 mb-2">
        <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm">
          <MapPin className="w-4 h-4 text-indigo-500" />
          <span className="text-gray-500">Cities:</span>
          <span className="font-semibold text-gray-800">{uniqueCities.join(' → ')}</span>
        </div>
        <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm">
          <ArrowRight className="w-4 h-4 text-indigo-500" />
          <span className="text-gray-500">Legs:</span>
          <span className="font-semibold text-gray-800">{sorted.length}</span>
        </div>
        <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm">
          <span className="text-gray-500">Total Fare:</span>
          <span className="font-semibold text-gray-800">{formatINR(totalFare)}</span>
        </div>
        {continuityWarnings.length > 0 && (
          <div className="flex items-center gap-2 bg-red-50 border border-red-300 rounded-lg px-3 py-2 text-sm text-red-700">
            <AlertTriangle className="w-4 h-4" />
            <span>{continuityWarnings.length} continuity issue{continuityWarnings.length > 1 ? 's' : ''} detected</span>
          </div>
        )}
      </div>

      {/* Timeline */}
      <div className="relative">
        {sorted.map((leg, index) => {
          const hasWarningAfter = continuityWarnings.some((w) => w.index === index);
          const isLast = index === sorted.length - 1;

          return (
            <React.Fragment key={leg.legId}>
              {/* Leg card */}
              <div className="flex gap-4">
                {/* Left: connector line + mode circle */}
                <div className="flex flex-col items-center">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white flex-shrink-0 shadow-sm ${modeCircleBg(leg.mode)}`}>
                    <ModeIcon mode={leg.mode} className="w-5 h-5" />
                  </div>
                  {!isLast && !hasWarningAfter && (
                    <div className="w-0.5 bg-gray-200 flex-1 min-h-[2rem] mt-1" />
                  )}
                  {!isLast && hasWarningAfter && (
                    <div className="w-0.5 bg-red-300 flex-1 min-h-[2rem] mt-1" />
                  )}
                </div>

                {/* Right: leg detail card */}
                <div className="flex-1 bg-white border border-gray-200 rounded-xl p-4 mb-2 shadow-sm hover:shadow-md transition-shadow">
                  {/* From → To */}
                  <div className="flex items-center gap-3 mb-3">
                    <div className="flex items-center gap-1.5">
                      <MapPin className="w-4 h-4 text-gray-400" />
                      <span className="text-base font-semibold text-gray-800">{leg.from}</span>
                    </div>
                    <ArrowRight className="w-4 h-4 text-gray-400 flex-shrink-0" />
                    <div className="flex items-center gap-1.5">
                      <MapPin className="w-4 h-4 text-indigo-500" />
                      <span className="text-base font-semibold text-indigo-700">{leg.to}</span>
                    </div>
                    <span className={`ml-auto inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full border ${modeBg(leg.mode)}`}>
                      <ModeIcon mode={leg.mode} className="w-3 h-3" />
                      {leg.mode}
                    </span>
                  </div>

                  {/* Date / time row */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs text-gray-600 mb-3">
                    <div className="flex items-center gap-1.5">
                      <Calendar className="w-3.5 h-3.5 text-gray-400" />
                      <div>
                        <div className="text-gray-400 text-[10px] uppercase tracking-wide">Departure</div>
                        <div className="font-medium">{formatDate(leg.departureDate)}</div>
                        {leg.departureTime && <div className="text-gray-500">{leg.departureTime}</div>}
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5 text-gray-400" />
                      <div>
                        <div className="text-gray-400 text-[10px] uppercase tracking-wide">Arrival</div>
                        <div className="font-medium">{formatDate(leg.arrivalDate)}</div>
                        {leg.arrivalTime && <div className="text-gray-500">{leg.arrivalTime}</div>}
                      </div>
                    </div>
                    {(leg.ticketNo || leg.pnrNo) && (
                      <div className="flex items-center gap-1.5">
                        <Hash className="w-3.5 h-3.5 text-gray-400" />
                        <div>
                          <div className="text-gray-400 text-[10px] uppercase tracking-wide">{leg.pnrNo ? 'PNR' : 'Ticket'}</div>
                          <div className="font-mono font-medium">{leg.pnrNo ?? leg.ticketNo}</div>
                        </div>
                      </div>
                    )}
                    <div className="flex flex-col justify-center">
                      <div className="text-gray-400 text-[10px] uppercase tracking-wide">Fare</div>
                      <div className="font-semibold text-gray-800">{formatINR(leg.fare)}</div>
                      {leg.class && <div className="text-gray-400">{leg.class}</div>}
                    </div>
                  </div>

                  {/* Receipt badge */}
                  <div className="flex items-center gap-2">
                    <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full ${leg.receiptUploaded ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'}`}>
                      {leg.receiptUploaded ? '✓ Receipt uploaded' : '✗ Receipt missing'}
                    </span>
                    {leg.bookingRef && (
                      <span className="text-xs text-gray-400">Ref: {leg.bookingRef}</span>
                    )}
                  </div>
                </div>
              </div>

              {/* Continuity warning banner */}
              {hasWarningAfter && (() => {
                const w = continuityWarnings.find((x) => x.index === index)!;
                return (
                  <div className="flex gap-4 mb-2">
                    <div className="flex flex-col items-center">
                      <div className="w-10 flex-shrink-0" />
                    </div>
                    <div className="flex-1 flex items-center gap-3 bg-red-50 border border-red-300 rounded-lg px-4 py-2 text-sm text-red-700">
                      <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                      <span>
                        <strong>Continuity gap:</strong> Previous leg arrived at{' '}
                        <strong>{w.prevTo}</strong> but next leg departs from{' '}
                        <strong>{w.nextFrom}</strong>. Journey may be incomplete.
                      </span>
                    </div>
                  </div>
                );
              })()}
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
};

export default TravelTimeline;

