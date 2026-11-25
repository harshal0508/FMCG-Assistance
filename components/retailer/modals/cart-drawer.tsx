'use client';

import React from 'react';
import { formatPaise } from '@/lib/money';
import { X, Minus, Plus, ArrowRight } from 'lucide-react';

export interface CartLineItem {
  product: {
    id: string;
    name: string;
    brand_name: string;
    rate_paise: number;
    default_order_unit: string | null;
  };
  quantity: number;
  lineTotalPaise: number;
}

interface Props {
  isOpen: boolean;
  cartLines: CartLineItem[];
  totalCartItemsCount: number;
  cartTotalPaise: number;
  distributorName: string;
  isPlacingOrder: boolean;
  holdFlag: boolean;
  language: 'en' | 'hi';
  onUpdateQty: (productId: string, delta: number) => void;
  onPlaceOrder: () => void;
  onClose: () => void;
}

export default function CartDrawer({
  isOpen,
  cartLines,
  totalCartItemsCount,
  cartTotalPaise,
  distributorName,
  isPlacingOrder,
  holdFlag,
  language,
  onUpdateQty,
  onPlaceOrder,
  onClose,
}: Props) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex flex-col justify-end animate-in fade-in">
      <div className="bg-white rounded-t-3xl max-w-2xl w-full mx-auto max-h-[85vh] flex flex-col shadow-2xl border-t border-slate-200">
        {/* Header */}
        <div className="p-4 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h3 className="font-extrabold text-base text-slate-900">
              {language === 'hi' ? 'आपकी कार्ट' : 'Shopping Cart'}
            </h3>
            <span className="text-xs text-slate-500">
              {totalCartItemsCount} {language === 'hi' ? 'सामग्री' : 'items'} • {distributorName}
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-100"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Cart Items List */}
        <div className="flex-1 overflow-y-auto p-4 divide-y divide-slate-100 space-y-2">
          {cartLines.map(({ product, quantity, lineTotalPaise }) => (
            <div key={product.id} className="pt-2.5 first:pt-0 flex items-center justify-between gap-3">
              <div className="flex-1 min-w-0">
                <span className="text-[10px] font-bold text-slate-400 uppercase">
                  {product.brand_name}
                </span>
                <h5 className="font-bold text-slate-900 text-xs sm:text-sm truncate">
                  {product.name}
                </h5>
                <span className="text-xs text-slate-500 font-semibold">
                  {formatPaise(product.rate_paise)} / {product.default_order_unit || 'unit'}
                </span>
              </div>

              <div className="flex items-center gap-2 bg-slate-100 rounded-xl p-1 shrink-0 border border-slate-200">
                <button
                  type="button"
                  onClick={() => onUpdateQty(product.id, -1)}
                  className="w-7 h-7 rounded-lg bg-white text-slate-700 flex items-center justify-center font-bold shadow-2xs hover:bg-slate-200"
                >
                  <Minus className="w-3 h-3" />
                </button>
                <span className="w-6 text-center font-extrabold text-xs text-slate-900">
                  {quantity}
                </span>
                <button
                  type="button"
                  onClick={() => onUpdateQty(product.id, 1)}
                  className="w-7 h-7 rounded-lg bg-white text-slate-700 flex items-center justify-center font-bold shadow-2xs hover:bg-slate-200"
                >
                  <Plus className="w-3 h-3" />
                </button>
              </div>

              <div className="w-20 text-right font-extrabold text-xs sm:text-sm text-[#17307A]">
                {formatPaise(lineTotalPaise)}
              </div>
            </div>
          ))}
        </div>

        {/* Footer Summary & Place Order */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 space-y-3">
          <div className="flex justify-between items-center text-sm font-extrabold text-slate-900">
            <span>{language === 'hi' ? 'अनुमानित कुल राशि:' : 'Estimated Total:'}</span>
            <span className="text-base text-[#17307A] font-black">
              {formatPaise(cartTotalPaise)}
            </span>
          </div>
          <p className="text-[11px] text-slate-500">
            {language === 'hi'
              ? 'अंतिम राशि वितरक द्वारा योजनाओं और लागू छूटों के साथ पुष्ट की जाएगी।'
              : 'Final total will be verified authoritatively by distributor pricing and active wholesale schemes.'}
          </p>

          <button
            type="button"
            disabled={isPlacingOrder || totalCartItemsCount === 0 || holdFlag}
            onClick={onPlaceOrder}
            className="touch-target w-full py-3.5 rounded-2xl bg-[#F58220] hover:bg-[#F58220]/95 text-white font-extrabold text-sm shadow-md shadow-orange-500/20 flex items-center justify-center gap-2 transition-all active:scale-[0.99] disabled:opacity-50"
          >
            <span>
              {isPlacingOrder
                ? language === 'hi'
                  ? 'ऑर्डर दर्ज हो रहा है...'
                  : 'Confirming Order...'
                : language === 'hi'
                ? 'ऑर्डर भेजें'
                : 'Confirm & Place Order'}
            </span>
            <ArrowRight className="w-4 h-4 text-white" />
          </button>
        </div>
      </div>
    </div>
  );
}
