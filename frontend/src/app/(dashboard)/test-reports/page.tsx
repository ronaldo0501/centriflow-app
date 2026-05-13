'use client';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { formatDate } from '@/lib/utils';
import { TestReport } from '@/types';
import StatusPill from '@/components/StatusPill';
import PageHeader from '@/components/PageHeader';
import { cn } from '@/lib/utils';

export default function TestReportsPage() {
  const [reports, setReports] = useState<TestReport[]>([]);
  const [total, setTotal] = useState(0);
  const [resultFilter, setResultFilter] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams({ per_page: '100' });
    if (resultFilter) params.set('result', resultFilter);
    api.get(`/api/v1/reports?${params}`)
      .then(res => { setReports(res.data); setTotal(res.meta.total); })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [resultFilter]);

  return (
    <div>
      <PageHeader title="Test Reports" subtitle={`${total} total reports`} />

      <div className="flex gap-2 mb-6">
        {[{ label: 'All', value: '' }, { label: 'Pass', value: 'pass' }, { label: 'Fail', value: 'fail' }].map(f => (
          <button
            key={f.value}
            onClick={() => setResultFilter(f.value)}
            className={cn(
              'px-3 py-2 rounded-lg text-sm font-medium transition-colors',
              resultFilter === f.value ? 'bg-blue-600 text-white' : 'bg-white border border-gray-300 text-gray-600 hover:bg-gray-50'
            )}
          >
            {f.label}
          </button>
        ))}
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="text-left px-4 py-3 font-medium text-gray-600">Tag #</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Address</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Tester</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Test Date</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Result</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Status</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">CW Sync</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading && <tr><td colSpan={7} className="text-center py-12 text-gray-400">Loading...</td></tr>}
              {!loading && reports.length === 0 && <tr><td colSpan={7} className="text-center py-12 text-gray-400">No reports found</td></tr>}
              {!loading && reports.map(r => (
                <tr key={r.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-900">{r.tag_number}</td>
                  <td className="px-4 py-3 text-gray-600">{r.address_line1}</td>
                  <td className="px-4 py-3 text-gray-600">
                    <div>{r.tester_name}</div>
                    <div className="text-xs text-gray-400">{r.license_number}</div>
                  </td>
                  <td className="px-4 py-3 text-gray-600">{formatDate(r.test_date)}</td>
                  <td className="px-4 py-3"><StatusPill status={r.result} /></td>
                  <td className="px-4 py-3"><StatusPill status={r.status} /></td>
                  <td className="px-4 py-3"><StatusPill status={r.cw_sync_status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
