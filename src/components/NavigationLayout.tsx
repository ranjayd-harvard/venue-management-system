'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { 
  Home, 
  Building2, 
  MapPin, 
  Layers, 
  Network, 
  BarChart3, 
  Users, 
  Menu, 
  ChevronLeft, 
  DollarSign,
  ChevronDown,
  ChevronRight,
  Settings,
  Calculator,
  Timer
} from 'lucide-react';

export default function NavigationLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [pricingOpen, setPricingOpen] = useState(
    pathname.startsWith('/pricing') || pathname.startsWith('/admin/pricing')
  );

  const isActive = (path: string) => {
    return pathname === path || pathname.startsWith(path + '/');
  };

  const navItems = [
    { href: '/', icon: Home, label: 'Home', color: 'gray' },
    { href: '/hierarchy', icon: Network, label: 'Hierarchy', color: 'red' },
    { href: '/customers', icon: Building2, label: 'Customers', color: 'blue' },
    { href: '/locations', icon: MapPin, label: 'Locations', color: 'green' },
    { href: '/venues', icon: Users, label: 'Venues', color: 'purple' },
    { href: '/relationships', icon: Layers, label: 'Assignments', color: 'oragne' },
    { href: '/graph', icon: BarChart3, label: 'Graph', color: 'gray' },
  ];

  const pricingSubItems = [
    { 
      href: '/pricing/view', 
      icon: Calculator, 
      label: 'Pricing Calculator',
      description: 'Calculate booking prices'
    },
    { 
      href: '/pricing/timeline-view', 
      icon: Timer, 
      label: 'Pricing Timeline',
      description: 'See Pricing Timeline'
    }, 
    {   
      href: '/pricing/timeline-all-sublocations', 
      icon: Timer, 
      label: 'Pricing Sublocations',
      description: 'All Sublocations Pricing'
    },        
    { 
      href: '/admin/pricing-settings', 
      icon: Settings, 
      label: 'Pricing Settings',
      description: 'Default Pricing Setup'
    },
    { 
      href: '/admin/pricing', 
      icon: DollarSign, 
      label: 'Manage Ratesheets',
      description: 'Create pricing rules'
    },
  ];

  const isPricingActive = pathname.startsWith('/pricing') || pathname.startsWith('/admin/pricing');

  return (
    <div className="min-h-screen flex">
      {/* Collapsible Sidebar */}
      <aside 
        className={`fixed left-0 top-16 h-[calc(100vh-4rem)] bg-white shadow-lg border-r border-gray-200 transition-all duration-300 z-30 overflow-y-auto ${
          sidebarOpen ? 'w-64' : 'w-16'
        }`}
      >
        <button
          onClick={() => setSidebarOpen(!sidebarOpen)}
          className="absolute -right-3 top-4 bg-white border border-gray-300 rounded-full p-1 hover:bg-gray-100 z-10"
        >
          {sidebarOpen ? <ChevronLeft className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
        </button>

        <nav className="p-4 space-y-2 text-red-400">
          {/* Regular Nav Items */}
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
                {sidebarOpen && <span className="text-sm font-medium">{item.label}</span>}
              </Link>
            );
          })}

          {/* Pricing Menu with Submenu */}
          <div>
            <button
              onClick={() => setPricingOpen(!pricingOpen)}
              className={`w-full flex items-center justify-between px-4 py-3 rounded-lg transition-colors ${
                isPricingActive
                  ? 'bg-emerald-100 text-emerald-700'
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
              title="Pricing"
            >
              <div className="flex items-center space-x-3">
                <DollarSign className="w-5 h-5 flex-shrink-0" />
                {sidebarOpen && <span className="text-sm font-medium">Pricing</span>}
              </div>
              {sidebarOpen && (
                pricingOpen ? 
                  <ChevronDown className="w-4 h-4" /> : 
                  <ChevronRight className="w-4 h-4" />
              )}
            </button>

            {/* Submenu Items */}
            {pricingOpen && sidebarOpen && (
              <div className="ml-4 mt-2 space-y-1 border-l-2 border-emerald-200 pl-4">
                {pricingSubItems.map((subItem) => {
                  const SubIcon = subItem.icon;
                  const active = pathname === subItem.href;
                  
                  return (
                    <Link
                      key={subItem.href}
                      href={subItem.href}
                      className={`flex items-start space-x-3 px-3 py-2 rounded-lg transition-colors group ${
                        active
                          ? 'bg-emerald-50 text-emerald-700'
                          : 'text-gray-600 hover:bg-gray-50'
                      }`}
                      title={subItem.label}
                    >
                      <SubIcon className="w-4 h-4 flex-shrink-0 mt-0.5" />
                      <div className="flex-1 min-w-0">
                        <div className={`text-xs font-medium ${
                          active ? 'text-emerald-700' : 'text-gray-700'
                        }`}>
                          {subItem.label}
                        </div>
                        <div className="text-xs text-gray-500 mt-0.5">
                          {subItem.description}
                        </div>
                      </div>
                    </Link>
                  );
                })}
              </div>
            )}

            {/* Collapsed State - Show submenu on hover */}
            {!sidebarOpen && (
              <div className="relative group">
                <div className="absolute left-full top-0 ml-2 w-56 bg-white shadow-lg rounded-lg border border-gray-200 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50">
                  <div className="p-3 border-b border-gray-100">
                    <div className="flex items-center space-x-2 text-emerald-700">
                      <DollarSign className="w-5 h-5" />
                      <span className="font-semibold text-sm">Pricing</span>
                    </div>
                  </div>
                  <div className="p-2 space-y-1">
                    {pricingSubItems.map((subItem) => {
                      const SubIcon = subItem.icon;
                      const active = pathname === subItem.href;
                      
                      return (
                        <Link
                          key={subItem.href}
                          href={subItem.href}
                          className={`flex items-start space-x-3 px-3 py-2 rounded-lg transition-colors ${
                            active
                              ? 'bg-emerald-50 text-emerald-700'
                              : 'text-gray-600 hover:bg-gray-50'
                          }`}
                        >
                          <SubIcon className="w-4 h-4 flex-shrink-0 mt-0.5" />
                          <div className="flex-1">
                            <div className={`text-xs font-medium ${
                              active ? 'text-emerald-700' : 'text-gray-700'
                            }`}>
                              {subItem.label}
                            </div>
                            <div className="text-xs text-gray-500 mt-0.5">
                              {subItem.description}
                            </div>
                          </div>
                        </Link>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}
          </div>
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
                 pathname === '/pricing/view' ? 'Pricing Calculator' :
                 pathname === '/admin/pricing-settings' ? 'Pricing Settings' :
                 pathname === '/admin/pricing' ? 'Manage Ratesheets' :
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
