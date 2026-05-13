'use client';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { formatDate, daysUntil } from '@/lib/utils';
import StatCard from '@/components/StatCard';
import StatusPill from '@/components/StatusPill';
import PageHeader from '@/components/PageHeader';
import Link from 'next/link';
import { Gauge, AlertTriangle, Clock } from 'lucide-react';

export default function DashboardPage() {
  const [devices, setDevices] = useState<{ data: { last_test_result: string; next_test_due: string; status: string }[]; meta: { total: number } } | null>(null);
  const [violations, setViolations] = useState<{ data: { compliance_deadline: string; status: string; tag_number: string; address_line1: string; violation_type: string }[] } | null>(null);
  const [reports, setReports] = useState<{ data: { result: string; tag_number: string; test_date: string; address_line1: string }[] } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      api.get('/api/v1/devices?per_page=200'),
      api.get('/api/v1/violations?status=open'),
      api.get('/api/v1/reports?per_page=5'),
    ]).then(([d, v, r]) => {
      setDevices(d);
      setViolations(v);
      setReports(r);
    }).catch(console.error).finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="flex items-center justify-center h-64 text-gray-400">Loading...</div>;

  const allDevices = devices?.data || [];
  const totalActive = allDevices.filter(d => d.status === 'active').length;
  const dueSoon = allDevices.filter(d => { const days = daysUntil(d.next_test_due); return days !== null && days <= 30 && days >= 0; }).length;
  const overdue = allDevices.filter(d => { const days = daysUntil(d.next_test_due); return days !== null && days < 0; }).length;
  const openViolations = violations?.data || [];
  const recentReports = reports?.data || [];

  return (
    <div>
      <PageHeader title="Dashboard" subtitle="Backflow prevention program overview" />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard title="Active Devices" value={totalActive} icon={Gauge} color="blue" />
        <StatCard title="Open Violations" value={openViolations.length} icon={AlertTriangle} color="red" />
        <StatCard title="Due in 30 Days" value={dueSoon} icon={Clock} color="amber" />
        <StatCard title="Overdue" value={overdue} icon={AlertTriangle} color="red" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Open Violations */}
        <div className="bg-white rounded-xl border border-gray-200">
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
            <h2 className="font-semibold text-gray-900">Open Violations</h2>
            <Link href="/violations" className="text-sm text-blue-600 hover:underline">View all</Link>
          </div>
          <div className="divide-y divide-gray-50">
            {openViolations.length === 0 && (
              <div className="px-6 py-8 text-center text-sm text-gray-400">No open violations</div>
            )}
            {openViolations.slice(0, 5).map((v) => (
              <div key={v.compliance_deadline + v.tag_number} className="px-6 py-3 flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-900">{v.tag_number}</p>
                  <p className="text-xs text-gray-500">{v.address_line1}</p>
                </div>
                <div className="text-right">
                  <StatusPill status={v.violation_type} />
                  <p className="text-xs text-gray-400 mt-1">Due {formatDate(v.compliance_deadline)}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Recent Test Reports */}
        <div className="bg-white rounded-xl border border-gray-200">
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
            <h2 className="font-semibold text-gray-900">Recent Test Reports</h2>
            <Link href="/test-reports" className="text-sm text-blue-600 hover:underline">View all</Link>
          </div>
          <div className="divide-y divide-gray-50">
            {recentReports.length === 0 && (
              <div className="px-6 py-8 text-center text-sm text-gray-400">No test reports yet</div>
            )}
            {recentReports.map((r, i) => (
              <div key={i} className="px-6 py-3 flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-900">{r.tag_number}</p>
                  <p className="text-xs text-gray-500">{r.address_line1}</p>
                </div>
                <div className="text-right">
                  <StatusPill status={r.result} />
                  <p className="text-xs text-gray-400 mt-1">{formatDate(r.test_date)}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
