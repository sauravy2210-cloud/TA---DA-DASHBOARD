import { XCircle, AlertTriangle, X, ChevronRight } from 'lucide-react';
import type { ValidationError } from '../types';

interface ValidationSummaryProps {
  errors: ValidationError[];
  warnings?: ValidationError[];
  onDismiss?: () => void;
}

export default function ValidationSummary({
  errors,
  warnings = [],
  onDismiss,
}: ValidationSummaryProps) {
  const errorCount = errors.length;
  const warningCount = warnings.length;

  if (errorCount === 0 && warningCount === 0) return null;

  const scrollToField = (fieldId: string) => {
    const el = document.getElementById(fieldId);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      el.focus?.();
    }
  };

  return (
    <div className="space-y-3">
      {/* Error Card */}
      {errorCount > 0 && (
        <div className="rounded-xl border border-red-200 bg-red-50 overflow-hidden">
          {/* Card Header */}
          <div className="flex items-center justify-between px-4 py-3 bg-red-100 border-b border-red-200">
            <div className="flex items-center gap-2">
              <XCircle className="w-5 h-5 text-red-600 shrink-0" />
              <span className="text-sm font-semibold text-red-800">
                {errorCount} blocker{errorCount !== 1 ? 's' : ''} preventing submission
              </span>
              <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-red-600 text-white text-xs font-bold leading-none">
                {errorCount}
              </span>
            </div>
            {onDismiss && (
              <button
                type="button"
                onClick={onDismiss}
                aria-label="Dismiss validation errors"
                className="text-red-400 hover:text-red-700 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Error List */}
          <ul className="divide-y divide-red-100">
            {errors.map((err, idx) => (
              <li key={`${err.field}-${idx}`}>
                <button
                  type="button"
                  onClick={() => err.field && scrollToField(err.field)}
                  className="w-full flex items-start gap-3 px-4 py-3 text-left hover:bg-red-100 transition-colors group"
                >
                  <XCircle className="w-4 h-4 text-red-400 mt-0.5 shrink-0 group-hover:text-red-600" />
                  <span className="flex-1 text-sm text-red-800 leading-relaxed">
                    <span className="font-semibold">{formatFieldLabel(err.field)}</span>
                    {err.message ? `: ${err.message}` : ''}
                  </span>
                  {err.field && (
                    <ChevronRight className="w-4 h-4 text-red-300 mt-0.5 shrink-0 group-hover:text-red-500 transition-colors" />
                  )}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Warning Card */}
      {warningCount > 0 && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 overflow-hidden">
          {/* Card Header */}
          <div className="flex items-center justify-between px-4 py-3 bg-amber-100 border-b border-amber-200">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0" />
              <span className="text-sm font-semibold text-amber-800">
                {warningCount} warning{warningCount !== 1 ? 's' : ''} — review before submitting
              </span>
              <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-amber-500 text-white text-xs font-bold leading-none">
                {warningCount}
              </span>
            </div>
          </div>

          {/* Warning List */}
          <ul className="divide-y divide-amber-100">
            {warnings.map((warn, idx) => (
              <li key={`${warn.field}-${idx}`}>
                <button
                  type="button"
                  onClick={() => warn.field && scrollToField(warn.field)}
                  className="w-full flex items-start gap-3 px-4 py-3 text-left hover:bg-amber-100 transition-colors group"
                >
                  <AlertTriangle className="w-4 h-4 text-amber-400 mt-0.5 shrink-0 group-hover:text-amber-600" />
                  <span className="flex-1 text-sm text-amber-800 leading-relaxed">
                    <span className="font-semibold">{formatFieldLabel(warn.field)}</span>
                    {warn.message ? `: ${warn.message}` : ''}
                  </span>
                  {warn.field && (
                    <ChevronRight className="w-4 h-4 text-amber-300 mt-0.5 shrink-0 group-hover:text-amber-500 transition-colors" />
                  )}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

/** Convert camelCase / snake_case field names to readable labels */
function formatFieldLabel(field: string): string {
  return field
    .replace(/([A-Z])/g, ' $1')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .trim();
}

