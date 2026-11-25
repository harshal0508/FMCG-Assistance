'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import {
  ShoppingBag,
  Package,
  IndianRupee,
  Clock,
  MapPin,
  Truck,
  Send,
  CheckCircle2,
  AlertCircle,
  XCircle,
  ArrowRight,
  TrendingUp,
  BarChart3,
  Calendar,
} from 'lucide-react';
import { formatPaise } from '@/lib/money';
import { useTranslation } from '@/lib/i18n/context';

export interface DashboardProps {
  metrics: {
    ordersTodayCount: number;
    ordersTodayTurnoverPaise: number;
    toPackCount: number;
    toCollectPaise: number;
    quietShopsCount: number;
  };
  todaysRoute: {
    routeName: string;
    cutoffTime: string;
    areas: string[];
    packingReadinessPercent: number;
    readyToDeliverOrders: number;
    totalRouteOrders: number;
  };
  recentOrders: Array<{
    id: string;
    order_number: string;
    shop_name: string;
    area_name: string;
    total_paise: number;
    status: string;
    source: string;
    created_at: string;
  }>;
  quietShops: Array<{
    id: string;
    name: string;
    owner_name: string;
    phone: string;
    area_name: string;
    days_since: number;
    usual_interval: number;
  }>;
  areaRevenue: Array<{
    id: string;
    name: string;
    total_paise: number;
    shop_count: number;
  }>;
  weeklyTrend: Array<{
    week_label: string;
    count: number;
    turnover_paise: number;
  }>;
}

export default function DashboardView({
  metrics,
  todaysRoute,
  recentOrders,
  quietShops,
  areaRevenue,
  weeklyTrend,
}: DashboardProps) {
  const { language, t } = useTranslation();
  const [nudgedShops, setNudgedShops] = useState<Record<string, boolean>>({});
  const [showCancelledOrders, setShowCancelledOrders] = useState(false);

  const activeRecentOrders = recentOrders.filter((o) => o.status !== 'CANCELLED');
  const cancelledRecentOrders = recentOrders.filter((o) => o.status === 'CANCELLED');
  const displayedOrders = showCancelledOrders
    ? [...activeRecentOrders, ...cancelledRecentOrders]
    : activeRecentOrders;

  const handleNudge = (shopId: string) => {
    setNudgedShops((prev) => ({ ...prev, [shopId]: true }));
  };

  const maxAreaPaise = Math.max(...areaRevenue.map((a) => a.total_paise), 1);
  const maxWeeklyCount = Math.max(...weeklyTrend.map((w) => w.count), 1);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'DELIVERED':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>{t('delivered')}</span>
          </span>
        );
      case 'CONFIRMED':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200">
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>{t('confirmed')}</span>
          </span>
        );
      case 'PACKING':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">
            <Clock className="w-3.5 h-3.5" />
            <span>{t('packing')}</span>
          </span>
        );
      case 'CANCELLED':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-200">
            <XCircle className="w-3.5 h-3.5" />
            <span>{t('cancelled')}</span>
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-700">
            <span>{status}</span>
          </span>
        );
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
        <div>
          <h1 className="text-lg sm:text-xl md:text-2xl font-bold text-[#17307A] tracking-tight">
            {t('todayOverview')}
          </h1>
          <p className="text-[11px] sm:text-xs md:text-sm text-slate-500 mt-0.5">
            {t('todaySubtitle')}
          </p>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <Link
            href="/d/orders/new"
            className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-3.5 sm:px-4 py-1.5 sm:py-2 rounded-xl bg-[#F58220] hover:bg-[#F58220]/90 text-white text-xs font-bold shadow-sm transition-colors"
          >
            <span>+ {language === 'hi' ? 'नया फोन ऑर्डर' : 'New Order'}</span>
          </Link>
        </div>
      </div>

      {/* 4 Top Focus Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-3.5 md:gap-4">
        {/* Card 1: Orders Today */}
        <div className="bg-white border border-[#E2E8F0] rounded-xl p-3 sm:p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] sm:text-xs font-semibold text-slate-500 truncate">{t('ordersToday')}</span>
            <div className="w-6 h-6 sm:w-8 sm:h-8 rounded-lg bg-blue-50 text-[#17307A] flex items-center justify-center shrink-0">
              <ShoppingBag className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            </div>
          </div>
          <div className="text-lg sm:text-2xl md:text-3xl font-extrabold text-[#17307A] mt-1 sm:mt-2">
            {metrics.ordersTodayCount}
          </div>
          <div className="text-[10px] sm:text-[11px] text-slate-400 mt-0.5 sm:mt-1 truncate">
            {metrics.ordersTodayTurnoverPaise > 0
              ? `${formatPaise(metrics.ordersTodayTurnoverPaise)} ${language === 'hi' ? 'बिक्री' : 'turnover'}`
              : (language === 'hi' ? 'कट-ऑफ से पहले का सत्र' : 'Pre-cutoff intake')}
          </div>
        </div>

        {/* Card 2: To Pack */}
        <div className="bg-white border border-[#E2E8F0] rounded-xl p-3 sm:p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] sm:text-xs font-semibold text-slate-500 truncate">{t('toPack')}</span>
            <div className="w-6 h-6 sm:w-8 sm:h-8 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
              <Package className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            </div>
          </div>
          <div className="text-lg sm:text-2xl md:text-3xl font-extrabold text-amber-600 mt-1 sm:mt-2">
            {metrics.toPackCount}
          </div>
          <div className="text-[10px] sm:text-[11px] text-slate-400 mt-0.5 sm:mt-1 truncate">
            {language === 'hi' ? 'डिलीवरी के लिए तैयार करें' : 'Pending warehouse packing'}
          </div>
        </div>

        {/* Card 3: Payments to Collect */}
        <div className="bg-white border border-[#E2E8F0] rounded-xl p-3 sm:p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] sm:text-xs font-semibold text-slate-500 truncate">{t('toCollect')}</span>
            <div className="w-6 h-6 sm:w-8 sm:h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
              <IndianRupee className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            </div>
          </div>
          <div className="text-lg sm:text-2xl md:text-3xl font-extrabold text-slate-900 mt-1 sm:mt-2">
            {formatPaise(metrics.toCollectPaise)}
          </div>
          <div className="text-[10px] sm:text-[11px] text-slate-400 mt-0.5 sm:mt-1 truncate">
            {language === 'hi' ? 'बकाया उधारी और बिल' : 'Outstanding shop balances'}
          </div>
        </div>

        {/* Card 4: Quiet Shops */}
        <div className="bg-white border border-[#E2E8F0] rounded-xl p-3 sm:p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] sm:text-xs font-semibold text-slate-500 truncate">{t('quietShops')}</span>
            <div className="w-6 h-6 sm:w-8 sm:h-8 rounded-lg bg-rose-50 text-rose-600 flex items-center justify-center shrink-0">
              <Clock className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            </div>
          </div>
          <div className="text-lg sm:text-2xl md:text-3xl font-extrabold text-rose-600 mt-1 sm:mt-2">
            {metrics.quietShopsCount}
          </div>
          <div className="text-[10px] sm:text-[11px] text-slate-400 mt-0.5 sm:mt-1 truncate">
            {language === 'hi' ? '१४ दिन से कोई ऑर्डर नहीं' : 'Overdue for re-order'}
          </div>
        </div>
      </div>

      {/* Today's Delivery Route Card */}
      <div className="bg-white border border-[#E2E8F0] rounded-xl p-5 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#17307A] text-white flex items-center justify-center shrink-0">
              <Truck className="w-5 h-5 text-[#F58220]" />
            </div>
            <div>
              <div className="text-xs font-semibold uppercase text-slate-400 tracking-wider">
                {t('todaysRoute')}
              </div>
              <div className="text-base font-bold text-[#17307A]">
                {todaysRoute.routeName}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="px-3 py-1 rounded-full bg-slate-100 text-slate-700 text-xs font-semibold flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-slate-500" />
              <span>{t('routeCutoff')}: {todaysRoute.cutoffTime}</span>
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4">
          <div>
            <div className="text-xs text-slate-500 font-medium mb-1.5">{t('scheduledArea')}</div>
            <div className="flex flex-wrap gap-1.5">
              {todaysRoute.areas.map((area, idx) => (
                <span
                  key={idx}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-100 text-slate-800 text-xs font-medium"
                >
                  <MapPin className="w-3 h-3 text-[#17307A]" />
                  <span>{area}</span>
                </span>
              ))}
            </div>
          </div>

          <div className="md:col-span-2 flex flex-col justify-center">
            <div className="flex justify-between items-center text-xs mb-1.5">
              <span className="font-semibold text-slate-700">{t('packProgress')}</span>
              <span className="font-bold text-[#17307A]">{todaysRoute.packingReadinessPercent}%</span>
            </div>
            <div className="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden">
              <div
                className="bg-[#17307A] h-2.5 rounded-full transition-all duration-500"
                style={{ width: `${Math.min(100, Math.max(5, todaysRoute.packingReadinessPercent))}%` }}
              />
            </div>
            <div className="text-[11px] text-slate-400 mt-1.5 flex justify-between">
              <span>{todaysRoute.readyToDeliverOrders} {language === 'hi' ? 'ऑर्डर पैक हो चुके हैं' : 'orders packed & ready'}</span>
              <span>{todaysRoute.totalRouteOrders} {language === 'hi' ? 'कुल निर्धारित ऑर्डर' : 'total scheduled'}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Two Column Layout: Recent Orders & Quiet Shops */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Recent Orders (2 cols) */}
        <div className="lg:col-span-2 bg-white border border-[#E2E8F0] rounded-xl shadow-xs overflow-hidden">
          <div className="p-4 flex flex-wrap items-center justify-between gap-2 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <h2 className="text-base font-bold text-[#17307A]">{t('recentOrders')}</h2>
              <span className="px-2 py-0.5 rounded-full bg-blue-50 text-[#17307A] text-[11px] font-bold">
                {activeRecentOrders.length} Active
              </span>
            </div>

            <div className="flex items-center gap-3">
              {cancelledRecentOrders.length > 0 && (
                <button
                  type="button"
                  onClick={() => setShowCancelledOrders(!showCancelledOrders)}
                  className={`text-[11px] font-semibold px-2 py-1 rounded-lg border transition-colors ${
                    showCancelledOrders
                      ? 'bg-slate-200 border-slate-300 text-slate-800'
                      : 'bg-slate-50 border-slate-200 text-slate-500 hover:text-slate-700'
                  }`}
                >
                  {showCancelledOrders ? 'Hide Cancelled' : `Show Cancelled (${cancelledRecentOrders.length})`}
                </button>
              )}

              <Link
                href="/d/orders"
                className="text-xs font-semibold text-[#17307A] hover:underline flex items-center gap-1"
              >
                <span>{t('viewAllOrders')}</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200">
                <tr>
                  <th className="p-3.5 pl-4">Order #</th>
                  <th className="p-3.5">Retailer</th>
                  <th className="p-3.5">Market Area</th>
                  <th className="p-3.5 text-right">Total (₹)</th>
                  <th className="p-3.5 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {displayedOrders.map((ord) => {
                  const isCancelled = ord.status === 'CANCELLED';
                  return (
                    <tr
                      key={ord.id}
                      className={`transition-colors ${
                        isCancelled
                          ? 'opacity-50 bg-slate-50/50 hover:bg-slate-100/50 text-slate-400'
                          : 'hover:bg-slate-50/70'
                      }`}
                    >
                      <td className={`p-3.5 pl-4 font-bold ${isCancelled ? 'text-slate-400 line-through' : 'text-slate-800'}`}>
                        {ord.order_number}
                      </td>
                      <td className="p-3.5">
                        <div className={`font-semibold ${isCancelled ? 'text-slate-500 line-through' : 'text-slate-900'}`}>
                          {ord.shop_name}
                        </div>
                        <div className="text-[11px] text-slate-400">{ord.created_at}</div>
                      </td>
                      <td className="p-3.5 text-slate-500">
                        {ord.area_name}
                      </td>
                      <td className={`p-3.5 text-right font-bold ${isCancelled ? 'text-slate-400 line-through' : 'text-slate-900'}`}>
                        {formatPaise(ord.total_paise)}
                      </td>
                      <td className="p-3.5 text-center">
                        {isCancelled ? (
                          <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-400 text-[10px] font-bold border border-slate-200">
                            CANCELLED
                          </span>
                        ) : (
                          getStatusBadge(ord.status)
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Right: Quiet Shops Alert with 1-click Nudge (1 col) */}
        <div className="bg-white border border-[#E2E8F0] rounded-xl shadow-xs overflow-hidden flex flex-col">
          <div className="p-4 border-b border-slate-100">
            <h2 className="text-base font-bold text-[#17307A]">{t('quietShopsTitle')}</h2>
            <p className="text-xs text-slate-500 mt-0.5">{t('quietShopsSubtitle')}</p>
          </div>

          <div className="divide-y divide-slate-100 flex-1 overflow-y-auto">
            {quietShops.map((shop) => {
              const isNudged = nudgedShops[shop.id];
              return (
                <div key={shop.id} className="p-3.5 flex items-center justify-between hover:bg-slate-50 transition-colors">
                  <div className="min-w-0 pr-2">
                    <div className="font-bold text-slate-900 text-xs truncate">{shop.name}</div>
                    <div className="text-[11px] text-slate-500">{shop.owner_name} • {shop.area_name}</div>
                    <div className="text-[10px] text-rose-600 font-medium mt-0.5">
                      {shop.days_since} {language === 'hi' ? 'दिन पहले अंतिम ऑर्डर' : 'days since last order'}
                    </div>
                  </div>

                  <button
                    onClick={() => handleNudge(shop.id)}
                    disabled={isNudged}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1 shrink-0 transition-colors cursor-pointer ${
                      isNudged
                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                        : 'bg-[#17307A] text-white hover:bg-[#17307A]/90'
                    }`}
                  >
                    {isNudged ? (
                      <>
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>{t('nudgeSent')}</span>
                      </>
                    ) : (
                      <>
                        <Send className="w-3.5 h-3.5" />
                        <span>{t('sendNudge')}</span>
                      </>
                    )}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Revenue by Area & Weekly Orders Trend (2 Equal Columns) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Revenue by Area (excluding cancelled orders) */}
        <div className="bg-white border border-[#E2E8F0] rounded-xl p-5 shadow-xs">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div>
              <h2 className="text-base font-bold text-[#17307A]">{t('revenueByArea')}</h2>
              <div className="text-[11px] text-slate-400 mt-0.5">{t('revenueExcludesCancelled')}</div>
            </div>
            <BarChart3 className="w-4 h-4 text-slate-400" />
          </div>

          <div className="space-y-3.5 pt-4">
            {areaRevenue.map((area) => {
              const pct = Math.round((area.total_paise / maxAreaPaise) * 100);
              return (
                <div key={area.id}>
                  <div className="flex justify-between items-center text-xs mb-1">
                    <span className="font-semibold text-slate-800">{area.name}</span>
                    <span className="font-bold text-[#17307A]">{formatPaise(area.total_paise)}</span>
                  </div>
                  <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                    <div
                      className="bg-[#17307A] h-2 rounded-full transition-all duration-500"
                      style={{ width: `${Math.min(100, Math.max(3, pct))}%` }}
                    />
                  </div>
                  <div className="text-[10px] text-slate-400 mt-0.5">
                    {area.shop_count} {language === 'hi' ? 'दुकानें' : 'retailers'}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Weekly Orders Trend */}
        <div className="bg-white border border-[#E2E8F0] rounded-xl p-5 shadow-xs">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div>
              <h2 className="text-base font-bold text-[#17307A]">{t('weeklyOrderTrend')}</h2>
              <div className="text-[11px] text-slate-400 mt-0.5">
                {language === 'hi' ? '८ सप्ताह का निरंतर रुझान' : '8-week completed delivery volume'}
              </div>
            </div>
            <TrendingUp className="w-4 h-4 text-slate-400" />
          </div>

          <div className="h-48 pt-6 flex items-end justify-between gap-2">
            {weeklyTrend.map((wk, idx) => {
              const heightPct = Math.round((wk.count / maxWeeklyCount) * 100);
              return (
                <div key={idx} className="flex-1 flex flex-col items-center gap-1">
                  <span className="text-[10px] font-bold text-slate-700">{wk.count}</span>
                  <div className="w-full bg-slate-100 h-28 rounded-md flex items-end p-0.5">
                    <div
                      className="w-full bg-[#17307A] rounded-xs transition-all duration-500 hover:bg-[#F58220]"
                      style={{ height: `${Math.min(100, Math.max(8, heightPct))}%` }}
                      title={`${wk.week_label}: ${wk.count} orders (${formatPaise(wk.turnover_paise)})`}
                    />
                  </div>
                  <span className="text-[9px] text-slate-400 truncate max-w-full text-center">
                    {wk.week_label}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
