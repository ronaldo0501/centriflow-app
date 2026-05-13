import { cn } from '@/lib/utils';
import { LucideIcon } from 'lucide-react';

interface Props {
  title: string;
  value: string | number;
  icon: LucideIcon;
  color?: 'blue' | 'green' | 'red' | 'amber';
  subtitle?: string;
}

const COLOR_MAP = {
  blue: { bg: 'bg-blue-50', icon: 'text-blue-600', value: 'text-blue-700' },
  green: { bg: 'bg-green-50', icon: 'text-green-600', value: 'text-green-700' },
  red: { bg: 'bg-red-50', icon: 'text-red-600', value: 'text-red-700' },
  amber: { bg: 'bg-amber-50', icon: 'text-amber-600', value: 'text-amber-700' },
};

export default function StatCard({ title, value, icon: Icon, color = 'blue', subtitle }: Props) {
  const c = COLOR_MAP[color];
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6">
      <div className="flex items-center gap-4">
        <div className={cn('p-3 rounded-lg', c.bg)}>
          <Icon className={cn('w-6 h-6', c.icon)} />
        </div>
        <div>
          <p className="text-sm font-medium text-gray-500">{title}</p>
          <p className={cn('text-2xl font-bold', c.value)}>{value}</p>
          {subtitle && <p className="text-xs text-gray-400 mt-0.5">{subtitle}</p>}
        </div>
      </div>
    </div>
  );
}
