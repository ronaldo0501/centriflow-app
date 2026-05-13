'use client';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import PageHeader from '@/components/PageHeader';
import { Save, Loader2 } from 'lucide-react';

export default function SettingsPage() {
  const [org, setOrg] = useState<{ name: string; timezone: string; plan_tier: string; cw_enabled: boolean; lob_enabled: boolean } | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    api.get('/api/v1/org').then(res => setOrg(res.data)).catch(console.error);
  }, []);

  const handleSave = async () => {
    if (!org) return;
    setSaving(true);
    try {
      await api.patch('/api/v1/org', { name: org.name, timezone: org.timezone });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  if (!org) return <div className="flex items-center justify-center h-64 text-gray-400">Loading...</div>;

  return (
    <div className="max-w-2xl">
      <PageHeader title="Settings" subtitle="Organization configuration" />

      <div className="space-y-6">
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="font-semibold text-gray-900 mb-4">Organization</h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Organization Name</label>
              <input
                value={org.name}
                onChange={e => setOrg({ ...org, name: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Timezone</label>
              <select
                value={org.timezone}
                onChange={e => setOrg({ ...org, timezone: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {['America/Denver', 'America/Chicago', 'America/New_York', 'America/Los_Angeles', 'America/Phoenix'].map(tz => (
                  <option key={tz} value={tz}>{tz}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="font-semibold text-gray-900 mb-4">Plan & Features</h2>
          <div className="space-y-3 text-sm">
            <div className="flex items-center justify-between py-2 border-b border-gray-50">
              <span className="text-gray-700">Plan Tier</span>
              <span className="font-medium capitalize text-blue-600">{org.plan_tier}</span>
            </div>
            <div className="flex items-center justify-between py-2 border-b border-gray-50">
              <span className="text-gray-700">Cityworks Integration</span>
              <span className={org.cw_enabled ? 'text-green-600 font-medium' : 'text-gray-400'}>
                {org.cw_enabled ? 'Enabled' : 'Not configured'}
              </span>
            </div>
            <div className="flex items-center justify-between py-2">
              <span className="text-gray-700">Postal Mail (Lob.com)</span>
              <span className={org.lob_enabled ? 'text-green-600 font-medium' : 'text-gray-400'}>
                {org.lob_enabled ? 'Enabled' : 'Disabled'}
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
          {saved && <span className="text-sm text-green-600 font-medium">Saved!</span>}
        </div>
      </div>
    </div>
  );
}
