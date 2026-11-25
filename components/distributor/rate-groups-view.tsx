'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  Percent,
  PlusCircle,
  Tag,
  Store,
  ChevronDown,
  ChevronUp,
  Edit2,
  Trash2,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  ArrowRight,
  Package
} from 'lucide-react';
import { useTranslation } from '@/lib/i18n/context';

interface RateOverrideItem {
  id: string;
  productId: string;
  productName: string;
  hindiName: string | null;
  standardRatePaise: number;
  specialRatePaise: number;
}

interface RateGroupItem {
  id: string;
  name: string;
  discountType: 'PERCENTAGE' | 'FLAT';
  discountValue: number;
  shopsCount: number;
  overrides: RateOverrideItem[];
  createdAt: string;
}

interface ProductOption {
  id: string;
  name: string;
  hindi_name: string | null;
  rate_paise: number;
  mrp_paise: number | null;
}

export function RateGroupsView() {
  const { language } = useTranslation();
  const [loading, setLoading] = useState(true);
  const [rateGroups, setRateGroups] = useState<RateGroupItem[]>([]);
  const [products, setProducts] = useState<ProductOption[]>([]);
  const [expandedGroupId, setExpandedGroupId] = useState<string | null>(null);

  // Create Group Modal
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const [newDiscountType, setNewDiscountType] = useState<'PERCENTAGE' | 'FLAT'>('PERCENTAGE');
  const [newDiscountValue, setNewDiscountValue] = useState('2');

  // Add Override Modal
  const [isOverrideModalOpen, setIsOverrideModalOpen] = useState(false);
  const [activeGroupId, setActiveGroupId] = useState<string | null>(null);
  const [overrideProductId, setOverrideProductId] = useState('');
  const [overrideRateRupees, setOverrideRateRupees] = useState('');

  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  useEffect(() => {
    fetchRateGroups();
  }, []);

  const fetchRateGroups = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/distributor/rate-groups');
      if (res.ok) {
        const data = await res.json();
        setRateGroups(data.rateGroups || []);
        setProducts(data.products || []);
        if (data.rateGroups?.length > 0 && !expandedGroupId) {
          setExpandedGroupId(data.rateGroups[0].id);
        }
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newGroupName.trim()) {
      setErrorMessage(language === 'hi' ? 'ग्रुप का नाम आवश्यक है।' : 'Group name is required.');
      return;
    }

    try {
      const val = parseFloat(newDiscountValue) || 0;
      const res = await fetch('/api/distributor/rate-groups', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'CREATE_GROUP',
          name: newGroupName.trim(),
          discountType: newDiscountType,
          discountValue: newDiscountType === 'PERCENTAGE' ? Math.round(val) : Math.round(val * 100),
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to create rate group');

      setSuccessMessage(
        language === 'hi'
          ? `रेट ग्रुप "${newGroupName}" सफलतापूर्वक बनाया गया!`
          : `Rate Group "${newGroupName}" created successfully!`
      );
      setIsCreateModalOpen(false);
      setNewGroupName('');
      fetchRateGroups();
    } catch (err: any) {
      setErrorMessage(err.message || 'Error creating group');
    }
  };

  const handleDeleteGroup = async (rateGroupId: string) => {
    if (!confirm(language === 'hi' ? 'क्या आप इस रेट ग्रुप को हटाना चाहते हैं?' : 'Delete this rate group?')) return;
    try {
      const res = await fetch('/api/distributor/rate-groups', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'DELETE_GROUP', rateGroupId }),
      });
      if (res.ok) {
        setSuccessMessage(language === 'hi' ? 'रेट ग्रुप हटा दिया गया।' : 'Rate group deleted.');
        fetchRateGroups();
      }
    } catch {
      setErrorMessage('Failed to delete group');
    }
  };

  const handleAddOverride = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeGroupId || !overrideProductId) return;

    const val = parseFloat(overrideRateRupees);
    if (isNaN(val) || val <= 0) {
      setErrorMessage(language === 'hi' ? 'मान्य विशेष दर दर्ज करें।' : 'Enter a valid rate.');
      return;
    }

    try {
      const res = await fetch('/api/distributor/rate-groups', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'UPSERT_OVERRIDE',
          rateGroupId: activeGroupId,
          tenantProductId: overrideProductId,
          specialRatePaise: Math.round(val * 100),
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to add override');

      setSuccessMessage(
        language === 'hi'
          ? 'उत्पाद हेतु विशेष दर सफलतापूर्वक सहेजी गई।'
          : 'Product rate override saved successfully.'
      );
      setIsOverrideModalOpen(false);
      setOverrideProductId('');
      setOverrideRateRupees('');
      fetchRateGroups();
    } catch (err: any) {
      setErrorMessage(err.message || 'Error adding override');
    }
  };

  const handleDeleteOverride = async (overrideId: string) => {
    try {
      const res = await fetch('/api/distributor/rate-groups', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'DELETE_OVERRIDE', overrideId }),
      });
      if (res.ok) {
        fetchRateGroups();
      }
    } catch {
      setErrorMessage('Failed to delete override');
    }
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 flex items-center gap-2.5">
            <Percent className="w-6 h-6 text-[#17307A]" />
            <span>{language === 'hi' ? 'दर समूह व विशेष मूल्य निर्धारण' : 'Rate Groups & Price Overrides'}</span>
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            {language === 'hi'
              ? 'दुकानों के लिए थोक दर समूह (Wholesale Tier A, Sub-distributor) व उत्पाद-वार विशेष दरें निर्धारित करें।'
              : 'Configure tiered wholesale rate groups and item-level price overrides for assigned retail partners.'}
          </p>
        </div>

        <button
          onClick={() => setIsCreateModalOpen(true)}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#17307A] text-white text-xs font-bold shadow-xs hover:bg-[#17307A]/90 transition-colors cursor-pointer self-start sm:self-auto"
        >
          <PlusCircle className="w-4 h-4" />
          <span>{language === 'hi' ? '+ नया रेट ग्रुप बनाएं' : '+ New Rate Group'}</span>
        </button>
      </div>

      {/* Alerts */}
      {errorMessage && (
        <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex justify-between items-center">
          <span>{errorMessage}</span>
          <button onClick={() => setErrorMessage(null)} className="font-bold">✕</button>
        </div>
      )}
      {successMessage && (
        <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex justify-between items-center">
          <span>{successMessage}</span>
          <button onClick={() => setSuccessMessage(null)} className="font-bold">✕</button>
        </div>
      )}

      {/* Rate Groups Cards */}
      <div className="space-y-4">
        {rateGroups.length === 0 ? (
          <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center text-slate-400 text-xs">
            {language === 'hi' ? 'कोई रेट ग्रुप नहीं है। ऊपर बटन से बनाएं।' : 'No rate groups configured yet.'}
          </div>
        ) : (
          rateGroups.map((rg) => {
            const isExpanded = expandedGroupId === rg.id;

            return (
              <div key={rg.id} className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
                {/* Group Card Header */}
                <div className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="flex items-start sm:items-center gap-3.5">
                    <div className="w-10 h-10 rounded-xl bg-blue-50 text-[#17307A] flex items-center justify-center font-bold text-lg border border-blue-100 shrink-0">
                      %
                    </div>
                    <div>
                      <div className="flex items-center gap-2.5">
                        <h2 className="text-base font-bold text-slate-900">{rg.name}</h2>
                        <span className="px-2.5 py-0.5 rounded-md bg-emerald-50 text-emerald-700 text-xs font-bold border border-emerald-200">
                          {rg.discountType === 'PERCENTAGE'
                            ? `${rg.discountValue}% Off PTR`
                            : `₹${(rg.discountValue / 100).toFixed(2)} Flat Off`}
                        </span>
                      </div>
                      <div className="text-xs text-slate-500 mt-0.5 flex items-center gap-2">
                        <Store className="w-3.5 h-3.5 text-slate-400" />
                        <span>
                          {rg.shopsCount} {language === 'hi' ? 'दुकानें जुड़ी हैं' : 'Assigned Shops'}
                        </span>
                        <span>•</span>
                        <span>
                          {rg.overrides.length} {language === 'hi' ? 'उत्पाद विशेष दरें' : 'Product Overrides'}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 self-end sm:self-auto">
                    <button
                      onClick={() => {
                        setActiveGroupId(rg.id);
                        if (products.length > 0) {
                          setOverrideProductId(products[0].id);
                          setOverrideRateRupees((products[0].rate_paise / 100).toFixed(2));
                        }
                        setIsOverrideModalOpen(true);
                      }}
                      className="px-3 py-1.5 rounded-lg border border-slate-300 hover:bg-slate-50 text-slate-700 text-xs font-semibold transition-colors cursor-pointer"
                    >
                      {language === 'hi' ? '+ विशेष दर जोड़ें' : '+ Add Override'}
                    </button>

                    <button
                      onClick={() => setExpandedGroupId(isExpanded ? null : rg.id)}
                      className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 transition-colors"
                      title="Expand / Collapse"
                    >
                      {isExpanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                    </button>

                    <button
                      onClick={() => handleDeleteGroup(rg.id)}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                      title="Delete Rate Group"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Overrides Table (Collapsible) */}
                {isExpanded && (
                  <div className="bg-slate-50/70 border-t border-slate-200 p-4 sm:p-5 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                        {language === 'hi' ? 'उत्पाद अनुसार विशेष दरें' : 'Product Price Overrides'}
                      </span>
                      <span className="text-[11px] text-slate-400">
                        {language === 'hi'
                          ? 'सामान्य छूट की जगह इन उत्पादों पर यह निर्धारित दर लागू होगी'
                          : 'Overrides standard group discount with an exact customized PTR'}
                      </span>
                    </div>

                    {rg.overrides.length === 0 ? (
                      <div className="p-6 text-center text-xs text-slate-400 bg-white rounded-xl border border-dashed border-slate-200">
                        {language === 'hi'
                          ? 'इस ग्रुप में कोई विशेष उत्पाद दर नहीं है। सभी उत्पादों पर सामान्य छूट लागू होगी।'
                          : 'No product overrides configured. Standard rate group discount applies to all items.'}
                      </div>
                    ) : (
                      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                        <table className="w-full text-left text-xs">
                          <thead className="bg-slate-50 text-slate-500 font-semibold text-[10px] uppercase border-b border-slate-100">
                            <tr>
                              <th className="p-3">{language === 'hi' ? 'उत्पाद का नाम' : 'Product'}</th>
                              <th className="p-3 text-right">{language === 'hi' ? 'मानक थोक दर' : 'Standard PTR'}</th>
                              <th className="p-3 text-right">{language === 'hi' ? 'विशेष ओवरराइड दर' : 'Override PTR'}</th>
                              <th className="p-3 text-right">{language === 'hi' ? 'बचत' : 'Discount'}</th>
                              <th className="p-3 text-right">{language === 'hi' ? 'हटाएं' : 'Action'}</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {rg.overrides.map((ov) => {
                              const diff = ov.standardRatePaise - ov.specialRatePaise;

                              return (
                                <tr key={ov.id} className="hover:bg-slate-50/50">
                                  <td className="p-3 font-semibold text-slate-900">
                                    {ov.productName}
                                  </td>
                                  <td className="p-3 text-right text-slate-500">
                                    ₹{(ov.standardRatePaise / 100).toFixed(2)}
                                  </td>
                                  <td className="p-3 text-right font-bold text-emerald-700">
                                    ₹{(ov.specialRatePaise / 100).toFixed(2)}
                                  </td>
                                  <td className="p-3 text-right text-slate-600 font-medium">
                                    {diff > 0 ? (
                                      <span className="text-emerald-600 font-semibold">
                                        -₹{(diff / 100).toFixed(2)} (
                                        {((diff / ov.standardRatePaise) * 100).toFixed(1)}%)
                                      </span>
                                    ) : (
                                      '—'
                                    )}
                                  </td>
                                  <td className="p-3 text-right">
                                    <button
                                      onClick={() => handleDeleteOverride(ov.id)}
                                      className="p-1 rounded text-slate-400 hover:text-rose-600"
                                      title="Remove Override"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Create Rate Group Modal */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-5 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <h3 className="font-bold text-slate-900 text-sm">
                {language === 'hi' ? 'नया रेट ग्रुप बनाएं' : 'Create Wholesale Rate Group'}
              </h3>
              <button onClick={() => setIsCreateModalOpen(false)} className="text-slate-400 hover:text-slate-700 font-bold">
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateGroup} className="space-y-3 text-xs">
              <div>
                <label className="font-semibold text-slate-700 block mb-1">
                  {language === 'hi' ? 'रेट ग्रुप का नाम:' : 'Rate Group Name:'}
                </label>
                <input
                  type="text"
                  value={newGroupName}
                  onChange={(e) => setNewGroupName(e.target.value)}
                  placeholder="e.g. Wholesale Tier A, Sub-distributor"
                  className="w-full p-2.5 rounded-xl border border-slate-300 font-medium"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">
                    {language === 'hi' ? 'छूट प्रकार:' : 'Discount Type:'}
                  </label>
                  <select
                    value={newDiscountType}
                    onChange={(e: any) => setNewDiscountType(e.target.value)}
                    className="w-full p-2 rounded-xl border border-slate-300 font-medium bg-white"
                  >
                    <option value="PERCENTAGE">प्रतिशत (% Off)</option>
                    <option value="FLAT">एकमुश्त राशि (Flat ₹ Off)</option>
                  </select>
                </div>

                <div>
                  <label className="font-semibold text-slate-700 block mb-1">
                    {newDiscountType === 'PERCENTAGE'
                      ? language === 'hi' ? 'छूट प्रतिशत (%):' : 'Discount (%):'
                      : language === 'hi' ? 'छूट राशि (₹):' : 'Discount (₹):'}
                  </label>
                  <input
                    type="number"
                    step={newDiscountType === 'PERCENTAGE' ? '0.5' : '1'}
                    value={newDiscountValue}
                    onChange={(e) => setNewDiscountValue(e.target.value)}
                    className="w-full p-2 rounded-xl border border-slate-300 font-bold"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-slate-300 text-xs font-semibold text-slate-600"
                >
                  {language === 'hi' ? 'रद्द करें' : 'Cancel'}
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl text-xs font-bold text-white bg-[#17307A] hover:bg-[#17307A]/90"
                >
                  {language === 'hi' ? 'नया ग्रुप बनाएं' : 'Create Group'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Product Override Modal */}
      {isOverrideModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-5 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <h3 className="font-bold text-slate-900 text-sm">
                {language === 'hi' ? 'उत्पाद हेतु विशेष दर जोड़ें' : 'Add Product Rate Override'}
              </h3>
              <button onClick={() => setIsOverrideModalOpen(false)} className="text-slate-400 hover:text-slate-700 font-bold">
                ✕
              </button>
            </div>

            <form onSubmit={handleAddOverride} className="space-y-3 text-xs">
              <div>
                <label className="font-semibold text-slate-700 block mb-1">
                  {language === 'hi' ? 'उत्पाद चुनें:' : 'Select Product:'}
                </label>
                <select
                  value={overrideProductId}
                  onChange={(e) => {
                    setOverrideProductId(e.target.value);
                    const prod = products.find((p) => p.id === e.target.value);
                    if (prod) {
                      setOverrideRateRupees((prod.rate_paise / 100).toFixed(2));
                    }
                  }}
                  className="w-full p-2.5 rounded-xl border border-slate-300 font-medium bg-white"
                >
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} (PTR: ₹{(p.rate_paise / 100).toFixed(2)})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">
                  {language === 'hi' ? 'इस ग्रुप हेतु विशेष दर (₹):' : 'Special Rate for this Group (₹):'}
                </label>
                <div className="flex items-center gap-2">
                  <span className="font-bold text-slate-700 text-sm">₹</span>
                  <input
                    type="number"
                    step="0.01"
                    value={overrideRateRupees}
                    onChange={(e) => setOverrideRateRupees(e.target.value)}
                    className="w-full p-2.5 rounded-xl border border-slate-300 font-bold text-sm text-emerald-700"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setIsOverrideModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-slate-300 text-xs font-semibold text-slate-600"
                >
                  {language === 'hi' ? 'रद्द करें' : 'Cancel'}
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl text-xs font-bold text-white bg-[#17307A] hover:bg-[#17307A]/90"
                >
                  {language === 'hi' ? 'विशेष दर सहेजें' : 'Save Override'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
