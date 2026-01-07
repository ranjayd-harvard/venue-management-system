'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, Building2, MapPin, Layers, Network, BarChart3, Users } from 'lucide-react';

export default function NavigationHeader() {
  const pathname = usePathname();

  const isActive = (path: string) => {
    return pathname === path || pathname.startsWith(path + '/');
  };

  const navItems = [
    { href: '/', icon: Home, label: 'Home', color: 'gray' },
    { href: '/hierarchy', icon: Network, label: 'Hierarchy', color: 'indigo' },
    { href: '/customers', icon: Building2, label: 'Customers', color: 'blue' },
    { href: '/locations', icon: MapPin, label: 'Locations', color: 'green' },
    { href: '/venues', icon: Users, label: 'Venues', color: 'purple' },
    { href: '/relationships', icon: Layers, label: 'Assignments', color: 'pink' },
    { href: '/graph', icon: BarChart3, label: 'Graph', color: 'cyan' },
  ];

  return (
    <nav className="bg-white shadow-md border-b border-gray-200">
      <div className="max-w-7xl mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          <Link href="/" className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center">
              <Network className="w-6 h-6 text-white" />
            </div>
            <span className="text-xl font-bold text-gray-800">Venue Manager</span>
          </Link>

          <div className="flex space-x-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const active = isActive(item.href);
              
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center space-x-2 px-4 py-2 rounded-lg transition-colors ${
                    active
                      ? `bg-${item.color}-100 text-${item.color}-700 font-medium`
                      : 'text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span className="text-sm">{item.label}</span>
                </Link>
              );
            })}
          </div>
        </div>
      </div>
    </nav>
  );
}
