'use client';

import React, { useState, useEffect } from 'react';
import {
  Tag,
  PlusCircle,
  Sparkles,
  Calendar,
  Gift,
  Layers,
  Percent,
  CheckCircle2,
  AlertCircle,
  Trash2,
  Power,
  ShoppingCart,
  ArrowRight,
  TrendingUp,
  Package
} from 'lucide-react';
import { useTranslation } from '@/lib/i18n/context';

interface SchemeProductInfo {
  productId: string;
  name: string;
  hindiName: string | null;
  isTrigger: boolean;
  isReward: boolean;
}

interface SchemeItem {
  id: string;
  name: string;
  type: 'FREE_GOODS' | 'SLAB_DISCOUNT' | 'COMBO';
  rule: any;
  startDate: string;
  endDate: string;
  isActive: boolean;
  isActiveNow: boolean;
  isExpired: boolean;
  isUpcoming: boolean;
  applicationsCount: number;
  products: SchemeProductInfo[];
}

interface ProductOption {
  id: string;
  name: string;
  hindi_name: string | null;
  rate_paise: number;
  mrp_paise: number | null;
  default_order_unit: string | null;
}

export function SchemesView() {
  const { language } = useTranslation();
  const [loading, setLoading] = useState(true);
  const [schemes, setSchemes] = useState<SchemeItem[]>([]);
  const [products, setProducts] = useState<ProductOption[]>([]);
  
  // Scheme Creation Form State
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [schemeName, setSchemeName] = useState('');
  const [schemeType, setSchemeType] = useState<'FREE_GOODS' | 'SLAB_DISCOUNT' | 'COMBO'>('FREE_GOODS');
  const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState(
    new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0]
  );

  // Free Goods Form Fields
  const [fgTriggerProductId, setFgTriggerProductId] = useState('');
  const [fgTriggerQty, setFgTriggerQty] = useState('10');
  const [fgRewardProductId, setFgRewardProductId] = useState('');
  const [fgRewardQty, setFgRewardQty] = useState('1');

  // Slab Discount Form Fields
  const [slabProductId, setSlabProductId] = useState('');
  const [slabMinQty, setSlabMinQty] = useState('5');
  const [slabDiscountRupees, setSlabDiscountRupees] = useState('250');

  // Combo Form Fields
  const [comboItem1Id, setComboItem1Id] = useState('');
  const [comboItem1Qty, setComboItem1Qty] = useState('2');
  const [comboItem2Id, setComboItem2Id] = useState('');
  const [comboItem2Qty, setComboItem2Qty] = useState('1');
  const [comboDiscountRupees, setComboDiscountRupees] = useState('150');

  // Sample Cart Simulator State
  const [sampleCartItems, setSampleCartItems] = useState<{ [productId: string]: number }>({});
  const [simulationResult, setSimulationResult] = useState<any>(null);

  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  useEffect(() => {
    fetchSchemes();
  }, []);

  const fetchSchemes = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/distributor/schemes');
      if (res.ok) {
        const data = await res.json();
        setSchemes(data.schemes || []);
        setProducts(data.products || []);
        if (data.products?.length >= 2) {
          setFgTriggerProductId(data.products[0].id);
          setFgRewardProductId(data.products[1].id);
          setSlabProductId(data.products[0].id);
          setComboItem1Id(data.products[0].id);
          setComboItem2Id(data.products[1].id);
        }
      }
    } catch (err) {
      console.error('Failed to load schemes:', err);
    } finally {
      setLoading(false);
    }
  };

  // Build the current scheme rule object from form state
  const getCurrentRule = () => {
    if (schemeType === 'FREE_GOODS') {
      return {
        type: 'FREE_GOODS',
        triggerProductIds: [fgTriggerProductId],
        triggerQuantityBase: parseInt(fgTriggerQty, 10) || 1,
        rewardProductId: fgRewardProductId || fgTriggerProductId,
        rewardQuantityBase: parseInt(fgRewardQty, 10) || 1,
      };
    }
    if (schemeType === 'SLAB_DISCOUNT') {
      return {
        type: 'SLAB_DISCOUNT',
        targetProductIds: [slabProductId],
        slabs: [
          {
            minQuantityBase: parseInt(slabMinQty, 10) || 1,
            discountPaisePerUnit: Math.round((parseFloat(slabDiscountRupees) || 0) * 100),
          },
        ],
      };
    }
    return {
      type: 'COMBO',
      requiredItems: [
        { productId: comboItem1Id, quantityBase: parseInt(comboItem1Qty, 10) || 1 },
        { productId: comboItem2Id, quantityBase: parseInt(comboItem2Qty, 10) || 1 },
      ],
      flatDiscountPaise: Math.round((parseFloat(comboDiscountRupees) || 0) * 100),
    };
  };

  // Real-time Cart Simulator whenever cart items or rule change
  useEffect(() => {
    const runSimulation = async () => {
      const currentRule = getCurrentRule();
      const cartInput = Object.entries(sampleCartItems)
        .filter(([_, qty]) => qty > 0)
        .map(([prodId, qty]) => {
          const prod = products.find((p) => p.id === prodId);
          return {
            productId: prodId,
            quantityBase: qty,
            unitPricePaise: prod?.rate_paise || 10000,
          };
        });

      if (cartInput.length === 0) {
        setSimulationResult(null);
        return;
      }

      try {
        const res = await fetch('/api/distributor/schemes', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'SIMULATE',
            schemeRule: currentRule,
            cartItems: cartInput,
          }),
        });
        if (res.ok) {
          const data = await res.json();
          setSimulationResult(data);
        }
      } catch (err) {
        console.error('Simulation error:', err);
      }
    };

    runSimulation();
  }, [
    schemeType,
    fgTriggerProductId,
    fgTriggerQty,
    fgRewardProductId,
    fgRewardQty,
    slabProductId,
    slabMinQty,
    slabDiscountRupees,
    comboItem1Id,
    comboItem1Qty,
    comboItem2Id,
    comboItem2Qty,
    comboDiscountRupees,
    sampleCartItems,
  ]);

  const handleCreateScheme = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!schemeName.trim()) {
      setErrorMessage(language === 'hi' ? 'योजना का नाम आवश्यक है।' : 'Scheme name is required.');
      return;
    }

    try {
      const rule = getCurrentRule();
      const res = await fetch('/api/distributor/schemes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'CREATE',
          name: schemeName.trim(),
          type: schemeType,
          rule,
          startDate,
          endDate,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to create scheme');

      setSuccessMessage(
        language === 'hi'
          ? `योजना "${schemeName}" सफलतापूर्वक बनाई गई!`
          : `Scheme "${schemeName}" created successfully!`
      );
      setShowCreateForm(false);
      setSchemeName('');
      fetchSchemes();
    } catch (err: any) {
      setErrorMessage(err.message || 'Creation failed');
    }
  };

  const handleToggleActive = async (schemeId: string, currentStatus: boolean) => {
    try {
      const res = await fetch('/api/distributor/schemes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'TOGGLE_ACTIVE',
          schemeId,
          isActive: !currentStatus,
        }),
      });
      if (res.ok) {
        fetchSchemes();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeleteScheme = async (schemeId: string) => {
    if (!confirm(language === 'hi' ? 'क्या आप इस योजना को हटाना चाहते हैं?' : 'Delete this scheme?')) return;
    try {
      const res = await fetch('/api/distributor/schemes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'DELETE',
          schemeId,
        }),
      });
      if (res.ok) {
        setSuccessMessage(language === 'hi' ? 'योजना हटा दी गई।' : 'Scheme deleted.');
        fetchSchemes();
      }
    } catch {
      setErrorMessage('Failed to delete scheme');
    }
  };

  // Helper to prefill sample cart based on active rule products
  const prefillSampleCart = (multiplier: number = 1) => {
    const updated: { [id: string]: number } = {};
    if (schemeType === 'FREE_GOODS') {
      const trigger = parseInt(fgTriggerQty, 10) || 10;
      updated[fgTriggerProductId] = trigger * multiplier;
    } else if (schemeType === 'SLAB_DISCOUNT') {
      const minQty = parseInt(slabMinQty, 10) || 5;
      updated[slabProductId] = minQty * multiplier;
    } else if (schemeType === 'COMBO') {
      const q1 = parseInt(comboItem1Qty, 10) || 2;
      const q2 = parseInt(comboItem2Qty, 10) || 1;
      updated[comboItem1Id] = q1 * multiplier;
      updated[comboItem2Id] = q2 * multiplier;
    }
    setSampleCartItems(updated);
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 flex items-center gap-2.5">
            <Tag className="w-6 h-6 text-[#17307A]" />
            <span>{language === 'hi' ? 'व्यापार योजनाएं व ऑफर प्रबंधन' : 'Trade Schemes & Promotions'}</span>
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            {language === 'hi'
              ? 'मुफ्त माल, स्लैब छूट व कॉम्बो ऑफर बनाएं और लाइव कार्ट सिमुलेटर में मूल्य बचत जांचें।'
              : 'Create Free Goods, Slab, and Combo discount schemes with live cart price preview and validity controls.'}
          </p>
        </div>

        <button
          onClick={() => {
            setShowCreateForm(!showCreateForm);
            prefillSampleCart(1);
          }}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#17307A] text-white text-xs font-bold shadow-xs hover:bg-[#17307A]/90 transition-colors cursor-pointer self-start sm:self-auto"
        >
          <PlusCircle className="w-4 h-4" />
          <span>{showCreateForm ? (language === 'hi' ? 'फॉर्म बंद करें' : 'Close Form') : (language === 'hi' ? '+ नई योजना बनाएं' : '+ Create Scheme')}</span>
        </button>
      </div>

      {/* Alert Banners */}
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

      {/* CREATE SCHEME & LIVE CART SIMULATOR SECTION */}
      {showCreateForm && (
        <div className="bg-white rounded-2xl border-2 border-[#17307A]/20 p-5 shadow-sm space-y-6">
          <div className="flex items-center justify-between pb-3 border-b border-slate-200">
            <div>
              <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-[#F58220]" />
                <span>{language === 'hi' ? 'नई व्यापार योजना बनाएं' : 'Create Trade Scheme'}</span>
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                {language === 'hi'
                  ? 'योजना का प्रकार चुनें, नियम सेट करें और दाईं ओर तुरंत देखें कि यह ग्राहक कार्ट को कैसे प्रभावित करेगी।'
                  : 'Select scheme type, set parameters, and preview pricing in real time.'}
              </p>
            </div>
            <span className="px-2.5 py-1 rounded-lg bg-orange-50 text-[#F58220] font-bold text-xs border border-orange-200">
              {schemeType}
            </span>
          </div>

          <form onSubmit={handleCreateScheme}>
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              {/* Left Column: Form Fields */}
              <div className="lg:col-span-7 space-y-4">
                {/* Scheme Name */}
                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">
                    {language === 'hi' ? 'योजना का नाम:' : 'Scheme Title:'}
                  </label>
                  <input
                    type="text"
                    value={schemeName}
                    onChange={(e) => setSchemeName(e.target.value)}
                    placeholder={
                      language === 'hi'
                        ? 'उदा. 10 बंडल वेफर्स पर 1 पैकेट बिस्कुट मुफ्त'
                        : 'e.g. Buy 10 Bundles Wafers, Get 1 Pkt Biscuit Free'
                    }
                    className="w-full p-2.5 rounded-xl border border-slate-300 font-medium text-xs sm:text-sm"
                  />
                </div>

                {/* Scheme Type Selector Tabs */}
                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1.5">
                    {language === 'hi' ? 'योजना का प्रकार:' : 'Scheme Type:'}
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setSchemeType('FREE_GOODS');
                        prefillSampleCart(1);
                      }}
                      className={`p-2.5 rounded-xl border text-xs font-bold flex flex-col items-center justify-center gap-1 transition-all cursor-pointer ${
                        schemeType === 'FREE_GOODS'
                          ? 'bg-blue-50 border-[#17307A] text-[#17307A] shadow-xs'
                          : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                      }`}
                    >
                      <Gift className="w-4 h-4 text-[#F58220]" />
                      <span>{language === 'hi' ? 'मुफ्त माल' : 'Free Goods'}</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setSchemeType('SLAB_DISCOUNT');
                        prefillSampleCart(1);
                      }}
                      className={`p-2.5 rounded-xl border text-xs font-bold flex flex-col items-center justify-center gap-1 transition-all cursor-pointer ${
                        schemeType === 'SLAB_DISCOUNT'
                          ? 'bg-blue-50 border-[#17307A] text-[#17307A] shadow-xs'
                          : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                      }`}
                    >
                      <Layers className="w-4 h-4 text-emerald-600" />
                      <span>{language === 'hi' ? 'स्लैब छूट' : 'Slab Discount'}</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setSchemeType('COMBO');
                        prefillSampleCart(1);
                      }}
                      className={`p-2.5 rounded-xl border text-xs font-bold flex flex-col items-center justify-center gap-1 transition-all cursor-pointer ${
                        schemeType === 'COMBO'
                          ? 'bg-blue-50 border-[#17307A] text-[#17307A] shadow-xs'
                          : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                      }`}
                    >
                      <Package className="w-4 h-4 text-purple-600" />
                      <span>{language === 'hi' ? 'कॉम्बो ऑफर' : 'Combo Discount'}</span>
                    </button>
                  </div>
                </div>

                {/* TYPE-SPECIFIC PARAMETERS */}
                {/* 1. Free Goods Parameters */}
                {schemeType === 'FREE_GOODS' && (
                  <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
                    <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                      <Gift className="w-3.5 h-3.5 text-[#F58220]" />
                      <span>{language === 'hi' ? 'मुफ्त माल नियम' : 'Free Goods Condition'}</span>
                    </span>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                      <div>
                        <label className="text-slate-600 block mb-1 font-medium">
                          {language === 'hi' ? 'खरीदे जाने वाला उत्पाद:' : 'Trigger Product:'}
                        </label>
                        <select
                          value={fgTriggerProductId}
                          onChange={(e) => setFgTriggerProductId(e.target.value)}
                          className="w-full p-2 rounded-lg border border-slate-300 font-medium bg-white"
                        >
                          {products.map((p) => (
                            <option key={p.id} value={p.id}>
                              {p.name} {p.hindi_name ? `(${p.hindi_name})` : ''}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="text-slate-600 block mb-1 font-medium">
                          {language === 'hi' ? 'न्यूनतम खरीद संख्या:' : 'Trigger Quantity:'}
                        </label>
                        <input
                          type="number"
                          min="1"
                          value={fgTriggerQty}
                          onChange={(e) => setFgTriggerQty(e.target.value)}
                          className="w-full p-2 rounded-lg border border-slate-300 font-bold"
                        />
                      </div>

                      <div>
                        <label className="text-slate-600 block mb-1 font-medium">
                          {language === 'hi' ? 'मुफ्त मिलने वाला उत्पाद:' : 'Free Reward Product:'}
                        </label>
                        <select
                          value={fgRewardProductId}
                          onChange={(e) => setFgRewardProductId(e.target.value)}
                          className="w-full p-2 rounded-lg border border-slate-300 font-medium bg-white"
                        >
                          {products.map((p) => (
                            <option key={p.id} value={p.id}>
                              {p.name} {p.hindi_name ? `(${p.hindi_name})` : ''}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="text-slate-600 block mb-1 font-medium">
                          {language === 'hi' ? 'मुफ्त संख्या:' : 'Free Quantity:'}
                        </label>
                        <input
                          type="number"
                          min="1"
                          value={fgRewardQty}
                          onChange={(e) => setFgRewardQty(e.target.value)}
                          className="w-full p-2 rounded-lg border border-slate-300 font-bold"
                        />
                      </div>
                    </div>
                  </div>
                )}

                {/* 2. Slab Discount Parameters */}
                {schemeType === 'SLAB_DISCOUNT' && (
                  <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
                    <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                      <Layers className="w-3.5 h-3.5 text-emerald-600" />
                      <span>{language === 'hi' ? 'स्लैब छूट नियम' : 'Volume Slab Condition'}</span>
                    </span>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                      <div className="sm:col-span-3">
                        <label className="text-slate-600 block mb-1 font-medium">
                          {language === 'hi' ? 'उत्पाद चुनें:' : 'Target Product:'}
                        </label>
                        <select
                          value={slabProductId}
                          onChange={(e) => setSlabProductId(e.target.value)}
                          className="w-full p-2 rounded-lg border border-slate-300 font-medium bg-white"
                        >
                          {products.map((p) => (
                            <option key={p.id} value={p.id}>
                              {p.name} {p.hindi_name ? `(${p.hindi_name})` : ''}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="text-slate-600 block mb-1 font-medium">
                          {language === 'hi' ? 'न्यूनतम खरीद संख्या:' : 'Min Quantity (>=):'}
                        </label>
                        <input
                          type="number"
                          min="1"
                          value={slabMinQty}
                          onChange={(e) => setSlabMinQty(e.target.value)}
                          className="w-full p-2 rounded-lg border border-slate-300 font-bold"
                        />
                      </div>

                      <div className="sm:col-span-2">
                        <label className="text-slate-600 block mb-1 font-medium">
                          {language === 'hi' ? 'प्रति इकाई छूट (₹):' : 'Discount per Unit (₹):'}
                        </label>
                        <div className="flex items-center gap-1.5">
                          <span className="font-bold text-slate-700">₹</span>
                          <input
                            type="number"
                            step="0.01"
                            value={slabDiscountRupees}
                            onChange={(e) => setSlabDiscountRupees(e.target.value)}
                            className="w-full p-2 rounded-lg border border-slate-300 font-bold"
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* 3. Combo Discount Parameters */}
                {schemeType === 'COMBO' && (
                  <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
                    <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                      <Package className="w-3.5 h-3.5 text-purple-600" />
                      <span>{language === 'hi' ? 'कॉम्बो शर्तें' : 'Combo Items Condition'}</span>
                    </span>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                      <div className="sm:col-span-2">
                        <label className="text-slate-600 block mb-1 font-medium">
                          {language === 'hi' ? 'उत्पाद 1:' : 'Required Item 1:'}
                        </label>
                        <select
                          value={comboItem1Id}
                          onChange={(e) => setComboItem1Id(e.target.value)}
                          className="w-full p-2 rounded-lg border border-slate-300 font-medium bg-white"
                        >
                          {products.map((p) => (
                            <option key={p.id} value={p.id}>{p.name}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="text-slate-600 block mb-1 font-medium">{language === 'hi' ? 'संख्या 1:' : 'Qty 1:'}</label>
                        <input
                          type="number"
                          min="1"
                          value={comboItem1Qty}
                          onChange={(e) => setComboItem1Qty(e.target.value)}
                          className="w-full p-2 rounded-lg border border-slate-300 font-bold"
                        />
                      </div>

                      <div className="sm:col-span-2">
                        <label className="text-slate-600 block mb-1 font-medium">
                          {language === 'hi' ? 'उत्पाद 2:' : 'Required Item 2:'}
                        </label>
                        <select
                          value={comboItem2Id}
                          onChange={(e) => setComboItem2Id(e.target.value)}
                          className="w-full p-2 rounded-lg border border-slate-300 font-medium bg-white"
                        >
                          {products.map((p) => (
                            <option key={p.id} value={p.id}>{p.name}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="text-slate-600 block mb-1 font-medium">{language === 'hi' ? 'संख्या 2:' : 'Qty 2:'}</label>
                        <input
                          type="number"
                          min="1"
                          value={comboItem2Qty}
                          onChange={(e) => setComboItem2Qty(e.target.value)}
                          className="w-full p-2 rounded-lg border border-slate-300 font-bold"
                        />
                      </div>

                      <div className="sm:col-span-3 pt-2 border-t border-slate-200">
                        <label className="text-slate-600 block mb-1 font-medium">
                          {language === 'hi' ? 'कॉम्बो पर कुल छूट (₹):' : 'Flat Combo Discount (₹):'}
                        </label>
                        <div className="flex items-center gap-1.5">
                          <span className="font-bold text-slate-700">₹</span>
                          <input
                            type="number"
                            step="0.01"
                            value={comboDiscountRupees}
                            onChange={(e) => setComboDiscountRupees(e.target.value)}
                            className="w-full p-2 rounded-lg border border-slate-300 font-bold text-emerald-700"
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Validity Dates */}
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div>
                    <label className="font-semibold text-slate-700 block mb-1 flex items-center gap-1">
                      <Calendar className="w-3.5 h-3.5 text-slate-400" />
                      <span>{language === 'hi' ? 'आरंभ तिथि:' : 'Start Date:'}</span>
                    </label>
                    <input
                      type="date"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                      className="w-full p-2 rounded-lg border border-slate-300 font-medium"
                    />
                  </div>
                  <div>
                    <label className="font-semibold text-slate-700 block mb-1 flex items-center gap-1">
                      <Calendar className="w-3.5 h-3.5 text-slate-400" />
                      <span>{language === 'hi' ? 'समाप्ति तिथि:' : 'End Date:'}</span>
                    </label>
                    <input
                      type="date"
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                      className="w-full p-2 rounded-lg border border-slate-300 font-medium"
                    />
                  </div>
                </div>

                <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setShowCreateForm(false)}
                    className="px-4 py-2 rounded-xl border border-slate-300 text-xs font-semibold text-slate-600 cursor-pointer"
                  >
                    {language === 'hi' ? 'रद्द करें' : 'Cancel'}
                  </button>
                  <button
                    type="submit"
                    className="px-6 py-2 rounded-xl bg-[#17307A] text-white text-xs font-bold hover:bg-[#17307A]/90 transition-colors shadow-xs cursor-pointer"
                  >
                    {language === 'hi' ? 'योजना सहेजें' : 'Save Scheme'}
                  </button>
                </div>
              </div>

              {/* Right Column: Live Sample Cart Simulator Preview */}
              <div className="lg:col-span-5 bg-slate-50/80 rounded-xl border border-slate-200 p-4 space-y-4">
                <div className="flex items-center justify-between pb-2 border-b border-slate-200">
                  <span className="font-bold text-slate-800 text-xs flex items-center gap-1.5">
                    <ShoppingCart className="w-4 h-4 text-[#17307A]" />
                    <span>{language === 'hi' ? 'लाइव नमूना कार्ट पूर्वावलोकन' : 'Live Cart Simulator'}</span>
                  </span>
                  <span className="px-2 py-0.5 rounded bg-blue-100 text-[#17307A] text-[10px] font-bold">
                    REALTIME PREVIEW
                  </span>
                </div>

                {/* Adjust sample quantities */}
                <div className="space-y-2.5">
                  <span className="text-[11px] text-slate-500 font-medium block">
                    {language === 'hi' ? 'नमूना कार्ट संख्या बदलें:' : 'Test with sample quantities:'}
                  </span>

                  {Object.keys(sampleCartItems).map((prodId) => {
                    const prod = products.find((p) => p.id === prodId);
                    if (!prod) return null;
                    return (
                      <div key={prodId} className="p-2.5 bg-white rounded-lg border border-slate-200 flex items-center justify-between gap-2 text-xs">
                        <div className="min-w-0">
                          <div className="font-semibold text-slate-800 truncate">{prod.name}</div>
                          <div className="text-[10px] text-slate-400">₹{(prod.rate_paise / 100).toFixed(2)} / unit</div>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <button
                            type="button"
                            onClick={() =>
                              setSampleCartItems({
                                ...sampleCartItems,
                                [prodId]: Math.max(1, (sampleCartItems[prodId] || 1) - 1),
                              })
                            }
                            className="w-6 h-6 rounded bg-slate-100 font-bold hover:bg-slate-200"
                          >
                            -
                          </button>
                          <span className="w-8 text-center font-bold text-slate-900">{sampleCartItems[prodId] || 1}</span>
                          <button
                            type="button"
                            onClick={() =>
                              setSampleCartItems({
                                ...sampleCartItems,
                                [prodId]: (sampleCartItems[prodId] || 1) + 1,
                              })
                            }
                            className="w-6 h-6 rounded bg-slate-100 font-bold hover:bg-slate-200"
                          >
                            +
                          </button>
                        </div>
                      </div>
                    );
                  })}

                  <div className="flex gap-1.5 pt-1">
                    <button
                      type="button"
                      onClick={() => prefillSampleCart(1)}
                      className="px-2 py-1 rounded bg-slate-200 hover:bg-slate-300 text-[10px] font-semibold text-slate-700"
                    >
                      1x Scheme
                    </button>
                    <button
                      type="button"
                      onClick={() => prefillSampleCart(2)}
                      className="px-2 py-1 rounded bg-slate-200 hover:bg-slate-300 text-[10px] font-semibold text-slate-700"
                    >
                      2x Multiplier
                    </button>
                    <button
                      type="button"
                      onClick={() => prefillSampleCart(3)}
                      className="px-2 py-1 rounded bg-slate-200 hover:bg-slate-300 text-[10px] font-semibold text-slate-700"
                    >
                      3x Multiplier
                    </button>
                  </div>
                </div>

                {/* Simulation Pricing Outcome Box */}
                {simulationResult && (
                  <div className="p-3.5 rounded-xl bg-white border border-slate-200 shadow-2xs space-y-2.5 pt-3">
                    <div className="flex items-center justify-between text-xs text-slate-500 pb-1.5 border-b border-slate-100">
                      <span>{language === 'hi' ? 'मूल कार्ट मूल्य:' : 'Base Cart Total:'}</span>
                      <span className="font-semibold text-slate-800">
                        ₹{(simulationResult.originalTotalPaise / 100).toFixed(2)}
                      </span>
                    </div>

                    {simulationResult.result ? (
                      <div className="space-y-2 text-xs">
                        {/* You Save Badge */}
                        <div className="p-2.5 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 flex items-center justify-between">
                          <span className="font-bold flex items-center gap-1.5">
                            <Sparkles className="w-4 h-4 text-emerald-600" />
                            <span>{language === 'hi' ? 'योजना लागू! बचत:' : 'Scheme Triggered! Savings:'}</span>
                          </span>
                          <span className="font-black text-sm text-emerald-700">
                            {simulationResult.discountPaise > 0
                              ? `₹${(simulationResult.discountPaise / 100).toFixed(2)}`
                              : `${simulationResult.result.freeGoods?.[0]?.quantityBase || 1} Free Unit(s)`}
                          </span>
                        </div>

                        {/* Free goods note */}
                        {simulationResult.result.freeGoods?.length > 0 && (
                          <div className="text-[11px] text-purple-700 font-semibold bg-purple-50 p-2 rounded-lg border border-purple-200">
                            🎁 {simulationResult.result.notes}
                          </div>
                        )}

                        {/* Net Cart Payable */}
                        <div className="flex items-center justify-between pt-1 border-t border-slate-100 font-bold text-sm text-slate-900">
                          <span>{language === 'hi' ? 'अंतिम देय राशि:' : 'Net Payable Total:'}</span>
                          <span className="text-[#17307A]">
                            ₹{(simulationResult.netTotalPaise / 100).toFixed(2)}
                          </span>
                        </div>
                      </div>
                    ) : (
                      <div className="p-3 text-center text-xs text-amber-700 bg-amber-50 rounded-lg">
                        ⚠️ {language === 'hi' ? 'कार्ट की संख्या योजना की न्यूनतम शर्त पूरी नहीं करती।' : 'Cart quantities do not meet minimum threshold.'}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </form>
        </div>
      )}

      {/* SCHEMES LIST TABLE */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-slate-200">
          <div>
            <h2 className="text-base font-bold text-slate-900">
              {language === 'hi' ? 'सक्रिय एवं पूर्व व्यापार योजनाएं' : 'Configured Trade Schemes'}
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              {language === 'hi'
                ? 'इन योजनाओं का लाभ रिटेलर ऐप पर ऑर्डर करते समय स्वचालित रूप से लागू होता है।'
                : 'Active schemes automatically price retailer carts and power the You Save calculation.'}
            </p>
          </div>
          <span className="text-xs font-semibold text-slate-500">
            {schemes.length} {language === 'hi' ? 'योजनाएं' : 'Schemes'}
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-600 font-bold uppercase tracking-wider text-[10px] border-b border-slate-200">
              <tr>
                <th className="p-3">{language === 'hi' ? 'योजना का नाम' : 'Scheme Name'}</th>
                <th className="p-3">{language === 'hi' ? 'प्रकार' : 'Type'}</th>
                <th className="p-3">{language === 'hi' ? 'नियम / ऑफर' : 'Rule Summary'}</th>
                <th className="p-3">{language === 'hi' ? 'वैधता अवधि' : 'Validity'}</th>
                <th className="p-3 text-center">{language === 'hi' ? 'उपयोग' : 'Claims'}</th>
                <th className="p-3 text-center">{language === 'hi' ? 'स्थिति' : 'Status'}</th>
                <th className="p-3 text-right">{language === 'hi' ? 'कार्य' : 'Actions'}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {schemes.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-slate-400">
                    {language === 'hi' ? 'कोई योजना उपलब्ध नहीं है। "+ नई योजना बनाएं" पर क्लिक करें।' : 'No schemes configured yet.'}
                  </td>
                </tr>
              ) : (
                schemes.map((s) => (
                  <tr key={s.id} className="hover:bg-slate-50/60 transition-colors">
                    <td className="p-3 font-bold text-slate-900 text-xs sm:text-sm">
                      {s.name}
                    </td>
                    <td className="p-3 whitespace-nowrap">
                      <span
                        className={`px-2 py-0.5 rounded font-bold text-[10px] ${
                          s.type === 'FREE_GOODS'
                            ? 'bg-blue-50 text-[#17307A] border border-blue-200'
                            : s.type === 'SLAB_DISCOUNT'
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : 'bg-purple-50 text-purple-700 border border-purple-200'
                        }`}
                      >
                        {s.type}
                      </span>
                    </td>
                    <td className="p-3 text-slate-700 max-w-xs">
                      {s.type === 'FREE_GOODS' && (
                        <div>
                          Buy {s.rule?.triggerQuantityBase}x units → Get {s.rule?.rewardQuantityBase}x Free
                        </div>
                      )}
                      {s.type === 'SLAB_DISCOUNT' && (
                        <div>
                          Min {s.rule?.slabs?.[0]?.minQuantityBase} units → ₹{(s.rule?.slabs?.[0]?.discountPaisePerUnit / 100).toFixed(2)} off/unit
                        </div>
                      )}
                      {s.type === 'COMBO' && (
                        <div>
                          Combo Bundle → Flat ₹{(s.rule?.flatDiscountPaise / 100).toFixed(2)} off
                        </div>
                      )}
                    </td>
                    <td className="p-3 text-slate-500 whitespace-nowrap">
                      <div className="flex items-center gap-1 text-[11px]">
                        <Calendar className="w-3 h-3 text-slate-400" />
                        <span>{new Date(s.startDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}</span>
                        <span>–</span>
                        <span>{new Date(s.endDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</span>
                      </div>
                    </td>
                    <td className="p-3 text-center font-bold text-slate-700">
                      {s.applicationsCount}
                    </td>
                    <td className="p-3 text-center whitespace-nowrap">
                      <button
                        onClick={() => handleToggleActive(s.id, s.isActive)}
                        className={`px-2.5 py-1 rounded-full text-[10px] font-bold flex items-center gap-1 mx-auto transition-colors cursor-pointer ${
                          s.isActiveNow
                            ? 'bg-emerald-100 text-emerald-800'
                            : s.isExpired
                            ? 'bg-slate-100 text-slate-500'
                            : 'bg-amber-100 text-amber-800'
                        }`}
                      >
                        <Power className="w-3 h-3" />
                        <span>
                          {s.isActiveNow
                            ? language === 'hi' ? 'सक्रिय' : 'Active'
                            : s.isExpired
                            ? language === 'hi' ? 'समाप्त' : 'Expired'
                            : language === 'hi' ? 'निष्क्रिय' : 'Paused'}
                        </span>
                      </button>
                    </td>
                    <td className="p-3 text-right whitespace-nowrap">
                      <button
                        onClick={() => handleDeleteScheme(s.id)}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                        title="Delete Scheme"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
