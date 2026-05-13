'use client';
import { useState } from 'react';
import { api } from '@/lib/api';
import PageHeader from '@/components/PageHeader';
import { FileText, Download, Loader2, BarChart3, CheckCircle, AlertTriangle, Clock } from 'lucide-react';

interface ReportData {
  year: number;
  total_devices: number;
  tested: number;
  passed: number;
  failed: number;
  not_tested: number;
  overdue: number;
  compliance_rate: number;
  open_violations: number;
  resolved_violations: number;
  new_devices: number;
  testers_active: number;
  top_assembly_types: { type: string; count: number }[];
  monthly_tests: { month: string; count: number; pass: number; fail: number }[];
}

const CURRENT_YEAR = new Date().getFullYear();
const YEARS = Array.from({ length: 5 }, (_, i) => CURRENT_YEAR - i);

export default function ReportsPage() {
  const [year, setYear] = useState(CURRENT_YEAR);
  const [data, setData] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState('');

  const loadReport = async () => {
    setLoading(true);
    setError('');
    setData(null);
    try {
      const res = await api.get(`/api/v1/annual-report/${year}`);
      setData(res.data);
    } catch {
      setError('Could not load report data. Make sure you have device and test data for this year.');
    } finally {
      setLoading(false);
    }
  };

  const generatePDF = async () => {
    if (!data) return;
    setGenerating(true);
    try {
      const res = await api.post(`/api/v1/annual-report/${year}/generate`);
      if (res.data?.pdf_url) {
        window.open(res.data.pdf_url, '_blank');
      }
    } catch {
      setError('PDF generation failed.');
    } finally {
      setGenerating(false);
    }
  };

  const pct = (n: number, d: number) => d === 0 ? '—' : `${Math.round((n / d) * 100)}%`;

  return (
    <div>
      <PageHeader title="Annual Report" subtitle="State-compliant backflow program annual summary" />

      {/* Year selector */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
        <div className="flex items-end gap-4">
          <div className="flex-1">
            <label className="block text-sm font-medium text-gray-700 mb-1">Report Year</label>
            <select
              value={year}
              onChange={e => setYear(Number(e.target.value))}
              className="w-full max-w-xs px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {YEARS.map(y => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>
          <button
            onClick={loadReport}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <BarChart3 className="w-4 h-4" />}
            Generate Report
          </button>
        </div>
        {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
      </div>

      {loading && (
        <div className="flex items-center justify-center h-48 text-gray-400">
          <Loader2 className="w-6 h-6 animate-spin mr-2" /> Loading report data...
        </div>
      )}

      {data && (
        <div className="space-y-6">
          {/* Summary cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="bg-white border border-gray-200 rounded-xl p-4">
              <p className="text-xs text-gray-500 mb-1">Total Devices</p>
              <p className="text-2xl font-bold text-gray-900">{data.total_devices}</p>
            </div>
            <div className="bg-green-50 border border-green-200 rounded-xl p-4">
              <div className="flex items-center gap-1.5 mb-1">
                <CheckCircle className="w-3.5 h-3.5 text-green-600" />
                <p className="text-xs text-gray-500">Compliance Rate</p>
              </div>
              <p className="text-2xl font-bold text-green-700">{Math.round(data.compliance_rate)}%</p>
            </div>
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
              <p className="text-xs text-gray-500 mb-1">Tests Conducted</p>
              <p className="text-2xl font-bold text-blue-700">{data.tested}</p>
            </div>
            <div className={`border rounded-xl p-4 ${data.not_tested > 0 ? 'bg-red-50 border-red-200' : 'bg-white border-gray-200'}`}>
              <div className="flex items-center gap-1.5 mb-1">
                <AlertTriangle className={`w-3.5 h-3.5 ${data.not_tested > 0 ? 'text-red-500' : 'text-gray-400'}`} />
                <p className="text-xs text-gray-500">Not Tested</p>
              </div>
              <p className={`text-2xl font-bold ${data.not_tested > 0 ? 'text-red-700' : 'text-gray-900'}`}>{data.not_tested}</p>
            </div>
          </div>

          {/* Test results breakdown */}
          <div className="bg-white border border-gray-200 rounded-xl p-6">
            <h2 className="font-semibold text-gray-900 mb-4">Test Results — {data.year}</h2>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm mb-6">
              <div><p className="text-gray-500">Passed</p><p className="font-bold text-green-700 text-lg">{data.passed} <span className="text-sm font-normal text-gray-400">({pct(data.passed, data.tested)})</span></p></div>
              <div><p className="text-gray-500">Failed</p><p className="font-bold text-red-700 text-lg">{data.failed} <span className="text-sm font-normal text-gray-400">({pct(data.failed, data.tested)})</span></p></div>
              <div><p className="text-gray-500">Overdue</p><p className="font-bold text-amber-700 text-lg">{data.overdue}</p></div>
              <div><p className="text-gray-500">Active Testers</p><p className="font-bold text-gray-900 text-lg">{data.testers_active}</p></div>
            </div>

            {/* Progress bar */}
            {data.tested > 0 && (
              <div className="mb-4">
                <div className="flex justify-between text-xs text-gray-500 mb-1">
                  <span>Tested vs. Total</span>
                  <span>{data.tested} / {data.total_devices}</span>
                </div>
                <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
                  <div className="h-full bg-blue-500 rounded-full" style={{ width: `${Math.min(100, (data.tested / data.total_devices) * 100)}%` }} />
                </div>
                {data.tested > 0 && (
                  <div className="h-3 bg-gray-100 rounded-full overflow-hidden mt-1.5">
                    <div className="h-full flex rounded-full overflow-hidden">
                      <div className="h-full bg-green-500" style={{ width: `${(data.passed / data.tested) * 100}%` }} />
                      <div className="h-full bg-red-400" style={{ width: `${(data.failed / data.tested) * 100}%` }} />
                    </div>
                  </div>
                )}
                <div className="flex gap-4 text-xs text-gray-500 mt-1">
                  <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-500 inline-block" />Pass</span>
                  <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-400 inline-block" />Fail</span>
                </div>
              </div>
            )}
          </div>

          {/* Violations summary */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="bg-white border border-gray-200 rounded-xl p-5">
              <h2 className="font-semibold text-gray-900 mb-3 text-sm">Violations</h2>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-500">Open violations</span>
                  <span className="font-medium text-red-600">{data.open_violations}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Resolved this year</span>
                  <span className="font-medium text-green-600">{data.resolved_violations}</span>
                </div>
              </div>
            </div>

            <div className="bg-white border border-gray-200 rounded-xl p-5">
              <h2 className="font-semibold text-gray-900 mb-3 text-sm">Assembly Types</h2>
              <div className="space-y-1.5">
                {(data.top_assembly_types || []).slice(0, 5).map(t => (
                  <div key={t.type} className="flex items-center gap-2">
                    <span className="text-xs font-mono font-medium text-gray-700 w-10">{t.type}</span>
                    <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div className="h-full bg-blue-400 rounded-full" style={{ width: `${(t.count / data.total_devices) * 100}%` }} />
                    </div>
                    <span className="text-xs text-gray-500 w-8 text-right">{t.count}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Monthly breakdown */}
          {data.monthly_tests && data.monthly_tests.length > 0 && (
            <div className="bg-white border border-gray-200 rounded-xl p-5">
              <h2 className="font-semibold text-gray-900 mb-4 text-sm">Tests by Month</h2>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-left text-gray-500 border-b border-gray-100">
                      <th className="pb-2 font-medium">Month</th>
                      <th className="pb-2 font-medium text-right">Total</th>
                      <th className="pb-2 font-medium text-right text-green-600">Pass</th>
                      <th className="pb-2 font-medium text-right text-red-600">Fail</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {data.monthly_tests.map(m => (
                      <tr key={m.month}>
                        <td className="py-1.5 text-gray-700">{m.month}</td>
                        <td className="py-1.5 text-right font-medium">{m.count}</td>
                        <td className="py-1.5 text-right text-green-600">{m.pass}</td>
                        <td className="py-1.5 text-right text-red-600">{m.fail}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Download */}
          <div className="bg-white border border-gray-200 rounded-xl p-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="font-semibold text-gray-900">Export Report</h2>
                <p className="text-sm text-gray-500 mt-0.5">Generate a state-compliant PDF for regulatory submission</p>
              </div>
              <div className="flex gap-3">
                <button
                  onClick={generatePDF}
                  disabled={generating}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50"
                >
                  {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />}
                  {generating ? 'Generating PDF...' : 'Download PDF'}
                </button>
                <a
                  href={`/api/v1/export/compliance.csv`}
                  className="flex items-center gap-2 px-4 py-2 border border-gray-300 text-gray-600 text-sm font-medium rounded-lg hover:bg-gray-50"
                >
                  <Download className="w-4 h-4" /> Export CSV
                </a>
              </div>
            </div>
          </div>
        </div>
      )}

      {!data && !loading && (
        <div className="bg-white border border-gray-200 rounded-xl p-12 text-center">
          <Clock className="w-10 h-10 text-gray-200 mx-auto mb-3" />
          <p className="text-gray-400">Select a year and click Generate Report to view your annual summary.</p>
        </div>
      )}
    </div>
  );
}
