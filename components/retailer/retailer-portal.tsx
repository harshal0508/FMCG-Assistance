'use client';

import React, { useState, useEffect, useMemo } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { formatPaise } from '@/lib/money';
import { useLanguage } from '@/lib/i18n/context';
import {
  Store,
  ShieldCheck,
  ShoppingBag,
  Sparkles,
  Percent,
  X,
  ChevronRight,
  ShieldAlert,
  ArrowRight,
  Truck,
  User,
  Boxes,
  Clock,
  ArrowLeftRight,
  TrendingUp,
  LogOut,
} from 'lucide-react';
import { RouteCutoffResult } from '@/lib/services/route-cutoff';
import { HistoricalOrder } from './modals/bill-modal';

export type { HistoricalOrder };

// Code-split components via next/dynamic (Part 1.6 Performance Budget Compliance)
const OffersTab = dynamic(() => import('./tabs/offers-tab'), {
  loading: () => <TabSkeleton />,
});
const CatalogTab = dynamic(() => import('./tabs/catalog-tab'), {
  loading: () => <TabSkeleton />,
});
const OrdersTab = dynamic(() => import('./tabs/orders-tab'), {
  loading: () => <TabSkeleton />,
});
const ProfileTab = dynamic(() => import('./tabs/profile-tab'), {
  loading: () => <TabSkeleton />,
});

// Lazy-load Cart Drawer & Bill Modal (QRCode library is isolated inside BillModal)
const CartDrawer = dynamic(() => import('./modals/cart-drawer'), {
  ssr: false,
});
const BillModal = dynamic(() => import('./modals/bill-modal'), {
  ssr: false,
});

function TabSkeleton() {
  return (
    <div className="space-y-3 animate-pulse p-2">
      <div className="h-24 bg-slate-200/80 rounded-2xl w-full" />
      <div className="h-36 bg-slate-200/70 rounded-2xl w-full" />
      <div className="h-28 bg-slate-200/60 rounded-2xl w-full" />
    </div>
  );
}

export interface RetailerProduct {
  id: string;
  name: string;
  hindi_name: string | null;
  brand_id: string | null;
  brand_name: string;
  sub_group: string | null;
  mrp_paise: number | null;
  rate_paise: number;
  stock_qty: number;
  in_stock_flag: boolean;
  default_order_unit: string | null;
  base_unit: string | null;
  is_new: boolean;
}

export interface RetailerScheme {
  id: string;
  name: string;
  type: string;
  discount_percent?: number | null;
  discount_paise?: number | null;
  description?: string;
  rule_json?: string;
}

export interface LastOrderSummary {
  id: string;
  order_number: string;
  created_at: string;
  total_paise: number;
  lines: {
    tenant_product_id: string;
    product_name: string;
    display_quantity: number;
    order_unit_name: string;
    price_paise: number;
  }[];
}

export interface RetailerSubstitution {
  id: string;
  order_number: string;
  original_product_name: string;
  suggested_product_name: string;
  requested_qty: number;
}

export interface FestivalSuggestionItem {
  id: string;
  name: string;
  start_date: string;
  end_date: string;
  notes?: string | null;
  items: {
    tenant_product_id: string;
    product_name: string;
    brand_name: string;
    suggested_qty_base: number;
    unit_name: string;
    rate_paise: number;
  }[];
}

interface Props {
  token: string;
  shop: {
    id: string;
    name: string;
    owner_name: string;
    shop_number: string;
    phone: string;
    address?: string;
    area_name: string;
    hold_flag: boolean;
    usual_order_interval_days: number;
  };
  tenant: {
    id: string;
    name: string;
    owner_name?: string | null;
    order_cutoff_time: string;
    upi_id: string | null;
    phone: string | null;
    address: string | null;
    enable_gst?: boolean;
  };
  brands: { id: string; name: string }[];
  products: RetailerProduct[];
  schemes: RetailerScheme[];
  lastOrder: LastOrderSummary | null;
  ordersHistory?: HistoricalOrder[];
  substitutions: RetailerSubstitution[];
  festivalSuggestions?: FestivalSuggestionItem[];
  routeCutoff?: RouteCutoffResult | null;
  isSmartReorderEligible?: boolean;
}

type TabType = 'OFFERS' | 'CATALOG' | 'ORDERS' | 'PROFILE';

export default function RetailerPortal({
  token,
  shop,
  tenant,
  brands,
  products,
  schemes,
  lastOrder,
  ordersHistory = [],
  substitutions: initialSubstitutions,
  festivalSuggestions = [],
  routeCutoff,
  isSmartReorderEligible = false,
}: Props) {
  const { t, language, setLanguage } = useLanguage();

  // Navigation tab state (4 bottom pages)
  const [activeTab, setActiveTab] = useState<TabType>('OFFERS');

  // Support URL param for screenshot capture & direct tab linking
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const tabParam = params.get('tab');
      if (tabParam === 'CATALOG' || tabParam === 'ORDERS' || tabParam === 'PROFILE' || tabParam === 'OFFERS') {
        setActiveTab(tabParam as TabType);
      }
      if (params.get('modal') === 'you-save' && schemes.length > 0) {
        setSelectedSavingsScheme(schemes[0]);
      }
    }
  }, [schemes]);

  // Cart state: Record<productId, quantity>
  const [cart, setCart] = useState<Record<string, number>>({});
  const [selectedBrandId, setSelectedBrandId] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [showCartDrawer, setShowCartDrawer] = useState(false);
  const [isPlacingOrder, setIsPlacingOrder] = useState(false);
  const [placedOrderInfo, setPlacedOrderInfo] = useState<any | null>(null);
  const [activeSubstitutions, setActiveSubstitutions] = useState(initialSubstitutions);
  const [submittingSubId, setSubmittingSubId] = useState<string | null>(null);

  // Registered wholesale distributors for this shopkeeper (Ratlam wholesale hub)
  const registeredDistributors = useMemo(() => [
    {
      id: tenant.id || 'tenant_shree_shyam_alwar',
      name: tenant.name || 'Demo Traders',
      owner_name: tenant.owner_name || 'Demo Owner',
      order_cutoff_time: tenant.order_cutoff_time || '18:00',
      upi_id: tenant.upi_id || 'demo@invalid',
      phone: tenant.phone || '9000000000',
      address: tenant.address || 'Plot 1, Fictional Wholesale Market, Ratlam',
      city: 'Ratlam',
      state: 'Madhya Pradesh',
      category_focus: 'Staples, Spices & Groceries',
      category_focus_hi: 'अनाज, मसाले एवं किराना सामग्री',
      brands: ['Sunrise Foods', 'Daily Fresh', 'SpiceCraft'],
      badge: 'Primary FMCG Supplier',
      badge_hi: 'मुख्य किराना आपूर्तिकर्ता',
    },
    {
      id: 'tenant_agrawal_sons',
      name: 'Agrawal & Sons Wholesale',
      owner_name: 'Suresh Agrawal',
      order_cutoff_time: '19:00',
      upi_id: 'agrawal.demo@invalid',
      phone: '9000000002',
      address: '42, Station Road Market, Ratlam',
      city: 'Ratlam',
      state: 'Madhya Pradesh',
      category_focus: 'Snacks, Namkeen & Confectionery',
      category_focus_hi: 'नमकीन, बिस्कुट एवं कन्फेक्शनरी',
      brands: ['Crunch Co', 'Golden Grains'],
      badge: 'Snacks & Confectionery',
      badge_hi: 'स्नैक्स एवं कन्फेक्शनरी',
    },
    {
      id: 'tenant_demo_stockist',
      name: 'Demo Stockist',
      owner_name: 'Dinesh Sharma',
      order_cutoff_time: '17:30',
      upi_id: 'stockist.demo@invalid',
      phone: '9000000003',
      address: 'Warehouse Block C, Krishi Mandi Gate 2, Ratlam',
      city: 'Ratlam',
      state: 'Madhya Pradesh',
      category_focus: 'Beverages & Packaged Goods',
      category_focus_hi: 'पेय पदार्थ एवं पैकेज्ड उत्पाद',
      brands: ['Daily Fresh', 'Sunrise Foods'],
      badge: 'Beverages Stockist',
      badge_hi: 'पेय पदार्थ स्टॉकिस्ट',
    },
  ], [tenant]);

  // Active distributor switching state
  const [activeDistributorId, setActiveDistributorId] = useState<string>(tenant.id || 'tenant_shree_shyam_alwar');
  const [isDistributorModalOpen, setIsDistributorModalOpen] = useState(false);
  const [switchToastMessage, setSwitchToastMessage] = useState<string | null>(null);

  const activeDistributor = useMemo(() => {
    return registeredDistributors.find((d) => d.id === activeDistributorId) || registeredDistributors[0];
  }, [registeredDistributors, activeDistributorId]);

  const handleSwitchDistributor = (distId: string) => {
    if (distId === activeDistributorId) {
      setIsDistributorModalOpen(false);
      return;
    }
    const target = registeredDistributors.find((d) => d.id === distId);
    if (!target) return;

    setActiveDistributorId(distId);
    setSelectedBrandId('ALL');
    setIsDistributorModalOpen(false);

    const msg = language === 'hi'
      ? `वितरक बदला गया: ${target.name}`
      : `Switched distributor to ${target.name}`;
    setSwitchToastMessage(msg);
    setTimeout(() => setSwitchToastMessage(null), 3500);
  };

  // Filter brands according to active distributor
  const visibleBrands = useMemo(() => {
    if (!activeDistributor.brands || activeDistributor.brands.length === 0) return brands;
    const filtered = brands.filter((b) => activeDistributor.brands.includes(b.name));
    return filtered.length > 0 ? filtered : brands;
  }, [brands, activeDistributor]);

  // Interactive You Save Modal state
  const [selectedSavingsScheme, setSelectedSavingsScheme] = useState<RetailerScheme | null>(null);

  // Retailer Bill Modal state
  const [viewingBillOrder, setViewingBillOrder] = useState<HistoricalOrder | null>(null);

  // Editable quantities for Repeat Last Order
  const [repeatOrderItems, setRepeatOrderItems] = useState<Record<string, number>>(() => {
    if (!lastOrder) return {};
    const init: Record<string, number> = {};
    for (const l of lastOrder.lines) {
      init[l.tenant_product_id] = l.display_quantity;
    }
    return init;
  });

  // Calculate order cut-off countdown in Asia/Kolkata
  const [cutoffCountdown, setCutoffCountdown] = useState<string>(() => {
    if (routeCutoff && activeDistributor.id === (tenant.id || 'tenant_shree_shyam_alwar')) {
      if (routeCutoff.isPastCutoff) return language === 'hi' ? 'आज का कट-ऑफ़ समाप्त' : 'Cut-off passed for today';
      const h = Math.floor(routeCutoff.minutesRemaining / 60);
      const m = routeCutoff.minutesRemaining % 60;
      return `${h}h ${m}m remaining`;
    }
    return `${activeDistributor.order_cutoff_time || '18:00'} IST`;
  });

  useEffect(() => {
    const updateCountdown = () => {
      try {
        if (routeCutoff && activeDistributor.id === (tenant.id || 'tenant_shree_shyam_alwar')) {
          if (routeCutoff.isPastCutoff) {
            setCutoffCountdown(language === 'hi' ? 'आज का कट-ऑफ़ समाप्त' : 'Cut-off passed for today');
          } else {
            const h = Math.floor(routeCutoff.minutesRemaining / 60);
            const m = routeCutoff.minutesRemaining % 60;
            setCutoffCountdown(`${h}h ${m}m remaining`);
          }
          return;
        }

        const now = new Date();
        const istString = now.toLocaleString('en-US', { timeZone: 'Asia/Kolkata' });
        const istNow = new Date(istString);

        const [cutoffHour, cutoffMin] = (activeDistributor.order_cutoff_time || '18:00')
          .split(':')
          .map(Number);
        const cutoffToday = new Date(istNow);
        cutoffToday.setHours(cutoffHour, cutoffMin, 0, 0);

        const diffMs = cutoffToday.getTime() - istNow.getTime();
        if (diffMs <= 0) {
          setCutoffCountdown(language === 'hi' ? 'आज का कट-ऑफ़ समाप्त' : 'Cut-off passed for today');
        } else {
          const hours = Math.floor(diffMs / (1000 * 60 * 60));
          const mins = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
          setCutoffCountdown(`${hours}h ${mins}m remaining`);
        }
      } catch {
        setCutoffCountdown(`${activeDistributor.order_cutoff_time || '18:00'} IST`);
      }
    };

    updateCountdown();
    const interval = setInterval(updateCountdown, 60000);
    return () => clearInterval(interval);
  }, [activeDistributor, routeCutoff, language, tenant.id]);

  // Filter products by Brand, Active Distributor, and Search
  const filteredProducts = useMemo(() => {
    return products.filter((p) => {
      if (activeDistributor.brands && activeDistributor.brands.length > 0) {
        if (!activeDistributor.brands.includes(p.brand_name)) {
          return false;
        }
      }

      const matchesBrand = selectedBrandId === 'ALL' || p.brand_id === selectedBrandId;
      const q = searchQuery.toLowerCase().trim();
      if (!q) return matchesBrand;

      const matchesSearch =
        p.name.toLowerCase().includes(q) ||
        (p.hindi_name && p.hindi_name.toLowerCase().includes(q)) ||
        p.brand_name.toLowerCase().includes(q) ||
        (p.sub_group && p.sub_group.toLowerCase().includes(q));

      return matchesBrand && matchesSearch;
    });
  }, [products, selectedBrandId, searchQuery, activeDistributor]);

  // Cart operations
  const updateCartQty = (productId: string, delta: number) => {
    setCart((prev) => {
      const current = prev[productId] || 0;
      const next = Math.max(0, current + delta);
      const copy = { ...prev };
      if (next === 0) {
        delete copy[productId];
      } else {
        copy[productId] = next;
      }
      return copy;
    });
  };

  const cartLines = useMemo(() => {
    return Object.entries(cart)
      .map(([prodId, qty]) => {
        const prod = products.find((p) => p.id === prodId);
        if (!prod) return null;
        return {
          product: prod,
          quantity: qty,
          lineTotalPaise: prod.rate_paise * qty,
        };
      })
      .filter(Boolean) as { product: RetailerProduct; quantity: number; lineTotalPaise: number }[];
  }, [cart, products]);

  const cartTotalPaise = useMemo(() => {
    return cartLines.reduce((acc, l) => acc + l.lineTotalPaise, 0);
  }, [cartLines]);

  const totalCartItemsCount = useMemo(() => {
    return Object.values(cart).reduce((acc, qty) => acc + qty, 0);
  }, [cart]);

  // Repeat Order Quantities state
  const updateRepeatItemQty = (prodId: string, delta: number) => {
    setRepeatOrderItems((prev) => {
      const current = prev[prodId] || 1;
      const next = Math.max(1, current + delta);
      return { ...prev, [prodId]: next };
    });
  };

  const handleLoadRepeatOrder = () => {
    if (!lastOrder) return;
    const newCart: Record<string, number> = { ...cart };
    for (const line of lastOrder.lines) {
      const qty = repeatOrderItems[line.tenant_product_id] ?? line.display_quantity;
      newCart[line.tenant_product_id] = (newCart[line.tenant_product_id] || 0) + qty;
    }
    setCart(newCart);
    setShowCartDrawer(true);
  };

  const handleReorderHistorical = (order: HistoricalOrder) => {
    const newCart: Record<string, number> = { ...cart };
    for (const line of order.lines) {
      newCart[line.tenant_product_id] = (newCart[line.tenant_product_id] || 0) + line.display_quantity;
    }
    setCart(newCart);
    setActiveTab('CATALOG');
    setShowCartDrawer(true);
  };

  const handlePlaceOrder = async () => {
    if (totalCartItemsCount === 0 || isPlacingOrder) return;
    setIsPlacingOrder(true);

    try {
      const items = Object.entries(cart).map(([tenant_product_id, quantity]) => ({
        tenant_product_id,
        quantity,
      }));

      const res = await fetch('/api/retailer/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token,
          items,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        alert(data.error || 'Failed to place order. Please check stock and try again.');
        return;
      }

      setCart({});
      setShowCartDrawer(false);
      setPlacedOrderInfo(data);
      setActiveTab('ORDERS');
    } catch {
      alert('Network error placing order. Please try again.');
    } finally {
      setIsPlacingOrder(false);
    }
  };

  const handleSubstitutionAction = async (subId: string, action: 'ACCEPT' | 'REJECT') => {
    setSubmittingSubId(subId);
    try {
      const res = await fetch('/api/retailer/substitutions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token,
          substitutionId: subId,
          action,
        }),
      });
      if (res.ok) {
        setActiveSubstitutions((prev) => prev.filter((s) => s.id !== subId));
      }
    } finally {
      setSubmittingSubId(null);
    }
  };

  // Regular brand additions
  const boughtBrandNames = useMemo(() => {
    if (!lastOrder) return new Set<string>();
    return new Set(
      lastOrder.lines
        .map((l) => {
          const prod = products.find((p) => p.id === l.tenant_product_id);
          return prod?.brand_name || '';
        })
        .filter(Boolean)
    );
  }, [lastOrder, products]);

  const newBrandArrivals = useMemo(() => {
    return products
      .filter((p) => p.is_new && boughtBrandNames.has(p.brand_name))
      .slice(0, 3)
      .map((p) => ({
        brand_name: p.brand_name,
        product_id: p.id,
        product_name: p.name,
        rate_paise: p.rate_paise,
        unit: p.default_order_unit || 'pack',
      }));
  }, [products, boughtBrandNames]);

  return (
    <div className="min-h-screen bg-[#F8FAFC] pb-28 text-slate-900 selection:bg-orange-100 selection:text-orange-900 w-full max-w-full overflow-x-hidden font-sans">
      {/* 1. Verified Distributor Top Header */}
      <header className="bg-[#17307A] text-white sticky top-0 z-30 shadow-sm border-b border-blue-950">
        <div className="max-w-2xl mx-auto px-3.5 py-2.5 flex items-center justify-between gap-2">
          <div className="space-y-0.5 min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="font-extrabold text-sm sm:text-base tracking-tight truncate">
                {activeDistributor.name}
              </span>
              <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-200 text-[10px] font-bold border border-emerald-400/30">
                <ShieldCheck className="w-3 h-3 text-emerald-300" />
                <span>{language === 'hi' ? 'सत्यापित आपूर्तिकर्ता' : 'Verified FMCG Distributor'}</span>
              </span>
            </div>
            <div className="flex items-center gap-2 text-[11px] text-blue-200/90 font-medium">
              <span>{shop.name}</span>
              <span>•</span>
              <span className="truncate">{shop.area_name}, Ratlam</span>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={() => setIsDistributorModalOpen(true)}
              className="px-2.5 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white font-extrabold text-[11px] border border-white/20 transition-all flex items-center gap-1 shadow-2xs active:scale-95"
            >
              <ArrowLeftRight className="w-3 h-3 text-[#F58220]" />
              <span className="hidden sm:inline">{language === 'hi' ? 'वितरक बदलें' : 'Switch Distributor'}</span>
              <span className="sm:hidden">{language === 'hi' ? 'बदलें' : 'Switch'}</span>
            </button>
            <button
              type="button"
              onClick={() => setLanguage(language === 'en' ? 'hi' : 'en')}
              className="px-2 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-xs font-bold transition-all border border-white/20 active:scale-95"
            >
              {language === 'en' ? 'हिं' : 'EN'}
            </button>
            <button
              type="button"
              onClick={() => { window.location.href = '/'; }}
              className="p-1.5 sm:px-2.5 sm:py-1.5 rounded-xl bg-white/10 hover:bg-rose-500/30 text-white hover:text-rose-200 text-xs font-bold transition-all border border-white/20 hover:border-rose-400/40 active:scale-95 flex items-center gap-1 cursor-pointer"
              title={language === 'hi' ? 'लॉग आउट' : 'Log Out'}
            >
              <LogOut className="w-3.5 h-3.5 text-rose-300" />
              <span className="hidden sm:inline">{language === 'hi' ? 'लॉग आउट' : 'Log Out'}</span>
            </button>
          </div>
        </div>
      </header>

      {/* Switch Notification Toast */}
      {switchToastMessage && (
        <div className="fixed top-14 left-1/2 -translate-x-1/2 z-50 bg-[#17307A] text-white px-4 py-2 rounded-2xl shadow-xl text-xs font-bold border border-blue-400/40 animate-in slide-in-from-top-2 duration-200 flex items-center gap-2">
          <Sparkles className="w-3.5 h-3.5 text-[#F58220]" />
          <span>{switchToastMessage}</span>
        </div>
      )}

      {/* 2. Urgent Delivery Cut-off Banner */}
      <div className="bg-gradient-to-r from-amber-500/10 via-orange-500/10 to-amber-500/10 border-b border-orange-200/60 px-3.5 py-2">
        <div className="max-w-2xl mx-auto flex items-center justify-between gap-2 text-xs">
          <div className="flex items-center gap-2 text-orange-950 font-bold min-w-0">
            <span className="relative flex h-2 w-2 shrink-0">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#F58220] opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-[#F58220]" />
            </span>
            <span className="truncate">
              {routeCutoff
                ? language === 'hi'
                  ? routeCutoff.deliveryNoticeHindi
                  : routeCutoff.deliveryNotice
                : language === 'hi'
                ? `कट-ऑफ: शाम ${activeDistributor.order_cutoff_time}`
                : `Cut-off: ${activeDistributor.order_cutoff_time} IST`}
            </span>
          </div>

          <span className="font-extrabold text-[#17307A] font-mono text-[11px] bg-white px-2 py-0.5 rounded-lg border border-orange-200 shrink-0">
            {cutoffCountdown}
          </span>
        </div>
      </div>

      {/* 3. Main Content Container */}
      <main className="max-w-2xl mx-auto px-3.5 pt-4 space-y-4">
        {activeTab === 'OFFERS' && (
          <OffersTab
            activeDistributor={activeDistributor}
            shop={shop}
            isSmartReorderEligible={isSmartReorderEligible}
            activeSubstitutions={activeSubstitutions.map((s) => ({
              ...s,
              suggested_product_id: '',
              status: 'PENDING',
            }))}
            submittingSubId={submittingSubId}
            schemes={schemes}
            lastOrder={lastOrder}
            repeatOrderItems={repeatOrderItems}
            festivalSuggestions={festivalSuggestions}
            newBrandArrivals={newBrandArrivals}
            language={language}
            onSubstitutionAction={handleSubstitutionAction}
            onSelectSavingsScheme={setSelectedSavingsScheme}
            onUpdateRepeatQty={updateRepeatItemQty}
            onLoadRepeatOrder={handleLoadRepeatOrder}
            onAddToCart={(prodId, qty) => updateCartQty(prodId, qty)}
            onNavigateToCatalog={() => setActiveTab('CATALOG')}
          />
        )}

        {activeTab === 'CATALOG' && (
          <CatalogTab
            activeDistributor={activeDistributor}
            searchQuery={searchQuery}
            setSearchQuery={setSearchQuery}
            selectedBrandId={selectedBrandId}
            setSelectedBrandId={setSelectedBrandId}
            visibleBrands={visibleBrands}
            filteredProducts={filteredProducts}
            cart={cart}
            holdFlag={shop.hold_flag}
            language={language}
            onUpdateCartQty={updateCartQty}
            onOpenDistributorModal={() => setIsDistributorModalOpen(true)}
          />
        )}

        {activeTab === 'ORDERS' && (
          <OrdersTab
            ordersHistory={ordersHistory}
            distributorName={activeDistributor.name}
            language={language}
            onViewBill={setViewingBillOrder}
            onReorder={handleReorderHistorical}
            onNavigateToCatalog={() => setActiveTab('CATALOG')}
          />
        )}

        {activeTab === 'PROFILE' && (
          <ProfileTab
            shop={{
              ...shop,
              address: shop.address || '',
            }}
            activeDistributor={activeDistributor}
            activeDistributorId={activeDistributorId}
            registeredDistributors={registeredDistributors}
            language={language}
            onSwitchDistributor={handleSwitchDistributor}
            onOpenDistributorModal={() => setIsDistributorModalOpen(true)}
            onToggleLanguage={() => setLanguage(language === 'en' ? 'hi' : 'en')}
          />
        )}
      </main>

      {/* Floating Bottom Cart Action Bar */}
      {totalCartItemsCount > 0 && (
        <div className="fixed bottom-16 inset-x-0 z-40 p-3 max-w-2xl mx-auto pointer-events-none">
          <button
            type="button"
            onClick={() => setShowCartDrawer(true)}
            className="pointer-events-auto touch-target w-full py-3.5 px-5 rounded-2xl bg-[#F58220] hover:bg-[#F58220]/95 active:scale-[0.99] text-white font-extrabold text-sm shadow-xl shadow-orange-500/30 flex items-center justify-between transition-all"
          >
            <div className="flex items-center gap-2">
              <ShoppingBag className="w-5 h-5 text-white" />
              <span>
                {language === 'hi' ? 'कार्ट देखें' : 'View Cart'} ({totalCartItemsCount} {language === 'hi' ? 'सामग्री' : 'items'})
              </span>
            </div>
            <div className="flex items-center gap-1.5 font-mono text-base">
              <span>{formatPaise(cartTotalPaise)}</span>
              <ArrowRight className="w-4 h-4 text-white" />
            </div>
          </button>
        </div>
      )}

      {/* 4. Modals (Lazy Loaded) */}
      {showCartDrawer && (
        <CartDrawer
          isOpen={showCartDrawer}
          cartLines={cartLines}
          totalCartItemsCount={totalCartItemsCount}
          cartTotalPaise={cartTotalPaise}
          distributorName={activeDistributor.name}
          isPlacingOrder={isPlacingOrder}
          holdFlag={shop.hold_flag}
          language={language}
          onUpdateQty={updateCartQty}
          onPlaceOrder={handlePlaceOrder}
          onClose={() => setShowCartDrawer(false)}
        />
      )}

      {viewingBillOrder && (
        <BillModal
          order={viewingBillOrder}
          tenant={{
            ...tenant,
            name: activeDistributor.name,
            upi_id: activeDistributor.upi_id,
          }}
          language={language}
          onClose={() => setViewingBillOrder(null)}
        />
      )}

      {/* Interactive Savings Scheme Modal */}
      {selectedSavingsScheme && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white rounded-3xl max-w-sm w-full p-5 sm:p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between">
              <span className="px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-extrabold uppercase">
                {selectedSavingsScheme.type.replace('_', ' ')}
              </span>
              <button
                type="button"
                onClick={() => setSelectedSavingsScheme(null)}
                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-500"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div>
              <h3 className="font-extrabold text-base text-slate-900">{selectedSavingsScheme.name}</h3>
              <p className="text-xs text-slate-600 mt-1">{selectedSavingsScheme.description}</p>
            </div>
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-900 font-medium">
              {language === 'hi'
                ? 'यह योजना कार्ट में आवश्यक मात्रा जुड़ने पर स्वचालित रूप से बिल में लागू हो जाएगी।'
                : 'Scheme discounts apply automatically to your wholesale bill upon meeting required order volume.'}
            </div>
            <button
              type="button"
              onClick={() => {
                setSelectedSavingsScheme(null);
                setActiveTab('CATALOG');
              }}
              className="w-full py-2.5 rounded-xl bg-[#17307A] text-white font-bold text-xs"
            >
              {language === 'hi' ? 'कैटलॉग में सामग्री देखें' : 'Browse Eligible Items'}
            </button>
          </div>
        </div>
      )}

      {/* Switch Distributor Modal */}
      {isDistributorModalOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-900/60 backdrop-blur-xs p-0 sm:p-4 animate-in fade-in">
          <div className="bg-white w-full max-w-lg rounded-t-3xl sm:rounded-3xl p-5 sm:p-6 space-y-4 max-h-[85vh] flex flex-col shadow-2xl border border-slate-200">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <h3 className="font-extrabold text-base text-slate-900">
                {language === 'hi' ? 'अधिकृत थोक वितरक चुनें' : 'Select FMCG Distributor'}
              </h3>
              <button
                type="button"
                onClick={() => setIsDistributorModalOpen(false)}
                className="p-1 rounded-full text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-2.5 overflow-y-auto flex-1 pr-1">
              {registeredDistributors.map((dist) => {
                const isSelected = dist.id === activeDistributorId;
                return (
                  <div
                    key={dist.id}
                    className={`p-3.5 rounded-2xl transition-all ${
                      isSelected
                        ? 'border-2 border-[#17307A] bg-blue-50/70 shadow-xs'
                        : 'border border-slate-200 bg-white hover:border-slate-300'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <h4 className="font-extrabold text-slate-900 text-sm">{dist.name}</h4>
                        <span className="text-[11px] text-slate-500 block">{dist.address}</span>
                        <span className="text-[10px] text-blue-700 font-bold block mt-1">
                          {language === 'hi' ? 'ब्रांड्स:' : 'Brands:'} {dist.brands.join(', ')}
                        </span>
                      </div>
                      {isSelected ? (
                        <span className="px-2 py-1 bg-[#17307A] text-white text-[10px] font-bold rounded-lg">
                          {language === 'hi' ? 'सक्रिय' : 'Active'}
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => handleSwitchDistributor(dist.id)}
                          className="px-3 py-1.5 rounded-xl bg-orange-50 hover:bg-[#F58220] hover:text-white text-[#F58220] font-extrabold text-xs border border-orange-200 transition-all active:scale-95"
                        >
                          {language === 'hi' ? 'चुनें' : 'Select'}
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* 5. Fixed Bottom 4-Tab Navigation Bar */}
      <nav className="fixed bottom-0 left-0 right-0 w-full bg-white/95 backdrop-blur-md border-t border-slate-200 z-40 shadow-lg">
        <div className="w-full max-w-md mx-auto px-1 py-1.5 grid grid-cols-4 gap-0.5">
          <button
            type="button"
            onClick={() => setActiveTab('OFFERS')}
            className={`flex flex-col items-center justify-center py-1 rounded-xl transition-all ${
              activeTab === 'OFFERS' ? 'text-[#F58220] font-extrabold' : 'text-slate-500 font-semibold'
            }`}
          >
            <Sparkles className={`w-5 h-5 transition-transform ${activeTab === 'OFFERS' ? 'scale-110' : ''}`} />
            <span className="text-[10px] mt-0.5">{language === 'hi' ? 'योजनाएं' : 'Offers'}</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('CATALOG')}
            className={`flex flex-col items-center justify-center py-1 rounded-xl transition-all ${
              activeTab === 'CATALOG' ? 'text-[#17307A] font-extrabold' : 'text-slate-500 font-semibold'
            }`}
          >
            <Boxes className={`w-5 h-5 transition-transform ${activeTab === 'CATALOG' ? 'scale-110' : ''}`} />
            <span className="text-[10px] mt-0.5">{language === 'hi' ? 'कैटलॉग' : 'Catalog'}</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('ORDERS')}
            className={`flex flex-col items-center justify-center py-1 rounded-xl transition-all ${
              activeTab === 'ORDERS' ? 'text-[#17307A] font-extrabold' : 'text-slate-500 font-semibold'
            }`}
          >
            <ShoppingBag className={`w-5 h-5 transition-transform ${activeTab === 'ORDERS' ? 'scale-110' : ''}`} />
            <span className="text-[10px] mt-0.5">{language === 'hi' ? 'आदेश' : 'Orders'}</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('PROFILE')}
            className={`flex flex-col items-center justify-center py-1 rounded-xl transition-all ${
              activeTab === 'PROFILE' ? 'text-[#17307A] font-extrabold' : 'text-slate-500 font-semibold'
            }`}
          >
            <User className={`w-5 h-5 transition-transform ${activeTab === 'PROFILE' ? 'scale-110' : ''}`} />
            <span className="text-[10px] mt-0.5">{language === 'hi' ? 'खाता' : 'Profile'}</span>
          </button>
        </div>
      </nav>
    </div>
  );
}
