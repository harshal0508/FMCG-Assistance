'use client';

import React, { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import {
  PhoneCall,
  Plus,
  Trash2,
  Store,
  CheckCircle2,
  AlertCircle,
  ShieldAlert,
  IndianRupee,
  ArrowLeft,
  Check,
  Search,
  Building2,
  Package,
} from 'lucide-react';
import { formatPaise } from '@/lib/money';
import { useTranslation } from '@/lib/i18n/context';

export interface ShopSummary {
  id: string;
  shop_number: string;
  name: string;
  owner_name: string;
  phone: string;
  address: string;
  hold_flag: boolean;
  credit_limit_paise: number;
  area: {
    id: string;
    name: string;
  } | null;
}

export interface BrandSummary {
  id: string;
  name: string;
  hindi_name: string | null;
}

export interface ProductSummary {
  id: string;
  brand_id?: string | null;
  brand?: BrandSummary | null;
  rate_paise: number;
  stock_qty: number;
  in_stock_flag: boolean;
  base_unit?: string | null;
  default_order_unit?: string | null;
  daily_max_limit?: number | null;
  master_product: {
    id: string;
    name: string;
    hindi_name: string | null;
    mrp_paise: number;
    base_unit: string;
    default_order_unit: string;
    unit_chain_json: string;
    category: {
      id: string;
      name: string;
      hindi_name: string | null;
    };
  };
}

interface OrderFormLine {
  tempId: string;
  brandId: string;
  tenantProductId: string;
  qty: number;
  orderUnitName: string;
}

interface Props {
  shops: ShopSummary[];
  brands: BrandSummary[];
  products: ProductSummary[];
}

const BRAND_BADGES: Record<string, { bg: string; text: string; initial: string }> = {
  'Sunrise Foods': { bg: 'bg-orange-500', text: 'text-white', initial: 'SF' },
  'Crunch Co': { bg: 'bg-amber-500', text: 'text-white', initial: 'CC' },
  'Golden Grains': { bg: 'bg-emerald-600', text: 'text-white', initial: 'GG' },
  'Daily Fresh': { bg: 'bg-blue-600', text: 'text-white', initial: 'DF' },
  'SpiceCraft': { bg: 'bg-purple-600', text: 'text-white', initial: 'SC' },
};

export default function PhoneOrderEntry({ shops, brands = [], products }: Props) {
  const { language, t } = useTranslation();
  const [selectedShopId, setSelectedShopId] = useState<string>('');
  const [shopSearch, setShopSearch] = useState<string>('');
  const [notes, setNotes] = useState<string>('');

  // Initial line with first brand and first product in that brand
  const initialBrandId = brands[0]?.id || products[0]?.brand_id || '';
  const initialProd = products.find((p) => p.brand_id === initialBrandId) || products[0];

  const [lines, setLines] = useState<OrderFormLine[]>([
    {
      tempId: 'line_1',
      brandId: initialBrandId,
      tenantProductId: initialProd?.id || '',
      qty: 1,
      orderUnitName:
        initialProd?.default_order_unit ||
        initialProd?.master_product.default_order_unit ||
        'piece',
    },
  ]);

  const [pricingData, setPricingData] = useState<any | null>(null);
  const [isCalculatingPricing, setIsCalculatingPricing] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successResult, setSuccessResult] = useState<{
    orderNumber: string;
    orderId: string;
  } | null>(null);

  // Shop selection
  const selectedShop = useMemo(
    () => shops.find((s) => s.id === selectedShopId),
    [shops, selectedShopId]
  );

  // Filter shops for search
  const filteredShops = useMemo(() => {
    const q = shopSearch.toLowerCase().trim();
    if (!q) return shops;
    return shops.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        s.owner_name.toLowerCase().includes(q) ||
        s.phone.includes(q) ||
        s.shop_number.toLowerCase().includes(q)
    );
  }, [shops, shopSearch]);

  // Centralized Pricing & Validation calculation from shared service
  useEffect(() => {
    if (!selectedShopId || lines.length === 0) {
      setPricingData(null);
      return;
    }

    let active = true;
    const timer = setTimeout(async () => {
      setIsCalculatingPricing(true);
      try {
        const payloadItems = lines.map((l) => ({
          tenantProductId: l.tenantProductId,
          orderQty: l.qty,
          orderUnitName: l.orderUnitName,
        }));

        const res = await fetch('/api/distributor/pricing/calculate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            tenantId: 'tenant_shree_shyam_alwar',
            shopId: selectedShopId,
            items: payloadItems,
          }),
        });

        if (!res.ok) {
          const errData = await res.json();
          if (active) {
            setPricingData(null);
            setErrorMessage(errData.error || 'Pricing calculation failed');
          }
          return;
        }

        const data = await res.json();
        if (active) {
          setPricingData(data);
          setErrorMessage(null);
        }
      } catch (err: any) {
        if (active) {
          setErrorMessage(err.message);
        }
      } finally {
        if (active) setIsCalculatingPricing(false);
      }
    }, 250);

    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [selectedShopId, lines]);

  // Handle adding a new line
  const handleAddLine = () => {
    const brandId = brands[0]?.id || '';
    const firstProdInBrand = products.find((p) => p.brand_id === brandId) || products[0];
    setLines((prev) => [
      ...prev,
      {
        tempId: `line_${Date.now()}`,
        brandId,
        tenantProductId: firstProdInBrand?.id || '',
        qty: 1,
        orderUnitName:
          firstProdInBrand?.default_order_unit ||
          firstProdInBrand?.master_product.default_order_unit ||
          'piece',
      },
    ]);
  };

  // Handle removing a line
  const handleRemoveLine = (tempId: string) => {
    if (lines.length <= 1) return;
    setLines((prev) => prev.filter((l) => l.tempId !== tempId));
  };

  // Handle Brand selection change for a line
  const handleBrandChange = (tempId: string, newBrandId: string) => {
    const prodsInBrand = products.filter((p) => p.brand_id === newBrandId);
    const firstProd = prodsInBrand[0] || products[0];

    setLines((prev) =>
      prev.map((l) => {
        if (l.tempId === tempId) {
          return {
            ...l,
            brandId: newBrandId,
            tenantProductId: firstProd?.id || '',
            orderUnitName:
              firstProd?.default_order_unit ||
              firstProd?.master_product.default_order_unit ||
              'piece',
          };
        }
        return l;
      })
    );
  };

  // Handle Product change for a line
  const handleProductChange = (tempId: string, newProductId: string) => {
    const prod = products.find((p) => p.id === newProductId);
    if (!prod) return;

    setLines((prev) =>
      prev.map((l) => {
        if (l.tempId === tempId) {
          return {
            ...l,
            tenantProductId: prod.id,
            orderUnitName:
              prod.default_order_unit || prod.master_product.default_order_unit || 'piece',
          };
        }
        return l;
      })
    );
  };

  // Handle Quantity change
  const handleQtyChange = (tempId: string, newQty: number) => {
    const validQty = Math.max(1, newQty);
    setLines((prev) =>
      prev.map((l) => (l.tempId === tempId ? { ...l, qty: validQty } : l))
    );
  };

  // Submit phone order
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedShopId) {
      setErrorMessage(
        language === 'hi' ? 'कृपया पहले दुकानदार चुनें।' : 'Please select a shop first.'
      );
      return;
    }

    if (selectedShop?.hold_flag) {
      setErrorMessage(
        language === 'hi'
          ? 'दुकानदार उधारी रोक पर है।'
          : 'Shop is on credit hold. Clear outstanding balance before booking.'
      );
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const payload = {
        tenantId: 'tenant_shree_shyam_alwar',
        shopId: selectedShopId,
        notes: notes || 'Booked via phone entry',
        clientTotalPaise: pricingData?.totalPaise,
        items: lines.map((l) => ({
          tenantProductId: l.tenantProductId,
          orderQty: l.qty,
          orderUnitName: l.orderUnitName,
        })),
      };

      const res = await fetch('/api/distributor/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to place order');
      }

      setSuccessResult({
        orderNumber: data.order.order_number,
        orderId: data.order.id,
      });
    } catch (err: any) {
      setErrorMessage(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const getBrandDisplayName = (b: BrandSummary) => {
    if (language === 'hi' && b.hindi_name) return b.hindi_name;
    return b.name;
  };

  const getProductDisplayName = (p: ProductSummary) => {
    if (language === 'hi' && p.master_product?.hindi_name) {
      return p.master_product.hindi_name;
    }
    return p.master_product?.name || '';
  };

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Header Bar */}
      <div>
        <h1 className="text-2xl font-bold text-[#17307A] tracking-tight">
          {t('phoneOrderTitle')}
        </h1>
        <p className="text-xs md:text-sm text-slate-500 mt-0.5">
          {t('phoneOrderSubtitle')}
        </p>
      </div>

      {/* Success Notification Banner */}
      {successResult && (
        <div className="p-5 rounded-2xl bg-emerald-50 border border-emerald-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-sm animate-in fade-in">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-emerald-900">
                {t('orderBookedSuccess')}
              </h3>
              <p className="text-xs text-emerald-700 mt-0.5">
                {t('orderNumber')}{' '}
                <span className="font-mono font-bold">#{successResult.orderNumber}</span>{' '}
                — logged directly into Order Inbox.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <Link
              href="/d/orders"
              className="flex-1 sm:flex-none text-center px-4 py-2 bg-[#17307A] hover:bg-[#17307A]/90 text-white font-semibold text-xs rounded-xl shadow-xs transition-colors"
            >
              {t('viewInOrders')}
            </Link>
            <button
              onClick={() => {
                setSuccessResult(null);
                setNotes('');
                setLines([
                  {
                    tempId: `line_${Date.now()}`,
                    brandId: initialBrandId,
                    tenantProductId: initialProd?.id || '',
                    qty: 1,
                    orderUnitName:
                      initialProd?.default_order_unit ||
                      initialProd?.master_product.default_order_unit ||
                      'piece',
                  },
                ]);
              }}
              className="flex-1 sm:flex-none text-center px-3.5 py-2 border border-slate-300 hover:bg-white bg-slate-50 text-slate-700 font-semibold text-xs rounded-xl transition-colors"
            >
              + {t('bookAnother')}
            </button>
          </div>
        </div>
      )}

      {/* Main Order Form */}
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Step 1: Select Retailer Shop */}
        <div className="bg-white p-5 rounded-2xl border border-[#E2E8F0] shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <span className="w-6 h-6 rounded-lg bg-[#17307A] text-white text-xs flex items-center justify-center font-bold">
                1
              </span>
              <span>{t('selectShop')}</span>
            </h2>
            {selectedShop && (
              <button
                type="button"
                onClick={() => setSelectedShopId('')}
                className="text-xs text-[#17307A] font-semibold hover:underline cursor-pointer"
              >
                {t('changeShop')}
              </button>
            )}
          </div>

          {!selectedShop ? (
            <div className="space-y-3">
              <div className="relative">
                <input
                  type="text"
                  placeholder={t('searchShopPlaceholder')}
                  value={shopSearch}
                  onChange={(e) => setShopSearch(e.target.value)}
                  className="w-full text-xs md:text-sm border border-slate-300 rounded-xl pl-9 pr-3.5 py-2.5 outline-none focus:border-[#17307A] focus:ring-1 focus:ring-[#17307A]"
                />
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
              </div>

              <div className="max-h-56 overflow-y-auto divide-y divide-slate-100 border border-slate-200 rounded-xl">
                {filteredShops.map((shop) => (
                  <div
                    key={shop.id}
                    onClick={() => setSelectedShopId(shop.id)}
                    className="p-3 hover:bg-slate-50 cursor-pointer flex items-center justify-between text-xs transition-colors"
                  >
                    <div>
                      <div className="font-bold text-slate-900 text-sm">
                        {shop.name}{' '}
                        <span className="text-slate-400 text-xs font-normal">
                          ({shop.shop_number})
                        </span>
                      </div>
                      <div className="text-slate-500 mt-0.5">
                        {shop.owner_name} • {shop.phone} • {shop.area?.name || 'Ratlam'}
                      </div>
                    </div>
                    <div>
                      {shop.hold_flag ? (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
                          Hold
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
                          Active
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
              <div>
                <div className="font-bold text-slate-900 text-base">
                  {selectedShop.name}{' '}
                  <span className="text-slate-400 text-xs font-normal">
                    ({selectedShop.shop_number})
                  </span>
                </div>
                <div className="text-slate-600 mt-0.5">
                  {selectedShop.owner_name} • {selectedShop.phone}
                </div>
                <div className="text-slate-500 mt-0.5">
                  {selectedShop.address} • {selectedShop.area?.name || 'Ratlam'}
                </div>
              </div>

              <div className="text-left sm:text-right">
                <div className="text-slate-400 text-[11px]">{t('creditLimit')}</div>
                <div className="font-bold text-slate-800 text-sm">
                  {formatPaise(selectedShop.credit_limit_paise)}
                </div>
                <div className="mt-1">
                  {selectedShop.hold_flag ? (
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-rose-100 text-rose-700 border border-rose-200">
                      <ShieldAlert className="w-3.5 h-3.5" />
                      <span>{t('creditHoldWarning')}</span>
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
                      <Check className="w-3.5 h-3.5" />
                      <span>Active</span>
                    </span>
                  )}
                </div>
              </div>
            </div>
          )}

          {selectedShop?.hold_flag && (
            <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs font-medium flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 shrink-0 text-rose-600" />
              <span>{t('creditHoldAlert')}</span>
            </div>
          )}
        </div>

        {/* Step 2: Add Items by Brand */}
        <div className="bg-white p-5 rounded-2xl border border-[#E2E8F0] shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <span className="w-6 h-6 rounded-lg bg-[#17307A] text-white text-xs flex items-center justify-center font-bold">
                2
              </span>
              <span>{t('orderItemsStep')}</span>
            </h2>
            <button
              type="button"
              onClick={handleAddLine}
              className="px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-[#17307A] rounded-xl text-xs font-bold transition-colors flex items-center gap-1 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>{t('addAnotherItem')}</span>
            </button>
          </div>

          <div className="space-y-3">
            {lines.map((line, idx) => {
              const currentProd = products.find((p) => p.id === line.tenantProductId);
              const pricingLine = pricingData?.lines ? pricingData.lines[idx] : null;

              const effectiveRate = pricingLine
                ? pricingLine.effectiveRatePaise
                : currentProd?.rate_paise || 0;
              const lineTotal = pricingLine
                ? pricingLine.lineSubtotalPaise
                : effectiveRate * line.qty;

              const brandProducts = products.filter((p) => p.brand_id === line.brandId);

              return (
                <div
                  key={line.tempId}
                  className="p-4 rounded-xl border border-slate-200 bg-slate-50/60 flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs"
                >
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 flex-1">
                    {/* Brand Selector */}
                    <div>
                      <label className="text-[11px] font-semibold text-slate-500 uppercase block mb-1">
                        {t('selectBrandStep')}
                      </label>
                      <select
                        value={line.brandId}
                        onChange={(e) => handleBrandChange(line.tempId, e.target.value)}
                        className="w-full text-xs font-semibold text-slate-800 bg-white border border-slate-300 rounded-lg px-2.5 py-2 outline-none focus:border-[#17307A]"
                      >
                        {brands.map((b) => (
                          <option key={b.id} value={b.id}>
                            {getBrandDisplayName(b)}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Product Selector in Brand */}
                    <div>
                      <label className="text-[11px] font-semibold text-slate-500 uppercase block mb-1">
                        {t('selectProductStep')}
                      </label>
                      <select
                        value={line.tenantProductId}
                        onChange={(e) => handleProductChange(line.tempId, e.target.value)}
                        className="w-full text-xs font-semibold text-slate-800 bg-white border border-slate-300 rounded-lg px-2.5 py-2 outline-none focus:border-[#17307A]"
                      >
                        {brandProducts.map((p) => (
                          <option key={p.id} value={p.id}>
                            {getProductDisplayName(p)} (PTR: {formatPaise(p.rate_paise)} /{' '}
                            {p.default_order_unit || p.master_product.default_order_unit})
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* Quantity Stepper & Line Total */}
                  <div className="flex items-center justify-between md:justify-end gap-3 pt-2 md:pt-0 border-t md:border-t-0 border-slate-200">
                    <div>
                      <label className="text-[11px] font-semibold text-slate-500 uppercase block mb-1">
                        Quantity ({line.orderUnitName})
                      </label>
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => handleQtyChange(line.tempId, line.qty - 1)}
                          className="w-8 h-8 rounded-lg bg-white border border-slate-300 font-bold hover:bg-slate-100 flex items-center justify-center text-slate-700 cursor-pointer"
                        >
                          -
                        </button>
                        <input
                          type="number"
                          min="1"
                          value={line.qty}
                          onChange={(e) =>
                            handleQtyChange(line.tempId, parseInt(e.target.value) || 1)
                          }
                          className="w-14 text-center font-bold text-sm bg-white border border-slate-300 rounded-lg py-1 outline-none"
                        />
                        <button
                          type="button"
                          onClick={() => handleQtyChange(line.tempId, line.qty + 1)}
                          className="w-8 h-8 rounded-lg bg-white border border-slate-300 font-bold hover:bg-slate-100 flex items-center justify-center text-slate-700 cursor-pointer"
                        >
                          +
                        </button>
                      </div>
                    </div>

                    <div className="text-right min-w-[80px]">
                      <div className="text-[10px] text-slate-400 uppercase font-semibold">
                        {t('netTotal')}
                      </div>
                      <div className="font-bold text-slate-900 text-sm">
                        {formatPaise(lineTotal)}
                      </div>
                    </div>

                    {lines.length > 1 && (
                      <button
                        type="button"
                        onClick={() => handleRemoveLine(line.tempId)}
                        className="text-slate-400 hover:text-rose-600 p-1.5 transition-colors cursor-pointer"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Step 3: Financial Summary & Confirmation */}
        <div className="bg-white p-5 rounded-2xl border border-[#E2E8F0] shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <span className="w-6 h-6 rounded-lg bg-[#17307A] text-white text-xs flex items-center justify-center font-bold">
                3
              </span>
              <span>{t('subtotal')} & {t('confirmAndBook')}</span>
            </h2>
          </div>

          {errorMessage && (
            <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs font-medium flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          <div className="p-4 bg-slate-50 rounded-xl space-y-2 text-xs">
            <div className="flex justify-between text-slate-600">
              <span>{t('subtotal')}</span>
              <span className="font-semibold">
                {pricingData ? formatPaise(pricingData.subtotalPaise) : '—'}
              </span>
            </div>
            {pricingData?.discountPaise > 0 && (
              <div className="flex justify-between text-emerald-600 font-semibold">
                <span>{t('discount')}</span>
                <span>- {formatPaise(pricingData.discountPaise)}</span>
              </div>
            )}
            <div className="flex justify-between pt-2 border-t border-slate-200 text-base font-bold text-slate-900">
              <span>{t('netTotal')}</span>
              <span className="text-[#17307A]">
                {pricingData ? formatPaise(pricingData.totalPaise) : '—'}
              </span>
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-600 block mb-1">
              Order Notes / Verbal Instructions (Optional)
            </label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Deliver before 2 PM, shopkeeper requested cash on delivery..."
              className="w-full text-xs border border-slate-300 rounded-xl px-3.5 py-2.5 outline-none focus:border-[#17307A]"
            />
          </div>

          <button
            type="submit"
            disabled={isSubmitting || selectedShop?.hold_flag || isCalculatingPricing}
            className="w-full py-3 rounded-xl bg-[#F58220] hover:bg-[#F58220]/90 text-white font-bold text-sm shadow-sm transition-all disabled:opacity-50 cursor-pointer flex items-center justify-center gap-2"
          >
            <PhoneCall className="w-4 h-4" />
            <span>
              {isSubmitting
                ? 'Booking Order...'
                : `${t('confirmAndBook')} (${pricingData ? formatPaise(pricingData.totalPaise) : '—'})`}
            </span>
          </button>
        </div>
      </form>
    </div>
  );
}
