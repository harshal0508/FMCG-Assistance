'use client';

import React, { useState, useMemo } from 'react';
import {
  BarChart3,
  TrendingUp,
  Download,
  MapPin,
  Calendar,
  Store,
  ShoppingBag,
  Award,
  ChevronDown,
  ChevronUp,
  Filter,
  CheckCircle2,
  AlertCircle,
  Package,
  IndianRupee,
  FileText,
  Truck,
} from 'lucide-react';
import { formatPaise } from '@/lib/money';
import { useTranslation } from '@/lib/i18n/context';

export interface AreaBreakdownItem {
  id: string;
  name: string;
  routeGroupName: string;
  orderDayOfWeek: number;
  cutoffTime: string;
  totalShops: number;
  activeShops: number;
  quietShops: number;
  coveragePercent: number;
  ordersCount: number;
  revenuePaise: number;
  aovPaise: number;
  topShops: { id: string; name: string; owner: string; spendPaise: number; orderCount: number }[];
  bottomShops: { id: string; name: string; owner: string; spendPaise: number; orderCount: number }[];
}

export interface WeekdayComparisonItem {
  day: number;
  name: string;
  nameHi: string;
  ordersCount: number;
  revenuePaise: number;
}

export interface BrandMixItem {
  id: string;
  name: string;
  revenuePaise: number;
  percentage: number;
}

export interface AnalyticsData {
  filters: { range: string; areaFilter: string };
  summary: {
    totalRevenuePaise: number;
    totalOrders: number;
    averageOrderValuePaise: number;
    totalShopsCount: number;
    activeShopsCount: number;
    quietShopsCount: number;
    overallCoveragePercent: number;
  };
  areaBreakdowns: AreaBreakdownItem[];
  weekdayComparison: WeekdayComparisonItem[];
  brandMix: BrandMixItem[];
}

interface Props {
  initialData: AnalyticsData;
}

export default function AnalyticsView({ initialData }: Props) {
  const { language } = useTranslation();
  const [data, setData] = useState<AnalyticsData>(initialData);
  const [range, setRange] = useState<string>('8W');
  const [selectedAreaId, setSelectedAreaId] = useState<string>('ALL');
  const [loading, setLoading] = useState(false);
  const [expandedAreaId, setExpandedAreaId] = useState<string | null>(null);

  // Re-fetch analytics when range or area changes
  const fetchAnalytics = async (newRange: string, newAreaId: string) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/distributor/analytics?range=${newRange}&areaId=${newAreaId}`);
      if (res.ok) {
        const json = await res.json();
        setData(json);
      }
    } catch (err) {
      console.error('Failed to load analytics', err);
    } finally {
      setLoading(false);
    }
  };

  const handleRangeChange = (newRange: string) => {
    setRange(newRange);
    fetchAnalytics(newRange, selectedAreaId);
  };

  const handleAreaChange = (newAreaId: string) => {
    setSelectedAreaId(newAreaId);
    fetchAnalytics(range, newAreaId);
  };

  const maxWeekdayOrders = useMemo(() => {
    const counts = data.weekdayComparison.map((w) => w.ordersCount);
    return Math.max(...counts, 1);
  }, [data.weekdayComparison]);

  const maxAreaRevenue = useMemo(() => {
    const revs = data.areaBreakdowns.map((a) => a.revenuePaise);
    return Math.max(...revs, 1);
  }, [data.areaBreakdowns]);

  const handleExportCsv = () => {
    window.location.href = `/api/distributor/analytics/export?range=${range}&areaId=${selectedAreaId}`;
  };

  return (
    <div className="p-3 sm:p-6 max-w-7xl mx-auto space-y-4 sm:space-y-6">
      {/* 1. Header & Controls */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 sm:gap-4">
        <div>
          <h1 className="text-lg sm:text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <BarChart3 className="w-5 h-5 sm:w-6 sm:h-6 text-[#17307A] shrink-0" />
            <span>
              {language === 'hi' ? 'क्षेत्रीय बिक्री एवं ऑर्डर विश्लेषण' : 'Area Sales & Order Analytics'}
            </span>
          </h1>
          <p className="hidden sm:block text-[11px] sm:text-xs text-slate-500 mt-0.5">
            {language === 'hi'
              ? 'बाज़ार क्षेत्र अनुसार राजस्व, औसत ऑर्डर मूल्य, सक्रिय दुकानें एवं रूट कवरेज (रद्द ऑर्डर छोड़कर)'
              : 'Area-wise revenue, average order value, active shops, and route coverage (excluding cancelled orders)'}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {/* Date Range Pills */}
          <div className="bg-slate-100 p-1 rounded-xl flex items-center text-xs font-semibold">
            {[
              { key: '7D', labelEn: '7 Days', labelHi: '7 दिवस' },
              { key: '30D', labelEn: '30 Days', labelHi: '30 दिवस' },
              { key: '8W', labelEn: '8 Weeks', labelHi: '8 सप्ताह' },
              { key: 'ALL', labelEn: 'All Time', labelHi: 'सम्पूर्ण' },
            ].map((p) => (
              <button
                key={p.key}
                type="button"
                onClick={() => handleRangeChange(p.key)}
                className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${
                  range === p.key
                    ? 'bg-white text-[#17307A] shadow-2xs font-bold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {language === 'hi' ? p.labelHi : p.labelEn}
              </button>
            ))}
          </div>

          {/* Area Selector */}
          <select
            value={selectedAreaId}
            onChange={(e) => handleAreaChange(e.target.value)}
            className="px-3 py-1.5 bg-white border border-slate-300 rounded-xl text-xs font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#17307A]"
          >
            <option value="ALL">
              {language === 'hi' ? 'सभी बाज़ार क्षेत्र' : 'All Market Areas'}
            </option>
            {initialData.areaBreakdowns.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>

          {/* Export CSV Button */}
          <button
            type="button"
            onClick={handleExportCsv}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold shadow-2xs transition-colors cursor-pointer"
          >
            <Download className="w-3.5 h-3.5 text-[#17307A]" />
            <span>{language === 'hi' ? 'सीएसवी डाउनलोड' : 'Export CSV'}</span>
          </button>
        </div>
      </div>

      {/* 2. Pulse Summary KPI Cards (Differentiated visual identity) */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-2 sm:gap-3.5">
        {/* Total Revenue - Navy financial hero */}
        <div className="bg-gradient-to-br from-blue-50/70 via-white to-blue-50/30 border border-blue-200/80 rounded-2xl p-2.5 sm:p-4 space-y-1 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-[10px] sm:text-[11px] font-bold text-[#17307A] uppercase tracking-wider truncate">
              {language === 'hi' ? 'कुल बिक्री राजस्व' : 'Total Revenue'}
            </span>
            <IndianRupee className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-[#17307A] shrink-0" />
          </div>
          <div className="text-base sm:text-xl font-black text-[#17307A] tracking-tight">
            {formatPaise(data.summary.totalRevenuePaise)}
          </div>
          <div className="text-[9px] sm:text-[10px] text-emerald-700 font-bold flex items-center gap-1 truncate">
            <CheckCircle2 className="w-3 h-3 shrink-0 text-emerald-600" />
            <span>{language === 'hi' ? 'स्वीकृत व पूर्ण ऑर्डर' : 'Valid Confirmed'}</span>
          </div>
        </div>

        {/* Total Orders - Slate volume card */}
        <div className="bg-white border border-slate-200 rounded-2xl p-2.5 sm:p-4 space-y-1 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-[10px] sm:text-[11px] font-bold text-slate-500 uppercase tracking-wider truncate">
              {language === 'hi' ? 'कुल ऑर्डर' : 'Total Orders'}
            </span>
            <FileText className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-slate-400 shrink-0" />
          </div>
          <div className="text-base sm:text-xl font-black text-slate-900 tracking-tight">
            {data.summary.totalOrders}
          </div>
          <div className="text-[9px] sm:text-[10px] text-slate-500 truncate">
            {language === 'hi' ? 'रद्द ऑर्डर छोड़कर' : 'Excluding cancelled'}
          </div>
        </div>

        {/* AOV - Warm Amber/Orange efficiency card */}
        <div className="bg-gradient-to-br from-orange-50/70 via-white to-orange-50/20 border border-orange-200/80 rounded-2xl p-2.5 sm:p-4 space-y-1 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-[10px] sm:text-[11px] font-bold text-orange-800 uppercase tracking-wider truncate">
              {language === 'hi' ? 'औसत ऑर्डर मूल्य' : 'Avg Order Value'}
            </span>
            <TrendingUp className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-orange-600 shrink-0" />
          </div>
          <div className="text-base sm:text-xl font-black text-[#F58220] tracking-tight">
            {formatPaise(data.summary.averageOrderValuePaise)}
          </div>
          <div className="text-[9px] sm:text-[10px] text-slate-500 truncate">
            {language === 'hi' ? 'प्रति सक्रिय ऑर्डर' : 'Per active order'}
          </div>
        </div>

        {/* Active vs Quiet Shops - Purple engagement card */}
        <div className="bg-gradient-to-br from-purple-50/60 via-white to-purple-50/20 border border-purple-200/70 rounded-2xl p-2.5 sm:p-4 space-y-1 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-[10px] sm:text-[11px] font-bold text-purple-800 uppercase tracking-wider truncate">
              {language === 'hi' ? 'सक्रिय बनाम शांत' : 'Active vs Quiet'}
            </span>
            <Store className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-purple-600 shrink-0" />
          </div>
          <div className="text-base sm:text-xl font-black text-slate-900 tracking-tight">
            {data.summary.activeShopsCount}{' '}
            <span className="text-xs text-slate-400 font-medium">/ {data.summary.totalShopsCount}</span>
          </div>
          <div className="text-[9px] sm:text-[10px] text-purple-700 truncate font-medium">
            {data.summary.quietShopsCount} {language === 'hi' ? 'शांत दुकानें' : 'quiet shops'}
          </div>
        </div>

        {/* Route Coverage - Indigo progress banner */}
        <div className="bg-white border border-slate-200 rounded-2xl p-2.5 sm:p-4 space-y-1 shadow-2xs col-span-2 lg:col-span-1">
          <div className="flex items-center justify-between">
            <span className="text-[10px] sm:text-[11px] font-bold text-slate-500 uppercase tracking-wider truncate">
              {language === 'hi' ? 'कुल रूट कवरेज' : 'Route Coverage'}
            </span>
            <Truck className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-indigo-600 shrink-0" />
          </div>
          <div className="text-base sm:text-xl font-black text-indigo-700 tracking-tight">
            {data.summary.overallCoveragePercent}%
          </div>
          <div className="w-full bg-slate-100 rounded-full h-1.5 mt-1 overflow-hidden">
            <div
              className="bg-[#17307A] h-full rounded-full transition-all duration-300"
              style={{ width: `${Math.min(100, data.summary.overallCoveragePercent)}%` }}
            />
          </div>
          <div className="text-[9px] sm:text-[10px] text-slate-500 font-medium leading-tight mt-1">
            {language === 'hi'
              ? 'ऑर्डर देने वाली दुकानें / रूट की सक्रिय दुकानें (रद्द छोड़कर)'
              : 'Ordered shops in cycle / Active shops on route (excl. cancelled)'}
          </div>
        </div>
      </div>

      {/* 3. Weekday Comparison & Brand Mix Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Weekday Performance SVG Chart with Axes & Data Values */}
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-2xs space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-bold text-slate-900">
                {language === 'hi' ? 'सप्ताह के दिन अनुसार ऑर्डर एवं व्यापार' : 'Weekday Orders & Turnover Distribution'}
              </h2>
              <p className="hidden sm:block text-[11px] text-slate-400 mt-0.5">
                {language === 'hi' ? 'सोमवार से रविवार की दैनिक मांग का तुलनात्मक चार्ट' : 'Comparative demand rhythm across weekdays'}
              </p>
            </div>
            <Calendar className="w-4 h-4 text-slate-400" />
          </div>

          {/* SVG Bar Chart with Clear Axes & Explicit Data Values */}
          <div className="w-full overflow-x-auto">
            <svg
              className="w-full h-56 min-w-[340px]"
              viewBox="0 0 420 200"
              aria-label="Weekday Performance Chart"
            >
              {/* Horizontal Grid Lines */}
              <line x1="45" y1="20" x2="400" y2="20" stroke="#F1F5F9" strokeWidth="1" />
              <line x1="45" y1="60" x2="400" y2="60" stroke="#F1F5F9" strokeWidth="1" />
              <line x1="45" y1="100" x2="400" y2="100" stroke="#F1F5F9" strokeWidth="1" />
              <line x1="45" y1="140" x2="400" y2="140" stroke="#F1F5F9" strokeWidth="1" />

              {/* Y-Axis Line */}
              <line x1="45" y1="15" x2="45" y2="150" stroke="#CBD5E1" strokeWidth="1.5" />
              {/* X-Axis Line */}
              <line x1="45" y1="150" x2="400" y2="150" stroke="#CBD5E1" strokeWidth="1.5" />

              {/* Y-Axis Tick Labels */}
              <text x="40" y="24" textAnchor="end" fontSize="9" fill="#94A3B8" fontFamily="monospace">
                {maxWeekdayOrders}
              </text>
              <text x="40" y="85" textAnchor="end" fontSize="9" fill="#94A3B8" fontFamily="monospace">
                {Math.round(maxWeekdayOrders / 2)}
              </text>
              <text x="40" y="152" textAnchor="end" fontSize="9" fill="#94A3B8" fontFamily="monospace">
                0
              </text>

              {/* Bars and Values */}
              {data.weekdayComparison.map((w, idx) => {
                const barWidth = 32;
                const gap = 18;
                const x = 55 + idx * (barWidth + gap);
                const heightRatio = maxWeekdayOrders > 0 ? w.ordersCount / maxWeekdayOrders : 0;
                const barHeight = Math.max(4, heightRatio * 125);
                const y = 150 - barHeight;
                const isHighVolume = w.ordersCount > 0 && w.ordersCount === maxWeekdayOrders;

                return (
                  <g key={w.day}>
                    {/* Bar Rectangle */}
                    <rect
                      x={x}
                      y={y}
                      width={barWidth}
                      height={barHeight}
                      rx="4"
                      fill={isHighVolume ? '#F58220' : '#17307A'}
                      className="transition-all hover:opacity-85 cursor-pointer"
                    />

                    {/* Exact Value text above bar */}
                    <text
                      x={x + barWidth / 2}
                      y={y - 4}
                      textAnchor="middle"
                      fontSize="10"
                      fontWeight="bold"
                      fill={isHighVolume ? '#C2410C' : '#1E293B'}
                    >
                      {w.ordersCount}
                    </text>

                    {/* X-Axis Day Label */}
                    <text
                      x={x + barWidth / 2}
                      y="166"
                      textAnchor="middle"
                      fontSize="9"
                      fontWeight="bold"
                      fill="#475569"
                    >
                      {language === 'hi' ? w.nameHi.slice(0, 3) : w.name.slice(0, 3)}
                    </text>

                    {/* Monetary Value at footer */}
                    <text
                      x={x + barWidth / 2}
                      y="182"
                      textAnchor="middle"
                      fontSize="8"
                      fill="#94A3B8"
                    >
                      {w.revenuePaise > 0 ? `₹${Math.round(w.revenuePaise / 100000)}k` : '₹0'}
                    </text>
                  </g>
                );
              })}
            </svg>
          </div>
        </div>

        {/* Brand Mix Distribution */}
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-2xs space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-bold text-slate-900">
                {language === 'hi' ? 'ब्रांड हिस्सा एवं उत्पाद मिश्रण' : 'Brand Turnover & Sales Mix'}
              </h2>
              <p className="hidden sm:block text-[11px] text-slate-400 mt-0.5">
                {language === 'hi' ? 'कुल बिक्री में प्रत्येक ब्रांड का योगदान' : 'Percentage contribution of brands to net turnover'}
              </p>
            </div>
            <Package className="w-4 h-4 text-slate-400" />
          </div>

          <div className="space-y-3.5 pt-1">
            {data.brandMix.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-400">
                {language === 'hi' ? 'कोई ब्रांड डेटा उपलब्ध नहीं है।' : 'No brand data available.'}
              </div>
            ) : (
              data.brandMix.map((brand, idx) => (
                <div key={brand.id} className="space-y-1.5 text-xs">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="w-5 h-5 rounded-md bg-slate-100 text-slate-600 font-bold text-[10px] flex items-center justify-center">
                        {idx + 1}
                      </span>
                      <span className="font-bold text-slate-800">{brand.name}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-slate-600 font-medium">
                        {formatPaise(brand.revenuePaise)}
                      </span>
                      <span className="px-2 py-0.5 rounded-full bg-blue-50 text-[#17307A] font-bold text-[10px]">
                        {brand.percentage}%
                      </span>
                    </div>
                  </div>

                  {/* Progress Bar */}
                  <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                    <div
                      className="bg-gradient-to-r from-[#17307A] to-[#F58220] h-full rounded-full transition-all duration-300"
                      style={{ width: `${Math.min(100, Math.max(3, brand.percentage))}%` }}
                    />
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* 4. Area Performance Breakdown Table */}
      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-2xs space-y-0">
        <div className="p-4 sm:px-5 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-slate-900 tracking-tight">
              {language === 'hi' ? 'बाज़ार क्षेत्र अनुसार प्रदर्शन सूची' : 'Market Area Performance Ledger'}
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              {language === 'hi'
                ? 'प्रत्येक क्षेत्र के कुल ऑर्डर, राजस्व, रूट कवरेज और शीर्ष दुकानें'
                : 'Breakdown of orders, revenue, route coverage, and top performing stores per area'}
            </p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200">
              <tr>
                <th className="py-3 px-4">{language === 'hi' ? 'बाज़ार क्षेत्र' : 'Market Area'}</th>
                <th className="py-3 px-3">{language === 'hi' ? 'रूट समूह' : 'Route Group'}</th>
                <th className="py-3 px-3 text-right">{language === 'hi' ? 'ऑर्डर संख्या' : 'Orders'}</th>
                <th className="py-3 px-3 text-right">{language === 'hi' ? 'कुल राजस्व' : 'Revenue'}</th>
                <th className="py-3 px-3 text-right">{language === 'hi' ? 'औसत ऑर्डर मूल्य' : 'AOV'}</th>
                <th className="py-3 px-3 text-center">{language === 'hi' ? 'सक्रिय / शांत' : 'Active / Quiet'}</th>
                <th className="py-3 px-4 text-center">{language === 'hi' ? 'कवरेज %' : 'Coverage %'}</th>
                <th className="py-3 px-3 text-center">{language === 'hi' ? 'दुकानें' : 'Stores'}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {data.areaBreakdowns.map((area) => {
                const isExpanded = expandedAreaId === area.id;

                return (
                  <React.Fragment key={area.id}>
                    <tr className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-3.5 px-4">
                        <div className="font-bold text-slate-900 text-sm flex items-center gap-1.5">
                          <MapPin className="w-3.5 h-3.5 text-[#17307A]" />
                          <span>{area.name}</span>
                        </div>
                        <div className="text-[11px] text-slate-400 mt-0.5">
                          {area.totalShops} {language === 'hi' ? 'पंजीकृत दुकानें' : 'registered shops'}
                        </div>
                      </td>

                      <td className="py-3.5 px-3">
                        <span className="font-semibold text-slate-700 block">{area.routeGroupName}</span>
                        <span className="text-[10px] text-slate-400 block font-mono">
                          {language === 'hi' ? 'कट-ऑफ' : 'Cut-off'} {area.cutoffTime}
                        </span>
                      </td>

                      <td className="py-3.5 px-3 text-right font-bold text-slate-900">
                        {area.ordersCount}
                      </td>

                      <td className="py-3.5 px-3 text-right font-black text-[#17307A]">
                        {formatPaise(area.revenuePaise)}
                      </td>

                      <td className="py-3.5 px-3 text-right font-mono text-slate-700">
                        {formatPaise(area.aovPaise)}
                      </td>

                      <td className="py-3.5 px-3 text-center">
                        <span className="inline-flex items-center gap-1 font-bold text-emerald-700">
                          {area.activeShops}
                        </span>{' '}
                        <span className="text-slate-300">/</span>{' '}
                        <span className="font-bold text-slate-400">
                          {area.quietShops}
                        </span>
                      </td>

                      <td className="py-3.5 px-4 text-center">
                        <div className="flex flex-col items-center gap-1">
                          <span className="font-bold text-slate-800 text-[11px]">
                            {area.coveragePercent}%
                          </span>
                          <div className="w-16 bg-slate-100 rounded-full h-1.5 overflow-hidden">
                            <div
                              className="bg-[#17307A] h-full rounded-full"
                              style={{ width: `${Math.min(100, area.coveragePercent)}%` }}
                            />
                          </div>
                        </div>
                      </td>

                      <td className="py-3.5 px-3 text-center">
                        <button
                          type="button"
                          onClick={() => setExpandedAreaId(isExpanded ? null : area.id)}
                          className="px-2.5 py-1 rounded-lg border border-slate-200 hover:bg-slate-100 text-slate-600 text-[11px] font-semibold transition-colors inline-flex items-center gap-1 cursor-pointer"
                        >
                          <span>{language === 'hi' ? 'शीर्ष दुकानें' : 'Rankings'}</span>
                          {isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                        </button>
                      </td>
                    </tr>

                    {/* Expandable Top & Bottom Stores Card */}
                    {isExpanded && (
                      <tr className="bg-slate-50/50">
                        <td colSpan={8} className="p-4 border-t border-slate-100">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {/* Top Shops */}
                            <div className="bg-white border border-emerald-200 rounded-xl p-3.5 space-y-2 shadow-2xs">
                              <div className="flex items-center justify-between">
                                <span className="font-bold text-emerald-800 text-xs flex items-center gap-1.5">
                                  <Award className="w-3.5 h-3.5 text-emerald-600" />
                                  <span>{language === 'hi' ? 'क्षेत्र की शीर्ष दुकानें' : 'Top Performing Stores'}</span>
                                </span>
                              </div>
                              <div className="space-y-1.5">
                                {area.topShops.length === 0 ? (
                                  <div className="text-[11px] text-slate-400 py-2">
                                    {language === 'hi' ? 'कोई सक्रिय ऑर्डर नहीं' : 'No active orders yet'}
                                  </div>
                                ) : (
                                  area.topShops.map((s, sIdx) => (
                                    <div
                                      key={s.id}
                                      className="flex items-center justify-between text-[11px] p-2 bg-slate-50/80 rounded-lg"
                                    >
                                      <div>
                                        <span className="font-bold text-slate-900">
                                          #{sIdx + 1} {s.name}
                                        </span>
                                        <span className="text-slate-400 block text-[10px]">{s.owner}</span>
                                      </div>
                                      <div className="text-right">
                                        <span className="font-bold text-[#17307A] block">
                                          {formatPaise(s.spendPaise)}
                                        </span>
                                        <span className="text-[10px] text-slate-400 block">
                                          {s.orderCount} {language === 'hi' ? 'ऑर्डर' : 'orders'}
                                        </span>
                                      </div>
                                    </div>
                                  ))
                                )}
                              </div>
                            </div>

                            {/* Bottom / Quiet Shops */}
                            <div className="bg-white border border-slate-200 rounded-xl p-3.5 space-y-2 shadow-2xs">
                              <div className="flex items-center justify-between">
                                <span className="font-bold text-slate-700 text-xs flex items-center gap-1.5">
                                  <AlertCircle className="w-3.5 h-3.5 text-slate-400" />
                                  <span>{language === 'hi' ? 'कम ऑर्डरल वाले स्टोर' : 'Lowest Volume Stores'}</span>
                                </span>
                              </div>
                              <div className="space-y-1.5">
                                {area.bottomShops.length === 0 ? (
                                  <div className="text-[11px] text-slate-400 py-2">
                                    {language === 'hi' ? 'सभी दुकानें सक्रिय हैं' : 'All stores are active'}
                                  </div>
                                ) : (
                                  area.bottomShops.map((s) => (
                                    <div
                                      key={s.id}
                                      className="flex items-center justify-between text-[11px] p-2 bg-slate-50/80 rounded-lg"
                                    >
                                      <div>
                                        <span className="font-semibold text-slate-800">{s.name}</span>
                                        <span className="text-slate-400 block text-[10px]">{s.owner}</span>
                                      </div>
                                      <div className="text-right">
                                        <span className="font-mono text-slate-600 block">
                                          {formatPaise(s.spendPaise)}
                                        </span>
                                        <span className="text-[10px] text-slate-400 block">
                                          {s.orderCount} {language === 'hi' ? 'ऑर्डर' : 'orders'}
                                        </span>
                                      </div>
                                    </div>
                                  ))
                                )}
                              </div>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
