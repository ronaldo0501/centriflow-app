'use client';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { formatDate } from '@/lib/utils';
import { Violation } from '@/types';
import StatusPill from '@/components/StatusPill';
import PageHeader from '@/components/PageHeader';
import { cn } from '@/lib/utils';

export default function ViolationsPage() {
  const [violations, setViolations] = useState<Violation[]>([]);
  const [total, setTotal] = useState(0);
  const [statusFilter, setStatusFilter] = useState('open');
  const [loading, setLoading] = useState(true);

  const loadViolations = () => {
    setLoading(true);
    const params = new URLSearchParams({ per_page: '100' });
    if (statusFilter) params.set('status', statusFilter);
    api.get(`/api/v1/violations?${params}`)
      .then(res => { setViolations(res.data); setTotal(res.meta.total); })
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { loadViolations(); }, [statusFilter]);

  const handleResolve = async (id: string) => {
    await api.put(`/api/v1/violations/${id}/resolve`);
    loadViolations();
  };

  return (
    <div>
      <PageHeader title="Violations" subtitle={`${total} violations`} />

      <div className="flex gap-2 mb-6">
        {['open', 'in_progress', 'resolved', 'waived'].map(s => (
          <button
            key={s}
            onClick={() => setStatusFilter(s)}
            className={cn(
              'px-3 py-2 rounded-lg text-sm font-medium transition-colors capitalize',
              statusFilter === s ? 'bg-blue-600 text-white' : 'bg-white border border-gray-300 text-gray-600 hover:bg-gray-50'
            )}
          >
            {s.replace('_', ' ')}
          </button>
        ))}
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="text-left px-4 py-3 font-medium text-gray-600">Tag #</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Address / Owner</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Type</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Issued</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Deadline</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Status</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading && <tr><td colSpan={7} className="text-center py-12 text-gray-400">Loading...</td></tr>}
              {!loading && violations.length === 0 && <tr><td colSpan={7} className="text-center py-12 text-gray-400">No violations found</td></tr>}
              {!loading && violations.map(v => (
                <tr key={v.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-900">{v.tag_number}</td>
                  <td className="px-4 py-3 text-gray-600">
                    <div>{v.address_line1}</div>
                    <div className="text-xs text-gray-400">{v.owner_name} · {v.owner_email}</div>
                  </td>
                  <td className="px-4 py-3"><StatusPill status={v.violation_type} /></td>
                  <td className="px-4 py-3 text-gray-600">{formatDate(v.issued_date)}</td>
                  <td className="px-4 py-3 text-gray-600">{formatDate(v.compliance_deadline)}</td>
                  <td className="px-4 py-3"><StatusPill status={v.status} /></td>
                  <td className="px-4 py-3">
                    {v.status === 'open' && (
                      <button
                        onClick={() => handleResolve(v.id)}
                        className="text-xs px-2 py-1 bg-green-100 text-green-700 rounded hover:bg-green-200 transition-colors"
                      >
                        Resolve
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
