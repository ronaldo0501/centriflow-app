'use client';
import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { clearAuthData, isAuthenticated } from '@/lib/api';
import { cn } from '@/lib/utils';
import {
  Droplets, LayoutDashboard, Gauge, ClipboardList, AlertTriangle,
  Users, MapPin, DollarSign, Settings, LogOut, Menu, Upload, FileText, Map,
} from 'lucide-react';

const NAV = [
  { href: '/', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/devices', label: 'Devices', icon: Gauge },
  { href: '/test-reports', label: 'Test Reports', icon: ClipboardList },
  { href: '/violations', label: 'Violations', icon: AlertTriangle },
  { href: '/testers', label: 'Testers', icon: Users },
  { href: '/surveys', label: 'Surveys', icon: MapPin },
  { href: '/fees', label: 'Fees', icon: DollarSign },
  { href: '/map', label: 'Map', icon: Map },
  { href: '/import', label: 'Import', icon: Upload },
  { href: '/reports', label: 'Annual Report', icon: FileText },
  { href: '/settings', label: 'Settings', icon: Settings },
];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [user, setUser] = useState<{ name: string; email: string; role: string } | null>(null);

  useEffect(() => {
    if (!isAuthenticated()) { router.push('/login'); return; }
    const stored = localStorage.getItem('cf_user');
    if (stored) setUser(JSON.parse(stored));
  }, [router]);

  const handleLogout = () => {
    clearAuthData();
    router.push('/login');
  };

  const Sidebar = ({ mobile = false }) => (
    <div className={cn('flex flex-col h-full bg-slate-900', mobile ? 'w-full' : 'w-64')}>
      <div className="flex items-center gap-3 px-6 py-5 border-b border-slate-700">
        <div className="bg-blue-500 p-2 rounded-lg">
          <Droplets className="w-5 h-5 text-white" />
        </div>
        <div>
          <p className="text-white font-bold text-sm">CentriFlow</p>
          <p className="text-slate-400 text-xs">Backflow Management</p>
        </div>
      </div>

      <nav className="flex-1 px-3 py-4 space-y-0.5">
        {NAV.map(({ href, label, icon: Icon }) => {
          const active = href === '/' ? pathname === '/' : pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              onClick={() => setSidebarOpen(false)}
              className={cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
                active
                  ? 'bg-blue-600 text-white'
                  : 'text-slate-300 hover:bg-slate-800 hover:text-white'
              )}
            >
              <Icon className="w-4 h-4 flex-shrink-0" />
              {label}
            </Link>
          );
        })}
      </nav>

      <div className="px-3 py-4 border-t border-slate-700">
        {user && (
          <div className="px-3 py-2 mb-2">
            <p className="text-white text-sm font-medium truncate">{user.name}</p>
            <p className="text-slate-400 text-xs truncate">{user.email}</p>
          </div>
        )}
        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-slate-300 hover:bg-slate-800 hover:text-white transition-colors"
        >
          <LogOut className="w-4 h-4" />
          Sign out
        </button>
      </div>
    </div>
  );

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Desktop sidebar */}
      <div className="hidden md:flex flex-shrink-0">
        <Sidebar />
      </div>

      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div className="absolute inset-0 bg-black/50" onClick={() => setSidebarOpen(false)} />
          <div className="absolute left-0 top-0 bottom-0 w-64">
            <Sidebar mobile />
          </div>
        </div>
      )}

      {/* Main content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Mobile topbar */}
        <div className="md:hidden flex items-center gap-3 px-4 py-3 bg-white border-b border-gray-200">
          <button onClick={() => setSidebarOpen(true)}>
            <Menu className="w-6 h-6 text-gray-600" />
          </button>
          <div className="flex items-center gap-2">
            <Droplets className="w-5 h-5 text-blue-600" />
            <span className="font-bold text-gray-900">CentriFlow</span>
          </div>
        </div>

        <main className="flex-1 overflow-y-auto p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
