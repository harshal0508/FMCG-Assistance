'use client';

import React from 'react';
import { formatPaise } from '@/lib/money';
import { Building2, ArrowLeftRight, Search, Plus, Minus } from 'lucide-react';

export interface RetailerProduct {
  id: string;
  name: string;
  hindi_name: string | null;
  brand_id: string | null;
  brand_name: string;
  sub_group: string | null;
  mrp_paise: number | null;
  rate_paise: number;
  stock_qty: number;
  in_stock_flag: boolean;
  default_order_unit: string | null;
  base_unit: string | null;
  is_new: boolean;
}

interface Props {
  activeDistributor: {
    id: string;
    name: string;
    city: string;
    category_focus: string;
    category_focus_hi: string;
  };
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  selectedBrandId: string;
  setSelectedBrandId: (b: string) => void;
  visibleBrands: { id: string; name: string }[];
  filteredProducts: RetailerProduct[];
  cart: Record<string, number>;
  holdFlag: boolean;
  language: 'en' | 'hi';
  onUpdateCartQty: (productId: string, delta: number) => void;
  onOpenDistributorModal: () => void;
}

export default function CatalogTab({
  activeDistributor,
  searchQuery,
  setSearchQuery,
  selectedBrandId,
  setSelectedBrandId,
  visibleBrands,
  filteredProducts,
  cart,
  holdFlag,
  language,
  onUpdateCartQty,
  onOpenDistributorModal,
}: Props) {
  return (
    <div className="space-y-4 animate-in fade-in duration-150">
      {/* Active Distributor & Category Focus Ribbon */}
      <div className="p-3 rounded-2xl bg-white border border-slate-200 shadow-2xs flex items-center justify-between gap-2">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-8 h-8 rounded-xl bg-blue-50 text-[#17307A] flex items-center justify-center shrink-0">
            <Building2 className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="font-extrabold text-xs sm:text-sm text-slate-900 truncate">
                {activeDistributor.name}
              </span>
              <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-[#17307A]">
                {activeDistributor.city}
              </span>
            </div>
            <span className="text-[11px] text-slate-500 block truncate">
              {language === 'hi' ? activeDistributor.category_focus_hi : activeDistributor.category_focus}
            </span>
          </div>
        </div>
        <button
          type="button"
          onClick={onOpenDistributorModal}
          className="px-2.5 py-1.5 rounded-xl bg-orange-50 hover:bg-[#F58220] hover:text-white text-[#F58220] font-bold text-xs border border-orange-200 transition-all shrink-0 flex items-center gap-1 cursor-pointer active:scale-95 shadow-2xs"
        >
          <ArrowLeftRight className="w-3.5 h-3.5" />
          <span>{language === 'hi' ? 'बदलें' : 'Switch'}</span>
        </button>
      </div>

      {/* Search Box */}
      <div className="relative">
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder={language === 'hi' ? 'सामग्री या ब्रांड खोजें...' : 'Search items or brands...'}
          className="w-full pl-9 pr-4 py-2.5 rounded-2xl border border-slate-300 bg-white text-xs sm:text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#17307A]/20 focus:border-[#17307A] shadow-2xs"
        />
        <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
      </div>

      {/* Brand Chips / Tabs (Brand-Wise Filtering for Active Distributor) */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
        <button
          type="button"
          onClick={() => setSelectedBrandId('ALL')}
          className={`px-3.5 py-2 rounded-xl text-xs font-extrabold whitespace-nowrap transition-all ${
            selectedBrandId === 'ALL'
              ? 'bg-[#17307A] text-white shadow-xs'
              : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
          }`}
        >
          {language === 'hi' ? 'सभी ब्रांड' : 'All Brands'}
        </button>
        {visibleBrands.map((b) => (
          <button
            key={b.id}
            type="button"
            onClick={() => setSelectedBrandId(b.id)}
            className={`px-3.5 py-2 rounded-xl text-xs font-extrabold whitespace-nowrap transition-all ${
              selectedBrandId === b.id
                ? 'bg-[#17307A] text-white shadow-xs'
                : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
            }`}
          >
            {b.name}
          </button>
        ))}
      </div>

      {/* Products List under Selected Brand */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {filteredProducts.map((prod) => {
          const inCartQty = cart[prod.id] || 0;
          const displayName =
            language === 'hi' && prod.hindi_name ? prod.hindi_name : prod.name;
          const brandInitials = prod.brand_name.slice(0, 2).toUpperCase();

          return (
            <div
              key={prod.id}
              className="p-3.5 bg-white border border-slate-200/80 rounded-2xl shadow-xs space-y-3 flex flex-col justify-between hover:border-slate-300 transition-colors"
            >
              <div className="flex items-start gap-3">
                {/* Static Brand Monogram Placeholder */}
                <div className="w-12 h-12 rounded-xl bg-slate-100 border border-slate-200 text-[#17307A] font-extrabold text-sm flex items-center justify-center shrink-0">
                  {brandInitials}
                </div>

                <div className="flex-1 min-w-0">
                  <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider block">
                    {prod.brand_name}
                  </span>
                  <h4 className="font-bold text-slate-900 text-xs sm:text-sm leading-snug truncate">
                    {displayName}
                  </h4>
                  <span className="text-[11px] text-slate-500 block mt-0.5">
                    {prod.default_order_unit || prod.base_unit || 'pack'}
                  </span>
                </div>
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                <div>
                  <span className="text-sm font-extrabold text-[#17307A] block">
                    {formatPaise(prod.rate_paise)}
                  </span>
                  {prod.mrp_paise && (
                    <span className="text-[10px] text-slate-400 line-through">
                      MRP {formatPaise(prod.mrp_paise)}
                    </span>
                  )}
                </div>

                {/* Live Stepper with numbers (1, 2, 3...) */}
                {inCartQty > 0 ? (
                  <div className="flex items-center gap-1.5 bg-slate-100 border border-slate-200 rounded-xl p-1">
                    <button
                      type="button"
                      onClick={() => onUpdateCartQty(prod.id, -1)}
                      className="w-7 h-7 rounded-lg bg-white text-slate-800 flex items-center justify-center font-extrabold hover:bg-slate-200 transition-colors shadow-2xs active:scale-95"
                    >
                      <Minus className="w-3.5 h-3.5" />
                    </button>
                    <span className="w-7 text-center font-extrabold text-xs text-slate-900">
                      {inCartQty}
                    </span>
                    <button
                      type="button"
                      onClick={() => onUpdateCartQty(prod.id, 1)}
                      className="w-7 h-7 rounded-lg bg-[#17307A] text-white flex items-center justify-center font-extrabold hover:bg-[#17307A]/90 transition-colors shadow-2xs active:scale-95"
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    disabled={holdFlag || !prod.in_stock_flag}
                    onClick={() => onUpdateCartQty(prod.id, 1)}
                    className="touch-target px-4 py-1.5 rounded-xl bg-[#17307A] text-white font-extrabold text-xs hover:bg-[#17307A]/90 transition-all active:scale-95 shadow-2xs disabled:opacity-40 flex items-center gap-1"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>{language === 'hi' ? 'जोड़ें' : 'Add to Cart'}</span>
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
