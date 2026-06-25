import React from 'react';

export interface FilterOption {
  label: string;
  value: string;
}

export interface FilterConfig {
  key: string;
  label: string;
  type: 'select' | 'date' | 'daterange' | 'multiselect' | 'text';
  options?: FilterOption[];
}

interface FilterBarProps {
  filters: FilterConfig[];
  values: Record<string, string | string[]>;
  onChange: (key: string, value: string | string[]) => void;
  onClear: () => void;
}

function countActiveFilters(values: Record<string, string | string[]>): number {
  return Object.values(values).filter((v) => {
    if (Array.isArray(v)) return v.length > 0;
    return v !== '' && v !== undefined && v !== null;
  }).length;
}

export const FilterBar: React.FC<FilterBarProps> = ({ filters, values, onChange, onClear }) => {
  const activeCount = countActiveFilters(values);

  const renderFilter = (filter: FilterConfig) => {
    const val = values[filter.key];

    switch (filter.type) {
      case 'select':
        return (
          <select
            className="
              mt-1 block w-full min-w-[140px] text-sm
              border border-gray-300 rounded-md
              bg-white text-gray-800
              px-2 py-1.5
              focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500
            "
            value={typeof val === 'string' ? val : ''}
            onChange={(e) => onChange(filter.key, e.target.value)}
          >
            <option value="">All</option>
            {filter.options?.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        );

      case 'multiselect':
        return (
          <select
            multiple
            className="
              mt-1 block w-full min-w-[160px] text-sm
              border border-gray-300 rounded-md
              bg-white text-gray-800
              px-2 py-1
              focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500
              max-h-24
            "
            value={Array.isArray(val) ? val : []}
            onChange={(e) => {
              const selected = Array.from(e.target.selectedOptions, (o) => o.value);
              onChange(filter.key, selected);
            }}
          >
            {filter.options?.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        );

      case 'date':
        return (
          <input
            type="date"
            className="
              mt-1 block w-full min-w-[140px] text-sm
              border border-gray-300 rounded-md
              bg-white text-gray-800
              px-2 py-1.5
              focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500
            "
            value={typeof val === 'string' ? val : ''}
            onChange={(e) => onChange(filter.key, e.target.value)}
          />
        );

      case 'daterange': {
        const rangeVal = Array.isArray(val) ? val : ['', ''];
        return (
          <div className="flex items-center gap-1 mt-1">
            <input
              type="date"
              className="
                block w-full min-w-[120px] text-sm
                border border-gray-300 rounded-md
                bg-white text-gray-800
                px-2 py-1.5
                focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500
              "
              value={rangeVal[0] ?? ''}
              onChange={(e) => onChange(filter.key, [e.target.value, rangeVal[1] ?? ''])}
            />
            <span className="text-gray-400 text-xs">to</span>
            <input
              type="date"
              className="
                block w-full min-w-[120px] text-sm
                border border-gray-300 rounded-md
                bg-white text-gray-800
                px-2 py-1.5
                focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500
              "
              value={rangeVal[1] ?? ''}
              onChange={(e) => onChange(filter.key, [rangeVal[0] ?? '', e.target.value])}
            />
          </div>
        );
      }

      case 'text':
      default:
        return (
          <input
            type="text"
            className="
              mt-1 block w-full min-w-[140px] text-sm
              border border-gray-300 rounded-md
              bg-white text-gray-800
              px-2 py-1.5
              placeholder-gray-400
              focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500
            "
            value={typeof val === 'string' ? val : ''}
            placeholder={`Filter by ${filter.label.toLowerCase()}...`}
            onChange={(e) => onChange(filter.key, e.target.value)}
          />
        );
    }
  };

  return (
    <div className="flex items-start gap-3 overflow-x-auto pb-2 px-1 py-1">
      {filters.map((filter) => (
        <div key={filter.key} className="flex-shrink-0">
          <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide">
            {filter.label}
          </label>
          {renderFilter(filter)}
        </div>
      ))}

      {/* Clear All */}
      <div className="flex-shrink-0 flex items-end pb-0.5 mt-auto" style={{ paddingTop: '1.5rem' }}>
        <button
          type="button"
          onClick={onClear}
          className="
            flex items-center gap-1.5
            px-3 py-1.5
            text-sm font-medium
            text-gray-600 hover:text-red-600
            border border-gray-300 hover:border-red-300
            rounded-md bg-white
            transition-colors duration-150
            focus:outline-none focus:ring-2 focus:ring-red-400
            whitespace-nowrap
          "
        >
          <svg
            className="w-3.5 h-3.5"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
          Clear All
          {activeCount > 0 && (
            <span className="inline-flex items-center justify-center w-4 h-4 text-xs font-bold text-white bg-blue-500 rounded-full">
              {activeCount}
            </span>
          )}
        </button>
      </div>
    </div>
  );
};

export default FilterBar;

