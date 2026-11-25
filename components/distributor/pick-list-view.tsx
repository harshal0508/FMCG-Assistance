'use client';

import React, { useState } from 'react';
import { formatPaise } from '@/lib/money';
import { useLanguage } from '@/lib/i18n/context';
import {
  Truck,
  PackageCheck,
  Printer,
  Check,
  CheckCircle2,
  MapPin,
  AlertCircle,
  Building2,
  Boxes,
  ChevronDown,
  ChevronUp,
  Layers,
  Filter,
} from 'lucide-react';

export interface PickListItem {
  productId: string;
  productName: string;
  hindiName: string | null;
  brandName: string;
  categoryName: string;
  orderUnitName: string;
  totalQuantity: number;
  currentStock: number;
  shopBreakdown: {
    shopName: string;
    shopNumber: string;
    areaName: string;
    quantity: number;
    orderNumber: string;
  }[];
}

export interface RouteFilterOption {
  id: string;
  name: string;
}

interface Props {
  pickList: PickListItem[];
  routes: RouteFilterOption[];
  totalOrdersCount: number;
  totalVolumeValuePaise: number;
}

export default function PickListView({
  pickList,
  routes,
  totalOrdersCount,
  totalVolumeValuePaise,
}: Props) {
  const { t, language } = useLanguage();
  const [selectedRouteId, setSelectedRouteId] = useState<string>('ALL');
  const [viewMode, setViewMode] = useState<'brand' | 'area'>('brand');
  const [checkedMap, setCheckedMap] = useState<Record<string, boolean>>({});
  const [expandedProductIds, setExpandedProductIds] = useState<Record<string, boolean>>({});

  // Filter items by area/route
  const filteredItems = pickList
    .map((item) => {
      if (selectedRouteId === 'ALL') return item;
      const filteredShops = item.shopBreakdown.filter(
        (s) => s.areaName === selectedRouteId
      );
      if (filteredShops.length === 0) return null;
      const filteredTotalQty = filteredShops.reduce((sum, s) => sum + s.quantity, 0);
      return {
        ...item,
        totalQuantity: filteredTotalQty,
        shopBreakdown: filteredShops,
      };
    })
    .filter((item): item is PickListItem => item !== null);

  const toggleCheck = (id: string) => {
    setCheckedMap((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  const toggleExpand = (id: string) => {
    setExpandedProductIds((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  const checkedCount = filteredItems.filter((i) => checkedMap[i.productId]).length;
  const progressPercent =
    filteredItems.length > 0 ? Math.round((checkedCount / filteredItems.length) * 100) : 0;

  // Group by Brand
  const brandGroups = filteredItems.reduce((acc, item) => {
    const b = item.brandName || 'General FMCG';
    if (!acc[b]) acc[b] = [];
    acc[b].push(item);
    return acc;
  }, {} as Record<string, PickListItem[]>);

  // Group by Area
  const areaGroups: Record<string, { item: PickListItem; qty: number; shops: typeof filteredItems[0]['shopBreakdown'] }[]> = {};
  for (const item of filteredItems) {
    for (const s of item.shopBreakdown) {
      const area = s.areaName;
      if (!areaGroups[area]) areaGroups[area] = [];
      let entry = areaGroups[area].find((e) => e.item.productId === item.productId);
      if (!entry) {
        entry = { item, qty: 0, shops: [] };
        areaGroups[area].push(entry);
      }
      entry.qty += s.quantity;
      entry.shops.push(s);
    }
  }

  const handlePrint = () => {
    window.print();
  };

  // Helper for brand chip initials
  const getBrandBadge = (name: string) => {
    const parts = name.split(' ');
    if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    return name.slice(0, 2).toUpperCase();
  };

  return (
    <div className="space-y-6">
      {/* Top Header & Print Action */}
      <div className="print:hidden flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#17307A] tracking-tight flex items-center gap-2">
            <Truck className="w-6 h-6 text-[#F58220]" />
            <span>{t('pickListTitle')}</span>
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            {t('pickListSubtitle')}
          </p>
        </div>

        <button
          type="button"
          onClick={handlePrint}
          className="touch-target px-4 py-2.5 rounded-xl bg-[#17307A] text-white font-semibold text-xs sm:text-sm hover:bg-[#17307A]/90 transition-all shadow-sm flex items-center gap-2 active:scale-95"
        >
          <Printer className="w-4 h-4 text-[#F58220]" />
          <span>{t('printManifest')}</span>
        </button>
      </div>

      {/* Top 3 Pulse Metric Cards */}
      <div className="print:hidden grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-4 rounded-2xl bg-white border border-slate-200/80 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">
              {t('totalOrders')}
            </span>
            <span className="text-2xl font-bold text-slate-900 mt-1 block">{totalOrdersCount}</span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-blue-50 text-[#17307A] flex items-center justify-center">
            <Boxes className="w-5 h-5" />
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-white border border-slate-200/80 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">
              {t('packingProgress')}
            </span>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-2xl font-bold text-slate-900">{progressPercent}%</span>
              <span className="text-xs text-slate-500 font-medium">
                ({checkedCount}/{filteredItems.length} {t('itemsPicked')})
              </span>
            </div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
            <PackageCheck className="w-5 h-5" />
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-white border border-slate-200/80 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">
              {t('ordersValue')}
            </span>
            <span className="text-2xl font-bold text-[#17307A] mt-1 block">
              {formatPaise(totalVolumeValuePaise)}
            </span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-orange-50 text-[#F58220] flex items-center justify-center">
            <Truck className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Controls & Filter Bar */}
      <div className="print:hidden bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs space-y-3">
        <div className="flex flex-col md:flex-row justify-between items-stretch md:items-center gap-3">
          {/* Grouping Toggle */}
          <div className="flex items-center gap-1.5 p-1 bg-slate-100 rounded-xl w-fit">
            <button
              type="button"
              onClick={() => setViewMode('brand')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                viewMode === 'brand'
                  ? 'bg-white text-[#17307A] shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Boxes className="w-3.5 h-3.5" />
              <span>{t('groupByBrand')}</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode('area')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                viewMode === 'area'
                  ? 'bg-white text-[#17307A] shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <MapPin className="w-3.5 h-3.5" />
              <span>{t('groupByArea')}</span>
            </button>
          </div>

          {/* Route Filter Pills */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0 scrollbar-none">
            <button
              type="button"
              onClick={() => setSelectedRouteId('ALL')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${
                selectedRouteId === 'ALL'
                  ? 'bg-[#17307A] text-white shadow-xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {t('allRoutes')}
            </button>
            {routes.map((r) => (
              <button
                key={r.id}
                type="button"
                onClick={() => setSelectedRouteId(r.name)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${
                  selectedRouteId === r.name
                    ? 'bg-[#17307A] text-white shadow-xs'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {r.name}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Manifest Content */}
      {viewMode === 'brand' ? (
        // BRAND GROUPED VIEW
        <div className="space-y-6">
          {Object.entries(brandGroups).map(([brandName, items]) => {
            const badge = getBrandBadge(brandName);
            const totalBrandUnits = items.reduce((s, i) => s + i.totalQuantity, 0);

            return (
              <div
                key={brandName}
                className="bg-white border border-slate-200/80 rounded-2xl shadow-xs overflow-hidden"
              >
                {/* Brand Header */}
                <div className="bg-slate-50/80 px-5 py-3.5 border-b border-slate-200/80 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-[#17307A] text-white font-bold text-xs flex items-center justify-center">
                      {badge}
                    </div>
                    <div>
                      <h3 className="font-bold text-sm text-slate-900">{brandName}</h3>
                      <span className="text-[11px] text-slate-500">
                        {items.length} {t('productCount')} • {totalBrandUnits} {t('allocated')}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Desktop Items Table */}
                <div className="hidden md:block overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-white text-slate-500 font-semibold border-b border-slate-100">
                      <tr>
                        <th className="p-3.5 w-12 text-center print:hidden">Done</th>
                        <th className="p-3.5">{t('productName')}</th>
                        <th className="p-3.5 text-center">{t('wholesaleUnit')}</th>
                        <th className="p-3.5 text-right font-bold text-slate-900">{t('allocated')}</th>
                        <th className="p-3.5 text-right">{t('available')}</th>
                        <th className="p-3.5 text-center">{t('shopBreakdown')}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {items.map((item) => {
                        const isChecked = Boolean(checkedMap[item.productId]);
                        const isExpanded = Boolean(expandedProductIds[item.productId]);
                        const displayName =
                          language === 'hi' && item.hindiName ? item.hindiName : item.productName;

                        return (
                          <React.Fragment key={item.productId}>
                            <tr
                              className={`transition-colors ${
                                isChecked ? 'bg-emerald-50/40 text-slate-400' : 'hover:bg-slate-50/60'
                              }`}
                            >
                              <td className="p-3.5 text-center print:hidden">
                                <button
                                  type="button"
                                  onClick={() => toggleCheck(item.productId)}
                                  className={`w-6 h-6 rounded-md border flex items-center justify-center transition-all ${
                                    isChecked
                                      ? 'bg-emerald-600 border-emerald-600 text-white'
                                      : 'border-slate-300 hover:border-slate-400 bg-white'
                                  }`}
                                >
                                  {isChecked && <Check className="w-4 h-4 stroke-[3]" />}
                                </button>
                              </td>
                              <td className="p-3.5">
                                <div className={`font-bold text-sm ${isChecked ? 'line-through text-slate-400' : 'text-slate-900'}`}>
                                  {displayName}
                                </div>
                                <div className="text-[11px] text-slate-500">{item.categoryName}</div>
                              </td>
                              <td className="p-3.5 text-center font-medium text-slate-600">
                                {item.orderUnitName}
                              </td>
                              <td className="p-3.5 text-right font-extrabold text-sm text-slate-900">
                                {item.totalQuantity}
                              </td>
                              <td className="p-3.5 text-right font-semibold text-slate-700">
                                {item.currentStock}
                              </td>
                              <td className="p-3.5 text-center">
                                <button
                                  type="button"
                                  onClick={() => toggleExpand(item.productId)}
                                  className="px-2.5 py-1 rounded-md bg-slate-100 hover:bg-slate-200 text-slate-700 text-[11px] font-semibold inline-flex items-center gap-1 transition-colors"
                                >
                                  <span>{item.shopBreakdown.length} shops</span>
                                  {isExpanded ? (
                                    <ChevronUp className="w-3 h-3" />
                                  ) : (
                                    <ChevronDown className="w-3 h-3" />
                                  )}
                                </button>
                              </td>
                            </tr>

                            {/* Expanded Breakdown Drawer Row */}
                            {isExpanded && (
                              <tr className="bg-slate-50/80 border-y border-slate-200">
                                <td colSpan={6} className="p-4">
                                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
                                    {item.shopBreakdown.map((s, idx) => (
                                      <div
                                        key={idx}
                                        className="p-2.5 bg-white rounded-lg border border-slate-200 text-xs flex justify-between items-center"
                                      >
                                        <div>
                                          <span className="font-bold text-slate-900 block">
                                            {s.shopName}
                                          </span>
                                          <span className="text-[10px] text-slate-500">
                                            {s.areaName} • #{s.orderNumber}
                                          </span>
                                        </div>
                                        <span className="font-bold text-sm text-[#17307A] bg-blue-50 px-2 py-0.5 rounded">
                                          {s.quantity} {item.orderUnitName}
                                        </span>
                                      </div>
                                    ))}
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

                {/* Mobile Item Cards */}
                <div className="divide-y divide-slate-100 md:hidden">
                  {items.map((item) => {
                    const isChecked = Boolean(checkedMap[item.productId]);
                    const displayName =
                      language === 'hi' && item.hindiName ? item.hindiName : item.productName;

                    return (
                      <div
                        key={item.productId}
                        className={`p-4 space-y-2.5 ${isChecked ? 'bg-emerald-50/30' : ''}`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <button
                            type="button"
                            onClick={() => toggleCheck(item.productId)}
                            className={`w-6 h-6 rounded-md border flex items-center justify-center shrink-0 mt-0.5 transition-all ${
                              isChecked
                                ? 'bg-emerald-600 border-emerald-600 text-white'
                                : 'border-slate-300 bg-white'
                            }`}
                          >
                            {isChecked && <Check className="w-4 h-4 stroke-[3]" />}
                          </button>
                          <div className="flex-1">
                            <h4
                              className={`font-bold text-sm ${
                                isChecked ? 'line-through text-slate-400' : 'text-slate-900'
                              }`}
                            >
                              {displayName}
                            </h4>
                            <span className="text-[11px] text-slate-500">{item.categoryName}</span>
                          </div>
                          <div className="text-right">
                            <span className="text-[10px] font-bold text-slate-400 block uppercase">
                              {t('allocated')}
                            </span>
                            <span className="font-bold text-base text-[#17307A]">
                              {item.totalQuantity} {item.orderUnitName}
                            </span>
                          </div>
                        </div>

                        {/* Retailers Pills */}
                        <div className="pt-1 flex flex-wrap gap-1.5">
                          {item.shopBreakdown.map((s, idx) => (
                            <span
                              key={idx}
                              className="px-2 py-0.5 bg-slate-100 text-slate-700 rounded text-[10px] font-semibold"
                            >
                              {s.shopName}: <strong className="text-slate-900">{s.quantity}</strong>
                            </span>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        // AREA / ROUTE GROUPED VIEW
        <div className="space-y-6">
          {Object.entries(areaGroups).map(([areaName, entries]) => (
            <div
              key={areaName}
              className="bg-white border border-slate-200/80 rounded-2xl shadow-xs overflow-hidden"
            >
              {/* Area Header */}
              <div className="bg-slate-50/80 px-5 py-3.5 border-b border-slate-200/80 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <MapPin className="w-5 h-5 text-[#F58220]" />
                  <h3 className="font-bold text-sm text-slate-900">{areaName} Route</h3>
                </div>
                <span className="text-xs font-semibold px-2.5 py-1 rounded-md bg-blue-50 text-[#17307A]">
                  {entries.length} SKUs to load
                </span>
              </div>

              {/* Items List */}
              <div className="divide-y divide-slate-100">
                {entries.map(({ item, qty, shops }) => {
                  const displayName =
                    language === 'hi' && item.hindiName ? item.hindiName : item.productName;

                  return (
                    <div key={item.productId} className="p-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 text-[10px] font-bold">
                            {item.brandName}
                          </span>
                          <span className="font-bold text-sm text-slate-900">{displayName}</span>
                        </div>
                        <div className="text-xs text-slate-500 mt-1">
                          {shops.map((s) => `${s.shopName} (${s.quantity})`).join(', ')}
                        </div>
                      </div>
                      <div className="text-right">
                        <span className="text-sm font-bold text-[#17307A] bg-blue-50 px-3 py-1 rounded-lg">
                          {qty} {item.orderUnitName}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
