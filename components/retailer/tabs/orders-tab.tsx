'use client';

import React from 'react';
import { formatPaise } from '@/lib/money';
import { ShoppingBag, Receipt, RotateCcw } from 'lucide-react';
import { HistoricalOrder } from '../modals/bill-modal';

interface Props {
  ordersHistory: HistoricalOrder[];
  distributorName: string;
  language: 'en' | 'hi';
  onViewBill: (order: HistoricalOrder) => void;
  onReorder: (order: HistoricalOrder) => void;
  onNavigateToCatalog: () => void;
}

export default function OrdersTab({
  ordersHistory,
  distributorName,
  language,
  onViewBill,
  onReorder,
  onNavigateToCatalog,
}: Props) {
  return (
    <div className="space-y-4 animate-in fade-in duration-150">
      <div className="flex items-center justify-between px-1">
        <div>
          <h2 className="font-extrabold text-base text-slate-900 tracking-tight">
            {language === 'hi' ? 'पूर्व आदेशों का इतिहास' : 'Order History'}
          </h2>
          <p className="text-xs text-slate-500">
            {ordersHistory.length} {language === 'hi' ? 'आदेश दर्ज' : 'orders recorded with'} {distributorName}
          </p>
        </div>
      </div>

      {ordersHistory.length === 0 ? (
        <div className="p-8 rounded-3xl bg-white border border-slate-200 text-center space-y-3">
          <ShoppingBag className="w-10 h-10 text-slate-300 mx-auto" />
          <h3 className="font-bold text-slate-800 text-sm">
            {language === 'hi' ? 'कोई पूर्व आदेश नहीं मिला' : 'No Previous Orders Found'}
          </h3>
          <p className="text-xs text-slate-500 max-w-xs mx-auto">
            {language === 'hi'
              ? `जब आप ${distributorName} से ऑर्डर करेंगे, आपके सभी बिल और री-ऑर्डर विकल्प यहाँ प्रदर्शित होंगे।`
              : `When you place orders with ${distributorName}, your complete order archive and re-order shortcuts will display here.`}
          </p>
          <button
            type="button"
            onClick={onNavigateToCatalog}
            className="px-4 py-2 rounded-xl bg-[#17307A] text-white font-bold text-xs cursor-pointer"
          >
            {language === 'hi' ? 'कैटलॉग देखें' : 'Start New Order'}
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {ordersHistory.map((order) => {
            const statusColors: Record<string, { bg: string; text: string; border: string }> = {
              DELIVERED: { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200' },
              DISPATCHED: { bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200' },
              CONFIRMED: { bg: 'bg-indigo-50', text: 'text-indigo-700', border: 'border-indigo-200' },
              CANCELLED: { bg: 'bg-rose-50', text: 'text-rose-700', border: 'border-rose-200' },
            };
            const styling = statusColors[order.status] || { bg: 'bg-slate-50', text: 'text-slate-700', border: 'border-slate-200' };

            return (
              <div
                key={order.id}
                className="p-4 bg-white border border-slate-200/90 rounded-2xl shadow-xs space-y-3 hover:border-slate-300 transition-colors"
              >
                {/* Top Order Row */}
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-xs text-slate-900">
                        #{order.order_number}
                      </span>
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold border ${styling.bg} ${styling.text} ${styling.border}`}
                      >
                        {order.status}
                      </span>
                    </div>
                    <span className="text-[11px] text-slate-400 block mt-0.5">
                      {new Date(order.created_at).toLocaleString('en-IN', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                  </div>

                  <div className="text-right">
                    <span className="text-sm font-extrabold text-[#17307A] block">
                      {formatPaise(order.total_paise)}
                    </span>
                    <span className="text-[11px] text-slate-500 font-medium">
                      {order.lines.length} {language === 'hi' ? 'सामग्री' : 'items'}
                    </span>
                  </div>
                </div>

                {/* Items Summary */}
                <div className="bg-slate-50/80 rounded-xl p-2.5 text-xs text-slate-700 space-y-1 border border-slate-100">
                  {order.lines.slice(0, 3).map((l, idx) => (
                    <div key={idx} className="flex justify-between items-center text-[11px]">
                      <span className="truncate pr-2 font-medium">
                        {l.product_name}
                      </span>
                      <span className="font-bold shrink-0 text-slate-900">
                        {l.display_quantity} {l.order_unit_name}
                      </span>
                    </div>
                  ))}
                  {order.lines.length > 3 && (
                    <div className="text-[10px] text-slate-400 font-medium italic pt-0.5">
                      +{order.lines.length - 3} {language === 'hi' ? 'और सामग्री इस आदेश में' : 'more items in this order'}
                    </div>
                  )}
                </div>

                {/* Action: View Bill / Pay UPI and 1-Tap Reorder */}
                <div className="flex items-center justify-end gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => onViewBill(order)}
                    className="px-3 py-1.5 rounded-xl border border-blue-200 bg-white hover:bg-blue-50 text-[#17307A] font-extrabold text-xs transition-colors flex items-center gap-1.5 active:scale-95 shadow-2xs"
                  >
                    <Receipt className="w-3.5 h-3.5 text-[#F58220]" />
                    <span>{language === 'hi' ? 'बिल और भुगतान' : 'Pay UPI / Bill'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => onReorder(order)}
                    className="px-3.5 py-1.5 rounded-xl bg-blue-50 hover:bg-blue-100 text-[#17307A] font-extrabold text-xs border border-blue-200 transition-colors flex items-center gap-1.5 active:scale-95"
                  >
                    <RotateCcw className="w-3.5 h-3.5 text-[#F58220]" />
                    <span>{language === 'hi' ? 'पुनः ऑर्डर करें' : 'Re-Order Items'}</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
