import { cn } from '@/lib/utils';

const STATUS_STYLES: Record<string, string> = {
  pass: 'bg-green-100 text-green-800',
  active: 'bg-green-100 text-green-800',
  compliant: 'bg-green-100 text-green-800',
  accepted: 'bg-green-100 text-green-800',
  resolved: 'bg-green-100 text-green-800',
  paid: 'bg-green-100 text-green-800',
  fail: 'bg-red-100 text-red-800',
  overdue: 'bg-red-100 text-red-800',
  open: 'bg-red-100 text-red-800',
  failed_test: 'bg-red-100 text-red-800',
  high: 'bg-red-100 text-red-800',
  pending: 'bg-amber-100 text-amber-800',
  due: 'bg-amber-100 text-amber-800',
  in_progress: 'bg-blue-100 text-blue-800',
  submitted: 'bg-blue-100 text-blue-800',
  invoiced: 'bg-blue-100 text-blue-800',
  inactive: 'bg-gray-100 text-gray-600',
  removed: 'bg-gray-100 text-gray-600',
  not_tested: 'bg-gray-100 text-gray-600',
  waived: 'bg-gray-100 text-gray-600',
  low: 'bg-gray-100 text-gray-600',
};

const LABELS: Record<string, string> = {
  not_tested: 'Not Tested',
  in_progress: 'In Progress',
  failed_test: 'Failed Test',
};

interface Props {
  status: string;
  className?: string;
}

export default function StatusPill({ status, className }: Props) {
  const style = STATUS_STYLES[status] || 'bg-gray-100 text-gray-600';
  const label = LABELS[status] || status.charAt(0).toUpperCase() + status.slice(1);
  return (
    <span className={cn('inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium', style, className)}>
      {label}
    </span>
  );
}
