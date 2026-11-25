'use client';

import React, { useState, useMemo, useEffect } from 'react';
import Link from 'next/link';
import {
  Search,
  MapPin,
  Truck,
  PhoneCall,
  Download,
  CheckCircle2,
  Clock,
  AlertCircle,
  XCircle,
  PackageCheck,
  Eye,
  ChevronDown,
  ChevronUp,
  Layers,
  ListFilter,
  Store,
  Phone,
  Globe,
  X,
  FileText,
  ShieldAlert,
  IndianRupee,
  Calendar,
  ArrowRight,
  TrendingUp,
  Receipt,
  Sparkles,
} from 'lucide-react';
import { formatPaise } from '@/lib/money';
import { useTranslation } from '@/lib/i18n/context';
import { TranslationKey } from '@/lib/i18n/translations';

export type OrderStatusType =
  | 'RECEIVED'
  | 'CONFIRMED'
  | 'PACKED'
  | 'OUT_FOR_DELIVERY'
  | 'DELIVERED'
  | 'CANCELLED';

export interface OrderItemLine {
  id: string;
  display_quantity: number;
  order_unit_name: string;
  price_paise_snapshot: number;
  tenant_product: {
    id: string;
    stock_qty: number;
    base_unit?: string | null;
    default_order_unit?: string | null;
    master_product: {
      name: string;
      hindi_name: string | null;
      base_unit?: string;
      default_order_unit?: string;
    };
  };
}

export interface OrderEventItem {
  id: string;
  status: OrderStatusType;
  created_at: string;
  notes: string | null;
}

export interface OrderInboxItem {
  id: string;
  order_number: string;
  status: OrderStatusType;
  source: string;
  subtotal_paise: number;
  total_paise: number;
  discount_paise: number;
  notes: string | null;
  created_at: string;
  shop: {
    id: string;
    name: string;
    shop_number: string;
    owner_name: string;
    phone: string;
    address: string;
    hold_flag: boolean;
    credit_limit_paise?: number;
    area: {
      id: string;
      name: string;
    } | null;
  };
  lines: OrderItemLine[];
  events: OrderEventItem[];
}

export interface AreaItem {
  id: string;
  name: string;
  notes?: string | null;
}

export interface SubstitutionRecord {
  id: string;
  order_id: string;
  order_line_id: string;
  original_product_id: string;
  suggested_product_id: string;
  requested_qty_base: number;
  shop_reply: 'PENDING' | 'ACCEPTED' | 'REJECTED';
}

export interface CandidateItem {
  id: string;
  name: string;
  brandName: string;
  ratePaise: number;
  originalRatePaise: number;
  priceDiffPaise: number;
  unit: string;
  packDifference: string;
  matchType: 'SAME_BRAND' | 'SAME_CATEGORY';
  stockQty: number;
  inStock: boolean;
}

interface Props {
  initialOrders: OrderInboxItem[];
  areas?: AreaItem[];
}

const STATUS_CONFIG: Record<
  OrderStatusType,
  {
    bg: string;
    text: string;
    border: string;
    icon: React.ComponentType<{ className?: string }>;
    labelKey: TranslationKey;
  }
> = {
  RECEIVED: {
    bg: 'bg-amber-50',
    text: 'text-amber-800',
    border: 'border-amber-200',
    icon: Clock,
    labelKey: 'pending',
  },
  CONFIRMED: {
    bg: 'bg-blue-50',
    text: 'text-blue-800',
    border: 'border-blue-200',
    icon: CheckCircle2,
    labelKey: 'confirmed',
  },
  PACKED: {
    bg: 'bg-purple-50',
    text: 'text-purple-800',
    border: 'border-purple-200',
    icon: PackageCheck,
    labelKey: 'packing',
  },
  OUT_FOR_DELIVERY: {
    bg: 'bg-orange-50',
    text: 'text-orange-800',
    border: 'border-orange-200',
    icon: Truck,
    labelKey: 'onRoute',
  },
  DELIVERED: {
    bg: 'bg-emerald-50',
    text: 'text-emerald-800',
    border: 'border-emerald-200',
    icon: CheckCircle2,
    labelKey: 'delivered',
  },
  CANCELLED: {
    bg: 'bg-rose-50',
    text: 'text-rose-800',
    border: 'border-rose-200',
    icon: XCircle,
    labelKey: 'cancelled',
  },
};

export default function OrderInbox({ initialOrders, areas = [] }: Props) {
  const { language, t } = useTranslation();
  const [orders, setOrders] = useState<OrderInboxItem[]>(initialOrders);
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [selectedAreaFilter, setSelectedAreaFilter] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<'AREA_GROUPED' | 'FLAT'>('AREA_GROUPED');
  const [collapsedAreas, setCollapsedAreas] = useState<Record<string, boolean>>({});
  const [isUpdating, setIsUpdating] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  // Substitution state
  const [orderSubstitutions, setOrderSubstitutions] = useState<Record<string, SubstitutionRecord>>({});
  const [isSubModalOpen, setIsSubModalOpen] = useState(false);
  const [subTargetLine, setSubTargetLine] = useState<OrderItemLine | null>(null);
  const [candidates, setCandidates] = useState<CandidateItem[]>([]);
  const [loadingCandidates, setLoadingCandidates] = useState(false);
  const [selectedCandidateId, setSelectedCandidateId] = useState<string | null>(null);
  const [triggerVoiceCall, setTriggerVoiceCall] = useState(false);
  const [submittingProposal, setSubmittingProposal] = useState(false);
  const [subProposalError, setSubProposalError] = useState<string | null>(null);

  // Fetch substitutions when order is selected
  useEffect(() => {
    if (!selectedOrderId) {
      setOrderSubstitutions({});
      return;
    }
    let isMounted = true;
    const fetchSubs = async () => {
      try {
        const res = await fetch(`/api/distributor/substitutions?orderId=${selectedOrderId}`);
        if (res.ok && isMounted) {
          const data = await res.json();
          const map: Record<string, SubstitutionRecord> = {};
          for (const s of data.substitutions || []) {
            map[s.order_line_id] = s;
          }
          setOrderSubstitutions(map);
        }
      } catch (e) {
        console.error('Failed to load substitutions for order', e);
      }
    };
    fetchSubs();
    return () => {
      isMounted = false;
    };
  }, [selectedOrderId]);

  const handleOpenSubModal = async (line: OrderItemLine) => {
    setSubTargetLine(line);
    setIsSubModalOpen(true);
    setSelectedCandidateId(null);
    setTriggerVoiceCall(false);
    setSubProposalError(null);
    setLoadingCandidates(true);
    try {
      const res = await fetch(`/api/distributor/substitutions/candidates?productId=${line.tenant_product.id}`);
      if (res.ok) {
        const data = await res.json();
        const candList: CandidateItem[] = data.candidates || [];
        setCandidates(candList);
        if (candList.length > 0) {
          setSelectedCandidateId(candList[0].id);
        }
      }
    } catch (err: any) {
      setSubProposalError(err.message || 'Failed to fetch candidate alternatives');
    } finally {
      setLoadingCandidates(false);
    }
  };

  const handleSendProposal = async () => {
    if (!selectedOrder || !subTargetLine || !selectedCandidateId) return;
    setSubmittingProposal(true);
    setSubProposalError(null);
    try {
      const res = await fetch('/api/distributor/substitutions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderId: selectedOrder.id,
          orderLineId: subTargetLine.id,
          originalProductId: subTargetLine.tenant_product.id,
          suggestedProductId: selectedCandidateId,
          requestedQtyBase: subTargetLine.display_quantity,
          triggerMockCall: triggerVoiceCall,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to send substitution proposal');
      }
      setOrderSubstitutions((prev) => ({
        ...prev,
        [subTargetLine.id]: data.substitution,
      }));
      setIsSubModalOpen(false);
    } catch (err: any) {
      setSubProposalError(err.message);
    } finally {
      setSubmittingProposal(false);
    }
  };

  const selectedOrder = useMemo(
    () => orders.find((o) => o.id === selectedOrderId) || null,
    [orders, selectedOrderId]
  );

  // Toggle area accordion collapse
  const toggleAreaCollapse = (areaId: string) => {
    setCollapsedAreas((prev) => ({ ...prev, [areaId]: !prev[areaId] }));
  };

  // Base search & status filter
  const filteredOrders = useMemo(() => {
    return orders.filter((o) => {
      const matchesStatus = statusFilter === 'ALL' || o.status === statusFilter;
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch =
        !q ||
        o.order_number.toLowerCase().includes(q) ||
        o.shop.name.toLowerCase().includes(q) ||
        o.shop.owner_name.toLowerCase().includes(q) ||
        o.shop.phone.includes(q) ||
        (o.shop.area?.name || '').toLowerCase().includes(q);

      const matchesArea =
        selectedAreaFilter === 'ALL' || (o.shop.area?.id || 'unassigned') === selectedAreaFilter;

      return matchesStatus && matchesSearch && matchesArea;
    });
  }, [orders, statusFilter, searchQuery, selectedAreaFilter]);

  // Grouped by Area Structure
  const areaGroups = useMemo(() => {
    const map: Record<
      string,
      {
        area: AreaItem;
        orders: OrderInboxItem[];
        totalPaise: number;
        shopCount: number;
      }
    > = {};

    // 1. Initialize predefined areas from database
    for (const a of areas) {
      map[a.id] = {
        area: a,
        orders: [],
        totalPaise: 0,
        shopCount: 0,
      };
    }

    // 2. Populate orders into area buckets
    for (const o of filteredOrders) {
      const aId = o.shop.area?.id || 'unassigned';
      if (!map[aId]) {
        map[aId] = {
          area: {
            id: aId,
            name: o.shop.area?.name || (language === 'hi' ? 'अवर्गीकृत क्षेत्र' : 'Unassigned Area'),
            notes: null,
          },
          orders: [],
          totalPaise: 0,
          shopCount: 0,
        };
      }
      map[aId].orders.push(o);
      if (o.status !== 'CANCELLED') {
        map[aId].totalPaise += o.total_paise;
      }
    }

    // Compute unique shop count per area
    for (const key of Object.keys(map)) {
      const uniqueShops = new Set(map[key].orders.map((o) => o.shop.id));
      map[key].shopCount = uniqueShops.size;
    }

    return Object.values(map).filter((g) => {
      if (selectedAreaFilter !== 'ALL') {
        return g.area.id === selectedAreaFilter;
      }
      return g.orders.length > 0 || areas.some((a) => a.id === g.area.id);
    });
  }, [filteredOrders, areas, selectedAreaFilter, language]);

  // Pulse Summary Metrics
  const metrics = useMemo(() => {
    const totalOrdersCount = filteredOrders.length;
    const totalTurnoverPaise = filteredOrders
      .filter((o) => o.status !== 'CANCELLED')
      .reduce((sum, o) => sum + o.total_paise, 0);
    const toPackCount = orders.filter(
      (o) => o.status === 'RECEIVED' || o.status === 'CONFIRMED' || o.status === 'PACKED'
    ).length;
    const areaCount = areas.length || 4;

    return {
      totalOrdersCount,
      totalTurnoverPaise,
      toPackCount,
      areaCount,
    };
  }, [filteredOrders, orders, areas]);

  // Handle Order Status State Transitions
  const handleUpdateStatus = async (newStatus: OrderStatusType) => {
    if (!selectedOrder) return;
    setIsUpdating(true);
    setActionError(null);

    try {
      const res = await fetch('/api/distributor/orders', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderId: selectedOrder.id,
          newStatus,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to update order status');
      }

      setOrders((prev) =>
        prev.map((o) => {
          if (o.id === selectedOrder.id) {
            return {
              ...o,
              status: newStatus,
              events: [
                {
                  id: `temp_${Date.now()}`,
                  status: newStatus,
                  created_at: new Date().toISOString(),
                  notes: `Status changed to ${newStatus}`,
                },
                ...o.events,
              ],
            };
          }
          return o;
        })
      );
    } catch (err: any) {
      setActionError(err.message);
    } finally {
      setIsUpdating(false);
    }
  };

  const getProductDisplayName = (l: OrderItemLine) => {
    if (language === 'hi') {
      return (
        l.tenant_product?.master_product?.hindi_name ||
        l.tenant_product?.master_product?.name ||
        ''
      );
    }
    return l.tenant_product?.master_product?.name || '';
  };

  return (
    <div className="space-y-4 md:space-y-6">
      {/* 1. Header Bar with Direct Actions */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-3 md:gap-4">
        <div>
          <h1 className="text-lg sm:text-xl md:text-2xl font-bold text-[#17307A] tracking-tight">
            {t('ordersTitle')}
          </h1>
          <p className="hidden sm:block text-[11px] sm:text-xs md:text-sm text-slate-500 mt-0.5">
            {t('ordersSubtitle')}
          </p>
        </div>

        <div className="flex items-center gap-2 w-full md:w-auto">
          <Link
            href="/d/orders/new"
            className="flex-1 md:flex-none flex items-center justify-center gap-1.5 px-3 sm:px-4 py-1.5 sm:py-2 rounded-xl bg-[#F58220] text-white text-xs font-semibold hover:bg-[#F58220]/90 transition-colors shadow-sm"
          >
            <PhoneCall className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-white" />
            <span>+ {t('newPhoneOrder')}</span>
          </Link>

          <a
            href="/api/distributor/export-csv?type=orders"
            download
            className="flex-1 md:flex-none flex items-center justify-center gap-1.5 px-3 sm:px-3.5 py-1.5 sm:py-2 rounded-xl bg-white border border-slate-300 text-slate-700 text-xs font-semibold hover:bg-slate-50 transition-colors shadow-xs"
          >
            <Download className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-slate-500" />
            <span>{t('exportCsv')}</span>
          </a>
        </div>
      </div>

      {/* 2. Top 4 Pulse Cards (2x2 on Mobile, 4 across on Desktop) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-4">
        <div className="bg-white border border-[#E2E8F0] rounded-xl p-3 sm:p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] sm:text-xs text-slate-500 font-medium truncate">{t('totalOrders')}</span>
            <FileText className="w-4 h-4 sm:w-4.5 sm:h-4.5 text-slate-400 shrink-0" />
          </div>
          <div className="text-lg sm:text-xl md:text-2xl font-bold text-[#17307A] mt-1">
            {metrics.totalOrdersCount}
          </div>
          <div className="text-[10px] sm:text-[11px] text-slate-400 mt-0.5 truncate">
            {language === 'hi' ? 'सक्रिय वितरण चक्र' : 'Across all routes'}
          </div>
        </div>

        <div className="bg-white border border-[#E2E8F0] rounded-xl p-3 sm:p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] sm:text-xs text-slate-500 font-medium truncate">{t('ordersValue')}</span>
            <IndianRupee className="w-4 h-4 sm:w-4.5 sm:h-4.5 text-emerald-600 shrink-0" />
          </div>
          <div className="text-lg sm:text-xl md:text-2xl font-bold text-slate-800 mt-1">
            {formatPaise(metrics.totalTurnoverPaise)}
          </div>
          <div className="text-[10px] sm:text-[11px] text-slate-400 mt-0.5 truncate">
            {language === 'hi' ? 'रद्द ऑर्डर हटाकर शुद्ध व्यापार' : 'Excluding cancelled'}
          </div>
        </div>

        <div className="bg-white border border-[#E2E8F0] rounded-xl p-3 sm:p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] sm:text-xs text-slate-500 font-medium truncate">{t('activeAreas')}</span>
            <MapPin className="w-4 h-4 sm:w-4.5 sm:h-4.5 text-purple-600 shrink-0" />
          </div>
          <div className="text-lg sm:text-xl md:text-2xl font-bold text-slate-800 mt-1">
            {metrics.areaCount}
          </div>
          <div className="text-[10px] sm:text-[11px] text-slate-400 mt-0.5 truncate">
            {language === 'hi' ? 'रतलाम व्यापार क्षेत्र' : 'Ratlam Delivery Hubs'}
          </div>
        </div>

        <div className="bg-white border border-[#E2E8F0] rounded-xl p-3 sm:p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] sm:text-xs text-slate-500 font-medium truncate">{t('pendingDispatch')}</span>
            <Truck className="w-4 h-4 sm:w-4.5 sm:h-4.5 text-amber-600 shrink-0" />
          </div>
          <div
            className={`text-lg sm:text-xl md:text-2xl font-bold mt-1 ${
              metrics.toPackCount > 0 ? 'text-[#F58220]' : 'text-slate-800'
            }`}
          >
            {metrics.toPackCount}
          </div>
          <div className="text-[10px] sm:text-[11px] text-slate-400 mt-0.5 truncate">
            {language === 'hi' ? 'गोदाम पैकिंग व प्रेषण सूची' : 'Pending warehouse action'}
          </div>
        </div>
      </div>

      {/* 3. Search Bar, View Mode Switch & Controls */}
      <div className="space-y-2.5 sm:space-y-3">
        {/* Desktop Header Controls (preserved) */}
        <div className="hidden md:flex gap-3 justify-between items-center">
          {/* Search Box */}
          <div className="relative w-full max-w-md">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t('searchOrders')}
              className="w-full pl-9 pr-4 py-2 rounded-xl border border-slate-300 bg-white text-xs md:text-sm focus:outline-none focus:ring-2 focus:ring-[#17307A]/20 focus:border-[#17307A]"
            />
            <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600 text-xs"
              >
                ✕
              </button>
            )}
          </div>

          {/* Desktop View Mode Switcher */}
          <div className="inline-flex rounded-xl border border-slate-300 bg-white p-1 shadow-2xs">
            <button
              onClick={() => setViewMode('AREA_GROUPED')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                viewMode === 'AREA_GROUPED'
                  ? 'bg-[#17307A] text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              <span>{t('areaSegregation')}</span>
            </button>
            <button
              onClick={() => setViewMode('FLAT')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                viewMode === 'FLAT'
                  ? 'bg-[#17307A] text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <ListFilter className="w-3.5 h-3.5" />
              <span>{t('flatList')}</span>
            </button>
          </div>
        </div>

        {/* Mobile Header Controls (Sleek 2-Row Layout) */}
        <div className="md:hidden space-y-2">
          {/* Row 1: Full-width clean search bar */}
          <div className="relative w-full">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t('searchOrders')}
              className="w-full pl-8 pr-7 py-1.5 rounded-xl border border-slate-300 bg-white text-xs focus:outline-none focus:ring-2 focus:ring-[#17307A]/20 focus:border-[#17307A]"
            />
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-slate-400" />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-2 text-slate-400 hover:text-slate-600 text-xs"
              >
                ✕
              </button>
            )}
          </div>

          {/* Row 2: Mode Toggle + Area Dropdown side by side */}
          <div className="flex items-center gap-2">
            <div className="inline-flex rounded-xl border border-slate-200 bg-slate-100 p-0.5 shadow-2xs shrink-0">
              <button
                onClick={() => setViewMode('AREA_GROUPED')}
                className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all cursor-pointer ${
                  viewMode === 'AREA_GROUPED'
                    ? 'bg-[#17307A] text-white shadow-xs'
                    : 'text-slate-600'
                }`}
              >
                <Layers className="w-3 h-3" />
                <span>{t('areaSegregation')}</span>
              </button>
              <button
                onClick={() => setViewMode('FLAT')}
                className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all cursor-pointer ${
                  viewMode === 'FLAT'
                    ? 'bg-[#17307A] text-white shadow-xs'
                    : 'text-slate-600'
                }`}
              >
                <ListFilter className="w-3 h-3" />
                <span>{t('flatList')}</span>
              </button>
            </div>

            <div className="flex-1 min-w-0">
              <select
                value={selectedAreaFilter}
                onChange={(e) => setSelectedAreaFilter(e.target.value)}
                className="w-full px-2 py-1 bg-white border border-slate-300 rounded-xl text-[11px] font-semibold text-slate-700 truncate focus:outline-none focus:ring-2 focus:ring-[#17307A]"
              >
                <option value="ALL">
                  {t('allAreas')} ({orders.length})
                </option>
                {areas.map((a) => {
                  const count = orders.filter((o) => o.shop.area?.id === a.id).length;
                  return (
                    <option key={a.id} value={a.id}>
                      {a.name} ({count})
                    </option>
                  );
                })}
              </select>
            </div>
          </div>
        </div>

        {/* Desktop Area Pills (Filter by Area) */}
        <div className="hidden md:flex gap-2 overflow-x-auto pb-1 scrollbar-none text-xs font-semibold">
          <button
            onClick={() => setSelectedAreaFilter('ALL')}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg transition-colors whitespace-nowrap cursor-pointer ${
              selectedAreaFilter === 'ALL'
                ? 'bg-[#17307A] text-white shadow-xs'
                : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50'
            }`}
          >
            <MapPin className="w-3.5 h-3.5" />
            <span>
              {t('allAreas')} ({orders.length})
            </span>
          </button>
          {areas.map((a) => {
            const areaOrderCount = orders.filter((o) => o.shop.area?.id === a.id).length;
            const isSelected = selectedAreaFilter === a.id;
            return (
              <button
                key={a.id}
                onClick={() => setSelectedAreaFilter(a.id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-colors whitespace-nowrap cursor-pointer ${
                  isSelected
                    ? 'bg-[#17307A] text-white shadow-xs'
                    : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50'
                }`}
              >
                <span>{a.name}</span>
                <span
                  className={`text-[11px] font-normal px-1.5 py-0.2 rounded-full ${
                    isSelected ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-600'
                  }`}
                >
                  {areaOrderCount}
                </span>
              </button>
            );
          })}
        </div>

        {/* Status Filter Pills (Mobile & Desktop) */}
        <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-none text-xs font-medium">
          {(
            [
              { key: 'ALL', labelKey: 'allAreas' },
              { key: 'RECEIVED', labelKey: 'pending' },
              { key: 'CONFIRMED', labelKey: 'confirmed' },
              { key: 'PACKED', labelKey: 'packing' },
              { key: 'OUT_FOR_DELIVERY', labelKey: 'onRoute' },
              { key: 'DELIVERED', labelKey: 'delivered' },
              { key: 'CANCELLED', labelKey: 'cancelled' },
            ] as const
          ).map((item) => {
            const count =
              item.key === 'ALL'
                ? orders.length
                : orders.filter((o) => o.status === item.key).length;
            const isSelected = statusFilter === item.key;
            return (
              <button
                key={item.key}
                onClick={() => setStatusFilter(item.key)}
                className={`px-2.5 sm:px-3 py-1 rounded-full whitespace-nowrap text-[11px] sm:text-xs transition-colors cursor-pointer border ${
                  isSelected
                    ? 'bg-slate-800 text-white border-slate-800 font-semibold'
                    : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                }`}
              >
                {item.key === 'ALL' ? (language === 'hi' ? 'सभी स्थितियां' : 'All Statuses') : t(item.labelKey)}{' '}
                <span className="opacity-75 text-[10px] sm:text-[11px]">({count})</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* 4. Main Body: Area-Segregated View or Flat Timeline */}
      {viewMode === 'AREA_GROUPED' ? (
        <div className="space-y-5">
          {areaGroups.length === 0 ? (
            <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center text-slate-400">
              <MapPin className="w-10 h-10 mx-auto text-slate-300 mb-2" />
              <p className="text-sm font-semibold text-slate-600">{t('noOrdersInArea')}</p>
              <p className="text-xs text-slate-400 mt-1">
                {language === 'hi'
                  ? 'फ़िल्टर साफ़ करें या कोई दूसरा क्षेत्र चुनें।'
                  : 'Try clearing status filter or selecting another area.'}
              </p>
            </div>
          ) : (
            areaGroups.map((group) => {
              const isCollapsed = collapsedAreas[group.area.id];
              return (
                <div
                  key={group.area.id}
                  className="bg-white border border-[#E2E8F0] rounded-2xl shadow-xs overflow-hidden transition-all"
                >
                  {/* Area Header Card */}
                  <div
                    onClick={() => toggleAreaCollapse(group.area.id)}
                    className="p-2.5 sm:p-4 md:px-5 flex items-center justify-between cursor-pointer hover:bg-slate-50/70 border-b border-slate-100 transition-colors"
                  >
                    <div className="flex items-center gap-2 sm:gap-2.5 min-w-0">
                      <MapPin className="w-4 h-4 sm:w-5 sm:h-5 text-[#17307A] shrink-0" />
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
                          <h2 className="font-bold text-xs sm:text-base text-slate-900 tracking-tight truncate">
                            {group.area.name}
                          </h2>
                          <span className="px-1.5 py-0.2 rounded-full bg-slate-100 text-slate-700 text-[10px] sm:text-xs font-semibold">
                            {group.orders.length} {t('itemsCount')}
                          </span>
                        </div>
                        {group.area.notes && (
                          <p className="hidden sm:block text-xs text-slate-500 mt-0.5 truncate">
                            {group.area.notes}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 sm:gap-3 shrink-0">
                      <div className="text-right hidden sm:block">
                        <div className="text-xs text-slate-400 font-medium">
                          {language === 'hi' ? 'क्षेत्र व्यापार' : 'Area Total'}
                        </div>
                        <div className="text-sm font-bold text-[#17307A]">
                          {formatPaise(group.totalPaise)}
                        </div>
                      </div>

                      <div className="text-slate-400">
                        {isCollapsed ? (
                          <ChevronDown className="w-4 h-4 sm:w-5 sm:h-5" />
                        ) : (
                          <ChevronUp className="w-4 h-4 sm:w-5 sm:h-5" />
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Area Orders Body */}
                  {!isCollapsed && (
                    <div className="p-2.5 sm:p-4 bg-slate-50/40">
                      {group.orders.length === 0 ? (
                        <div className="p-8 text-center text-xs text-slate-400">
                          {t('noOrdersInArea')}
                        </div>
                      ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3.5">
                          {group.orders.map((order) => {
                            const cfg = STATUS_CONFIG[order.status] || STATUS_CONFIG.RECEIVED;
                            const IconComponent = cfg.icon;
                            const isSelected = selectedOrderId === order.id;

                            return (
                              <div
                                key={order.id}
                                onClick={() => setSelectedOrderId(order.id)}
                                className={`bg-white rounded-xl border p-3 sm:p-4 transition-all cursor-pointer flex flex-col justify-between gap-2.5 sm:gap-3 shadow-2xs ${
                                  isSelected
                                    ? 'border-[#17307A] ring-2 ring-[#17307A]/15 bg-blue-50/20'
                                    : 'border-slate-200 hover:border-slate-300 hover:shadow-xs'
                                }`}
                              >
                                <div>
                                  {/* Card Top: Order Number & Status Badge */}
                                  <div className="flex items-start justify-between gap-2">
                                    <div>
                                      <div className="font-bold text-slate-900 text-xs sm:text-sm">
                                        {order.order_number}
                                      </div>
                                      <div className="text-[10px] sm:text-[11px] text-slate-400 mt-0.5">
                                        {new Date(order.created_at).toLocaleTimeString('en-IN', {
                                          hour: 'numeric',
                                          minute: '2-digit',
                                          hour12: true,
                                        })}
                                      </div>
                                    </div>

                                    <span
                                      className={`inline-flex items-center gap-1 px-2 sm:px-2.5 py-0.5 rounded-full text-[10px] sm:text-[11px] font-semibold border ${cfg.bg} ${cfg.text} ${cfg.border}`}
                                    >
                                      <IconComponent className="w-2.5 h-2.5 sm:w-3 sm:h-3" />
                                      <span>{t(cfg.labelKey)}</span>
                                    </span>
                                  </div>

                                  {/* Shop Information */}
                                  <div className="mt-2.5 sm:mt-3 pt-2.5 sm:pt-3 border-t border-slate-100">
                                    <div className="font-bold text-slate-800 text-xs sm:text-sm truncate">
                                      {order.shop.name}
                                    </div>
                                    <div className="text-[11px] sm:text-xs text-slate-500 mt-0.5 truncate">
                                      {order.shop.owner_name} • {order.shop.phone}
                                    </div>
                                    {order.shop.hold_flag && (
                                      <div className="mt-1 inline-flex items-center gap-1 text-[11px] font-semibold text-rose-600 bg-rose-50 px-2 py-0.5 rounded-md">
                                        <ShieldAlert className="w-3 h-3" />
                                        <span>{t('creditHoldWarning')}</span>
                                      </div>
                                    )}
                                  </div>
                                </div>

                                {/* Card Footer: Source & Net Total */}
                                <div className="flex items-center justify-between pt-2.5 border-t border-slate-100 text-xs">
                                  <div className="flex items-center gap-1.5 text-slate-400 text-[11px]">
                                    {order.source === 'STAFF_PHONE' ? (
                                      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-orange-50 text-[#F58220] font-medium">
                                        <Phone className="w-3 h-3" />
                                        <span>{t('phoneOrder')}</span>
                                      </span>
                                    ) : (
                                      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-blue-50 text-[#17307A] font-medium">
                                        <Globe className="w-3 h-3" />
                                        <span>{t('retailerAppOrder')}</span>
                                      </span>
                                    )}
                                    <span>• {order.lines.length} {t('itemsCount')}</span>
                                  </div>

                                  <div className="text-right">
                                    <div className="font-bold text-slate-900 text-xs sm:text-sm">
                                      {formatPaise(order.total_paise)}
                                    </div>
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      ) : (
        /* Flat Timeline List View */
        <div className="bg-white border border-[#E2E8F0] rounded-2xl shadow-xs overflow-hidden">
          <div className="divide-y divide-slate-100">
            {filteredOrders.length === 0 ? (
              <div className="p-12 text-center text-slate-400">
                <FileText className="w-10 h-10 mx-auto text-slate-300 mb-2" />
                <p className="text-sm font-semibold text-slate-600">{t('noOrdersInArea')}</p>
              </div>
            ) : (
              filteredOrders.map((order) => {
                const cfg = STATUS_CONFIG[order.status] || STATUS_CONFIG.RECEIVED;
                const IconComponent = cfg.icon;
                const isSelected = selectedOrderId === order.id;

                return (
                  <div
                    key={order.id}
                    onClick={() => setSelectedOrderId(order.id)}
                    className={`p-3 sm:p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5 sm:gap-3 cursor-pointer transition-colors ${
                      isSelected ? 'bg-blue-50/50' : 'hover:bg-slate-50/80'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
                      <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-slate-100 text-slate-600 flex items-center justify-center shrink-0">
                        {order.source === 'STAFF_PHONE' ? (
                          <Phone className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-[#F58220]" />
                        ) : (
                          <Globe className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-[#17307A]" />
                        )}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-slate-900 text-xs sm:text-sm">
                            {order.order_number}
                          </span>
                          <span className="text-[10px] sm:text-xs text-slate-400">
                            {new Date(order.created_at).toLocaleTimeString('en-IN', {
                              hour: 'numeric',
                              minute: '2-digit',
                              hour12: true,
                            })}
                          </span>
                        </div>
                        <div className="text-[11px] sm:text-xs text-slate-600 mt-0.5 truncate">
                          <span className="font-semibold text-slate-800">{order.shop.name}</span>{' '}
                          <span className="text-slate-400">• {order.shop.area?.name || 'Ratlam'}</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 sm:gap-4 self-end sm:self-auto shrink-0">
                      <span
                        className={`inline-flex items-center gap-1 px-2 sm:px-2.5 py-0.5 sm:py-1 rounded-full text-[11px] sm:text-xs font-semibold border ${cfg.bg} ${cfg.text} ${cfg.border}`}
                      >
                        <IconComponent className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                        <span>{t(cfg.labelKey)}</span>
                      </span>

                      <div className="text-right min-w-[70px] sm:min-w-[90px]">
                        <div className="font-bold text-slate-900 text-xs sm:text-sm">
                          {formatPaise(order.total_paise)}
                        </div>
                        <div className="text-[11px] text-slate-400">
                          {order.lines.length} {t('itemsCount')}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* 5. Order Inspector Drawer / Detail Modal */}
      {selectedOrder && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-2xs flex justify-end transition-opacity">
          <div className="bg-white w-full max-w-xl h-full shadow-2xl flex flex-col overflow-hidden animate-in slide-in-from-right duration-200">
            {/* Drawer Header */}
            <div className="p-5 border-b border-slate-200 flex items-center justify-between bg-slate-50/50 shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-[#17307A] text-white flex items-center justify-center font-bold">
                  {selectedOrder.shop.name.slice(0, 1)}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-base font-bold text-slate-900">
                      {selectedOrder.order_number}
                    </h2>
                    {(() => {
                      const cfg = STATUS_CONFIG[selectedOrder.status] || STATUS_CONFIG.RECEIVED;
                      const IconComponent = cfg.icon;
                      return (
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold border ${cfg.bg} ${cfg.text} ${cfg.border}`}
                        >
                          <IconComponent className="w-3 h-3" />
                          <span>{t(cfg.labelKey)}</span>
                        </span>
                      );
                    })()}
                  </div>
                  <div className="text-xs text-slate-400 mt-0.5">
                    {new Date(selectedOrder.created_at).toLocaleString('en-IN', {
                      dateStyle: 'medium',
                      timeStyle: 'short',
                    })}
                  </div>
                </div>
              </div>

              <button
                onClick={() => setSelectedOrderId(null)}
                className="w-8 h-8 rounded-lg border border-slate-200 hover:bg-slate-100 text-slate-500 flex items-center justify-center transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Drawer Scrollable Body */}
            <div className="flex-1 overflow-y-auto p-5 space-y-5 text-xs">
              {/* Error Alert */}
              {actionError && (
                <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{actionError}</span>
                </div>
              )}

              {/* Retailer Card */}
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-2.5">
                <div className="text-slate-400 font-semibold uppercase tracking-wider text-[10px]">
                  {t('retailerInfo')}
                </div>
                <div className="flex items-start justify-between">
                  <div>
                    <div className="font-bold text-sm text-slate-900">
                      {selectedOrder.shop.name}
                    </div>
                    <div className="text-slate-500 mt-0.5">
                      {selectedOrder.shop.owner_name}
                    </div>
                  </div>

                  <a
                    href={`tel:${selectedOrder.shop.phone}`}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white border border-slate-300 text-slate-700 font-semibold hover:bg-slate-100"
                  >
                    <Phone className="w-3 h-3 text-[#17307A]" />
                    <span>{selectedOrder.shop.phone}</span>
                  </a>
                </div>

                <div className="flex items-center gap-1.5 text-slate-500 pt-1 border-t border-slate-200/60">
                  <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  <span className="truncate">
                    {selectedOrder.shop.area?.name || 'Ratlam'} • {selectedOrder.shop.address}
                  </span>
                </div>

                {selectedOrder.shop.hold_flag && (
                  <div className="p-2 rounded-lg bg-rose-100/60 border border-rose-200 text-rose-700 font-medium flex items-center gap-1.5">
                    <ShieldAlert className="w-4 h-4 shrink-0" />
                    <span>{t('creditHoldWarning')}</span>
                  </div>
                )}
              </div>

              {/* Order Items Table */}
              <div>
                <div className="font-bold text-slate-800 text-sm mb-2.5 flex items-center justify-between">
                  <span>{t('orderItems')}</span>
                  <span className="text-xs text-slate-400 font-normal">
                    {selectedOrder.lines.length} {t('itemsCount')}
                  </span>
                </div>

                <div className="border border-slate-200 rounded-xl overflow-hidden">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200">
                      <tr>
                        <th className="p-2.5 pl-3">{t('productName')}</th>
                        <th className="p-2.5 text-right">{t('wholesaleUnit')}</th>
                        <th className="p-2.5 text-right">{t('unitRate')}</th>
                        <th className="p-2.5 text-right pr-3">{t('netTotal')}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {selectedOrder.lines.map((l) => {
                        const lineTotal = l.display_quantity * l.price_paise_snapshot;
                        return (
                          <tr key={l.id} className="hover:bg-slate-50/50">
                            <td className="p-2.5 pl-3">
                              <div className="font-semibold text-slate-900">
                                {getProductDisplayName(l)}
                              </div>
                              <div className="mt-1 flex items-center gap-2">
                                {(() => {
                                  const sub = orderSubstitutions[l.id];
                                  if (!sub) {
                                    return (
                                      <button
                                        type="button"
                                        onClick={() => handleOpenSubModal(l)}
                                        className="text-[11px] font-semibold text-[#17307A] hover:underline flex items-center gap-1 cursor-pointer"
                                      >
                                        <Sparkles className="w-3 h-3 text-[#F58220]" />
                                        <span>{t('proposeAlternative')}</span>
                                      </button>
                                    );
                                  }
                                  if (sub.shop_reply === 'PENDING') {
                                    return (
                                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-900 border border-amber-300">
                                        <Clock className="w-3 h-3 text-amber-700" />
                                        <span>{t('awaitingShopReply')}</span>
                                      </span>
                                    );
                                  }
                                  if (sub.shop_reply === 'ACCEPTED') {
                                    return (
                                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-900 border border-emerald-300">
                                        <CheckCircle2 className="w-3 h-3 text-emerald-700" />
                                        <span>{t('alternativeAccepted')}</span>
                                      </span>
                                    );
                                  }
                                  if (sub.shop_reply === 'REJECTED') {
                                    return (
                                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-900 border border-rose-300">
                                        <XCircle className="w-3 h-3 text-rose-700" />
                                        <span>{t('alternativeRejected')}</span>
                                      </span>
                                    );
                                  }
                                  return null;
                                })()}
                              </div>
                            </td>
                            <td className="p-2.5 text-right font-medium text-slate-700">
                              {l.display_quantity} {l.order_unit_name}
                            </td>
                            <td className="p-2.5 text-right text-slate-500">
                              {formatPaise(l.price_paise_snapshot)}
                            </td>
                            <td className="p-2.5 text-right pr-3 font-bold text-slate-900">
                              {formatPaise(lineTotal)}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Order Financial Totals */}
              <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-2">
                <div className="flex justify-between text-slate-600">
                  <span>{t('subtotal')}</span>
                  <span>{formatPaise(selectedOrder.subtotal_paise)}</span>
                </div>
                {selectedOrder.discount_paise > 0 && (
                  <div className="flex justify-between text-emerald-600 font-medium">
                    <span>{t('discount')}</span>
                    <span>- {formatPaise(selectedOrder.discount_paise)}</span>
                  </div>
                )}
                <div className="flex justify-between pt-2 border-t border-slate-200 text-sm font-bold text-slate-900">
                  <span>{t('netTotal')}</span>
                  <span className="text-[#17307A]">
                    {formatPaise(selectedOrder.total_paise)}
                  </span>
                </div>
              </div>

              {/* Status Audit Trail */}
              <div>
                <div className="font-bold text-slate-800 text-xs mb-2">
                  {t('orderAuditTrail')}
                </div>
                <div className="space-y-2">
                  {selectedOrder.events.map((ev, i) => (
                    <div
                      key={ev.id || i}
                      className="flex items-start gap-2 p-2 rounded-lg bg-slate-50 text-[11px]"
                    >
                      <div className="w-1.5 h-1.5 rounded-full bg-[#17307A] mt-1.5 shrink-0" />
                      <div className="flex-1">
                        <span className="font-semibold text-slate-800">
                          {ev.status}
                        </span>
                        {ev.notes && <span className="text-slate-500"> — {ev.notes}</span>}
                      </div>
                      <div className="text-slate-400">
                        {new Date(ev.created_at).toLocaleTimeString('en-IN', {
                          hour: 'numeric',
                          minute: '2-digit',
                          hour12: true,
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Drawer Actions Footer */}
            <div className="p-4 border-t border-slate-200 bg-white flex flex-col gap-2.5 shrink-0">
              {/* Direct Bill & UPI QR Link */}
              <Link
                href={`/d/bills/${selectedOrder.id}`}
                className="w-full py-2.5 px-4 rounded-xl border border-blue-200 bg-blue-50/80 hover:bg-blue-100 text-[#17307A] font-bold text-xs flex items-center justify-center gap-2 transition-colors shadow-2xs"
              >
                <Receipt className="w-4 h-4 text-[#F58220]" />
                <span>{language === 'hi' ? 'थोक बिल और यूपीआई क्यूआर देखें' : 'View Bill & UPI QR'}</span>
              </Link>

              <div className="flex items-center gap-2.5 w-full">
              {selectedOrder.status === 'RECEIVED' && (
                <>
                  <button
                    onClick={() => handleUpdateStatus('CONFIRMED')}
                    disabled={isUpdating}
                    className="flex-1 py-2.5 rounded-xl bg-[#17307A] hover:bg-[#17307A]/90 text-white font-semibold text-xs shadow-sm transition-colors cursor-pointer disabled:opacity-50"
                  >
                    {t('markConfirmed')}
                  </button>
                  <button
                    onClick={() => handleUpdateStatus('CANCELLED')}
                    disabled={isUpdating}
                    className="py-2.5 px-4 rounded-xl border border-rose-300 text-rose-700 hover:bg-rose-50 font-semibold text-xs transition-colors cursor-pointer disabled:opacity-50"
                  >
                    {t('cancelOrder')}
                  </button>
                </>
              )}

              {selectedOrder.status === 'CONFIRMED' && (
                <>
                  <button
                    onClick={() => handleUpdateStatus('PACKED')}
                    disabled={isUpdating}
                    className="flex-1 py-2.5 rounded-xl bg-purple-700 hover:bg-purple-800 text-white font-semibold text-xs shadow-sm transition-colors cursor-pointer disabled:opacity-50"
                  >
                    {t('markPacked')}
                  </button>
                  <button
                    onClick={() => handleUpdateStatus('CANCELLED')}
                    disabled={isUpdating}
                    className="py-2.5 px-4 rounded-xl border border-rose-300 text-rose-700 hover:bg-rose-50 font-semibold text-xs transition-colors cursor-pointer disabled:opacity-50"
                  >
                    {t('cancelOrder')}
                  </button>
                </>
              )}

              {selectedOrder.status === 'PACKED' && (
                <button
                  onClick={() => handleUpdateStatus('OUT_FOR_DELIVERY')}
                  disabled={isUpdating}
                  className="w-full py-2.5 rounded-xl bg-[#F58220] hover:bg-[#F58220]/90 text-white font-semibold text-xs shadow-sm transition-colors cursor-pointer disabled:opacity-50"
                >
                  {t('markOutForDelivery')}
                </button>
              )}

              {selectedOrder.status === 'OUT_FOR_DELIVERY' && (
                <button
                  onClick={() => handleUpdateStatus('DELIVERED')}
                  disabled={isUpdating}
                  className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs shadow-sm transition-colors cursor-pointer disabled:opacity-50"
                >
                  {t('markDelivered')}
                </button>
              )}

              {(selectedOrder.status === 'DELIVERED' ||
                selectedOrder.status === 'CANCELLED') && (
                <div className="w-full text-center text-xs text-slate-400 py-1 font-medium">
                  {language === 'hi'
                    ? 'यह ऑर्डर पूर्ण या अंतिम स्थिति में है।'
                    : 'This order is in a completed or final state.'}
                </div>
              )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 6. Substitution Propose Modal */}
      {isSubModalOpen && subTargetLine && (
        <div className="fixed inset-0 z-60 bg-slate-900/50 backdrop-blur-2xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-5 space-y-4 shadow-2xl animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-[#17307A]/10 text-[#17307A] flex items-center justify-center">
                  <Sparkles className="w-4 h-4 text-[#F58220]" />
                </div>
                <h3 className="font-bold text-slate-900 text-sm">
                  {t('substitutionTitle')}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsSubModalOpen(false)}
                className="w-7 h-7 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 flex items-center justify-center transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Target Product Info */}
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-1 text-xs">
              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                {language === 'hi' ? 'मूल ऑर्डर किया गया उत्पाद' : 'Original Ordered Item'}
              </div>
              <div className="flex justify-between items-center">
                <span className="font-bold text-slate-900">
                  {getProductDisplayName(subTargetLine)}
                </span>
                <span className="font-mono text-slate-700">
                  {formatPaise(subTargetLine.price_paise_snapshot)} / {subTargetLine.order_unit_name}
                </span>
              </div>
              <div className="text-slate-500">
                {language === 'hi' ? 'मांगी गई मात्रा:' : 'Ordered Qty:'}{' '}
                <strong>{subTargetLine.display_quantity} {subTargetLine.order_unit_name}</strong>
              </div>
            </div>

            {subProposalError && (
              <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{subProposalError}</span>
              </div>
            )}

            {/* Candidates List */}
            <div className="space-y-2 text-xs">
              <div className="font-bold text-slate-800">
                {t('selectAlternative')}
              </div>

              {loadingCandidates ? (
                <div className="py-8 text-center text-slate-400">
                  {language === 'hi' ? 'वैकल्पिक उत्पाद खोजे जा रहे हैं...' : 'Loading candidate alternatives...'}
                </div>
              ) : candidates.length === 0 ? (
                <div className="py-6 text-center text-slate-400 bg-slate-50 rounded-xl border border-dashed border-slate-200">
                  {t('noAlternativesFound')}
                </div>
              ) : (
                <div className="space-y-2 max-h-52 overflow-y-auto pr-1">
                  {candidates.map((c) => {
                    const isSelected = selectedCandidateId === c.id;
                    const diffText =
                      c.priceDiffPaise === 0
                        ? (language === 'hi' ? 'समान मूल्य' : 'Same Price')
                        : c.priceDiffPaise > 0
                        ? `+${formatPaise(c.priceDiffPaise)}`
                        : `-${formatPaise(Math.abs(c.priceDiffPaise))}`;

                    return (
                      <div
                        key={c.id}
                        onClick={() => setSelectedCandidateId(c.id)}
                        className={`p-3 rounded-xl border text-xs cursor-pointer transition-all ${
                          isSelected
                            ? 'border-[#17307A] bg-blue-50/60 ring-2 ring-[#17307A]/20'
                            : 'border-slate-200 bg-white hover:bg-slate-50'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <div className="font-bold text-slate-900">{c.name}</div>
                            <div className="text-[11px] text-slate-500 mt-0.5">
                              {c.brandName} • {c.packDifference}
                            </div>
                          </div>
                          <div className="text-right shrink-0">
                            <div className="font-bold font-mono text-slate-900">
                              {formatPaise(c.ratePaise)}
                            </div>
                            <span
                              className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full inline-block mt-0.5 ${
                                c.priceDiffPaise > 0
                                  ? 'bg-amber-100 text-amber-800'
                                  : c.priceDiffPaise < 0
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : 'bg-slate-100 text-slate-700'
                              }`}
                            >
                              {diffText}
                            </span>
                          </div>
                        </div>

                        <div className="mt-2 pt-2 border-t border-slate-100 flex items-center justify-between text-[11px]">
                          <span className="text-slate-400">
                            {c.matchType === 'SAME_BRAND' ? t('sameBrand') : t('sameCategory')}
                          </span>
                          <span className={c.inStock ? 'text-emerald-700 font-semibold' : 'text-slate-400'}>
                            {c.inStock ? `${c.stockQty} ${c.unit}` : (language === 'hi' ? 'स्टॉक अनुपलब्ध' : 'Out of Stock')}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Voice agent simulation trigger */}
            <label className="flex items-start gap-2.5 p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs cursor-pointer">
              <input
                type="checkbox"
                checked={triggerVoiceCall}
                onChange={(e) => setTriggerVoiceCall(e.target.checked)}
                className="mt-0.5 rounded text-[#17307A] focus:ring-[#17307A]"
              />
              <div className="space-y-0.5">
                <span className="font-bold text-slate-800 block">
                  {t('simulateVoiceCall')}
                </span>
                <span className="text-[11px] text-slate-400 block">
                  {language === 'hi'
                    ? 'दुकानदार को तुरंत आउट ऑफ स्टॉक सूचना व विकल्प की वॉयस कॉल सिमुलेट करें।'
                    : 'Immediately logs an automated voice call notification script for this shopkeeper.'}
                </span>
              </div>
            </label>

            {/* Modal Actions */}
            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setIsSubModalOpen(false)}
                className="flex-1 py-2.5 rounded-xl border border-slate-300 font-semibold text-xs text-slate-700 hover:bg-slate-50 transition-colors"
              >
                {t('cancel')}
              </button>
              <button
                type="button"
                disabled={!selectedCandidateId || submittingProposal || candidates.length === 0}
                onClick={handleSendProposal}
                className="flex-1 py-2.5 rounded-xl bg-[#17307A] hover:bg-[#17307A]/90 text-white font-bold text-xs shadow-sm transition-colors disabled:opacity-50 flex items-center justify-center gap-1.5"
              >
                <Sparkles className="w-3.5 h-3.5 text-[#F58220]" />
                <span>{submittingProposal ? (language === 'hi' ? 'भेजा जा रहा है...' : 'Sending...') : t('sendProposal')}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
