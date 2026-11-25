'use client';

import React, { useState } from 'react';
import {
  Search,
  Plus,
  Upload,
  ChevronDown,
  ChevronUp,
  Boxes,
  AlertCircle,
  CheckCircle2,
  X,
  PackagePlus,
  Sparkles,
  History,
} from 'lucide-react';
import { formatPaise } from '@/lib/money';
import { useTranslation } from '@/lib/i18n/context';

interface Brand {
  id: string;
  name: string;
  hindi_name: string | null;
  sort_order: number;
}

interface ProductItem {
  id: string;
  brand_id: string | null;
  sub_group: string | null;
  name: string | null;
  hindi_name: string | null;
  mrp_paise: number | null;
  base_unit: string | null;
  default_order_unit: string | null;
  rate_paise: number;
  stock_qty: number;
  in_stock_flag: boolean;
  daily_max_limit: number | null;
  brand?: Brand | null;
  master_product?: {
    name: string;
    hindi_name: string | null;
    mrp_paise: number;
    base_unit: string;
    default_order_unit: string;
    category?: {
      id: string;
      name: string;
      hindi_name: string;
    };
  } | null;
}

interface Props {
  initialProducts: ProductItem[];
  initialBrands: Brand[];
  categories: { id: string; name: string; hindi_name: string }[];
}

const BRAND_THEMES: Record<string, { bg: string; text: string; initial: string }> = {
  'Sunrise Foods': { bg: 'bg-orange-500', text: 'text-white', initial: 'SF' },
  'Crunch Co': { bg: 'bg-amber-500', text: 'text-white', initial: 'CC' },
  'Golden Grains': { bg: 'bg-emerald-600', text: 'text-white', initial: 'GG' },
  'Daily Fresh': { bg: 'bg-blue-600', text: 'text-white', initial: 'DF' },
  'SpiceCraft': { bg: 'bg-purple-600', text: 'text-white', initial: 'SC' },
};

const UNIT_TRANSLATIONS: Record<string, { en: string; hi: string; pluralEn: string }> = {
  bag: { en: 'bag', hi: 'बोरी', pluralEn: 'bags' },
  bags: { en: 'bag', hi: 'बोरी', pluralEn: 'bags' },
  pouch: { en: 'pouch', hi: 'पाउच', pluralEn: 'pouches' },
  pouches: { en: 'pouch', hi: 'पाउच', pluralEn: 'pouches' },
  tin: { en: 'tin', hi: 'पीपा', pluralEn: 'tins' },
  tins: { en: 'tin', hi: 'पीपा', pluralEn: 'tins' },
  jar: { en: 'jar', hi: 'जार', pluralEn: 'jars' },
  jars: { en: 'jar', hi: 'जार', pluralEn: 'jars' },
  bottle: { en: 'bottle', hi: 'बोतल', pluralEn: 'bottles' },
  bottles: { en: 'bottle', hi: 'बोतल', pluralEn: 'bottles' },
  packet: { en: 'packet', hi: 'पैकेट', pluralEn: 'packets' },
  packets: { en: 'packet', hi: 'पैकेट', pluralEn: 'packets' },
  bundle: { en: 'bundle', hi: 'बंडल', pluralEn: 'bundles' },
  bundles: { en: 'bundle', hi: 'बंडल', pluralEn: 'bundles' },
  box: { en: 'box', hi: 'बॉक्स', pluralEn: 'boxes' },
  boxes: { en: 'box', hi: 'बॉक्स', pluralEn: 'boxes' },
  carton: { en: 'carton', hi: 'कार्टन', pluralEn: 'cartons' },
  cartons: { en: 'carton', hi: 'कार्टन', pluralEn: 'cartons' },
  piece: { en: 'piece', hi: 'पीस', pluralEn: 'pieces' },
  pieces: { en: 'piece', hi: 'पीस', pluralEn: 'pieces' },
  dozen: { en: 'dozen', hi: 'दर्जन', pluralEn: 'dozens' },
  kg: { en: 'kg', hi: 'किलो', pluralEn: 'kg' },
  gram: { en: 'gram', hi: 'ग्राम', pluralEn: 'grams' },
  litre: { en: 'litre', hi: 'लीटर', pluralEn: 'litres' },
  ml: { en: 'ml', hi: 'मिली', pluralEn: 'ml' },
};

function formatUnit(unit: string | null | undefined, count: number, lang: 'en' | 'hi'): string {
  if (!unit) return '';
  const norm = unit.toLowerCase().trim();
  const entry = UNIT_TRANSLATIONS[norm];
  if (!entry) return unit;
  if (lang === 'hi') return entry.hi;
  return count === 1 ? entry.en : entry.pluralEn;
}

export default function InventoryManager({ initialProducts, initialBrands, categories }: Props) {
  const { language, t } = useTranslation();
  const [products, setProducts] = useState<ProductItem[]>(initialProducts);
  const [brands, setBrands] = useState<Brand[]>(initialBrands);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedBrandFilter, setSelectedBrandFilter] = useState<string>('ALL');
  const [expandedBrands, setExpandedBrands] = useState<Record<string, boolean>>({
    [initialBrands[0]?.id || '']: true, // First brand open by default
  });

  // Modals & Drawers
  const [showAddBrandModal, setShowAddBrandModal] = useState(false);
  const [showAddItemDrawer, setShowAddItemDrawer] = useState(false);
  const [newBrandName, setNewBrandName] = useState('');
  const [newBrandHindi, setNewBrandHindi] = useState('');
  const [isSubmittingBrand, setIsSubmittingBrand] = useState(false);

  // New Item State
  const [newItemBrandId, setNewItemBrandId] = useState(initialBrands[0]?.id || '');
  const [newItemName, setNewItemName] = useState('');
  const [newItemHindi, setNewItemHindi] = useState('');
  const [newItemSubGroup, setNewItemSubGroup] = useState('');
  const [newItemMrp, setNewItemMrp] = useState('');
  const [newItemPtr, setNewItemPtr] = useState('');
  const [newItemStock, setNewItemStock] = useState('100');
  const [newItemBaseUnit, setNewItemBaseUnit] = useState('packet');
  const [newItemOrderUnit, setNewItemOrderUnit] = useState('bundle');
  const [isSubmittingItem, setIsSubmittingItem] = useState(false);
  const [loadingId, setLoadingId] = useState<string | null>(null);

  // Stock Movement History Modal State
  const [movementProduct, setMovementProduct] = useState<ProductItem | null>(null);
  const [movementsList, setMovementsList] = useState<any[]>([]);
  const [movementsLoading, setMovementsLoading] = useState(false);

  const openMovementHistory = async (prod: ProductItem) => {
    setMovementProduct(prod);
    setMovementsLoading(true);
    try {
      const res = await fetch(`/api/distributor/inventory/${prod.id}/movements`);
      if (res.ok) {
        const data = await res.json();
        setMovementsList(data.movements || []);
      }
    } catch (err) {
      console.error('Failed to load stock movements:', err);
    } finally {
      setMovementsLoading(false);
    }
  };

  // Toggle brand accordion
  const toggleBrandAccordion = (brandId: string) => {
    setExpandedBrands((prev) => ({ ...prev, [brandId]: !prev[brandId] }));
  };

  // Helper to resolve product display name
  const getProductName = (p: ProductItem) => {
    if (language === 'hi') {
      return p.hindi_name || p.master_product?.hindi_name || p.name || p.master_product?.name || '';
    }
    return p.name || p.master_product?.name || '';
  };

  const getBrandDisplayName = (b: Brand) => {
    if (language === 'hi' && b.hindi_name) return b.hindi_name;
    return b.name;
  };

  // Calculate Metrics (All stock stored strictly as discrete integer count * PTR rate)
  const totalStockValue = products.reduce((acc, p) => acc + (p.stock_qty * p.rate_paise), 0);
  const activeBrandCount = brands.length;
  const outOfStockCount = products.filter((p) => !p.in_stock_flag || p.stock_qty <= 0).length;

  // Filter products by search query
  const q = searchQuery.toLowerCase().trim();
  const searchFilteredProducts = products.filter((p) => {
    if (!q) return true;
    const nameMatch = (p.name || '').toLowerCase().includes(q) ||
      (p.master_product?.name || '').toLowerCase().includes(q) ||
      (p.hindi_name || '').toLowerCase().includes(q) ||
      (p.sub_group || '').toLowerCase().includes(q);
    return nameMatch;
  });

  // Toggle in-stock status
  const toggleStock = async (product: ProductItem) => {
    const newStatus = !product.in_stock_flag;
    setLoadingId(product.id);
    try {
      const res = await fetch('/api/distributor/inventory', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tenantProductId: product.id, inStock: newStatus }),
      });
      if (res.ok) {
        setProducts((prev) =>
          prev.map((item) => (item.id === product.id ? { ...item, in_stock_flag: newStatus } : item))
        );
      }
    } finally {
      setLoadingId(null);
    }
  };

  // Quick edit rate
  const updateRate = async (product: ProductItem, newRupees: number) => {
    const newPaise = Math.round(newRupees * 100);
    setLoadingId(product.id);
    try {
      const res = await fetch('/api/distributor/inventory', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tenantProductId: product.id, ratePaise: newPaise }),
      });
      if (res.ok) {
        setProducts((prev) =>
          prev.map((item) => (item.id === product.id ? { ...item, rate_paise: newPaise } : item))
        );
      }
    } finally {
      setLoadingId(null);
    }
  };

  // Add Brand submit
  const handleCreateBrand = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newBrandName.trim()) return;
    setIsSubmittingBrand(true);
    try {
      const res = await fetch('/api/distributor/brands', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newBrandName.trim(),
          hindi_name: newBrandHindi.trim() || null,
          sort_order: brands.length + 1,
        }),
      });
      const data = await res.json();
      if (res.ok && data.brand) {
        setBrands((prev) => [...prev, data.brand]);
        setExpandedBrands((prev) => ({ ...prev, [data.brand.id]: true }));
        setNewBrandName('');
        setNewBrandHindi('');
        setShowAddBrandModal(false);
      } else {
        alert(data.error || 'Failed to create brand');
      }
    } finally {
      setIsSubmittingBrand(false);
    }
  };

  // Add Item submit
  const handleCreateItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newItemName.trim() || !newItemPtr) return;
    setIsSubmittingItem(true);
    try {
      const ptrPaise = Math.round(parseFloat(newItemPtr) * 100);
      const mrpPaise = newItemMrp ? Math.round(parseFloat(newItemMrp) * 100) : ptrPaise;
      const res = await fetch('/api/distributor/inventory', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          brand_id: newItemBrandId || null,
          name: newItemName.trim(),
          hindi_name: newItemHindi.trim() || null,
          sub_group: newItemSubGroup.trim() || null,
          mrp_paise: mrpPaise,
          rate_paise: ptrPaise,
          stock_qty: parseInt(newItemStock, 10) || 0,
          base_unit: newItemBaseUnit,
          default_order_unit: newItemOrderUnit,
        }),
      });
      const data = await res.json();
      if (res.ok && data.product) {
        setProducts((prev) => [...prev, data.product]);
        setNewItemName('');
        setNewItemHindi('');
        setNewItemPtr('');
        setNewItemMrp('');
        setShowAddItemDrawer(false);
      } else {
        alert(data.error || 'Failed to add item');
      }
    } finally {
      setIsSubmittingItem(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header and Action Bar */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#17307A] tracking-tight">
            {t('brandFirstTitle')}
          </h1>
          <p className="text-xs md:text-sm text-slate-500 mt-0.5">
            {t('brandFirstSubtitle')}
          </p>
        </div>

        <div className="flex items-center gap-2.5 w-full md:w-auto">
          <button
            onClick={() => setShowAddBrandModal(true)}
            className="flex-1 md:flex-none flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl bg-white border border-slate-300 text-slate-700 text-xs font-semibold hover:bg-slate-50 transition-colors shadow-xs"
          >
            <Plus className="w-4 h-4 text-[#17307A]" />
            <span>{t('addBrand')}</span>
          </button>

          <a
            href="/d/inventory/import"
            className="flex-1 md:flex-none flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl bg-white border border-slate-300 text-slate-700 text-xs font-semibold hover:bg-slate-50 transition-colors shadow-xs"
          >
            <Upload className="w-4 h-4 text-slate-500" />
            <span>{t('importCsv')}</span>
          </a>

          <button
            onClick={() => setShowAddItemDrawer(true)}
            className="flex-1 md:flex-none flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl bg-[#17307A] text-white text-xs font-semibold hover:bg-[#17307A]/90 transition-colors shadow-sm"
          >
            <PackagePlus className="w-4 h-4 text-[#F58220]" />
            <span>{t('addItem')}</span>
          </button>
        </div>
      </div>

      {/* Top 3 Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white border border-[#E2E8F0] rounded-xl p-4 shadow-xs">
          <div className="text-xs text-slate-500 font-medium">{t('totalStockValue')}</div>
          <div className="text-xl md:text-2xl font-bold text-[#17307A] mt-1">
            {formatPaise(totalStockValue)}
          </div>
          <div className="text-[11px] text-slate-400 mt-1">
            {language === 'hi' ? '८० थोक उत्पादों का कुल भंडार' : 'Across 80 catalog lines'}
          </div>
        </div>

        <div className="bg-white border border-[#E2E8F0] rounded-xl p-4 shadow-xs">
          <div className="text-xs text-slate-500 font-medium">{t('activeBrands')}</div>
          <div className="text-xl md:text-2xl font-bold text-slate-800 mt-1">
            {activeBrandCount}
          </div>
          <div className="text-[11px] text-slate-400 mt-1">
            {language === 'hi' ? '५ प्रमुख वितरण ब्रांड' : '5 Core Distribution Brands'}
          </div>
        </div>

        <div className="bg-white border border-[#E2E8F0] rounded-xl p-4 shadow-xs">
          <div className="text-xs text-slate-500 font-medium">{t('outOfStockItems')}</div>
          <div className={`text-xl md:text-2xl font-bold mt-1 ${outOfStockCount > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
            {outOfStockCount}
          </div>
          <div className="text-[11px] text-slate-400 mt-1">
            {outOfStockCount === 0
              ? (language === 'hi' ? 'सभी सामान पर्याप्त उपलब्ध हैं' : 'All items in stock')
              : (language === 'hi' ? 'तुरंत री-स्टॉक की आवश्यकता है' : 'Needs warehouse restock')}
          </div>
        </div>
      </div>

      {/* Search Bar & Brand Quick Pills */}
      <div className="space-y-3">
        <div className="relative w-full max-w-md">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={t('searchProducts')}
            className="w-full pl-9 pr-4 py-2 rounded-xl border border-slate-300 bg-white text-xs md:text-sm focus:outline-none focus:ring-2 focus:ring-[#17307A]/20 focus:border-[#17307A]"
          />
          <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
        </div>

        {/* Brand Filter Pills */}
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none text-xs font-semibold">
          <button
            onClick={() => setSelectedBrandFilter('ALL')}
            className={`px-3 py-1.5 rounded-lg transition-colors whitespace-nowrap cursor-pointer ${
              selectedBrandFilter === 'ALL'
                ? 'bg-[#17307A] text-white'
                : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50'
            }`}
          >
            {t('allBrands')} ({products.length})
          </button>
          {brands.map((b) => {
            const theme = BRAND_THEMES[b.name] || { bg: 'bg-slate-700', text: 'text-white', initial: b.name.slice(0, 2).toUpperCase() };
            const brandProductCount = products.filter((p) => p.brand_id === b.id).length;
            const isSelected = selectedBrandFilter === b.id;
            return (
              <button
                key={b.id}
                onClick={() => setSelectedBrandFilter(b.id)}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg transition-colors whitespace-nowrap cursor-pointer ${
                  isSelected
                    ? 'bg-[#17307A] text-white'
                    : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50'
                }`}
              >
                <span className={`w-5 h-5 rounded-full ${theme.bg} ${theme.text} text-[10px] font-bold flex items-center justify-center shrink-0`}>
                  {theme.initial}
                </span>
                <span>{getBrandDisplayName(b)}</span>
                <span className="text-[11px] opacity-75">({brandProductCount})</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Brand Accordion Sections */}
      <div className="space-y-4">
        {brands
          .filter((b) => selectedBrandFilter === 'ALL' || selectedBrandFilter === b.id)
          .map((brand) => {
            const theme = BRAND_THEMES[brand.name] || { bg: 'bg-slate-700', text: 'text-white', initial: brand.name.slice(0, 2).toUpperCase() };
            const brandProducts = searchFilteredProducts.filter((p) => p.brand_id === brand.id);
            const isExpanded = expandedBrands[brand.id] ?? false;
            const brandOosCount = brandProducts.filter((p) => !p.in_stock_flag || p.stock_qty <= 0).length;

            return (
              <div
                key={brand.id}
                className="bg-white border border-[#E2E8F0] rounded-xl shadow-xs overflow-hidden transition-all"
              >
                {/* Accordion Header */}
                <div
                  onClick={() => toggleBrandAccordion(brand.id)}
                  className="p-4 flex items-center justify-between cursor-pointer hover:bg-slate-50/80 transition-colors"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className={`w-10 h-10 rounded-xl ${theme.bg} ${theme.text} font-bold text-sm flex items-center justify-center shrink-0 shadow-xs`}>
                      {theme.initial}
                    </div>
                    <div className="min-w-0">
                      <div className="text-base font-bold text-[#17307A] truncate">
                        {getBrandDisplayName(brand)}
                      </div>
                      <div className="text-xs text-slate-500 flex items-center gap-2 mt-0.5">
                        <span>{brandProducts.length} {t('productCount')}</span>
                        <span>•</span>
                        <span className={brandOosCount > 0 ? 'text-rose-600 font-semibold' : 'text-emerald-600'}>
                          {brandOosCount > 0 ? `${brandOosCount} ${t('outOfStock')}` : t('inStock')}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      className="p-1 rounded-lg text-slate-400 hover:text-slate-600"
                    >
                      {isExpanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                    </button>
                  </div>
                </div>

                {/* Accordion Expanded Body */}
                {isExpanded && (
                  <div className="border-t border-slate-200">
                    {brandProducts.length === 0 ? (
                      <div className="p-8 text-center text-xs text-slate-400">
                        {language === 'hi' ? 'इस खोज के लिए कोई उत्पाद नहीं मिला' : 'No products found matching this filter.'}
                      </div>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs">
                          <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200">
                            <tr>
                              <th className="p-3.5 pl-4">{t('productName')}</th>
                              <th className="p-3.5">{t('subGroup')}</th>
                              <th className="p-3.5 text-right">{t('mrp')}</th>
                              <th className="p-3.5 text-right">{t('unitRate')}</th>
                              <th className="p-3.5 text-right">{t('stockAvailable')}</th>
                              <th className="p-3.5 text-center">{t('dailyQuota')}</th>
                              <th className="p-3.5 text-center pr-4">{t('actions')}</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {brandProducts.map((p) => {
                              const mrp = p.mrp_paise || p.master_product?.mrp_paise || p.rate_paise;
                              const baseUnit = p.base_unit || p.master_product?.base_unit || 'unit';
                              const orderUnit = p.default_order_unit || p.master_product?.default_order_unit || baseUnit;
                              const isInStock = p.in_stock_flag && p.stock_qty > 0;

                              return (
                                <tr key={p.id} className="hover:bg-slate-50/70 transition-colors">
                                  <td className="p-3.5 pl-4">
                                    <div className="font-bold text-slate-900 text-sm">
                                      {getProductName(p)}
                                    </div>
                                    <div className="text-[11px] text-slate-400 mt-0.5">
                                      {orderUnit !== baseUnit
                                        ? `${formatUnit(orderUnit, 1, language)} (${formatUnit(baseUnit, 1, language)})`
                                        : formatUnit(baseUnit, 1, language)}
                                    </div>
                                  </td>
                                  <td className="p-3.5 text-slate-600">
                                    {p.sub_group && (
                                      <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 text-[11px] font-medium">
                                        {p.sub_group}
                                      </span>
                                    )}
                                  </td>
                                  <td className="p-3.5 text-right text-slate-500 font-medium">
                                    {formatPaise(mrp)}
                                  </td>
                                  <td className="p-3.5 text-right">
                                    <div className="inline-flex items-center gap-1 font-bold text-slate-900">
                                      <span>₹</span>
                                      <input
                                        type="number"
                                        defaultValue={(p.rate_paise / 100).toFixed(2)}
                                        onBlur={(e) => updateRate(p, parseFloat(e.target.value) || 0)}
                                        className="w-20 text-right px-2 py-1 rounded border border-slate-200 focus:border-[#17307A] text-xs font-bold"
                                      />
                                    </div>
                                  </td>
                                  <td className="p-3.5 text-right font-semibold text-slate-800">
                                    <div className="font-bold text-sm text-slate-900">{p.stock_qty.toLocaleString()}</div>
                                    <div className="text-[11px] text-slate-400 font-normal">
                                      {formatUnit(baseUnit, p.stock_qty, language)}
                                    </div>
                                  </td>
                                  <td className="p-3.5 text-center text-slate-500">
                                    {p.daily_max_limit ? (
                                      <div>
                                        <span className="font-medium text-slate-800">{p.daily_max_limit}</span>{' '}
                                        <span className="text-[11px] text-slate-400">{formatUnit(baseUnit, p.daily_max_limit, language)}</span>
                                      </div>
                                    ) : (
                                      t('unlimited')
                                    )}
                                  </td>
                                  <td className="p-3.5 text-center pr-4">
                                    <div className="inline-flex items-center gap-1.5">
                                      <button
                                        type="button"
                                        disabled={loadingId === p.id}
                                        onClick={() => toggleStock(p)}
                                        className={`px-3 py-1 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                                          isInStock
                                            ? 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200'
                                            : 'bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200'
                                        }`}
                                      >
                                        {isInStock ? t('inStock') : t('outOfStock')}
                                      </button>

                                      <button
                                        type="button"
                                        onClick={() => openMovementHistory(p)}
                                        className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-100 text-slate-500 hover:text-slate-800 transition-colors cursor-pointer"
                                        title={language === 'hi' ? 'स्टॉक हलचल इतिहास' : 'View Stock Movements'}
                                      >
                                        <History className="w-4 h-4 text-[#17307A]" />
                                      </button>
                                    </div>
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
          })}
      </div>

      {/* Add Brand Modal */}
      {showAddBrandModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 p-6 max-w-md w-full shadow-xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <h3 className="text-base font-bold text-[#17307A]">{t('addBrand')}</h3>
              <button
                onClick={() => setShowAddBrandModal(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleCreateBrand} className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  {t('brandName')} *
                </label>
                <input
                  type="text"
                  required
                  value={newBrandName}
                  onChange={(e) => setNewBrandName(e.target.value)}
                  placeholder="e.g. Royal Spices"
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-[#17307A]/20 focus:border-[#17307A]"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  {t('brandHindiName')}
                </label>
                <input
                  type="text"
                  value={newBrandHindi}
                  onChange={(e) => setNewBrandHindi(e.target.value)}
                  placeholder="उदा. रॉयल स्पाइसेज"
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-[#17307A]/20 focus:border-[#17307A]"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddBrandModal(false)}
                  className="px-4 py-2 rounded-lg border border-slate-300 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                >
                  {t('cancel')}
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingBrand}
                  className="px-4 py-2 rounded-lg bg-[#17307A] text-xs font-semibold text-white hover:bg-[#17307A]/90"
                >
                  {isSubmittingBrand ? '...' : t('addBrand')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Item Drawer */}
      {showAddItemDrawer && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex justify-end">
          <div className="bg-white w-full max-w-lg h-full overflow-y-auto p-6 shadow-2xl flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between pb-4 border-b border-slate-200">
                <h3 className="text-lg font-bold text-[#17307A]">{t('createNewItem')}</h3>
                <button
                  onClick={() => setShowAddItemDrawer(false)}
                  className="text-slate-400 hover:text-slate-600"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form id="add-item-form" onSubmit={handleCreateItem} className="mt-5 space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    {t('selectBrand')} *
                  </label>
                  <select
                    value={newItemBrandId}
                    onChange={(e) => setNewItemBrandId(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#17307A]/20 focus:border-[#17307A]"
                  >
                    {brands.map((b) => (
                      <option key={b.id} value={b.id}>
                        {getBrandDisplayName(b)}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    {t('productName')} *
                  </label>
                  <input
                    type="text"
                    required
                    value={newItemName}
                    onChange={(e) => setNewItemName(e.target.value)}
                    placeholder="e.g. Premium Roasted Poha 500g"
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-[#17307A]/20 focus:border-[#17307A]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    {t('productHindiName')}
                  </label>
                  <input
                    type="text"
                    value={newItemHindi}
                    onChange={(e) => setNewItemHindi(e.target.value)}
                    placeholder="उदा. भुना हुआ पोहा ५०० ग्राम"
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-[#17307A]/20 focus:border-[#17307A]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    {t('subGroup')}
                  </label>
                  <input
                    type="text"
                    value={newItemSubGroup}
                    onChange={(e) => setNewItemSubGroup(e.target.value)}
                    placeholder="e.g. Grains, Namkeen, Oils"
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-[#17307A]/20 focus:border-[#17307A]"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      {t('mrp')} (₹)
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      value={newItemMrp}
                      onChange={(e) => setNewItemMrp(e.target.value)}
                      placeholder="e.g. 50.00"
                      className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-[#17307A]/20 focus:border-[#17307A]"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      {t('unitRate')} (PTR ₹) *
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      required
                      value={newItemPtr}
                      onChange={(e) => setNewItemPtr(e.target.value)}
                      placeholder="e.g. 42.00"
                      className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-[#17307A]/20 focus:border-[#17307A]"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      {t('baseUnit')}
                    </label>
                    <select
                      value={newItemBaseUnit}
                      onChange={(e) => setNewItemBaseUnit(e.target.value)}
                      className="w-full px-2 py-2 rounded-lg border border-slate-300 text-xs bg-white"
                    >
                      <option value="packet">packet</option>
                      <option value="piece">piece</option>
                      <option value="gram">gram</option>
                      <option value="ml">ml</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      {t('wholesaleUnit')}
                    </label>
                    <select
                      value={newItemOrderUnit}
                      onChange={(e) => setNewItemOrderUnit(e.target.value)}
                      className="w-full px-2 py-2 rounded-lg border border-slate-300 text-xs bg-white"
                    >
                      <option value="bundle">bundle</option>
                      <option value="box">box</option>
                      <option value="kg">kg</option>
                      <option value="litre">litre</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      {t('stockAvailable')}
                    </label>
                    <input
                      type="number"
                      value={newItemStock}
                      onChange={(e) => setNewItemStock(e.target.value)}
                      className="w-full px-2 py-2 rounded-lg border border-slate-300 text-xs text-right"
                    />
                  </div>
                </div>
              </form>
            </div>

            <div className="pt-4 border-t border-slate-200 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowAddItemDrawer(false)}
                className="px-4 py-2 rounded-lg border border-slate-300 text-xs font-semibold text-slate-700 hover:bg-slate-50"
              >
                {t('cancel')}
              </button>
              <button
                type="submit"
                form="add-item-form"
                disabled={isSubmittingItem}
                className="px-5 py-2 rounded-lg bg-[#17307A] text-xs font-semibold text-white hover:bg-[#17307A]/90 transition-colors shadow-sm"
              >
                {isSubmittingItem ? '...' : t('saveItem')}
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Stock Movement History Audit Modal */}
      {movementProduct && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 max-w-2xl w-full p-5 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-blue-50 text-[#17307A] flex items-center justify-center font-bold">
                  <History className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-sm sm:text-base">
                    {getProductName(movementProduct)}
                  </h3>
                  <div className="text-xs text-slate-500">
                    {language === 'hi' ? 'स्टॉक आवाजाही का इतिहास' : 'Stock Movement Audit History'} • {language === 'hi' ? 'वर्तमान स्टॉक:' : 'Current Stock:'}{' '}
                    <span className="font-bold text-slate-900">{movementProduct.stock_qty.toLocaleString()}</span>
                  </div>
                </div>
              </div>
              <button
                onClick={() => setMovementProduct(null)}
                className="text-slate-400 hover:text-slate-600 font-bold p-1"
              >
                ✕
              </button>
            </div>

            {movementsLoading ? (
              <div className="p-10 text-center text-xs text-slate-400">
                <div className="w-6 h-6 border-2 border-[#17307A] border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                <span>{language === 'hi' ? 'हलचल डेटा लोड हो रहा है...' : 'Loading movements...'}</span>
              </div>
            ) : movementsList.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-400 bg-slate-50 rounded-xl">
                {language === 'hi' ? 'इस उत्पाद के लिए कोई स्टॉक हलचल रिकॉर्ड नहीं है।' : 'No recorded movements for this item.'}
              </div>
            ) : (
              <div className="max-h-[360px] overflow-y-auto overflow-x-auto pr-1">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-slate-500 font-semibold text-[10px] uppercase border-b border-slate-200 sticky top-0">
                    <tr>
                      <th className="p-2.5">{language === 'hi' ? 'समय' : 'When'}</th>
                      <th className="p-2.5">{language === 'hi' ? 'उपयोगकर्ता' : 'Who'}</th>
                      <th className="p-2.5">{language === 'hi' ? 'कारण एवं विवरण' : 'Why & Notes'}</th>
                      <th className="p-2.5 text-right">{language === 'hi' ? 'परिवर्तन' : 'Change'}</th>
                      <th className="p-2.5 text-right">{language === 'hi' ? 'पहले → बाद में' : 'Before → After'}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {movementsList.map((m) => {
                      const isPositive = m.change > 0;
                      return (
                        <tr key={m.id} className="hover:bg-slate-50/60">
                          <td className="p-2.5 whitespace-nowrap text-slate-600 font-medium">
                            {new Date(m.createdAt).toLocaleString('en-IN', {
                              day: '2-digit',
                              month: 'short',
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </td>
                          <td className="p-2.5 whitespace-nowrap text-slate-700 font-semibold">
                            {m.actorUserId}
                          </td>
                          <td className="p-2.5">
                            <span className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 font-mono text-[10px] font-bold mr-1.5">
                              {m.reason}
                            </span>
                            <span className="text-slate-600">{m.notes}</span>
                          </td>
                          <td className="p-2.5 text-right whitespace-nowrap font-bold">
                            <span className={isPositive ? 'text-emerald-600' : 'text-rose-600'}>
                              {isPositive ? `+${m.change}` : m.change}
                            </span>
                          </td>
                          <td className="p-2.5 text-right whitespace-nowrap font-mono text-slate-700">
                            {m.stockBefore} → <span className="font-bold text-slate-900">{m.stockAfter}</span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            <div className="flex justify-end pt-3 border-t border-slate-200">
              <button
                onClick={() => setMovementProduct(null)}
                className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-xs font-semibold text-slate-700 cursor-pointer"
              >
                {language === 'hi' ? 'बंद करें' : 'Close'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
