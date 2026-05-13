'use client';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { formatDate } from '@/lib/utils';
import { Survey } from '@/types';
import StatusPill from '@/components/StatusPill';
import PageHeader from '@/components/PageHeader';
import { Plus } from 'lucide-react';

export default function SurveysPage() {
  const [surveys, setSurveys] = useState<Survey[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/api/v1/surveys?per_page=100')
      .then(res => { setSurveys(res.data); setTotal(res.meta.total); })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  return (
    <div>
      <PageHeader
        title="Cross-Connection Surveys"
        subtitle={`${total} surveys`}
        action={
          <button className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700">
            <Plus className="w-4 h-4" /> New Survey
          </button>
        }
      />

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="text-left px-4 py-3 font-medium text-gray-600">Address</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Date</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Inspector</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Cross Connection</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Outcome</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Next Due</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading && <tr><td colSpan={6} className="text-center py-12 text-gray-400">Loading...</td></tr>}
              {!loading && surveys.length === 0 && <tr><td colSpan={6} className="text-center py-12 text-gray-400">No surveys yet</td></tr>}
              {!loading && surveys.map(s => (
                <tr key={s.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-gray-900">{s.address_line1 || s.survey_address}</td>
                  <td className="px-4 py-3 text-gray-600">{formatDate(s.survey_date)}</td>
                  <td className="px-4 py-3 text-gray-600">{s.inspector_name || '—'}</td>
                  <td className="px-4 py-3">
                    {s.cross_connection_found == null ? '—' : s.cross_connection_found
                      ? <StatusPill status="fail" />
                      : <StatusPill status="pass" />}
                  </td>
                  <td className="px-4 py-3"><StatusPill status={s.outcome} /></td>
                  <td className="px-4 py-3 text-gray-600">{formatDate(s.next_survey_due)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
