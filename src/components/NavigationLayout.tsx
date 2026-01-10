'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, Building2, MapPin, Layers, Network, BarChart3, Users, Menu, X, ChevronLeft } from 'lucide-react';

export default function NavigationLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(true);

  const isActive = (path: string) => {
    return pathname === path || pathname.startsWith(path + '/');
  };

  const navItems = [
    { href: '/', icon: Home, label: 'Home', color: 'gray' },
    { href: '/hierarchy', icon: Network, label: 'Hierarchy', color: 'red' },
    { href: '/customers', icon: Building2, label: 'Customers', color: 'blue' },
    { href: '/locations', icon: MapPin, label: 'Locations', color: 'green' },
    { href: '/venues', icon: Users, label: 'Venues', color: 'purple' },
    { href: '/relationships', icon: Layers, label: 'Assignments', color: 'yellow' },
    { href: '/graph', icon: BarChart3, label: 'Graph', color: 'orange' },
    { href: '/admin/pricing', icon: BarChart3, label: 'Pricing', color: 'blue' },
  ];

  return (
    <div className="min-h-screen flex">
      {/* Collapsible Sidebar */}
      <aside 
        className={`fixed left-0 top-16 h-[calc(100vh-4rem)] bg-white shadow-lg border-r border-gray-200 transition-all duration-300 z-30 ${
          sidebarOpen ? 'w-64' : 'w-16'
        }`}
      >
        <button
          onClick={() => setSidebarOpen(!sidebarOpen)}
          className="absolute -right-3 top-4 bg-gray-700 border border-gray-300 rounded-full p-1 hover:bg-gray-100"
        >
          {sidebarOpen ? <ChevronLeft className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
        </button>

        <nav className="p-4 space-y-2">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = isActive(item.href);
            
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center space-x-3 px-4 py-3 rounded-lg transition-colors ${
                  active
                    ? `bg-${item.color}-100 text-${item.color}-700`
                    : 'text-gray-600 hover:bg-gray-100'
                }`}
                title={item.label}
              >
                <Icon className="w-5 h-5 flex-shrink-0" />
                {sidebarOpen && <span className="text-sm font-medium text-gray-600">{item.label}</span>}
              </Link>
            );
          })}
        </nav>
      </aside>

      {/* Main Content */}
      <div className={`flex-1 transition-all duration-300 ${sidebarOpen ? 'ml-64' : 'ml-16'}`}>
        {/* Transparent Header */}
        <header className="fixed top-0 right-0 left-0 bg-white/90 backdrop-blur-sm shadow-md border-b border-gray-200 z-40">
          <div className="flex items-center justify-between h-16 px-6">
            <Link href="/" className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center">
                <Network className="w-6 h-6 text-white" />
              </div>
              <span className="text-xl font-bold text-gray-800">Venue Manager</span>
            </Link>

            <div className="flex items-center space-x-4">
              <span className="text-sm text-gray-600">
                {pathname === '/' ? 'Dashboard' : 
                 pathname.split('/')[1].charAt(0).toUpperCase() + pathname.split('/')[1].slice(1)}
              </span>
            </div>
          </div>
        </header>

        {/* Page Content */}
        <main className="pt-16">
          {children}
        </main>
      </div>
    </div>
  );
}
