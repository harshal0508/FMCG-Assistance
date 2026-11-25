'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { formatPaise } from '@/lib/money';
import { useLanguage } from '@/lib/i18n/context';
import {
  Store,
  Search,
  Plus,
  Phone,
  MapPin,
  CreditCard,
  ShieldAlert,
  CheckCircle2,
  X,
  Clock,
  ExternalLink,
  Copy,
  Check,
  AlertTriangle,
  Building2,
  Percent,
  Receipt,
} from 'lucide-react';

export interface RateGroupOption {
  id: string;
  name: string;
  discount_type: string;
  discount_value: number;
}

export interface ShopItem {
  id: string;
  shop_number: string;
  name: string;
  owner_name: string;
  phone: string;
  address: string;
  credit_limit_paise: number;
  hold_flag: boolean;
  usual_order_interval_days: number;
  area: {
    id: string;
    name: string;
  } | null;
  rate_group?: RateGroupOption | null;
  tokens: {
    token_hash: string;
  }[];
  orders: {
    created_at: string;
    total_paise: number;
  }[];
}

export interface AreaItem {
  id: string;
  name: string;
}

interface Props {
  initialShops: ShopItem[];
  areas: AreaItem[];
  rateGroups?: RateGroupOption[];
}

export default function ShopDirectory({ initialShops, areas, rateGroups = [] }: Props) {
  const { t, language } = useLanguage();
  const [shops, setShops] = useState<ShopItem[]>(initialShops);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedAreaId, setSelectedAreaId] = useState<string>('ALL');
  const [showAddModal, setShowAddModal] = useState(false);
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [copiedLinkShopId, setCopiedLinkShopId] = useState<string | null>(null);

  // New shop form state
  const [formData, setFormData] = useState({
    name: '',
    ownerName: '',
    phone: '',
    address: '',
    areaId: areas[0]?.id || '',
    creditLimitRupees: 10000,
  });
  const [createdPersonalLink, setCreatedPersonalLink] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Filtered list
  const filteredShops = shops.filter((s) => {
    const matchesArea = selectedAreaId === 'ALL' || s.area?.id === selectedAreaId;
    const q = searchQuery.toLowerCase().trim();
    if (!q) return matchesArea;
    const matchesSearch =
      s.name.toLowerCase().includes(q) ||
      s.owner_name.toLowerCase().includes(q) ||
      s.phone.includes(q) ||
      s.shop_number.toLowerCase().includes(q);
    return matchesArea && matchesSearch;
  });

  // Pulse metrics
  const totalShops = shops.length;
  const activeShops = shops.filter((s) => !s.hold_flag).length;
  const holdShops = shops.filter((s) => s.hold_flag).length;

  // Toggle credit hold
  const toggleCreditHold = async (shop: ShopItem) => {
    const newHold = !shop.hold_flag;
    setLoadingId(shop.id);

    try {
      const res = await fetch('/api/distributor/shops', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          shopId: shop.id,
          holdFlag: newHold,
        }),
      });

      if (res.ok) {
        setShops((prev) =>
          prev.map((item) => (item.id === shop.id ? { ...item, hold_flag: newHold } : item))
        );
      }
    } finally {
      setLoadingId(null);
    }
  };

  // Update shop rate group
  const handleUpdateRateGroup = async (shopId: string, rateGroupId: string | null) => {
    setLoadingId(shopId);
    try {
      const res = await fetch('/api/distributor/shops', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          shopId,
          rateGroupId: rateGroupId || null,
        }),
      });

      if (res.ok) {
        setShops((prev) =>
          prev.map((s) => {
            if (s.id === shopId) {
              const matched = rateGroups.find((rg) => rg.id === rateGroupId) || null;
              return { ...s, rate_group: matched };
            }
            return s;
          })
        );
      }
    } finally {
      setLoadingId(null);
    }
  };

  // Add new shop submit
  const handleAddShop = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const res = await fetch('/api/distributor/shops', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formData.name,
          ownerName: formData.ownerName,
          phone: formData.phone,
          address: formData.address,
          areaId: formData.areaId,
          creditLimitPaise: formData.creditLimitRupees * 100,
        }),
      });

      const data = await res.json();
      if (res.ok && data.shop) {
        const newShopItem: ShopItem = {
          ...data.shop,
          area: areas.find((a) => a.id === formData.areaId) || null,
          tokens: [{ token_hash: 'new' }],
          orders: [],
        };
        setShops((prev) => [newShopItem, ...prev]);
        setCreatedPersonalLink(data.personalLink || null);
        setFormData({
          name: '',
          ownerName: '',
          phone: '',
          address: '',
          areaId: areas[0]?.id || '',
          creditLimitRupees: 10000,
        });
      }
    } catch (err) {
      console.error(err);
    } finally {
      setSubmitting(false);
    }
  };

  const handleCopyLink = (shopId: string, link: string) => {
    navigator.clipboard.writeText(window.location.origin + link);
    setCopiedLinkShopId(shopId);
    setTimeout(() => setCopiedLinkShopId(null), 2500);
  };

  return (
    <div className="space-y-6">
      {/* Top Header & Single Primary Action */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#17307A] tracking-tight flex items-center gap-2">
            <Store className="w-6 h-6 text-[#F58220]" />
            <span>{t('shopsTitle')}</span>
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            {t('shopsSubtitle')}
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          <Link
            href="/d/rate-groups"
            className="touch-target px-3.5 py-2.5 rounded-xl border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 font-semibold text-xs sm:text-sm transition-all shadow-2xs flex items-center gap-1.5"
          >
            <Percent className="w-4 h-4 text-[#17307A]" />
            <span>{language === 'hi' ? 'दर समूह' : 'Rate Groups'}</span>
          </Link>

          <button
            type="button"
            onClick={() => {
              setCreatedPersonalLink(null);
              setShowAddModal(true);
            }}
            className="touch-target px-4 py-2.5 rounded-xl bg-[#17307A] text-white font-semibold text-xs sm:text-sm hover:bg-[#17307A]/90 transition-all shadow-sm flex items-center gap-2 active:scale-95"
          >
            <Plus className="w-4 h-4 text-[#F58220]" />
            <span>{t('addShop')}</span>
          </button>
        </div>
      </div>

      {/* Top Pulse Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-4 rounded-2xl bg-white border border-slate-200/80 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">
              {t('shops')}
            </span>
            <span className="text-2xl font-bold text-slate-900 mt-1 block">{totalShops}</span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-blue-50 text-[#17307A] flex items-center justify-center">
            <Building2 className="w-5 h-5" />
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-white border border-slate-200/80 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">
              {t('active')}
            </span>
            <span className="text-2xl font-bold text-emerald-700 mt-1 block">{activeShops}</span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
            <CheckCircle2 className="w-5 h-5" />
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-white border border-slate-200/80 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">
              {t('onHold')}
            </span>
            <span className="text-2xl font-bold text-rose-600 mt-1 block">{holdShops}</span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center">
            <ShieldAlert className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Area Filter Pills & Search */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs space-y-3">
        <div className="flex flex-col md:flex-row gap-3 justify-between items-stretch md:items-center">
          {/* Search Input */}
          <div className="relative flex-1 max-w-md">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t('searchShops')}
              className="w-full pl-9 pr-4 py-2 rounded-xl border border-slate-300 bg-white text-xs sm:text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#17307A]/20 focus:border-[#17307A]"
            />
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          </div>

          {/* Area Filter Pills */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0 scrollbar-none">
            <button
              type="button"
              onClick={() => setSelectedAreaId('ALL')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${
                selectedAreaId === 'ALL'
                  ? 'bg-[#17307A] text-white shadow-xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {t('allAreas')} ({shops.length})
            </button>
            {areas.map((a) => {
              const count = shops.filter((s) => s.area?.id === a.id).length;
              return (
                <button
                  key={a.id}
                  type="button"
                  onClick={() => setSelectedAreaId(a.id)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${
                    selectedAreaId === a.id
                      ? 'bg-[#17307A] text-white shadow-xs'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {a.name} ({count})
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Desktop Table View (>= 768px) */}
      <div className="hidden md:block bg-white border border-slate-200/80 rounded-2xl shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200">
              <tr>
                <th className="p-4">{t('shopNumber')}</th>
                <th className="p-4">{t('storeAndOwner')}</th>
                <th className="p-4">{t('contactPhone')}</th>
                <th className="p-4">{t('deliveryArea')}</th>
                <th className="p-4">{language === 'hi' ? 'दर समूह' : 'Rate Group'}</th>
                <th className="p-4 text-right">{t('creditLimit')}</th>
                <th className="p-4 text-center">{t('orderInterval')}</th>
                <th className="p-4 text-center">{language === 'hi' ? 'स्थिति व खाता' : 'Status & Ledger'}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredShops.length === 0 ? (
                <tr>
                  <td colSpan={8} className="p-8 text-center text-slate-400">
                    {t('noOrdersInArea')}
                  </td>
                </tr>
              ) : (
                filteredShops.map((s) => (
                  <tr key={s.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="p-4 font-bold text-slate-600">{s.shop_number}</td>
                    <td className="p-4">
                      <div className="font-bold text-slate-900 text-sm">{s.name}</div>
                      <div className="text-xs text-slate-500 mt-0.5">{s.owner_name}</div>
                    </td>
                    <td className="p-4">
                      <span className="font-medium text-slate-800">{s.phone}</span>
                    </td>
                    <td className="p-4">
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-blue-50 text-[#17307A] font-semibold text-[11px]">
                        <MapPin className="w-3 h-3 text-[#F58220]" />
                        {s.area?.name ?? 'Ratlam Main'}
                      </span>
                    </td>
                    <td className="p-4">
                      <select
                        value={s.rate_group?.id || ''}
                        disabled={loadingId === s.id}
                        onChange={(e) => handleUpdateRateGroup(s.id, e.target.value || null)}
                        className="px-2 py-1 rounded-lg border border-slate-300 bg-white font-semibold text-[11px] text-slate-700 focus:outline-none focus:ring-1 focus:ring-[#17307A] cursor-pointer"
                      >
                        <option value="">{language === 'hi' ? 'मानक दर' : 'Standard PTR'}</option>
                        {rateGroups.map((rg) => (
                          <option key={rg.id} value={rg.id}>
                            {rg.name} ({rg.discount_type === 'PERCENTAGE' ? `${rg.discount_value}%` : `₹${(rg.discount_value / 100).toFixed(0)}`})
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="p-4 text-right font-bold text-slate-900">
                      {formatPaise(s.credit_limit_paise)}
                    </td>
                    <td className="p-4 text-center text-slate-600 font-medium">
                      {t('every')} {s.usual_order_interval_days} {t('days')}
                    </td>
                    <td className="p-4 text-center whitespace-nowrap">
                      <div className="inline-flex items-center gap-1.5">
                        <button
                          type="button"
                          disabled={loadingId === s.id}
                          onClick={() => toggleCreditHold(s)}
                          className={`touch-target px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all inline-flex items-center gap-1 shadow-2xs ${
                            s.hold_flag
                              ? 'bg-rose-100 text-rose-700 border border-rose-300 hover:bg-rose-200'
                              : 'bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100'
                          }`}
                        >
                          {s.hold_flag ? (
                            <>
                              <ShieldAlert className="w-3.5 h-3.5" />
                              <span>{t('onHold')}</span>
                            </>
                          ) : (
                            <>
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              <span>{t('active')}</span>
                            </>
                          )}
                        </button>

                        <Link
                          href={`/d/shops/${s.id}/ledger`}
                          className="touch-target px-2.5 py-1.5 rounded-lg border border-blue-200 bg-blue-50 hover:bg-blue-100 text-[#17307A] font-bold text-xs inline-flex items-center gap-1 transition-colors"
                          title="Open Shop Credit Ledger"
                        >
                          <Receipt className="w-3.5 h-3.5 text-[#F58220]" />
                          <span>{language === 'hi' ? 'खाता बही' : 'Ledger'}</span>
                        </Link>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Mobile Card Grid (< 768px) */}
      <div className="grid grid-cols-1 gap-3 md:hidden">
        {filteredShops.length === 0 ? (
          <div className="p-6 text-center text-slate-400 bg-white rounded-xl border border-slate-200">
            {t('noOrdersInArea')}
          </div>
        ) : (
          filteredShops.map((s) => (
            <div
              key={s.id}
              className={`bg-white p-4 rounded-xl border transition-all space-y-3 shadow-xs ${
                s.hold_flag ? 'border-rose-300 bg-rose-50/20' : 'border-slate-200'
              }`}
            >
              <div className="flex justify-between items-start">
                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                    {s.shop_number}
                  </span>
                  <h3 className="font-bold text-slate-900 text-sm leading-snug">{s.name}</h3>
                  <div className="text-xs text-slate-500 mt-0.5">
                    {s.owner_name} • {s.phone}
                  </div>
                </div>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-blue-50 text-[#17307A] font-semibold text-[10px]">
                  <MapPin className="w-2.5 h-2.5 text-[#F58220]" />
                  {s.area?.name ?? 'Ratlam'}
                </span>
              </div>

              {/* Rate Group Selector in Mobile Card */}
              <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs">
                <span className="text-slate-500 font-semibold">{language === 'hi' ? 'दर समूह:' : 'Rate Group:'}</span>
                <select
                  value={s.rate_group?.id || ''}
                  disabled={loadingId === s.id}
                  onChange={(e) => handleUpdateRateGroup(s.id, e.target.value || null)}
                  className="px-2 py-1 rounded-lg border border-slate-300 bg-white font-semibold text-[11px] text-slate-700"
                >
                  <option value="">{language === 'hi' ? 'मानक दर' : 'Standard PTR'}</option>
                  {rateGroups.map((rg) => (
                    <option key={rg.id} value={rg.id}>
                      {rg.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex justify-between items-center text-xs pt-2 border-t border-slate-100">
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase font-bold">
                    {t('creditLimit')}
                  </span>
                  <span className="font-bold text-slate-900">{formatPaise(s.credit_limit_paise)}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase font-bold text-right">
                    {t('orderInterval')}
                  </span>
                  <span className="text-slate-600 font-medium">
                    {t('every')} {s.usual_order_interval_days} {t('days')}
                  </span>
                </div>
              </div>

              <div className="pt-2 border-t border-slate-100 flex items-center justify-between gap-2">
                <button
                  type="button"
                  disabled={loadingId === s.id}
                  onClick={() => toggleCreditHold(s)}
                  className={`flex-1 touch-target px-3 py-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 shadow-2xs ${
                    s.hold_flag
                      ? 'bg-rose-100 text-rose-700 border border-rose-300'
                      : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                  }`}
                >
                  {s.hold_flag ? (
                    <>
                      <ShieldAlert className="w-3.5 h-3.5" />
                      <span>{t('onHold')}</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>{t('active')}</span>
                    </>
                  )}
                </button>

                <Link
                  href={`/d/shops/${s.id}/ledger`}
                  className="touch-target px-3 py-2 rounded-lg border border-blue-200 bg-blue-50 text-[#17307A] font-bold text-xs flex items-center justify-center gap-1.5"
                >
                  <Receipt className="w-3.5 h-3.5 text-[#F58220]" />
                  <span>{language === 'hi' ? 'खाता बही' : 'Ledger'}</span>
                </Link>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Add New Retailer Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <h3 className="font-bold text-slate-900 text-base flex items-center gap-2">
                <Store className="w-5 h-5 text-[#F58220]" />
                <span>{t('addNewShopTitle')}</span>
              </h3>
              <button
                type="button"
                onClick={() => {
                  setShowAddModal(false);
                  setCreatedPersonalLink(null);
                }}
                className="p-1 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-700 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {createdPersonalLink ? (
              <div className="space-y-4 py-2">
                <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 space-y-2">
                  <div className="flex items-center gap-2 font-bold text-sm">
                    <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                    <span>{t('successSaved')}</span>
                  </div>
                  <p className="text-xs text-emerald-700">
                    Personal ordering link created. Retailer can order directly without login.
                  </p>
                </div>

                <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                    Personal Order Link
                  </span>
                  <div className="flex items-center justify-between gap-2 bg-white p-2.5 rounded-lg border border-slate-200">
                    <span className="text-xs font-mono text-slate-700 truncate">
                      {window.location.origin + createdPersonalLink}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleCopyLink('new', createdPersonalLink)}
                      className="px-2.5 py-1 bg-[#17307A] text-white text-xs font-semibold rounded-md flex items-center gap-1 hover:bg-[#17307A]/90 transition-colors shrink-0"
                    >
                      {copiedLinkShopId === 'new' ? (
                        <>
                          <Check className="w-3.5 h-3.5" />
                          <span>Copied</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5" />
                          <span>Copy</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>

                <div className="flex justify-end pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      setShowAddModal(false);
                      setCreatedPersonalLink(null);
                    }}
                    className="px-4 py-2 rounded-xl bg-[#17307A] text-white text-xs font-bold hover:bg-[#17307A]/90 transition-all shadow-xs"
                  >
                    Done
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleAddShop} className="space-y-3.5">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    {t('shopNameLabel')}
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="e.g. Mahadev Kirana Store"
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs sm:text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#17307A]/20 focus:border-[#17307A]"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      {t('ownerNameLabel')}
                    </label>
                    <input
                      type="text"
                      required
                      value={formData.ownerName}
                      onChange={(e) => setFormData({ ...formData, ownerName: e.target.value })}
                      placeholder="e.g. Ramesh Chandra"
                      className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs sm:text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#17307A]/20 focus:border-[#17307A]"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      {t('phoneLabel')}
                    </label>
                    <input
                      type="tel"
                      required
                      value={formData.phone}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                      placeholder="e.g. 9829012345"
                      className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs sm:text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#17307A]/20 focus:border-[#17307A]"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      {t('deliveryArea')}
                    </label>
                    <select
                      value={formData.areaId}
                      onChange={(e) => setFormData({ ...formData, areaId: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs sm:text-sm text-slate-900 bg-white focus:outline-none focus:ring-2 focus:ring-[#17307A]/20 focus:border-[#17307A]"
                    >
                      {areas.map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      {t('creditLimitRupees')}
                    </label>
                    <input
                      type="number"
                      required
                      step="500"
                      min="0"
                      value={formData.creditLimitRupees}
                      onChange={(e) =>
                        setFormData({ ...formData, creditLimitRupees: Number(e.target.value) })
                      }
                      className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs sm:text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#17307A]/20 focus:border-[#17307A]"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    {t('addressLabel')}
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.address}
                    onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                    placeholder="e.g. Shop 14, Manek Chowk, Ratlam"
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs sm:text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#17307A]/20 focus:border-[#17307A]"
                  />
                </div>

                <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setShowAddModal(false)}
                    className="px-4 py-2 rounded-xl border border-slate-300 text-slate-700 text-xs font-semibold hover:bg-slate-50 transition-colors"
                  >
                    {t('cancel')}
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="px-5 py-2 rounded-xl bg-[#17307A] text-white text-xs font-bold hover:bg-[#17307A]/90 transition-all shadow-xs disabled:opacity-50"
                  >
                    {submitting ? '...' : t('saveShop')}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
