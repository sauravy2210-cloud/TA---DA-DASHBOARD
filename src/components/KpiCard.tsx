import type { LucideIcon } from 'lucide-react';
import { TrendingUp, TrendingDown } from 'lucide-react';

type AccentColor = 'blue' | 'green' | 'yellow' | 'red' | 'purple' | 'indigo' | 'teal';

interface KpiCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: LucideIcon;
  accentColor: AccentColor;
  onClick?: () => void;
  trend?: string;
  isAmount?: boolean;
}

const accentStyles: Record<AccentColor, { border: string; iconBg: string; iconText: string; trendPos: string; trendNeg: string }> = {
  blue:   { border: 'border-l-blue-500',   iconBg: 'bg-blue-50',   iconText: 'text-blue-600',   trendPos: 'text-blue-600',   trendNeg: 'text-blue-400'   },
  green:  { border: 'border-l-green-500',  iconBg: 'bg-green-50',  iconText: 'text-green-600',  trendPos: 'text-green-600',  trendNeg: 'text-red-500'    },
  yellow: { border: 'border-l-yellow-500', iconBg: 'bg-yellow-50', iconText: 'text-yellow-600', trendPos: 'text-yellow-600', trendNeg: 'text-red-500'    },
  red:    { border: 'border-l-red-500',    iconBg: 'bg-red-50',    iconText: 'text-red-600',    trendPos: 'text-green-600',  trendNeg: 'text-red-500'    },
  purple: { border: 'border-l-purple-500', iconBg: 'bg-purple-50', iconText: 'text-purple-600', trendPos: 'text-green-600',  trendNeg: 'text-red-500'    },
  indigo: { border: 'border-l-indigo-500', iconBg: 'bg-indigo-50', iconText: 'text-indigo-600', trendPos: 'text-green-600',  trendNeg: 'text-red-500'    },
  teal:   { border: 'border-l-teal-500',   iconBg: 'bg-teal-50',   iconText: 'text-teal-600',   trendPos: 'text-green-600',  trendNeg: 'text-red-500'    },
};

function formatAmount(amount: number): string {
  if (Math.abs(amount) >= 100000) {
    const lakhs = amount / 100000;
    return `₹${lakhs.toFixed(2)}L`;
  }
  const absStr = Math.abs(Math.round(amount)).toString();
  if (absStr.length <= 3) return `${amount < 0 ? '-' : ''}₹${absStr}`;
  const last3 = absStr.slice(-3);
  const rest = absStr.slice(0, -3);
  const pairs = rest.replace(/\B(?=(\d{2})+(?!\d))/g, ',');
  return `${amount < 0 ? '-' : ''}₹${pairs},${last3}`;
}

function isTrendPositive(trend: string): boolean {
  return trend.startsWith('+');
}

export default function KpiCard({
  title,
  value,
  subtitle,
  icon: Icon,
  accentColor,
  onClick,
  trend,
  isAmount = false,
}: KpiCardProps) {
  const styles = accentStyles[accentColor];
  const displayValue =
    isAmount && typeof value === 'number' ? formatAmount(value) : String(value);

  const trendPositive = trend ? isTrendPositive(trend) : true;
  const trendColor = trendPositive ? styles.trendPos : styles.trendNeg;
  const TrendIcon = trendPositive ? TrendingUp : TrendingDown;

  return (
    <div
      className={[
        'bg-white rounded-xl border border-gray-100 border-l-4 shadow-sm',
        'p-5 flex items-start gap-4 transition-shadow duration-200',
        styles.border,
        onClick ? 'cursor-pointer hover:shadow-md' : '',
      ].join(' ')}
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={onClick ? (e) => e.key === 'Enter' && onClick() : undefined}
    >
      {/* Icon */}
      <div className={`flex-shrink-0 rounded-full p-3 ${styles.iconBg}`}>
        <Icon className={`w-5 h-5 ${styles.iconText}`} strokeWidth={2} />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium text-gray-500 uppercase tracking-wide truncate">{title}</p>
        <p className="mt-1 text-2xl font-bold text-gray-900 leading-tight">{displayValue}</p>
        {subtitle && (
          <p className="mt-0.5 text-xs text-gray-400 truncate">{subtitle}</p>
        )}
        {trend && (
          <div className={`mt-1.5 inline-flex items-center gap-1 text-xs font-medium ${trendColor}`}>
            <TrendIcon className="w-3 h-3" strokeWidth={2.5} />
            <span>{trend}</span>
          </div>
        )}
      </div>
    </div>
  );
}

