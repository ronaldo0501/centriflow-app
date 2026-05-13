'use client';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { formatDate, daysUntil, cn } from '@/lib/utils';
import { Device } from '@/types';
import StatusPill from '@/components/StatusPill';
import PageHeader from '@/components/PageHeader';
import Link from 'next/link';
import { Search, Plus, AlertTriangle } from 'lucide-react';

export default function DevicesPage() {
  const [devices, setDevices] = useState<Device[]>([]);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('active');
  const [loading, setLoading] = useState(true);

  const fetchDevices = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ status: statusFilter, per_page: '100' });
      if (search) params.set('search', search);
      const res = await api.get(`/api/v1/devices?${params}`);
      setDevices(res.data);
      setTotal(res.meta.total);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { fetchDevices(); }, [statusFilter]);
  useEffect(() => {
    const t = setTimeout(fetchDevices, 300);
    return () => clearTimeout(t);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  const getDueColor = (date: string | undefined) => {
    const days = daysUntil(date);
    if (days === null) return '';
    if (days < 0) return 'text-red-600 font-semibold';
    if (days <= 30) return 'text-amber-600 font-semibold';
    return 'text-gray-600';
  };

  return (
    <div>
      <PageHeader
        title="Devices"
        subtitle={`${total} total backflow assemblies`}
        action={
          <button className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors">
            <Plus className="w-4 h-4" /> Add Device
          </button>
        }
      />

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search tag # or address..."
            className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div className="flex gap-2">
          {['active', 'inactive', 'removed'].map(s => (
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
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="text-left px-4 py-3 font-medium text-gray-600">Tag #</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Address</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Type / Size</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Hazard</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Last Test</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Next Due</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading && (
                <tr><td colSpan={7} className="text-center py-12 text-gray-400">Loading...</td></tr>
              )}
              {!loading && devices.length === 0 && (
                <tr><td colSpan={7} className="text-center py-12 text-gray-400">No devices found</td></tr>
              )}
              {!loading && devices.map(d => (
                <tr key={d.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <Link href={`/devices/${d.id}`} className="font-medium text-blue-600 hover:underline">
                      {d.tag_number}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-gray-700">
                    <div>{d.address_line1}</div>
                    <div className="text-xs text-gray-400">{d.city}, {d.state}</div>
                  </td>
                  <td className="px-4 py-3 text-gray-700">{d.assembly_type} · {d.size}</td>
                  <td className="px-4 py-3">
                    <StatusPill status={d.hazard_classification} />
                  </td>
                  <td className="px-4 py-3 text-gray-600">
                    <div>{formatDate(d.last_test_date)}</div>
                    {d.last_test_result && <StatusPill status={d.last_test_result} className="mt-1" />}
                  </td>
                  <td className={cn('px-4 py-3', getDueColor(d.next_test_due))}>
                    {d.next_test_due ? (
                      <div className="flex items-center gap-1">
                        {daysUntil(d.next_test_due)! < 0 && <AlertTriangle className="w-3.5 h-3.5" />}
                        {formatDate(d.next_test_due)}
                      </div>
                    ) : '—'}
                  </td>
                  <td className="px-4 py-3"><StatusPill status={d.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
