'use client';

import React from 'react';
import { formatPaise } from '@/lib/money';
import {
  Sparkles,
  AlertCircle,
  Check,
  TrendingUp,
  ChevronRight,
  RotateCcw,
  ShoppingBag,
  Package,
  Plus,
  Minus,
  Clock,
  Calendar,
  Gift,
} from 'lucide-react';
import { RetailerScheme, LastOrderSummary } from '../retailer-portal';

export interface SubstitutionItem {
  id: string;
  order_number: string;
  original_product_name: string;
  suggested_product_name: string;
  suggested_product_id: string;
  requested_qty: number;
  price_difference_paise?: number;
  pack_difference?: string;
  status: string;
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
  activeDistributor: {
    id: string;
    name: string;
  };
  shop: {
    id: string;
    name: string;
    hold_flag: boolean;
    usual_order_interval_days?: number;
  };
  activeSubstitutions: SubstitutionItem[];
  submittingSubId: string | null;
  schemes: RetailerScheme[];
  lastOrder: LastOrderSummary | null;
  isSmartReorderEligible?: boolean;
  repeatOrderItems: Record<string, number>;
  festivalSuggestions?: FestivalSuggestionItem[];
  newBrandArrivals?: {
    brand_name: string;
    product_id: string;
    product_name: string;
    rate_paise: number;
    unit: string;
  }[];
  language: 'en' | 'hi';
  onSubstitutionAction: (id: string, action: 'ACCEPT' | 'REJECT') => void;
  onSelectSavingsScheme: (scheme: RetailerScheme) => void;
  onUpdateRepeatQty: (productId: string, delta: number) => void;
  onLoadRepeatOrder: () => void;
  onAddToCart: (productId: string, qty: number) => void;
  onNavigateToCatalog: () => void;
}

export default function OffersTab({
  activeDistributor,
  shop,
  activeSubstitutions,
  submittingSubId,
  schemes,
  lastOrder,
  isSmartReorderEligible = false,
  repeatOrderItems,
  festivalSuggestions = [],
  newBrandArrivals = [],
  language,
  onSubstitutionAction,
  onSelectSavingsScheme,
  onUpdateRepeatQty,
  onLoadRepeatOrder,
  onAddToCart,
  onNavigateToCatalog,
}: Props) {
  // Days since last order computation
  const daysSinceLastOrder = lastOrder
    ? Math.max(0, Math.floor((Date.now() - new Date(lastOrder.created_at).getTime()) / (1000 * 60 * 60 * 24)))
    : null;

  const usualInterval = shop.usual_order_interval_days || 7;
  const isDueForReorder = daysSinceLastOrder !== null && daysSinceLastOrder >= usualInterval;

  return (
    <div className="space-y-4 animate-in fade-in duration-150">
      {/* 1. Pending Substitutions Alert Card */}
      {activeSubstitutions.length > 0 && (
        <div className="space-y-2.5">
          {activeSubstitutions.map((sub) => (
            <div
              key={sub.id}
              className="p-4 rounded-2xl bg-amber-50 border border-amber-200 text-xs space-y-3 shadow-xs"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="space-y-1">
                  <span className="inline-flex items-center gap-1 font-bold text-amber-800 uppercase text-[10px] tracking-wider">
                    <AlertCircle className="w-3.5 h-3.5" />
                    <span>{language === 'hi' ? 'सामग्री प्रतिस्थापन अनुरोध' : 'Item Substitution Request'} (#{sub.order_number})</span>
                  </span>
                  <p className="text-slate-800">
                    <strong>{sub.original_product_name}</strong> {language === 'hi' ? 'स्टॉक में अनुपलब्ध है।' : 'is temporarily out of stock.'}
                  </p>
                  <p className="text-amber-900 font-semibold">
                    {language === 'hi' ? 'प्रस्तावित विकल्प:' : 'Suggested Replacement:'} <strong>{sub.suggested_product_name}</strong> ({sub.requested_qty} {language === 'hi' ? 'इकाइयां' : 'units'})
                    {sub.pack_difference && <span className="block text-[11px] text-amber-800 font-normal mt-0.5">{sub.pack_difference}</span>}
                  </p>
                </div>
              </div>

              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={submittingSubId === sub.id}
                  onClick={() => onSubstitutionAction(sub.id, 'ACCEPT')}
                  className="flex-1 py-2 px-3 rounded-xl bg-[#17307A] text-white font-bold text-xs hover:bg-[#17307A]/90 transition-colors shadow-2xs flex items-center justify-center gap-1"
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>{language === 'hi' ? 'स्वीकार करें' : 'Accept Alternative'}</span>
                </button>
                <button
                  type="button"
                  disabled={submittingSubId === sub.id}
                  onClick={() => onSubstitutionAction(sub.id, 'REJECT')}
                  className="py-2 px-3 rounded-xl border border-slate-300 bg-white text-slate-700 font-semibold text-xs hover:bg-slate-50 transition-colors"
                >
                  {language === 'hi' ? 'अस्वीकार करें' : 'Decline'}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 2. Retailer Smart Reorder Prompt (Part 2.11 Compliance: Show nothing for shops with < 3 orders in 90 days) */}
      {isSmartReorderEligible && lastOrder && (
        <section className={`p-4 rounded-3xl border shadow-xs transition-all ${
          isDueForReorder
            ? 'bg-gradient-to-br from-orange-50 via-amber-50/60 to-white border-[#F58220]/40'
            : 'bg-white border-slate-200'
        }`}>
          <div className="flex items-start gap-3">
            <div className={`w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 shadow-xs ${
              isDueForReorder ? 'bg-[#F58220] text-white' : 'bg-blue-50 text-[#17307A]'
            }`}>
              <Clock className="w-5 h-5" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-extrabold text-xs uppercase tracking-wider text-slate-700">
                  {language === 'hi' ? 'स्मार्ट री-ऑर्डर स्मरण' : 'Smart Reorder Prompt'}
                </span>
                {isDueForReorder && (
                  <span className="px-2 py-0.5 rounded-full bg-orange-100 text-[#F58220] text-[10px] font-extrabold">
                    {language === 'hi' ? 'ऑर्डर समय' : 'Due for Order'}
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-800 font-medium mt-1 leading-snug">
                {language === 'hi'
                  ? `आप सामान्यतः हर ${usualInterval} दिनों में ऑर्डर करते हैं। आपका पिछला ऑर्डर ${daysSinceLastOrder} दिन पहले था।`
                  : `You usually order every ${usualInterval} days. Your last order was ${daysSinceLastOrder} days ago.`}
              </p>
              <div className="mt-2.5 flex items-center gap-2">
                <button
                  type="button"
                  onClick={onLoadRepeatOrder}
                  className="px-3.5 py-1.5 rounded-xl bg-[#F58220] hover:bg-[#F58220]/90 text-white font-extrabold text-xs shadow-xs flex items-center gap-1.5 active:scale-95 transition-all"
                >
                  <RotateCcw className="w-3.5 h-3.5 text-white" />
                  <span>{language === 'hi' ? 'नियमित सामान दोहराएं' : 'Restock Usual Basket'}</span>
                </button>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* 3. Festival Stock Suggestions (Part 2.F Compliance) */}
      {festivalSuggestions.length > 0 && (
        <section className="space-y-2.5">
          {festivalSuggestions.map((fest) => (
            <div
              key={fest.id}
              className="p-4 sm:p-5 rounded-3xl bg-gradient-to-br from-amber-500/10 via-orange-50 to-amber-100/40 border border-amber-300 shadow-xs space-y-3"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-[#F58220] text-white flex items-center justify-center shadow-xs">
                    <Gift className="w-4 h-4 text-white" />
                  </div>
                  <div>
                    <span className="text-[10px] font-extrabold text-amber-800 uppercase tracking-wider block">
                      {language === 'hi' ? 'त्योहार विशेष स्टॉक सुझाव' : 'Festival Stock Suggestions'}
                    </span>
                    <h3 className="font-extrabold text-slate-900 text-sm">{fest.name}</h3>
                  </div>
                </div>
                <span className="text-[10px] text-amber-900 font-semibold bg-amber-100 border border-amber-300 px-2 py-0.5 rounded-full">
                  {new Date(fest.start_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })} - {new Date(fest.end_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                </span>
              </div>

              {fest.notes && (
                <p className="text-xs text-slate-700 italic">{fest.notes}</p>
              )}

              <div className="space-y-2 pt-1">
                {fest.items.map((item, idx) => (
                  <div
                    key={idx}
                    className="p-3 bg-white/90 rounded-2xl border border-amber-200/80 flex items-center justify-between gap-2"
                  >
                    <div>
                      <span className="text-[10px] font-bold text-slate-400 uppercase">{item.brand_name}</span>
                      <h5 className="font-bold text-slate-900 text-xs">{item.product_name}</h5>
                      <span className="text-[11px] font-mono text-[#17307A] font-bold">
                        {formatPaise(item.rate_paise)} / {item.unit_name}
                      </span>
                    </div>
                    <div className="text-right flex items-center gap-2">
                      <span className="text-[11px] text-amber-900 font-extrabold bg-amber-50 px-2 py-1 rounded-lg border border-amber-200">
                        {language === 'hi' ? 'सुझाव:' : 'Suggest:'} {item.suggested_qty_base} {item.unit_name}
                      </span>
                      <button
                        type="button"
                        onClick={() => onAddToCart(item.tenant_product_id, item.suggested_qty_base)}
                        className="px-3 py-1.5 rounded-xl bg-[#17307A] hover:bg-[#17307A]/90 text-white font-extrabold text-xs shadow-2xs active:scale-95 transition-all"
                      >
                        {language === 'hi' ? 'कार्ट में जोड़ें' : 'Add to Cart'}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </section>
      )}

      {/* 4. Dynamic New-Item Prompt by Brand Purchase History (Part 2.E Compliance) */}
      {newBrandArrivals.length > 0 && (
        <section className="p-4 rounded-3xl bg-blue-50/60 border border-blue-200 shadow-xs space-y-3">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-[#17307A]" />
            <h3 className="font-extrabold text-xs uppercase tracking-wider text-slate-700">
              {language === 'hi' ? 'आपके पसंदीदा ब्रांड से नए उत्पाद' : 'New Additions from Your Regular Brands'}
            </h3>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {newBrandArrivals.map((arr) => (
              <div
                key={arr.product_id}
                className="p-3 bg-white rounded-2xl border border-slate-200 flex items-center justify-between gap-2"
              >
                <div className="min-w-0">
                  <span className="text-[10px] font-bold text-slate-400 uppercase truncate block">
                    {arr.brand_name}
                  </span>
                  <h5 className="font-bold text-slate-900 text-xs truncate">{arr.product_name}</h5>
                  <span className="text-xs font-mono font-bold text-[#17307A]">
                    {formatPaise(arr.rate_paise)} / {arr.unit}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => onAddToCart(arr.product_id, 1)}
                  className="px-3 py-1.5 rounded-xl bg-orange-50 hover:bg-[#F58220] hover:text-white text-[#F58220] font-extrabold text-xs border border-orange-200 transition-all shrink-0 active:scale-95"
                >
                  {language === 'hi' ? 'जोड़ें' : 'Add'}
                </button>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* 5. Schemes & Offers with Interactive "You Save" Button */}
      {schemes.length > 0 && (
        <section className="space-y-2.5">
          <div className="flex items-center justify-between px-1">
            <div className="flex items-center gap-1.5">
              <Sparkles className="w-4 h-4 text-[#F58220]" />
              <h2 className="font-extrabold text-sm text-slate-900 tracking-tight">
                {language === 'hi' ? 'सक्रिय व्यापार योजनाएं' : 'Trade Schemes & Offers'}
              </h2>
            </div>
            <span className="text-[11px] font-semibold text-slate-500">
              {schemes.length} {language === 'hi' ? 'सक्रिय योजनाएं' : 'Active Offers'}
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {schemes.map((sc, index) => {
              const gradientColors = [
                'from-amber-500/10 via-orange-50 to-orange-100/50 border-orange-200',
                'from-emerald-500/10 via-teal-50 to-teal-100/50 border-emerald-200',
                'from-indigo-500/10 via-blue-50 to-blue-100/50 border-indigo-200',
              ][index % 3];

              return (
                <div
                  key={sc.id}
                  className={`p-4 rounded-2xl bg-gradient-to-br ${gradientColors} border shadow-xs flex flex-col justify-between gap-3 transition-transform hover:-translate-y-0.5`}
                >
                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="px-2 py-0.5 rounded-md bg-white/80 border border-slate-200/80 text-[10px] font-extrabold text-slate-700 uppercase tracking-wider">
                        {sc.type.replace('_', ' ')}
                      </span>
                      <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded">
                        Wholesale Margin+
                      </span>
                    </div>
                    <h3 className="font-bold text-slate-900 text-sm leading-snug pt-1">
                      {sc.name}
                    </h3>
                    <p className="text-[11px] text-slate-600 line-clamp-2">
                      {sc.description || 'Special wholesale distributor trade scheme for registered retailers'}
                    </p>
                  </div>

                  {/* Attractive, Colorful "You Save" Button */}
                  <div className="pt-2 border-t border-slate-200/60 flex items-center justify-between">
                    <div className="text-[11px] text-slate-500 font-medium">
                      {language === 'hi' ? 'बचत विवरण:' : 'Tap to see savings:'}
                    </div>
                    <button
                      type="button"
                      onClick={() => onSelectSavingsScheme(sc)}
                      className="touch-target px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-[#F58220] via-amber-500 to-orange-600 hover:brightness-105 active:scale-95 text-white font-extrabold text-xs shadow-md shadow-orange-500/20 flex items-center gap-1.5 transition-all"
                    >
                      <TrendingUp className="w-3.5 h-3.5 text-white" />
                      <span>{language === 'hi' ? 'बचत देखें' : 'You Save'}</span>
                      <ChevronRight className="w-3.5 h-3.5 opacity-80" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* 6. Repeat Last Order Section */}
      {lastOrder ? (
        <section className="bg-white border-2 border-[#17307A]/20 hover:border-[#17307A] transition-all rounded-3xl p-4 sm:p-5 shadow-xs space-y-3">
          <div className="flex items-start justify-between gap-3">
            <div>
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-blue-50 text-[#17307A] text-[10px] font-extrabold uppercase tracking-wider mb-1">
                <RotateCcw className="w-3 h-3 text-[#F58220]" />
                <span>{language === 'hi' ? 'पिछला ऑर्डर दोहराएं' : 'Repeat Last Order'}</span>
              </span>
              <h2 className="text-base sm:text-lg font-extrabold text-slate-900 leading-tight">
                {language === 'hi' ? '1-क्लिक री-ऑर्डर' : 'Quick 1-Tap Re-Order'}
              </h2>
              <span className="text-xs text-slate-400">
                Order #{lastOrder.order_number} • {new Date(lastOrder.created_at).toLocaleDateString()}
              </span>
            </div>
            <div className="text-right">
              <span className="text-base font-extrabold text-[#17307A] block">
                {formatPaise(lastOrder.total_paise)}
              </span>
              <span className="text-[11px] text-slate-500 font-medium">
                {lastOrder.lines.length} {language === 'hi' ? 'सामग्री' : 'items'}
              </span>
            </div>
          </div>

          {/* Editable items list with live steppers */}
          <div className="divide-y divide-slate-100 py-1 text-xs max-h-56 overflow-y-auto pr-1">
            {lastOrder.lines.map((line) => {
              const currentQty = repeatOrderItems[line.tenant_product_id] ?? line.display_quantity;
              return (
                <div key={line.tenant_product_id} className="py-2.5 flex items-center justify-between gap-2">
                  <div className="flex-1 min-w-0 pr-2">
                    <div className="font-bold text-slate-800 truncate">{line.product_name}</div>
                    <div className="text-[11px] text-slate-400">
                      {formatPaise(line.price_paise)} / {line.order_unit_name}
                    </div>
                  </div>

                  {/* Stepper with live numbers */}
                  <div className="flex items-center gap-2 bg-slate-100 rounded-xl p-1 shrink-0 border border-slate-200">
                    <button
                      type="button"
                      onClick={() => onUpdateRepeatQty(line.tenant_product_id, -1)}
                      className="w-7 h-7 rounded-lg bg-white text-slate-700 flex items-center justify-center font-bold hover:bg-slate-200 transition-colors shadow-2xs active:scale-95"
                    >
                      <Minus className="w-3 h-3" />
                    </button>
                    <span className="w-7 text-center font-extrabold text-xs text-slate-900">
                      {currentQty}
                    </span>
                    <button
                      type="button"
                      onClick={() => onUpdateRepeatQty(line.tenant_product_id, 1)}
                      className="w-7 h-7 rounded-lg bg-white text-slate-700 flex items-center justify-center font-bold hover:bg-slate-200 transition-colors shadow-2xs active:scale-95"
                    >
                      <Plus className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Primary Action Button */}
          <button
            type="button"
            disabled={shop.hold_flag}
            onClick={onLoadRepeatOrder}
            className="touch-target w-full py-3.5 rounded-2xl bg-[#F58220] hover:bg-[#F58220]/95 text-white font-extrabold text-sm shadow-md shadow-orange-500/20 flex items-center justify-center gap-2 transition-all active:scale-[0.99] disabled:opacity-50"
          >
            <ShoppingBag className="w-4 h-4 text-white" />
            <span>{language === 'hi' ? 'कार्ट में लोड करें' : 'Load Items to Cart'}</span>
          </button>
        </section>
      ) : (
        <div className="p-6 rounded-3xl bg-white border border-slate-200 text-center space-y-2">
          <Package className="w-8 h-8 text-slate-300 mx-auto" />
          <h3 className="font-bold text-slate-800 text-sm">
            {language === 'hi' ? `${activeDistributor.name} में स्वागत है` : `Welcome to ${activeDistributor.name}`}
          </h3>
          <p className="text-xs text-slate-500">
            {language === 'hi'
              ? 'अपना पहला थोक ऑर्डर दर्ज करने हेतु कैटलॉग टैब खोलें।'
              : 'Switch to the Catalog tab to place your first wholesale order.'}
          </p>
          <button
            type="button"
            onClick={onNavigateToCatalog}
            className="px-4 py-2 rounded-xl bg-[#17307A] text-white font-bold text-xs shadow-xs cursor-pointer"
          >
            {language === 'hi' ? 'कैटलॉग खोलें' : 'Open Catalog'}
          </button>
        </div>
      )}
    </div>
  );
}
