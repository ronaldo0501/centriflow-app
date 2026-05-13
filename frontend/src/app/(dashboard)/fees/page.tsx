'use client';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { formatDate, formatCurrency } from '@/lib/utils';
import { Fee } from '@/types';
import StatusPill from '@/components/StatusPill';
import PageHeader from '@/components/PageHeader';
import { cn } from '@/lib/utils';

export default function FeesPage() {
  const [fees, setFees] = useState<Fee[]>([]);
  const [total, setTotal] = useState(0);
  const [statusFilter, setStatusFilter] = useState('pending');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams({ per_page: '100' });
    if (statusFilter) params.set('status', statusFilter);
    api.get(`/api/v1/fees?${params}`)
      .then(res => { setFees(res.data); setTotal(res.meta.total); })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [statusFilter]);

  return (
    <div>
      <PageHeader title="Fees" subtitle={`${total} fees`} />

      <div className="flex gap-2 mb-6">
        {['pending', 'paid', 'waived'].map(s => (
          <button
            key={s}
            onClick={() => setStatusFilter(s)}
            className={cn(
              'px-3 py-2 rounded-lg text-sm font-medium transition-colors capitalize',
              statusFilter === s ? 'bg-blue-600 text-white' : 'bg-white border border-gray-300 text-gray-600 hover:bg-gray-50'
            )}
          >
            {s}
          </button>
        ))}
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="text-left px-4 py-3 font-medium text-gray-600">Tag # / Address</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Owner</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Type</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Amount</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Due Date</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading && <tr><td colSpan={6} className="text-center py-12 text-gray-400">Loading...</td></tr>}
              {!loading && fees.length === 0 && <tr><td colSpan={6} className="text-center py-12 text-gray-400">No fees found</td></tr>}
              {!loading && fees.map(f => (
                <tr key={f.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <p className="font-medium text-gray-900">{f.tag_number || '—'}</p>
                    <p className="text-xs text-gray-400">{f.address_line1}</p>
                  </td>
                  <td className="px-4 py-3 text-gray-600">
                    <div>{f.owner_name || '—'}</div>
                    <div className="text-xs text-gray-400">{f.owner_email}</div>
                  </td>
                  <td className="px-4 py-3 text-gray-600 capitalize">{f.fee_type.replace('_', ' ')}</td>
                  <td className="px-4 py-3 font-medium text-gray-900">{formatCurrency(f.amount)}</td>
                  <td className="px-4 py-3 text-gray-600">{formatDate(f.due_date)}</td>
                  <td className="px-4 py-3"><StatusPill status={f.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
