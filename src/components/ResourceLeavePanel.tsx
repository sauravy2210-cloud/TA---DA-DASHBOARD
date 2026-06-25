import React, { useMemo } from 'react';
import { Calendar, AlertCircle, Info } from 'lucide-react';
import type { LeaveRecord, Assignment } from '../types';

interface ResourceLeavePanelProps {
  trainerId: string;
  startDate: string;
  endDate: string;
  leaveRecords: LeaveRecord[];
  assignments: Assignment[];
}

type DayCategory = 'assignment' | 'leave' | 'stayback' | 'travel' | 'normal' | 'weekend' | 'out-of-range';

interface DayInfo {
  date: string;
  isoDate: string;
  category: DayCategory;
  label?: string;
  leaveType?: string;
}

function parseDate(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

function toISO(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function dateRange(start: string, end: string): string[] {
  const dates: string[] = [];
  const cur = parseDate(start);
  const last = parseDate(end);
  while (cur <= last) {
    dates.push(toISO(cur));
    cur.setUTCDate(cur.getUTCDate() + 1);
  }
  return dates;
}

function isBetween(date: string, start: string, end: string): boolean {
  return date >= start && date <= end;
}

const DAY_STYLES: Record<DayCategory, string> = {
  assignment: 'bg-blue-500 text-white border-blue-600',
  leave: 'bg-red-500 text-white border-red-600',
  stayback: 'bg-orange-400 text-white border-orange-500',
  travel: 'bg-purple-500 text-white border-purple-600',
  normal: 'bg-gray-100 text-gray-700 border-gray-200',
  weekend: 'bg-gray-50 text-gray-400 border-gray-100',
  'out-of-range': 'bg-white text-gray-200 border-transparent',
};

const LEGEND_ITEMS: { category: DayCategory; label: string; sub?: string }[] = [
  { category: 'assignment', label: 'Assignment Day', sub: 'DA eligible' },
  { category: 'leave', label: 'Leave Day', sub: 'DA excluded' },
  { category: 'stayback', label: 'Personal Stayback', sub: 'DA excluded' },
  { category: 'travel', label: 'Travel Day' },
  { category: 'normal', label: 'Normal Day' },
  { category: 'weekend', label: 'Weekend' },
];

export const ResourceLeavePanel: React.FC<ResourceLeavePanelProps> = ({
  startDate,
  endDate,
  leaveRecords,
  assignments,
}) => {
  const allDates = useMemo(() => dateRange(startDate, endDate), [startDate, endDate]);

  // Build leave set
  const leaveDateMap = useMemo(() => {
    const map = new Map<string, LeaveRecord>();
    leaveRecords.forEach((lr) => {
      dateRange(lr.startDate, lr.endDate).forEach((d) => {
        if (!map.has(d)) map.set(d, lr);
      });
    });
    return map;
  }, [leaveRecords]);

  // Build assignment set
  const assignmentDates = useMemo(() => {
    const set = new Set<string>();
    assignments.forEach((a) => {
      dateRange(a.startDate, a.endDate).forEach((d) => set.add(d));
    });
    return set;
  }, [assignments]);

  const dayInfos = useMemo((): DayInfo[] => {
    return allDates.map((iso) => {
      const dateObj = parseDate(iso);
      const dow = dateObj.getUTCDay();
      const dayNum = parseInt(iso.slice(8, 10), 10);
      const label = String(dayNum);
      const isWeekend = dow === 0 || dow === 6;
      const leaveRecord = leaveDateMap.get(iso);
      const isAssignment = assignmentDates.has(iso);

      let category: DayCategory = isWeekend ? 'weekend' : 'normal';
      if (leaveRecord && isBetween(iso, startDate, endDate)) category = 'leave';
      else if (isAssignment) category = 'assignment';

      return {
        date: label,
        isoDate: iso,
        category,
        leaveType: leaveRecord?.type,
      };
    });
  }, [allDates, leaveDateMap, assignmentDates, startDate, endDate]);

  // Summaries
  const summary = useMemo(() => {
    let assignmentDays = 0, leaveDays = 0, staybackDays = 0, travelDays = 0, normalDays = 0;
    dayInfos.forEach((d) => {
      if (d.category === 'assignment') assignmentDays++;
      else if (d.category === 'leave') leaveDays++;
      else if (d.category === 'stayback') staybackDays++;
      else if (d.category === 'travel') travelDays++;
      else if (d.category === 'normal' || d.category === 'weekend') normalDays++;
    });
    const totalDays = dayInfos.length;
    const eligibleDA = totalDays - leaveDays - staybackDays;
    return { assignmentDays, leaveDays, staybackDays, travelDays, normalDays, eligibleDA, totalDays };
  }, [dayInfos]);

  // Group by month-week for calendar display
  const weeks = useMemo(() => {
    const result: DayInfo[][] = [];
    let week: DayInfo[] = [];
    // Pad first week
    if (dayInfos.length > 0) {
      const firstDow = parseDate(dayInfos[0].isoDate).getUTCDay();
      for (let i = 0; i < firstDow; i++) {
        week.push({ date: '', isoDate: '', category: 'out-of-range' });
      }
    }
    dayInfos.forEach((d) => {
      week.push(d);
      if (week.length === 7) {
        result.push(week);
        week = [];
      }
    });
    if (week.length > 0) {
      while (week.length < 7) week.push({ date: '', isoDate: '', category: 'out-of-range' });
      result.push(week);
    }
    return result;
  }, [dayInfos]);

  const DOW_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  const formatDisplayDate = (iso: string) => {
    try {
      return new Date(iso).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
    } catch { return iso; }
  };

  return (
    <div className="space-y-5">
      {/* Period header */}
      <div className="flex items-center gap-2 text-sm text-gray-600">
        <Calendar className="w-4 h-4 text-indigo-500" />
        <span>Claim period:</span>
        <strong className="text-gray-800">{formatDisplayDate(startDate)}</strong>
        <span>—</span>
        <strong className="text-gray-800">{formatDisplayDate(endDate)}</strong>
        <span className="ml-1 text-gray-400">({summary.totalDays} days)</span>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 text-center">
          <div className="text-2xl font-bold text-blue-700">{summary.assignmentDays}</div>
          <div className="text-xs text-blue-600 mt-0.5">Assignment days</div>
        </div>
        <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-center">
          <div className="text-2xl font-bold text-red-600">{summary.leaveDays}</div>
          <div className="text-xs text-red-500 mt-0.5">Leave days <span className="block text-[10px]">(DA excluded)</span></div>
        </div>
        <div className="bg-orange-50 border border-orange-200 rounded-xl p-3 text-center">
          <div className="text-2xl font-bold text-orange-600">{summary.staybackDays}</div>
          <div className="text-xs text-orange-500 mt-0.5">Personal stayback <span className="block text-[10px]">(DA excluded)</span></div>
        </div>
        <div className="bg-purple-50 border border-purple-200 rounded-xl p-3 text-center">
          <div className="text-2xl font-bold text-purple-600">{summary.travelDays}</div>
          <div className="text-xs text-purple-500 mt-0.5">Travel days</div>
        </div>
        <div className="bg-green-50 border border-green-200 rounded-xl p-3 text-center">
          <div className="text-2xl font-bold text-green-700">{summary.eligibleDA}</div>
          <div className="text-xs text-green-600 mt-0.5">Eligible DA days</div>
        </div>
      </div>

      {/* Calendar grid */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
        <div className="grid grid-cols-7 border-b border-gray-100">
          {DOW_LABELS.map((d) => (
            <div key={d} className="text-center text-xs font-semibold text-gray-400 py-2">{d}</div>
          ))}
        </div>
        <div>
          {weeks.map((week, wi) => (
            <div key={wi} className="grid grid-cols-7">
              {week.map((day, di) => (
                <div
                  key={di}
                  title={day.isoDate && day.category !== 'out-of-range' ? `${day.isoDate} — ${day.category}${day.leaveType ? ` (${day.leaveType})` : ''}` : ''}
                  className={`relative min-h-[44px] flex flex-col items-center justify-center text-sm font-medium border-b border-r border-gray-100 transition-all
                    ${DAY_STYLES[day.category]}
                    ${day.category === 'out-of-range' ? 'cursor-default' : 'cursor-default hover:opacity-90'}
                  `}
                >
                  {day.date && <span>{day.date}</span>}
                  {day.leaveType && (
                    <span className="text-[9px] mt-0.5 opacity-80 uppercase tracking-wide">{day.leaveType}</span>
                  )}
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-3 pt-1">
        {LEGEND_ITEMS.map(({ category, label, sub }) => (
          <div key={category} className="flex items-center gap-2">
            <div className={`w-5 h-5 rounded flex-shrink-0 border ${DAY_STYLES[category]}`} />
            <div className="text-xs text-gray-600">
              {label}
              {sub && <span className="text-gray-400 ml-1">({sub})</span>}
            </div>
          </div>
        ))}
      </div>

      {/* Eligibility note */}
      <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 text-sm text-amber-800">
        <Info className="w-4 h-4 mt-0.5 flex-shrink-0" />
        <span>
          DA is excluded for leave days (any type) and personal stayback days.{' '}
          <strong>{summary.eligibleDA}</strong> of <strong>{summary.totalDays}</strong> days are eligible for DA.
          {summary.leaveDays > 0 && (
            <span className="ml-1 text-red-700 flex items-center gap-1 inline-flex">
              <AlertCircle className="w-3.5 h-3.5" />
              {summary.leaveDays} leave day{summary.leaveDays > 1 ? 's' : ''} detected.
            </span>
          )}
        </span>
      </div>
    </div>
  );
};

export default ResourceLeavePanel;

