'use client';
import { useState } from 'react';
import { api } from '@/lib/api';
import { formatDate } from '@/lib/utils';
import StatusPill from '@/components/StatusPill';
import { Droplets, Search, ClipboardList, Loader2 } from 'lucide-react';

interface DeviceResult {
  id: string;
  tag_number: string;
  assembly_type: string;
  size: string;
  manufacturer?: string;
  model_number?: string;
  last_test_date?: string;
  last_test_result: string;
  next_test_due?: string;
  address_line1: string;
  city: string;
  state: string;
}

export default function TesterPortalPage() {
  const [orgSlug, setOrgSlug] = useState('');
  const [searchTag, setSearchTag] = useState('');
  const [results, setResults] = useState<DeviceResult[]>([]);
  const [searched, setSearched] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [selectedDevice, setSelectedDevice] = useState<DeviceResult | null>(null);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    setSearched(false);
    try {
      const params = new URLSearchParams({ org_slug: orgSlug, tag: searchTag });
      const res = await api.get(`/api/v1/devices/lookup?${params}`);
      setResults(res.data);
      setSearched(true);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Search failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-slate-100">
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center gap-3">
          <div className="bg-blue-600 p-2 rounded-lg">
            <Droplets className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="font-bold text-gray-900">CentriFlow Tester Portal</h1>
            <p className="text-xs text-gray-500">Certified Backflow Prevention Tester</p>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Search */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 mb-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-1">Find a Device</h2>
          <p className="text-sm text-gray-500 mb-4">Enter the organization and device tag number to look up a backflow assembly.</p>

          <form onSubmit={handleSearch} className="flex flex-col sm:flex-row gap-3">
            <input
              value={orgSlug}
              onChange={e => setOrgSlug(e.target.value)}
              placeholder="Organization (e.g. cedar-hills)"
              className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
            <input
              value={searchTag}
              onChange={e => setSearchTag(e.target.value)}
              placeholder="Tag number (e.g. CH-0001)"
              className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
            <button
              type="submit"
              disabled={loading}
              className="flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
              Search
            </button>
          </form>

          {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
        </div>

        {/* Results */}
        {searched && results.length === 0 && (
          <div className="text-center py-12 text-gray-400">No devices found for that tag number.</div>
        )}

        {results.map(device => (
          <div
            key={device.id}
            className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 mb-4 cursor-pointer hover:border-blue-300 transition-colors"
            onClick={() => setSelectedDevice(selectedDevice?.id === device.id ? null : device)}
          >
            <div className="flex items-center justify-between">
              <div>
                <div className="flex items-center gap-3">
                  <h3 className="font-bold text-gray-900 text-lg">{device.tag_number}</h3>
                  <StatusPill status={device.last_test_result} />
                </div>
                <p className="text-sm text-gray-600 mt-0.5">{device.address_line1}, {device.city}, {device.state}</p>
              </div>
              <div className="text-right text-sm text-gray-500">
                <p>{device.assembly_type} · {device.size}</p>
                <p>{device.manufacturer} {device.model_number}</p>
              </div>
            </div>

            {selectedDevice?.id === device.id && (
              <div className="mt-4 pt-4 border-t border-gray-100">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm mb-4">
                  <div>
                    <p className="text-gray-500 text-xs mb-0.5">Last Test</p>
                    <p className="font-medium">{formatDate(device.last_test_date)}</p>
                  </div>
                  <div>
                    <p className="text-gray-500 text-xs mb-0.5">Last Result</p>
                    <StatusPill status={device.last_test_result} />
                  </div>
                  <div>
                    <p className="text-gray-500 text-xs mb-0.5">Next Due</p>
                    <p className="font-medium">{formatDate(device.next_test_due)}</p>
                  </div>
                  <div>
                    <p className="text-gray-500 text-xs mb-0.5">Type</p>
                    <p className="font-medium">{device.assembly_type} · {device.size}</p>
                  </div>
                </div>
                <button className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700">
                  <ClipboardList className="w-4 h-4" />
                  Submit Test Report for This Device
                </button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
