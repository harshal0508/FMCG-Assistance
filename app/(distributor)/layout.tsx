'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  LayoutDashboard,
  Inbox,
  Boxes,
  Store,
  Truck,
  PlusCircle,
  Languages,
  ShieldCheck,
  LogOut,
  CreditCard,
  Tag,
  Percent,
  FileSpreadsheet,
  Smartphone,
  Settings,
  Calendar,
  Send,
  BarChart3,
  Menu,
  X,
} from 'lucide-react';
import { useTranslation } from '@/lib/i18n/context';

export default function DistributorLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const { language, setLanguage, t } = useTranslation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Dynamic tenant and owner profile state
  const [profile, setProfile] = useState({
    businessName: 'Demo Traders',
    ownerName: 'Demo Owner',
    city: 'Ratlam',
    state: 'Madhya Pradesh',
  });

  useEffect(() => {
    let isMounted = true;
    const fetchProfile = async () => {
      try {
        const res = await fetch('/api/distributor/settings');
        if (res.ok) {
          const data = await res.json();
          if (data?.tenant && isMounted) {
            setProfile({
              businessName: data.tenant.name || 'Demo Traders',
              ownerName: data.tenant.owner_name || 'Demo Owner',
              city: data.tenant.city || 'Ratlam',
              state: data.tenant.state || 'Madhya Pradesh',
            });
          }
        }
      } catch {
        // Fallback to existing state
      }
    };
    fetchProfile();
    return () => {
      isMounted = false;
    };
  }, [pathname]);

  // Close mobile drawer on route transition
  useEffect(() => {
    setMobileMenuOpen(false);
  }, [pathname]);

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } catch {
      // ignore
    }
    router.push('/d/login');
  };

  const navItems = [
    { href: '/d/dashboard', label: t('dashboard'), icon: LayoutDashboard },
    { href: '/d/orders', label: t('orders'), icon: Inbox },
    { href: '/d/payments', label: language === 'hi' ? 'भुगतान मिलान' : 'Payments', icon: CreditCard },
    { href: '/d/routes', label: language === 'hi' ? 'रूट अनुसूची' : 'Routes', icon: Calendar },
    { href: '/d/campaigns', label: language === 'hi' ? 'ऑर्डर अभियान' : 'Campaigns', icon: Send },
    { href: '/d/analytics', label: language === 'hi' ? 'क्षेत्रीय विश्लेषण' : 'Analytics', icon: BarChart3 },
    { href: '/d/inventory', label: t('inventory'), icon: Boxes },
    { href: '/d/schemes', label: language === 'hi' ? 'व्यापार योजनाएं' : 'Schemes', icon: Tag },
    { href: '/d/shops', label: t('shops'), icon: Store },
    { href: '/d/rate-groups', label: language === 'hi' ? 'दर समूह' : 'Rate Groups', icon: Percent },
    { href: '/d/picklist', label: language === 'hi' ? 'डिलीवरी रूट' : 'Delivery Routes', icon: Truck },
    { href: '/d/reports/scheme-claims', label: language === 'hi' ? 'योजना क्लेम' : 'Scheme Claims', icon: FileSpreadsheet },
    { href: '/d/devices', label: language === 'hi' ? 'डिवाइस' : 'Devices', icon: Smartphone },
    { href: '/d/settings', label: language === 'hi' ? 'सेटिंग्स' : 'Settings', icon: Settings },
  ];

  // Grouped sections for the mobile slide-out drawer
  const mobileNavSections = [
    {
      titleEn: 'Core Operations',
      titleHi: 'मुख्य कार्य',
      items: [
        { href: '/d/dashboard', label: t('dashboard'), icon: LayoutDashboard },
        { href: '/d/orders', label: t('orders'), icon: Inbox },
        { href: '/d/payments', label: language === 'hi' ? 'भुगतान मिलान' : 'Payments', icon: CreditCard },
        { href: '/d/picklist', label: language === 'hi' ? 'डिलीवरी रूट' : 'Pick List', icon: Truck },
      ],
    },
    {
      titleEn: 'Routes & Campaigns',
      titleHi: 'रूट एवं अभियान',
      items: [
        { href: '/d/routes', label: language === 'hi' ? 'रूट अनुसूची' : 'Routes', icon: Calendar },
        { href: '/d/campaigns', label: language === 'hi' ? 'ऑर्डर अभियान' : 'Campaigns', icon: Send },
        { href: '/d/analytics', label: language === 'hi' ? 'क्षेत्रीय विश्लेषण' : 'Analytics', icon: BarChart3 },
      ],
    },
    {
      titleEn: 'Catalog & Retailers',
      titleHi: 'कैटलॉग एवं व्यापारी',
      items: [
        { href: '/d/inventory', label: t('inventory'), icon: Boxes },
        { href: '/d/schemes', label: language === 'hi' ? 'व्यापार योजनाएं' : 'Schemes', icon: Tag },
        { href: '/d/shops', label: t('shops'), icon: Store },
        { href: '/d/rate-groups', label: language === 'hi' ? 'दर समूह' : 'Rate Groups', icon: Percent },
      ],
    },
    {
      titleEn: 'Audit & Settings',
      titleHi: 'सिस्टम एवं सेटिंग्स',
      items: [
        { href: '/d/reports/scheme-claims', label: language === 'hi' ? 'योजना क्लेम' : 'Scheme Claims', icon: FileSpreadsheet },
        { href: '/d/devices', label: language === 'hi' ? 'डिवाइस' : 'Devices', icon: Smartphone },
        { href: '/d/settings', label: language === 'hi' ? 'सेटिंग्स' : 'Settings', icon: Settings },
      ],
    },
  ];

  const toggleLanguage = () => {
    setLanguage(language === 'en' ? 'hi' : 'en');
  };

  const isAuthPage = pathname === '/d/login' || pathname === '/d/join' || pathname?.startsWith('/d/onboard');
  if (isAuthPage) {
    return <>{children}</>;
  }

  const isMoreActive =
    pathname !== '/d/dashboard' &&
    pathname !== '/d/orders' &&
    pathname !== '/d/campaigns' &&
    pathname !== '/d/analytics';

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex flex-col lg:flex-row text-slate-900 font-sans">
      {/* Desktop Left Sidebar (100% preserved as-is) */}
      <aside className="hidden lg:flex flex-col w-64 bg-[#17307A] text-white p-5 border-r border-[#17307A]/20 shrink-0">
        <div className="flex items-center gap-3 pb-6 border-b border-white/10">
          <div className="w-10 h-10 rounded-xl bg-[#F58220] text-white flex items-center justify-center font-bold text-lg shadow-sm">
            V
          </div>
          <div className="min-w-0">
            <div className="font-bold text-base tracking-wide truncate">Vitarak Hub</div>
            <div className="text-xs text-white/70 truncate">{profile.businessName}</div>
          </div>
        </div>

        {/* Navigation Items */}
        <nav className="flex flex-col gap-1.5 py-6 flex-1 text-sm font-medium">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 px-3.5 py-2.5 rounded-xl transition-colors ${
                  isActive
                    ? 'bg-white/20 text-white font-semibold'
                    : 'text-white/80 hover:bg-white/10 hover:text-white'
                }`}
              >
                <Icon className="w-5 h-5 shrink-0" />
                <span className="truncate">{item.label}</span>
              </Link>
            );
          })}

          <Link
            href="/d/orders/new"
            className="flex items-center gap-3 px-3.5 py-2.5 rounded-xl bg-[#F58220] text-white font-semibold hover:bg-[#F58220]/90 transition-colors mt-3 shadow-sm"
          >
            <PlusCircle className="w-5 h-5 shrink-0" />
            <span>{language === 'hi' ? 'नया फोन ऑर्डर' : 'New Order'}</span>
          </Link>
        </nav>

        {/* Language Switcher in Sidebar */}
        <div className="py-4 border-t border-white/10">
          <button
            onClick={toggleLanguage}
            className="w-full flex items-center justify-between px-3 py-2 rounded-lg bg-white/10 hover:bg-white/20 text-xs text-white font-medium transition-colors"
          >
            <span className="flex items-center gap-2">
              <Languages className="w-4 h-4 text-[#F58220]" />
              <span>{t('switchLanguage')}</span>
            </span>
            <span className="font-bold px-2 py-0.5 rounded bg-white/20 text-white">
              {language === 'en' ? 'हिंदी' : 'English'}
            </span>
          </button>
        </div>

        {/* Staff User Role Footer & Logout */}
        <div className="pt-4 border-t border-white/10 text-xs text-white/70 space-y-2.5">
          <div className="flex items-center justify-between">
            <div className="min-w-0">
              <div className="font-semibold text-white truncate">{profile.ownerName}</div>
              <div className="text-[11px] text-white/60">
                {language === 'hi' ? 'थोक वितरक' : 'Wholesale Distributor'}
              </div>
            </div>
            <span className="px-2 py-0.5 rounded bg-[#F58220] text-white font-bold text-[10px] uppercase shrink-0">
              {language === 'hi' ? 'मालिक' : 'Owner'}
            </span>
          </div>

          <button
            onClick={handleLogout}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-xl bg-white/10 hover:bg-rose-900/50 hover:text-rose-200 hover:border-rose-700/50 text-xs text-white/90 font-semibold border border-white/15 transition-all shadow-2xs"
          >
            <LogOut className="w-3.5 h-3.5 text-rose-400" />
            <span>{t('logout')}</span>
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 pb-20 lg:pb-0">
        {/* Top Header Bar for Desktop & Mobile */}
        <header className="bg-white border-b border-slate-200 px-3 md:px-8 py-2.5 sm:py-3 flex items-center justify-between sticky top-0 z-30 shadow-xs">
          <div className="flex items-center gap-2 min-w-0 flex-1">
            {/* Mobile Hamburger Trigger */}
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              className="lg:hidden p-1.5 -ml-1 rounded-lg text-slate-700 hover:bg-slate-100 hover:text-[#17307A] flex items-center justify-center transition-colors cursor-pointer shrink-0"
              aria-label="Open navigation menu"
            >
              <Menu className="w-5 h-5 text-[#17307A]" />
            </button>

            <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-[#17307A] text-white font-bold flex items-center justify-center text-xs sm:text-sm shadow-xs shrink-0">
              V
            </div>

            <div className="min-w-0 flex-1">
              <div className="font-bold text-xs sm:text-sm md:text-base text-[#17307A] leading-tight truncate">
                {profile.businessName}
              </div>
              <div className="text-[10px] sm:text-xs text-slate-500 truncate">
                <span className="sm:hidden">{profile.city}</span>
                <span className="hidden sm:inline">
                  {profile.city}, {profile.state} • {language === 'hi' ? 'सक्रिय वितरण सत्र' : 'Active Trading Session'}
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0 ml-1.5">
            {/* Language Toggle Pill */}
            <button
              type="button"
              onClick={toggleLanguage}
              className="flex items-center gap-1 px-2 sm:px-2.5 py-1 sm:py-1.5 rounded-lg border border-slate-300 hover:border-[#17307A] hover:bg-slate-50 text-[11px] sm:text-xs font-semibold text-slate-700 transition-colors cursor-pointer shrink-0"
              title={language === 'en' ? 'Switch to Hindi' : 'Switch to English'}
            >
              <Languages className="w-3.5 h-3.5 text-[#F58220] shrink-0" />
              <span className="font-bold text-[#17307A] whitespace-nowrap">
                {language === 'en' ? 'हिंदी' : 'Eng'}
              </span>
            </button>

            {/* Log Out Button */}
            <button
              type="button"
              onClick={handleLogout}
              className="p-1 sm:px-2.5 sm:py-1.5 rounded-lg border border-slate-200 hover:border-rose-300 hover:bg-rose-50 text-xs font-semibold text-slate-600 hover:text-rose-700 transition-colors cursor-pointer shrink-0"
              title={t('logout')}
            >
              <LogOut className="w-3.5 h-3.5 text-rose-500" />
              <span className="hidden sm:inline">{t('logout')}</span>
            </button>

            <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-emerald-50 text-emerald-700 text-xs font-medium border border-emerald-200">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>{language === 'hi' ? 'प्रमाणित सत्र' : 'Secure Session'}</span>
            </div>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 p-3.5 md:p-6 lg:p-8 max-w-7xl w-full mx-auto">
          {children}
        </main>
      </div>

      {/* Mobile Slide-Out Navigation Drawer */}
      {mobileMenuOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex">
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs transition-opacity"
            onClick={() => setMobileMenuOpen(false)}
          />

          {/* Drawer Panel */}
          <div className="relative w-[84%] max-w-xs bg-[#17307A] text-white flex flex-col h-full shadow-2xl z-10 animate-in slide-in-from-left duration-200">
            {/* Drawer Header */}
            <div className="p-4 border-b border-white/10 flex items-center justify-between">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-9 h-9 rounded-xl bg-[#F58220] text-white flex items-center justify-center font-bold text-base shadow-sm shrink-0">
                  V
                </div>
                <div className="min-w-0">
                  <div className="font-bold text-sm tracking-wide truncate">{profile.businessName}</div>
                  <div className="text-[11px] text-white/70 truncate">{profile.city}, {profile.state}</div>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setMobileMenuOpen(false)}
                className="w-8 h-8 rounded-lg bg-white/10 hover:bg-white/20 text-white/80 hover:text-white flex items-center justify-center transition-colors cursor-pointer shrink-0 ml-2"
                aria-label="Close navigation"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Quick Action: New Phone Order */}
            <div className="p-3 border-b border-white/10">
              <Link
                href="/d/orders/new"
                onClick={() => setMobileMenuOpen(false)}
                className="w-full flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl bg-[#F58220] text-white font-bold text-xs hover:bg-[#F58220]/90 transition-colors shadow-sm"
              >
                <PlusCircle className="w-4 h-4" />
                <span>{language === 'hi' ? 'नया फोन ऑर्डर दर्ज करें' : 'Create New Phone Order'}</span>
              </Link>
            </div>

            {/* Scrollable Nav Sections */}
            <div className="flex-1 overflow-y-auto p-3 space-y-4 text-xs">
              {mobileNavSections.map((section, idx) => (
                <div key={idx} className="space-y-1">
                  <div className="px-2.5 py-1 text-[10px] font-bold text-white/40 uppercase tracking-wider">
                    {language === 'hi' ? section.titleHi : section.titleEn}
                  </div>
                  {section.items.map((item) => {
                    const Icon = item.icon;
                    const isActive = pathname === item.href;
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        onClick={() => setMobileMenuOpen(false)}
                        className={`flex items-center gap-3 px-3 py-2 rounded-xl transition-colors ${
                          isActive
                            ? 'bg-white/20 text-white font-bold'
                            : 'text-white/80 hover:bg-white/10 hover:text-white'
                        }`}
                      >
                        <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-[#F58220]' : 'text-white/70'}`} />
                        <span className="truncate">{item.label}</span>
                      </Link>
                    );
                  })}
                </div>
              ))}
            </div>

            {/* Drawer Footer */}
            <div className="p-3 border-t border-white/10 bg-[#11235A] space-y-2 text-xs">
              {/* Language Switch */}
              <button
                type="button"
                onClick={toggleLanguage}
                className="w-full flex items-center justify-between px-3 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white font-medium transition-colors cursor-pointer"
              >
                <span className="flex items-center gap-2">
                  <Languages className="w-4 h-4 text-[#F58220]" />
                  <span>{t('switchLanguage')}</span>
                </span>
                <span className="font-bold px-2 py-0.5 rounded bg-white/20 text-white text-[11px]">
                  {language === 'en' ? 'हिंदी' : 'English'}
                </span>
              </button>

              {/* User Profile & Logout */}
              <div className="flex items-center justify-between pt-1">
                <div className="min-w-0">
                  <div className="font-bold text-white truncate text-xs">{profile.ownerName}</div>
                  <div className="text-[10px] text-white/60">
                    {language === 'hi' ? 'थोक वितरक मालिक' : 'Wholesale Owner'}
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleLogout}
                  className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-rose-500/20 text-rose-300 hover:bg-rose-500/30 text-[11px] font-semibold border border-rose-400/30 transition-colors cursor-pointer"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>{t('logout')}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Mobile Bottom Navigation Bar (Hidden on lg+) */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-slate-200 shadow-lg px-1 h-16 flex items-center justify-around">
        {/* 1. Dashboard */}
        <Link
          href="/d/dashboard"
          className={`flex flex-col items-center justify-center flex-1 py-1 transition-colors ${
            pathname === '/d/dashboard' ? 'text-[#17307A] font-bold' : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          <LayoutDashboard className={`w-5 h-5 ${pathname === '/d/dashboard' ? 'text-[#17307A]' : 'text-slate-500'}`} />
          <span className="text-[11px] mt-0.5 truncate">{t('dashboard')}</span>
        </Link>

        {/* 2. Orders */}
        <Link
          href="/d/orders"
          className={`flex flex-col items-center justify-center flex-1 py-1 transition-colors ${
            pathname === '/d/orders' ? 'text-[#17307A] font-bold' : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          <Inbox className={`w-5 h-5 ${pathname === '/d/orders' ? 'text-[#17307A]' : 'text-slate-500'}`} />
          <span className="text-[11px] mt-0.5 truncate">{t('orders')}</span>
        </Link>

        {/* 3. Campaigns */}
        <Link
          href="/d/campaigns"
          className={`flex flex-col items-center justify-center flex-1 py-1 transition-colors ${
            pathname === '/d/campaigns' ? 'text-[#17307A] font-bold' : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          <Send className={`w-5 h-5 ${pathname === '/d/campaigns' ? 'text-[#17307A]' : 'text-slate-500'}`} />
          <span className="text-[11px] mt-0.5 truncate">{language === 'hi' ? 'अभियान' : 'Campaigns'}</span>
        </Link>

        {/* 4. Analytics */}
        <Link
          href="/d/analytics"
          className={`flex flex-col items-center justify-center flex-1 py-1 transition-colors ${
            pathname === '/d/analytics' ? 'text-[#17307A] font-bold' : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          <BarChart3 className={`w-5 h-5 ${pathname === '/d/analytics' ? 'text-[#17307A]' : 'text-slate-500'}`} />
          <span className="text-[11px] mt-0.5 truncate">{language === 'hi' ? 'विश्लेषण' : 'Analytics'}</span>
        </Link>

        {/* 5. More / Menu Drawer Trigger */}
        <button
          type="button"
          onClick={() => setMobileMenuOpen(true)}
          className={`flex flex-col items-center justify-center flex-1 py-1 transition-colors relative cursor-pointer ${
            isMoreActive ? 'text-[#17307A] font-bold' : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          <div className="relative">
            <Menu className={`w-5 h-5 ${isMoreActive ? 'text-[#17307A]' : 'text-slate-500'}`} />
            {isMoreActive && (
              <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-[#F58220]" />
            )}
          </div>
          <span className="text-[11px] mt-0.5 truncate">{language === 'hi' ? 'मेनू' : 'Menu'}</span>
        </button>
      </nav>
    </div>
  );
}
