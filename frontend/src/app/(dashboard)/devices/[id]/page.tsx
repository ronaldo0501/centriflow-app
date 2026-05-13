'use client';
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { api } from '@/lib/api';
import { formatDate } from '@/lib/utils';
import { Device, TestReport } from '@/types';
import StatusPill from '@/components/StatusPill';
import PageHeader from '@/components/PageHeader';
import Link from 'next/link';
import { ArrowLeft, MapPin, User, Calendar } from 'lucide-react';

export default function DeviceDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [device, setDevice] = useState<Device & { recent_tests: TestReport[] } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get(`/api/v1/devices/${id}`)
      .then(res => setDevice(res.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) return <div className="flex items-center justify-center h-64 text-gray-400">Loading...</div>;
  if (!device) return <div className="text-center py-12 text-gray-400">Device not found</div>;

  return (
    <div>
      <div className="mb-6">
        <Link href="/devices" className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 mb-4">
          <ArrowLeft className="w-4 h-4" /> Back to Devices
        </Link>
        <PageHeader
          title={`Device ${device.tag_number}`}
          subtitle={`${device.assembly_type} · ${device.size} · ${device.manufacturer || ''} ${device.model_number || ''}`}
          action={<StatusPill status={device.status} />}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Device details */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h2 className="font-semibold text-gray-900 mb-4">Assembly Information</h2>
            <dl className="grid grid-cols-2 gap-4 text-sm">
              {[
                ['Tag Number', device.tag_number],
                ['Assembly Type', device.assembly_type],
                ['Size', device.size],
                ['Manufacturer', device.manufacturer || '—'],
                ['Model Number', device.model_number || '—'],
                ['Serial Number', device.serial_number || '—'],
                ['Hazard Classification', <StatusPill key="h" status={device.hazard_classification} />],
                ['Service Type', device.service_type || '—'],
                ['Install Date', formatDate(device.install_date)],
                ['Test Frequency', `Every ${device.test_frequency_months} months`],
              ].map(([label, value]) => (
                <div key={String(label)}>
                  <dt className="text-gray-500 text-xs mb-0.5">{label}</dt>
                  <dd className="font-medium text-gray-900">{value}</dd>
                </div>
              ))}
            </dl>
            {device.location_notes && (
              <div className="mt-4 pt-4 border-t border-gray-100">
                <dt className="text-gray-500 text-xs mb-0.5">Location Notes</dt>
                <dd className="text-sm text-gray-700">{device.location_notes}</dd>
              </div>
            )}
          </div>

          {/* Recent Tests */}
          <div className="bg-white rounded-xl border border-gray-200">
            <div className="px-6 py-4 border-b border-gray-100">
              <h2 className="font-semibold text-gray-900">Test History</h2>
            </div>
            <div className="divide-y divide-gray-50">
              {(!device.recent_tests || device.recent_tests.length === 0) && (
                <div className="px-6 py-8 text-center text-sm text-gray-400">No test reports yet</div>
              )}
              {device.recent_tests?.map(r => (
                <div key={r.id} className="px-6 py-4 flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <StatusPill status={r.result} />
                      <span className="text-sm font-medium text-gray-900">{formatDate(r.test_date)}</span>
                    </div>
                    <p className="text-xs text-gray-500 mt-0.5">{r.tester_name} · {r.test_event_type}</p>
                  </div>
                  <div className="text-right">
                    <StatusPill status={r.status} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h2 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <MapPin className="w-4 h-4 text-gray-400" /> Property
            </h2>
            <div className="text-sm space-y-1">
              <p className="font-medium text-gray-900">{device.address_line1}</p>
              <p className="text-gray-500">{device.city}, {device.state} {device.zip}</p>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h2 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <User className="w-4 h-4 text-gray-400" /> Owner
            </h2>
            <div className="text-sm space-y-1">
              <p className="font-medium text-gray-900">{device.owner_name || '—'}</p>
              {device.owner_email && <p className="text-gray-500">{device.owner_email}</p>}
              {device.owner_phone && <p className="text-gray-500">{device.owner_phone}</p>}
            </div>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h2 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <Calendar className="w-4 h-4 text-gray-400" /> Compliance
            </h2>
            <div className="text-sm space-y-3">
              <div>
                <p className="text-gray-500 text-xs">Last Test</p>
                <p className="font-medium text-gray-900">{formatDate(device.last_test_date)}</p>
                {device.last_test_result && <StatusPill status={device.last_test_result} className="mt-1" />}
              </div>
              <div>
                <p className="text-gray-500 text-xs">Next Due</p>
                <p className="font-medium text-gray-900">{formatDate(device.next_test_due)}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
