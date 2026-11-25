'use client';

import React, { useState, useEffect } from 'react';
import QRCode from 'qrcode';
import { formatPaise } from '@/lib/money';
import { isDemoUpi } from '@/lib/services/upi-validator';
import {
  X,
  AlertCircle,
  QrCode,
  ArrowRight,
  ShieldCheck,
  Receipt,
} from 'lucide-react';

export interface HistoricalOrder {
  id: string;
  order_number: string;
  created_at: string;
  status: string;
  total_paise: number;
  subtotal_paise?: number;
  lines: {
    tenant_product_id: string;
    product_name: string;
    display_quantity: number;
    order_unit_name: string;
    price_paise: number;
  }[];
}

interface Props {
  order: HistoricalOrder;
  tenant: {
    id: string;
    name: string;
    owner_name?: string | null;
    upi_id?: string | null;
    enable_gst?: boolean;
  };
  language: 'en' | 'hi';
  onClose: () => void;
}

export default function BillModal({ order, tenant, language, onClose }: Props) {
  const [billQrDataUrl, setBillQrDataUrl] = useState<string | null>(null);

  const totalRupees = (order.total_paise / 100).toFixed(2);
  const upiId = tenant.upi_id || 'demo@invalid';
  const upiUri = `upi://pay?pa=${encodeURIComponent(upiId)}&pn=${encodeURIComponent(tenant.name)}&am=${totalRupees}&cu=INR&tn=${encodeURIComponent(`Bill ${order.order_number}`)}`;

  useEffect(() => {
    let active = true;
    QRCode.toDataURL(upiUri, {
      width: 256,
      margin: 2,
      color: { dark: '#17307A', light: '#FFFFFF' },
    })
      .then((url) => {
        if (active) setBillQrDataUrl(url);
      })
      .catch((err) => {
        console.error('QR code generation failed:', err);
      });
    return () => {
      active = false;
    };
  }, [upiUri]);

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in">
      <div className="bg-white rounded-3xl max-w-lg w-full p-5 sm:p-6 shadow-2xl border border-slate-200 space-y-4 max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-[#17307A] text-white flex items-center justify-center font-black text-sm">
              V
            </div>
            <div>
              <h3 className="font-extrabold text-sm sm:text-base text-slate-900">
                {language === 'hi' ? 'थोक बिक्री बिल एवं भुगतान' : 'Wholesale Bill & UPI Payment'}
              </h3>
              <span className="text-[11px] text-slate-500 font-mono">
                #{order.order_number}
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 flex items-center justify-center transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Scrollable Bill Content */}
        <div className="flex-1 overflow-y-auto space-y-4 pr-1 text-xs">
          {/* Distributor Settlement Banner */}
          <div className="p-3 bg-blue-50/70 border border-blue-200/80 rounded-2xl flex items-center justify-between">
            <div>
              <span className="text-[10px] font-bold text-slate-400 uppercase block">
                {language === 'hi' ? 'प्राप्तकर्ता वितरक' : 'Settlement Beneficiary'}
              </span>
              <span className="font-extrabold text-[#17307A] text-xs sm:text-sm">{tenant.name}</span>
              <span className="text-[11px] font-mono text-slate-600 block mt-0.5">UPI: {upiId}</span>
            </div>
            <div className="text-right">
              <span className="text-[10px] font-bold text-slate-400 uppercase block">
                {language === 'hi' ? 'कुल बिल राशि' : 'Order Total'}
              </span>
              <span className="font-black text-sm sm:text-base text-[#17307A] font-mono">
                {formatPaise(order.total_paise)}
              </span>
            </div>
          </div>

          {/* Demo UPI Warning Banner */}
          {isDemoUpi(upiId) && (
            <div className="p-3 bg-amber-50 border border-amber-300 rounded-xl flex items-start gap-2 text-xs text-amber-900">
              <AlertCircle className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
              <div>
                <strong className="block font-bold">
                  {language === 'hi' ? 'डेमो खाता चेतावनी (परीक्षण मोड)' : 'Demo UPI Warning (Test Mode Only)'}
                </strong>
                <span className="text-amber-800 text-[11px]">
                  {language === 'hi'
                    ? `वितरक आईडी "${upiId}" केवल परीक्षण हेतु है। इससे वास्तविक भुगतान नहीं किया जा सकता।`
                    : `Settlement UPI ID "${upiId}" is a demo handle. This QR is for demonstration testing only and cannot accept real funds.`}
                </span>
              </div>
            </div>
          )}

          {/* Itemized Line Items Table */}
          <div className="border border-slate-200 rounded-2xl overflow-hidden">
            <div className="bg-slate-50 px-3.5 py-2 border-b border-slate-200 font-bold text-slate-700 flex justify-between">
              <span>{language === 'hi' ? 'सामग्री एवं मात्रा' : 'Item & Quantity'}</span>
              <span>{language === 'hi' ? 'मूल्य' : 'Amount'}</span>
            </div>
            <div className="divide-y divide-slate-100">
              {order.lines.map((line, idx) => (
                <div key={idx} className="px-3.5 py-2.5 flex items-center justify-between">
                  <div>
                    <span className="font-semibold text-slate-800 block">{line.product_name}</span>
                    <span className="text-[11px] text-slate-500">
                      {line.display_quantity} {line.order_unit_name}
                    </span>
                  </div>
                  <span className="font-mono font-bold text-slate-700">
                    {formatPaise(line.price_paise * line.display_quantity)}
                  </span>
                </div>
              ))}
            </div>
            <div className="bg-slate-50/80 px-3.5 py-2.5 border-t border-slate-200 flex justify-between font-extrabold text-slate-900">
              <span>{language === 'hi' ? 'देय कुल राशि' : 'Bill Total'}</span>
              <span className="font-mono text-sm text-[#17307A]">{formatPaise(order.total_paise)}</span>
            </div>
          </div>

          {/* Interactive QR Code & Deep Link Section */}
          <div className="p-4 bg-gradient-to-br from-slate-50 to-blue-50/40 rounded-2xl border border-slate-200 text-center space-y-3">
            <div className="flex items-center justify-center gap-1.5 text-xs font-bold text-slate-700">
              <QrCode className="w-4 h-4 text-[#F58220]" />
              <span>{language === 'hi' ? 'स्कैन कर यूपीआई से भुगतान करें' : 'Scan to Pay with Any UPI App'}</span>
            </div>

            {billQrDataUrl ? (
              <div className="inline-block p-3 bg-white rounded-2xl shadow-md border border-slate-200">
                <img
                  src={billQrDataUrl}
                  alt={`UPI QR for Bill ${order.order_number}`}
                  className="w-48 h-48 mx-auto object-contain"
                />
              </div>
            ) : (
              <div className="w-48 h-48 mx-auto bg-slate-100 rounded-2xl flex items-center justify-center text-slate-400 font-mono text-xs">
                {language === 'hi' ? 'क्यूआर कोड बन रहा है...' : 'Generating QR...'}
              </div>
            )}

            <div className="space-y-1">
              <span className="text-[11px] text-slate-500 block">
                {language === 'hi' ? 'फोनपे, गूगल पे, पेटीएम या भीम से स्कैन करें' : 'PhonePe • Google Pay • Paytm • BHIM'}
              </span>
              <span className="text-[10px] text-slate-400 font-mono block">
                {upiId}
              </span>
            </div>

            {/* Direct Pay Now Deep Link */}
            <div className="pt-2">
              <a
                href={upiUri}
                className="w-full py-3 px-4 rounded-xl bg-[#17307A] hover:bg-[#11235A] active:scale-[0.99] text-white font-extrabold text-xs shadow-md shadow-blue-950/20 flex items-center justify-center gap-2 transition-all"
              >
                <span>{language === 'hi' ? 'सीधे यूपीआई ऐप खोलें' : 'Pay Now via UPI App'}</span>
                <ArrowRight className="w-4 h-4 text-[#F58220]" />
              </a>
              <span className="block text-[10px] text-slate-400 mt-1.5">
                {language === 'hi'
                  ? '* भुगतान की पुष्टि वितरक द्वारा बैंक एसएमएस मिलान के उपरांत की जाती है।'
                  : '* Payment is confirmed by distributor upon bank SMS verification.'}
              </span>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
          <span className="flex items-center gap-1 font-medium">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
            <span>{language === 'hi' ? 'डायरेक्ट वितरक खाता' : 'Direct Distributor Settlement'}</span>
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold transition-colors"
          >
            {language === 'hi' ? 'बंद करें' : 'Close'}
          </button>
        </div>
      </div>
    </div>
  );
}
