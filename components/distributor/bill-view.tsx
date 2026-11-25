'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import QRCode from 'qrcode';
import { useLanguage } from '@/lib/i18n/context';
import { isDemoUpi } from '@/lib/services/upi-validator';
import {
  Printer,
  Share2,
  ArrowLeft,
  CheckCircle2,
  Clock,
  AlertCircle,
  Building2,
  Store,
  QrCode,
  Download,
} from 'lucide-react';

export interface BillItemLine {
  id: string;
  name: string;
  hindiName?: string | null;
  unit: string;
  quantity: number;
  ratePaise: number;
  totalPaise: number;
}

export interface BillData {
  id: string;
  billNumber: string;
  orderNumber: string;
  version?: number;
  createdAt: string;
  status: 'PAID' | 'PARTIALLY_PAID' | 'UNPAID';
  totalPaise: number;
  paidAmountPaise: number;
  upiReference?: string | null;
  upiString?: string | null;
  tenant: {
    name: string;
    ownerName: string;
    phone?: string | null;
    address?: string | null;
    gstin?: string | null;
    enableGst?: boolean;
    upiId: string;
  };
  shop: {
    name: string;
    ownerName: string;
    shopNumber: string;
    phone: string;
    address: string;
    areaName: string;
  };
  lines: BillItemLine[];
}

interface Props {
  bill: BillData;
}

export default function BillView({ bill }: Props) {
  const { language } = useLanguage();
  const [qrDataUrl, setQrDataUrl] = useState<string>('');

  const formatRupees = (paise: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 2,
    }).format(paise / 100);
  };

  // Generate UPI QR Code on mount
  useEffect(() => {
    const upiUri =
      bill.upiString ||
      `upi://pay?pa=${encodeURIComponent(bill.tenant.upiId)}&pn=${encodeURIComponent(
        bill.tenant.name
      )}&am=${(bill.totalPaise / 100).toFixed(2)}&cu=INR&tn=${encodeURIComponent(
        `Bill ${bill.billNumber}`
      )}&tr=${encodeURIComponent(bill.upiReference || bill.billNumber)}`;

    QRCode.toDataURL(upiUri, {
      width: 240,
      margin: 1.5,
      color: {
        dark: '#17307A',
        light: '#FFFFFF',
      },
    })
      .then((url) => setQrDataUrl(url))
      .catch((err) => console.error('QR generation error:', err));
  }, [bill]);

  const handlePrint = () => {
    window.print();
  };

  const handleShare = () => {
    if (navigator.share) {
      navigator
        .share({
          title: `Bill ${bill.billNumber} - ${bill.tenant.name}`,
          text: `Wholesale Bill ${bill.billNumber} for ${bill.shop.name}: Total ${formatRupees(
            bill.totalPaise
          )}. UPI Pay: ${bill.tenant.upiId}`,
          url: window.location.href,
        })
        .catch(() => {});
    } else {
      navigator.clipboard.writeText(window.location.href);
      alert(language === 'hi' ? 'बिल लिंक कॉपी कर लिया गया है।' : 'Bill link copied to clipboard.');
    }
  };

  const subtotalPaise = bill.lines.reduce((acc, l) => acc + l.totalPaise, 0);
  const remainingDuePaise = Math.max(0, bill.totalPaise - bill.paidAmountPaise);

  return (
    <div className="max-w-4xl mx-auto space-y-4 sm:space-y-6">
      {/* Top Actions Bar (Hidden during Print) */}
      <div className="flex items-center justify-between gap-3 print:hidden">
        <Link
          href="/d/orders"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-[#17307A] transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5 text-[#17307A]" />
          <span>{language === 'hi' ? 'ऑर्डर सूची' : 'Back to Orders'}</span>
        </Link>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleShare}
            className="px-3 py-1.5 rounded-lg border border-slate-300 text-slate-700 font-medium text-xs hover:bg-slate-50 transition-colors shadow-2xs flex items-center justify-center gap-1.5 cursor-pointer"
          >
            <Share2 className="w-3.5 h-3.5 text-slate-500" />
            <span>{language === 'hi' ? 'शेयर करें' : 'Share Bill'}</span>
          </button>

          <button
            type="button"
            onClick={handlePrint}
            className="px-3.5 py-1.5 rounded-lg bg-[#17307A] hover:bg-[#11235A] active:scale-95 text-white font-semibold text-xs shadow-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer"
          >
            <Printer className="w-3.5 h-3.5 text-white" />
            <span>{language === 'hi' ? 'प्रिंट करें' : 'Print Bill'}</span>
          </button>
        </div>
      </div>

      {/* Main Printable Bill Canvas */}
      <div className="bg-white rounded-2xl sm:rounded-3xl border border-slate-200/90 shadow-sm p-4 sm:p-10 space-y-4 sm:space-y-8 print:p-0 print:border-none print:shadow-none font-sans">
        {/* Header: Distributor Info & Bill Tag */}
        <div className="flex flex-col sm:flex-row justify-between items-start gap-3 sm:gap-4 pb-4 sm:pb-6 border-b border-slate-200">
          <div className="space-y-1">
            <div className="flex items-center gap-2 sm:gap-2.5">
              <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg sm:rounded-xl bg-[#17307A] text-white font-extrabold flex items-center justify-center text-sm sm:text-lg shadow-2xs print:border print:border-slate-800">
                V
              </div>
              <div>
                <h1 className="text-base sm:text-2xl font-serif font-black text-[#17307A] tracking-tight">
                  {bill.tenant.name}
                </h1>
                <p className="text-[11px] sm:text-xs text-slate-500">
                  Wholesale FMCG &amp; Grain Distribution Hub â€¢ Ratlam
                </p>
              </div>
            </div>
            <p className="text-[11px] sm:text-xs text-slate-600 max-w-md pt-0.5">
              {bill.tenant.address} â€¢ Phone: +91 {bill.tenant.phone}
            </p>
            {bill.tenant.enableGst && bill.tenant.gstin && (
              <p className="text-[10px] sm:text-xs font-mono font-semibold text-slate-700">
                GSTIN: {bill.tenant.gstin}
              </p>
            )}
          </div>

          <div className="text-left sm:text-right space-y-0.5 sm:space-y-1 w-full sm:w-auto">
            <span className="inline-block px-2.5 py-0.5 sm:px-3 sm:py-1 rounded-full bg-blue-50 text-[#17307A] border border-blue-200 text-[10px] sm:text-xs font-bold uppercase tracking-wider">
              {bill.tenant.enableGst
                ? (language === 'hi' ? 'कर चालान' : 'Tax Invoice')
                : (language === 'hi' ? 'थोक बिल' : 'Bill')}
            </span>
            <div className="text-base sm:text-lg font-mono font-black text-slate-900 tracking-tight pt-0.5">
              {bill.billNumber}
            </div>
            <div className="text-[11px] sm:text-xs text-slate-500">
              {language === 'hi' ? 'तारीख' : 'Date'}:{' '}
              {new Date(bill.createdAt).toLocaleDateString('en-IN', {
                year: 'numeric',
                month: 'short',
                day: 'numeric',
              })}
            </div>
            <div className="text-[11px] sm:text-xs text-slate-500">
              {language === 'hi' ? 'ऑर्डर' : 'Order'}: <span className="font-mono">{bill.orderNumber}</span>
            </div>
          </div>
        </div>

        {/* Bill To & Status Strip */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-6 bg-slate-50/70 p-3 sm:p-5 rounded-xl sm:rounded-2xl border border-slate-200/80">
          <div className="space-y-1 text-xs">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
              {language === 'hi' ? 'दुकानदार का विवरण' : 'Billed To'}
            </span>
            <div className="text-base font-bold text-slate-900 flex items-center gap-1.5">
              <Store className="w-4 h-4 text-slate-500" />
              <span>{bill.shop.name}</span>
            </div>
            <div className="text-slate-600">
              {language === 'hi' ? 'मालिक:' : 'Prop:'} <strong className="text-slate-800">{bill.shop.ownerName}</strong> ({bill.shop.shopNumber})
            </div>
            <div className="text-slate-500">{language === 'hi' ? 'बाज़ार क्षेत्र:' : 'Area:'} {bill.shop.areaName} • Ratlam</div>
            <div className="text-slate-500">{language === 'hi' ? 'फोन:' : 'Phone:'} +91 {bill.shop.phone}</div>
          </div>

          <div className="space-y-2 text-xs sm:text-right flex flex-col sm:items-end justify-between">
            <div>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                {language === 'hi' ? 'भुगतान स्थिति' : 'Payment Status'}
              </span>
              <div className="pt-1">
                {bill.status === 'PAID' ? (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 text-emerald-700 text-xs font-bold border border-emerald-200">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>{language === 'hi' ? 'पूर्ण भुगतान' : 'PAID IN FULL'}</span>
                  </span>
                ) : bill.status === 'PARTIALLY_PAID' ? (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-50 text-amber-800 text-xs font-bold border border-amber-200">
                    <Clock className="w-3.5 h-3.5" />
                    <span>{language === 'hi' ? 'आंशिक भुगतान' : 'PARTIALLY PAID'}</span>
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-rose-50 text-rose-700 text-xs font-bold border border-rose-200">
                    <AlertCircle className="w-3.5 h-3.5" />
                    <span>{language === 'hi' ? 'बकाया भुगतान' : 'PAYMENT DUE'}</span>
                  </span>
                )}
              </div>
            </div>

            <div className="text-xs text-slate-500">
              Settlement UPI: <span className="font-mono font-bold text-slate-700">{bill.tenant.upiId}</span>
            </div>
          </div>
        </div>

        {/* Itemised Lines Table (Desktop Table & Mobile Friendly) */}
        <div className="space-y-2">
          <div className="overflow-x-auto rounded-2xl border border-slate-200">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#17307A] text-white uppercase text-[10px] font-bold tracking-wider">
                <tr>
                  <th className="p-3 w-12 text-center">#</th>
                  <th className="p-3">{language === 'hi' ? 'वस्तु का नाम' : 'Item Description'}</th>
                  <th className="p-3 text-center">{language === 'hi' ? 'इकाई' : 'Unit'}</th>
                  <th className="p-3 text-center">{language === 'hi' ? 'मात्रा' : 'Qty'}</th>
                  <th className="p-3 text-right">{language === 'hi' ? 'थोक दर' : 'Rate (PTR)'}</th>
                  <th className="p-3 text-right">{language === 'hi' ? 'कुल राशि' : 'Amount'}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                {bill.lines.map((line, idx) => (
                  <tr key={line.id} className="hover:bg-slate-50/60 transition-colors">
                    <td className="p-3 text-center text-slate-400 font-mono text-[11px]">{idx + 1}</td>
                    <td className="p-3 font-semibold text-slate-900">
                      <div>{line.name}</div>
                      {line.hindiName && (
                        <div className="text-[11px] text-slate-400 font-normal">{line.hindiName}</div>
                      )}
                    </td>
                    <td className="p-3 text-center uppercase text-slate-500 text-[11px] font-bold">
                      {line.unit}
                    </td>
                    <td className="p-3 text-center font-bold text-slate-900">{line.quantity}</td>
                    <td className="p-3 text-right font-mono text-slate-600">{formatRupees(line.ratePaise)}</td>
                    <td className="p-3 text-right font-mono font-bold text-slate-900">
                      {formatRupees(line.totalPaise)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Demo UPI Warning Banner (Item 3 Compliance) */}
        {isDemoUpi(bill.tenant.upiId) && (
          <div className="p-2.5 sm:p-3.5 bg-amber-50/90 border border-amber-300 rounded-xl sm:rounded-2xl flex items-start gap-2 sm:gap-2.5 text-[11px] sm:text-xs text-amber-900 shadow-2xs">
            <AlertCircle className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-amber-700 shrink-0 mt-0.5" />
            <div>
              <strong className="block font-bold">
                {language === 'hi' ? 'डेमो भुगतान चेतावनी (परीक्षण मोड)' : 'Demo UPI Warning (Test Mode Only)'}
              </strong>
              <span className="text-amber-800">
                {language === 'hi'
                  ? `वितरक भुगतान आईडी "${bill.tenant.upiId}" केवल परीक्षण के लिए है। यह कोड वास्तविक बैंक भुगतान स्वीकार नहीं कर सकता।`
                  : `Distributor UPI ID "${bill.tenant.upiId}" is a simulated test handle. This QR code cannot process real bank settlements.`}
              </span>
            </div>
          </div>
        )}

        {/* Totals & Fixed-Amount UPI QR Section */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-8 items-start pt-3 sm:pt-4 border-t border-slate-200">
          {/* Left: Fixed-Amount UPI QR Code */}
          <div className="p-3 sm:p-5 rounded-xl sm:rounded-2xl border border-slate-200 bg-slate-50/50 flex flex-col sm:flex-row items-center gap-3 sm:gap-5">
            <div className="bg-white p-2 rounded-xl border border-slate-200/90 shadow-2xs shrink-0">
              {qrDataUrl ? (
                <img src={qrDataUrl} alt="UPI Payment QR Code" className="w-28 h-28 sm:w-36 sm:h-36 object-contain" />
              ) : (
                <div className="w-28 h-28 sm:w-36 sm:h-36 bg-slate-100 rounded-lg flex items-center justify-center text-slate-400 text-xs">
                  Loading QR...
                </div>
              )}
            </div>

            <div className="space-y-1 text-center sm:text-left">
              <div className="font-extrabold text-xs text-[#17307A] flex items-center justify-center sm:justify-start gap-1.5">
                <QrCode className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-[#17307A]" />
                <span>{language === 'hi' ? 'निश्चित राशि भुगतान कोड' : 'Fixed-Amount UPI QR'}</span>
              </div>
              <p className="text-[10px] sm:text-[11px] text-slate-500 leading-relaxed">
                {language === 'hi'
                  ? 'किसी भी भुगतान ऐप से स्कैन करके सटीक बिल राशि का तुरंत भुगतान करें।'
                  : 'Scan with any UPI application (GPay, PhonePe, Paytm). The exact bill amount is pre-filled.'}
              </p>
              <div className="pt-0.5">
                <span className="text-[10px] sm:text-[11px] font-mono font-bold text-slate-800 block">
                  VPA: {bill.tenant.upiId}
                </span>
                <span className="text-[9px] sm:text-[10px] text-slate-400 block font-mono">
                  Ref: {bill.upiReference || bill.billNumber}
                </span>
              </div>
            </div>
          </div>

          {/* Right: Totals Calculation Summary */}
          <div className="space-y-2 sm:space-y-3 bg-slate-50 p-3 sm:p-5 rounded-xl sm:rounded-2xl border border-slate-200">
            <div className="flex justify-between items-center text-xs text-slate-600">
              <span>{language === 'hi' ? 'सामान का योग' : 'Item Subtotal'}</span>
              <span className="font-mono font-semibold text-slate-900">{formatRupees(subtotalPaise)}</span>
            </div>

            <div className="flex justify-between items-center text-xs text-emerald-700">
              <span>{language === 'hi' ? 'योजना बचत' : 'Scheme Savings'}</span>
              <span className="font-mono font-bold">
                -{formatRupees(Math.max(0, subtotalPaise - bill.totalPaise))}
              </span>
            </div>

            <div className="pt-2 border-t border-slate-300 flex justify-between items-center text-sm font-black text-slate-900">
              <span className="text-base text-[#17307A] font-serif">
                {language === 'hi' ? 'कुल देय राशि' : 'Total Amount Due'}
              </span>
              <span className="text-lg font-mono font-black text-[#17307A]">
                {formatRupees(bill.totalPaise)}
              </span>
            </div>

            {bill.paidAmountPaise > 0 && (
              <div className="pt-2 border-t border-slate-200 space-y-1 text-xs">
                <div className="flex justify-between items-center text-emerald-700 font-semibold">
                  <span>{language === 'hi' ? 'प्राप्त भुगतान' : 'Amount Paid'}</span>
                  <span className="font-mono">{formatRupees(bill.paidAmountPaise)}</span>
                </div>
                <div className="flex justify-between items-center text-rose-700 font-bold">
                  <span>{language === 'hi' ? 'शेष बकाया' : 'Remaining Balance'}</span>
                  <span className="font-mono">{formatRupees(remainingDuePaise)}</span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer Terms */}
        <div className="pt-6 border-t border-slate-200 text-center text-[10px] text-slate-400 space-y-1">
          <p>
            {language === 'hi'
              ? 'यह कंप्यूटर जनरेटेड थोक इनवॉइस है। माल प्राप्त होने पर 48 घंटे के भीतर किसी भी टूट-फूट की रिपोर्ट करें।'
              : 'This is a computer generated commercial invoice. Please report any transit breakage within 48 hours.'}
          </p>
          <p className="font-semibold text-slate-500">
            {bill.tenant.name} â€¢ Krishi Upaj Mandi, Ratlam (M.P.)
          </p>
        </div>
      </div>
    </div>
  );
}
