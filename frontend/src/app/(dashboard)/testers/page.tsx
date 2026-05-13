'use client';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { formatDate } from '@/lib/utils';
import { Tester } from '@/types';
import StatusPill from '@/components/StatusPill';
import PageHeader from '@/components/PageHeader';
import { CheckCircle, XCircle, Mail } from 'lucide-react';

export default function TestersPage() {
  const [testers, setTesters] = useState<Tester[]>([]);
  const [loading, setLoading] = useState(true);

  const fetch = () => {
    setLoading(true);
    api.get('/api/v1/testers')
      .then(res => setTesters(res.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetch(); }, []);

  const handleApprove = async (id: string) => { await api.put(`/api/v1/testers/${id}/approve`); fetch(); };
  const handleReject = async (id: string) => { await api.put(`/api/v1/testers/${id}/reject`); fetch(); };

  const pending = testers.filter(t => !t.is_approved);
  const approved = testers.filter(t => t.is_approved);

  return (
    <div>
      <PageHeader title="Certified Testers" subtitle={`${approved.length} approved · ${pending.length} pending`} />

      {pending.length > 0 && (
        <div className="mb-8">
          <h2 className="text-sm font-semibold text-amber-700 bg-amber-50 border border-amber-200 px-4 py-2 rounded-lg mb-3">
            {pending.length} pending approval
          </h2>
          <div className="space-y-3">
            {pending.map(t => (
              <div key={t.id} className="bg-white border border-amber-200 rounded-xl p-4 flex items-center justify-between">
                <div>
                  <p className="font-medium text-gray-900">{t.name}</p>
                  <p className="text-sm text-gray-500">{t.email} · {t.license_number} ({t.license_state})</p>
                  <p className="text-xs text-gray-400">{t.company_name} · Expires {formatDate(t.license_expiration)}</p>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => handleApprove(t.id)} className="flex items-center gap-1.5 px-3 py-1.5 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700">
                    <CheckCircle className="w-4 h-4" /> Approve
                  </button>
                  <button onClick={() => handleReject(t.id)} className="flex items-center gap-1.5 px-3 py-1.5 bg-red-100 text-red-700 text-sm rounded-lg hover:bg-red-200">
                    <XCircle className="w-4 h-4" /> Reject
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="text-left px-4 py-3 font-medium text-gray-600">Name</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">License</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Company</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Expires</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Tests</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading && <tr><td colSpan={6} className="text-center py-12 text-gray-400">Loading...</td></tr>}
              {!loading && approved.length === 0 && <tr><td colSpan={6} className="text-center py-12 text-gray-400">No approved testers yet</td></tr>}
              {!loading && approved.map(t => (
                <tr key={t.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <p className="font-medium text-gray-900">{t.name}</p>
                    <div className="flex items-center gap-3 mt-0.5">
                      <span className="text-xs text-gray-400 flex items-center gap-1"><Mail className="w-3 h-3" />{t.email}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-gray-600">
                    <div>{t.license_number}</div>
                    <div className="text-xs text-gray-400">{t.license_state} · {t.certifying_body}</div>
                  </td>
                  <td className="px-4 py-3 text-gray-600">{t.company_name || '—'}</td>
                  <td className="px-4 py-3 text-gray-600">{formatDate(t.license_expiration)}</td>
                  <td className="px-4 py-3 text-gray-600">{t.test_count}</td>
                  <td className="px-4 py-3">
                    <StatusPill status={t.is_approved ? 'active' : 'pending'} />
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
