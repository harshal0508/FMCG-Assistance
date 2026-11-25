'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  Store,
  ArrowLeft,
  DollarSign,
  AlertTriangle,
  Lock,
  Unlock,
  PlusCircle,
  FileText,
  CreditCard,
  CheckCircle2,
  AlertCircle,
  ShieldAlert,
  ArrowUpRight,
  ArrowDownLeft,
  Calendar,
  Receipt
} from 'lucide-react';
import { useTranslation } from '@/lib/i18n/context';
import { PinUnlockModal } from './pin-unlock-modal';

interface LedgerEntryItem {
  id: string;
  type: string;
  amountPaise: number;
  runningBalancePaise: number;
  referenceId: string | null;
  description: string;
  createdAt: string;
}

interface ShopDetails {
  id: string;
  name: string;
  shopNumber: string;
  ownerName: string;
  phone: string;
  address: string;
  creditLimitPaise: number;
  holdFlag: boolean;
  area: { id: string; name: string } | null;
  rateGroup: { id: string; name: string } | null;
}

interface LedgerSummary {
  currentDuePaise: number;
  creditLimitPaise: number;
  totalDebitsPaise: number;
  totalCreditsPaise: number;
  isOverLimit: boolean;
  isHold: boolean;
  entriesCount: number;
}

export function ShopLedgerView({ shopId }: { shopId: string }) {
  const { language } = useTranslation();
  const [loading, setLoading] = useState(true);
  const [shop, setShop] = useState<ShopDetails | null>(null);
  const [summary, setSummary] = useState<LedgerSummary | null>(null);
  const [entries, setEntries] = useState<LedgerEntryItem[]>([]);
  
  // Modals state
  const [isCashModalOpen, setIsCashModalOpen] = useState(false);
  const [cashAmount, setCashAmount] = useState('');
  const [cashNotes, setCashNotes] = useState('');
  const [cashReceipt, setCashReceipt] = useState('');

  const [isOpeningModalOpen, setIsOpeningModalOpen] = useState(false);
  const [openingAmount, setOpeningAmount] = useState('');
  const [openingDesc, setOpeningDesc] = useState('');

  const [isCreditLimitModalOpen, setIsCreditLimitModalOpen] = useState(false);
  const [newCreditLimit, setNewCreditLimit] = useState('');

  // PIN modal
  const [isPinModalOpen, setIsPinModalOpen] = useState(false);
  const [pendingAction, setPendingAction] = useState<(() => Promise<void>) | null>(null);
  const [actionTitle, setActionTitle] = useState('');
  const [actionSubtitle, setActionSubtitle] = useState('');

  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  useEffect(() => {
    fetchLedgerData();
  }, [shopId]);

  const fetchLedgerData = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/distributor/shops/${shopId}/ledger`);
      if (res.ok) {
        const data = await res.json();
        setShop(data.shop);
        setSummary(data.summary);
        setEntries(data.entries || []);
      }
    } catch (err) {
      console.error('Failed to load shop ledger:', err);
    } finally {
      setLoading(false);
    }
  };

  const requestPinAuthorizedAction = (title: string, subtitle: string, action: () => Promise<void>) => {
    setActionTitle(title);
    setActionSubtitle(subtitle);
    setPendingAction(() => action);
    setIsPinModalOpen(true);
  };

  const handleToggleHold = async () => {
    if (!shop) return;
    try {
      const res = await fetch(`/api/distributor/shops/${shopId}/ledger`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'TOGGLE_HOLD', holdFlag: !shop.holdFlag }),
      });
      if (res.ok) {
        setSuccessMessage(
          !shop.holdFlag
            ? language === 'hi'
              ? 'दुकान पर उधारी रोक लगा दी गई है। नए ऑर्डर रोक दिए गए हैं।'
              : 'Shop placed on Order Hold. New orders blocked.'
            : language === 'hi'
            ? 'उधारी रोक हटा दी गई है। दुकान सामान्य रूप से ऑर्डर दे सकती है।'
            : 'Order Hold released. Shop can place orders normally.'
        );
        fetchLedgerData();
      }
    } catch {
      setErrorMessage('Failed to update hold status');
    }
  };

  const handleRecordCash = async (pin?: string) => {
    const val = parseFloat(cashAmount);
    if (isNaN(val) || val <= 0) {
      setErrorMessage(language === 'hi' ? 'मान्य नकद राशि दर्ज करें।' : 'Please enter a valid amount.');
      return;
    }

    try {
      const payload: any = {
        action: 'CASH_PAYMENT',
        amountPaise: Math.round(val * 100),
        notes: cashNotes,
        receiptNumber: cashReceipt,
      };
      if (pin) payload.pin = pin;

      const res = await fetch(`/api/distributor/shops/${shopId}/ledger`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to record cash');

      setSuccessMessage(
        language === 'hi'
          ? 'नकद भुगतान सफलतापूर्वक दर्ज किया गया।'
          : 'Cash payment recorded successfully.'
      );
      setIsCashModalOpen(false);
      setCashAmount('');
      setCashNotes('');
      setCashReceipt('');
      fetchLedgerData();
    } catch (err: any) {
      setErrorMessage(err.message || 'Error recording cash');
    }
  };

  const handleAddOpeningBalance = async (pin?: string) => {
    const val = parseFloat(openingAmount);
    if (isNaN(val) || val === 0) {
      setErrorMessage(language === 'hi' ? 'मान्य राशि दर्ज करें।' : 'Please enter a valid amount.');
      return;
    }

    try {
      const payload: any = {
        action: 'OPENING_BALANCE',
        amountPaise: Math.round(val * 100),
        description: openingDesc,
      };
      if (pin) payload.pin = pin;

      const res = await fetch(`/api/distributor/shops/${shopId}/ledger`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to record opening balance');

      setSuccessMessage(
        language === 'hi'
          ? 'प्रारंभिक शेष सफलतापूर्वक दर्ज किया गया।'
          : 'Opening balance recorded successfully.'
      );
      setIsOpeningModalOpen(false);
      setOpeningAmount('');
      setOpeningDesc('');
      fetchLedgerData();
    } catch (err: any) {
      setErrorMessage(err.message || 'Error recording opening balance');
    }
  };

  const handleUpdateCreditLimit = async () => {
    const val = parseFloat(newCreditLimit);
    if (isNaN(val) || val < 0) {
      setErrorMessage(language === 'hi' ? 'मान्य क्रेडिट सीमा दर्ज करें।' : 'Please enter a valid limit.');
      return;
    }

    try {
      const res = await fetch(`/api/distributor/shops/${shopId}/ledger`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'UPDATE_CREDIT_LIMIT',
          creditLimitPaise: Math.round(val * 100),
        }),
      });

      if (!res.ok) throw new Error('Failed to update limit');

      setSuccessMessage(language === 'hi' ? 'क्रेडिट सीमा अपडेट की गई।' : 'Credit limit updated.');
      setIsCreditLimitModalOpen(false);
      fetchLedgerData();
    } catch (err: any) {
      setErrorMessage(err.message || 'Error updating limit');
    }
  };

  if (loading) {
    return (
      <div className="p-12 text-center text-slate-500 text-sm">
        <div className="w-8 h-8 border-4 border-[#17307A] border-t-transparent rounded-full animate-spin mx-auto mb-3" />
        <div>{language === 'hi' ? 'खाता बही लोड हो रहा है...' : 'Loading shop ledger...'}</div>
      </div>
    );
  }

  if (!shop || !summary) {
    return (
      <div className="p-8 text-center text-rose-600 bg-rose-50 rounded-2xl">
        {language === 'hi' ? 'दुकान नहीं मिली।' : 'Shop not found.'}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Top Navigation & Breadcrumb */}
      <div className="flex items-center gap-3 text-xs text-slate-500">
        <Link href="/d/shops" className="hover:text-[#17307A] flex items-center gap-1 font-semibold">
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>{language === 'hi' ? 'सभी दुकानें' : 'All Shops'}</span>
        </Link>
        <span>/</span>
        <span className="font-bold text-slate-800">{shop.name}</span>
        <span>/</span>
        <span>{language === 'hi' ? 'खाता बही' : 'Credit Ledger'}</span>
      </div>

      {/* Shop Header Card */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-5">
        <div className="flex items-start gap-3.5">
          <div className="w-12 h-12 rounded-xl bg-blue-50 text-[#17307A] font-bold text-xl flex items-center justify-center shrink-0 border border-blue-100">
            <Store className="w-6 h-6" />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-xl font-bold text-slate-900">{shop.name}</h1>
              <span className="px-2.5 py-0.5 rounded-md bg-slate-100 text-slate-700 text-xs font-mono font-bold">
                {shop.shopNumber}
              </span>
              {shop.holdFlag ? (
                <span className="px-2.5 py-0.5 rounded-md bg-rose-100 text-rose-800 text-xs font-bold flex items-center gap-1">
                  <Lock className="w-3 h-3" />
                  <span>{language === 'hi' ? 'ऑर्डर होल्ड' : 'HOLD ACTIVE'}</span>
                </span>
              ) : (
                <span className="px-2.5 py-0.5 rounded-md bg-emerald-100 text-emerald-800 text-xs font-bold flex items-center gap-1">
                  <Unlock className="w-3 h-3" />
                  <span>{language === 'hi' ? 'सक्रिय' : 'ACTIVE'}</span>
                </span>
              )}
            </div>
            <div className="text-xs text-slate-500 mt-1 flex flex-wrap gap-x-4 gap-y-1">
              <span>{shop.ownerName}</span>
              <span>•</span>
              <span>{shop.phone}</span>
              {shop.area && (
                <>
                  <span>•</span>
                  <span>{shop.area.name}</span>
                </>
              )}
              {shop.rateGroup && (
                <>
                  <span>•</span>
                  <span className="text-[#17307A] font-semibold">{shop.rateGroup.name}</span>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Cash Payment Button */}
          <button
            onClick={() => {
              setCashAmount('');
              setCashNotes('');
              setCashReceipt('');
              setIsCashModalOpen(true);
            }}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-xs transition-colors cursor-pointer"
          >
            <PlusCircle className="w-4 h-4" />
            <span>{language === 'hi' ? '+ नकद भुगतान' : '+ Cash Payment'}</span>
          </button>

          {/* Opening Balance Button */}
          <button
            onClick={() => {
              setOpeningAmount('');
              setOpeningDesc('');
              setIsOpeningModalOpen(true);
            }}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-slate-300 hover:bg-slate-50 text-slate-700 font-semibold text-xs transition-colors cursor-pointer"
          >
            <Receipt className="w-4 h-4 text-slate-500" />
            <span>{language === 'hi' ? 'प्रारंभिक शेष' : 'Opening Balance'}</span>
          </button>

          {/* Hold Orders Toggle */}
          <button
            onClick={handleToggleHold}
            className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl font-bold text-xs transition-colors cursor-pointer border ${
              shop.holdFlag
                ? 'bg-emerald-50 text-emerald-700 border-emerald-300 hover:bg-emerald-100'
                : 'bg-rose-50 text-rose-700 border-rose-300 hover:bg-rose-100'
            }`}
          >
            {shop.holdFlag ? (
              <>
                <Unlock className="w-4 h-4" />
                <span>{language === 'hi' ? 'रोक हटाएं' : 'Release Hold'}</span>
              </>
            ) : (
              <>
                <Lock className="w-4 h-4" />
                <span>{language === 'hi' ? 'ऑर्डर रोकें' : 'Hold Orders'}</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Credit Limit Exceeded Warning Alert Banner */}
      {summary.isOverLimit && (
        <div className="p-4 rounded-2xl bg-amber-50 border-2 border-amber-300 text-amber-900 flex items-start gap-3.5 shadow-xs animate-in fade-in">
          <ShieldAlert className="w-6 h-6 text-amber-600 shrink-0 mt-0.5" />
          <div className="flex-1">
            <div className="font-bold text-sm">
              {language === 'hi'
                ? 'चेतावनी: उधारी सीमा पार हो चुकी है!'
                : 'Warning: Credit Limit Exceeded!'}
            </div>
            <div className="text-xs text-amber-800 mt-1">
              {language === 'hi'
                ? `इस दुकान का वर्तमान बकाया ₹${(summary.currentDuePaise / 100).toFixed(2)} है, जो निर्धारित क्रेडिट सीमा ₹${(summary.creditLimitPaise / 100).toFixed(2)} से अधिक है। यदि आवश्यक हो तो ऑर्डर होल्ड टॉगल करें।`
                : `Current outstanding ₹${(summary.currentDuePaise / 100).toFixed(2)} exceeds the authorized credit limit of ₹${(summary.creditLimitPaise / 100).toFixed(2)}.`}
            </div>
          </div>
          <button
            onClick={() => {
              setNewCreditLimit((summary.creditLimitPaise / 100).toFixed(0));
              setIsCreditLimitModalOpen(true);
            }}
            className="px-3 py-1.5 rounded-lg bg-amber-200 hover:bg-amber-300 text-amber-900 text-xs font-bold shrink-0 transition-colors cursor-pointer"
          >
            {language === 'hi' ? 'सीमा बढ़ाएं' : 'Adjust Limit'}
          </button>
        </div>
      )}

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

      {/* Financial Summary KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Current Due / Running Balance */}
        <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs">
          <span className="text-xs text-slate-500 font-medium block">
            {language === 'hi' ? 'कुल बकाया राशि' : 'Current Balance'}
          </span>
          <div
            className={`text-xl sm:text-2xl font-bold mt-1 ${
              summary.currentDuePaise > summary.creditLimitPaise
                ? 'text-rose-600'
                : summary.currentDuePaise > 0
                ? 'text-[#17307A]'
                : 'text-emerald-600'
            }`}
          >
            ₹{(summary.currentDuePaise / 100).toFixed(2)}
          </div>
          <span className="text-[11px] text-slate-400 mt-1 block">
            {summary.currentDuePaise > 0
              ? language === 'hi'
                ? 'दुकानदार से लेना बाकी'
                : 'Receivable from shop'
              : language === 'hi'
              ? 'खाता चुकता / अग्रिम'
              : 'Zero due / Advance credit'}
          </span>
        </div>

        {/* Credit Limit */}
        <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-500 font-medium">
              {language === 'hi' ? 'क्रेडिट सीमा' : 'Credit Limit'}
            </span>
            <button
              onClick={() => {
                setNewCreditLimit((summary.creditLimitPaise / 100).toFixed(0));
                setIsCreditLimitModalOpen(true);
              }}
              className="text-[#17307A] text-[11px] font-bold hover:underline"
            >
              {language === 'hi' ? 'संपादित' : 'Edit'}
            </button>
          </div>
          <div className="text-xl sm:text-2xl font-bold text-slate-800 mt-1">
            ₹{(summary.creditLimitPaise / 100).toFixed(2)}
          </div>
          <span className="text-[11px] text-slate-400 mt-1 block">
            {language === 'hi' ? 'चेतावनी सीमा' : 'Warning threshold'}
          </span>
        </div>

        {/* Total Billed (Debits) */}
        <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs">
          <span className="text-xs text-slate-500 font-medium block flex items-center gap-1">
            <ArrowUpRight className="w-3.5 h-3.5 text-rose-500" />
            <span>{language === 'hi' ? 'कुल नामे राशि' : 'Total Debits (Billed)'}</span>
          </span>
          <div className="text-xl sm:text-2xl font-bold text-slate-800 mt-1">
            ₹{(summary.totalDebitsPaise / 100).toFixed(2)}
          </div>
          <span className="text-[11px] text-slate-400 mt-1 block">
            {language === 'hi' ? 'बिल एवं समायोजन' : 'Bills & opening dues'}
          </span>
        </div>

        {/* Total Payments (Credits) */}
        <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs">
          <span className="text-xs text-slate-500 font-medium block flex items-center gap-1">
            <ArrowDownLeft className="w-3.5 h-3.5 text-emerald-500" />
            <span>{language === 'hi' ? 'कुल जमा राशि' : 'Total Payments (Credits)'}</span>
          </span>
          <div className="text-xl sm:text-2xl font-bold text-emerald-700 mt-1">
            ₹{(summary.totalCreditsPaise / 100).toFixed(2)}
          </div>
          <span className="text-[11px] text-slate-400 mt-1 block">
            {language === 'hi' ? 'प्राप्त डिजिटल व नकद भुगतान' : 'UPI & cash received'}
          </span>
        </div>
      </div>

      {/* Append-Only Ledger Entries Table */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-slate-200">
          <div>
            <h3 className="font-bold text-slate-900 text-base flex items-center gap-2">
              <FileText className="w-5 h-5 text-[#17307A]" />
              <span>{language === 'hi' ? 'खाता विवरण व रनिंग बैलेंस' : 'Append-Only Ledger Statement'}</span>
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              {language === 'hi'
                ? 'सभी बिल, भुगतान और समायोजन की संपूर्ण सूची एवं प्रत्येक लेनदेन के बाद का शेष।'
                : 'Chronological append-only transactions with running balances computed from database truth.'}
            </p>
          </div>
          <span className="text-xs font-semibold text-slate-500">
            {entries.length} {language === 'hi' ? 'प्रविष्टियाँ' : 'Transactions'}
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-600 font-bold uppercase tracking-wider text-[10px] border-b border-slate-200">
              <tr>
                <th className="p-3">{language === 'hi' ? 'दिनांक' : 'Date'}</th>
                <th className="p-3">{language === 'hi' ? 'प्रकार' : 'Type'}</th>
                <th className="p-3">{language === 'hi' ? 'विवरण' : 'Description / Ref'}</th>
                <th className="p-3 text-right">{language === 'hi' ? 'नामे (+)' : 'Debit (+)'}</th>
                <th className="p-3 text-right">{language === 'hi' ? 'जमा (-)' : 'Credit (-)'}</th>
                <th className="p-3 text-right">{language === 'hi' ? 'कुल शेष' : 'Running Balance'}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {entries.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-slate-400">
                    {language === 'hi' ? 'इस दुकान का कोई खाता लेनदेन नहीं है।' : 'No transactions recorded yet.'}
                  </td>
                </tr>
              ) : (
                entries.map((entry) => {
                  const isDebit = entry.amountPaise > 0;
                  const isCredit = entry.amountPaise < 0;

                  return (
                    <tr key={entry.id} className="hover:bg-slate-50/60 transition-colors">
                      <td className="p-3 font-medium text-slate-600 whitespace-nowrap">
                        {new Date(entry.createdAt).toLocaleDateString('en-IN', {
                          day: '2-digit',
                          month: 'short',
                          year: 'numeric',
                        })}
                      </td>
                      <td className="p-3 whitespace-nowrap">
                        <span
                          className={`px-2 py-0.5 rounded font-bold text-[10px] ${
                            entry.type === 'BILL'
                              ? 'bg-rose-50 text-rose-700 border border-rose-200'
                              : entry.type === 'PAYMENT'
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : entry.type === 'OPENING_BALANCE'
                              ? 'bg-blue-50 text-[#17307A] border border-blue-200'
                              : 'bg-amber-50 text-amber-800 border border-amber-200'
                          }`}
                        >
                          {entry.type}
                        </span>
                      </td>
                      <td className="p-3 text-slate-700 font-medium">
                        {entry.description}
                      </td>
                      <td className="p-3 text-right font-semibold text-rose-600 whitespace-nowrap">
                        {isDebit ? `₹${(entry.amountPaise / 100).toFixed(2)}` : '—'}
                      </td>
                      <td className="p-3 text-right font-semibold text-emerald-600 whitespace-nowrap">
                        {isCredit ? `₹${(Math.abs(entry.amountPaise) / 100).toFixed(2)}` : '—'}
                      </td>
                      <td className="p-3 text-right font-bold text-slate-900 whitespace-nowrap">
                        ₹{(entry.runningBalancePaise / 100).toFixed(2)}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Record Cash Modal */}
      {isCashModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-5 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                <PlusCircle className="w-4 h-4 text-emerald-600" />
                <span>{language === 'hi' ? 'नकद भुगतान दर्ज करें' : 'Record Direct Cash Payment'}</span>
              </h3>
              <button onClick={() => setIsCashModalOpen(false)} className="text-slate-400 hover:text-slate-700 font-bold">
                ✕
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="font-semibold text-slate-700 block mb-1">
                  {language === 'hi' ? 'प्राप्त नकद राशि (₹):' : 'Cash Amount (₹):'}
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={cashAmount}
                  onChange={(e) => setCashAmount(e.target.value)}
                  placeholder="0.00"
                  className="w-full p-2.5 rounded-xl border border-slate-300 font-bold text-sm"
                />
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">
                  {language === 'hi' ? 'रसीद संख्या (वैकल्पिक):' : 'Receipt # (Optional):'}
                </label>
                <input
                  type="text"
                  value={cashReceipt}
                  onChange={(e) => setCashReceipt(e.target.value)}
                  placeholder="e.g. REC-1049"
                  className="w-full p-2.5 rounded-xl border border-slate-300 font-medium"
                />
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">
                  {language === 'hi' ? 'टिप्पणी / विवरण:' : 'Notes / Description:'}
                </label>
                <input
                  type="text"
                  value={cashNotes}
                  onChange={(e) => setCashNotes(e.target.value)}
                  placeholder="e.g. Counter cash collected by owner"
                  className="w-full p-2.5 rounded-xl border border-slate-300 font-medium"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-200">
              <button
                onClick={() => setIsCashModalOpen(false)}
                className="px-4 py-2 rounded-xl border border-slate-300 text-xs font-semibold text-slate-600"
              >
                {language === 'hi' ? 'रद्द करें' : 'Cancel'}
              </button>
              <button
                disabled={!cashAmount || parseFloat(cashAmount) <= 0}
                onClick={() => {
                  requestPinAuthorizedAction(
                    language === 'hi' ? 'नकद भुगतान पुष्टि' : 'Authorize Cash Entry',
                    language === 'hi' ? 'सुरक्षा पिन दर्ज करें' : 'Enter 6-digit PIN',
                    () => handleRecordCash()
                  );
                }}
                className={`px-5 py-2 rounded-xl text-xs font-bold text-white ${
                  !cashAmount || parseFloat(cashAmount) <= 0
                    ? 'bg-slate-300 cursor-not-allowed'
                    : 'bg-emerald-600 hover:bg-emerald-700'
                }`}
              >
                {language === 'hi' ? 'पुष्टि करें' : 'Record Cash'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Opening Balance Modal */}
      {isOpeningModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-5 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <h3 className="font-bold text-slate-900 text-sm">
                {language === 'hi' ? 'प्रारंभिक शेष दर्ज करें' : 'Record Opening Balance'}
              </h3>
              <button onClick={() => setIsOpeningModalOpen(false)} className="text-slate-400 hover:text-slate-700 font-bold">
                ✕
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="font-semibold text-slate-700 block mb-1">
                  {language === 'hi' ? 'प्रारंभिक बकाया राशि (₹) (धनात्मक = उधारी, ऋणात्मक = अग्रिम):' : 'Amount (₹) (Positive = Due, Negative = Advance):'}
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={openingAmount}
                  onChange={(e) => setOpeningAmount(e.target.value)}
                  placeholder="e.g. 1500.00"
                  className="w-full p-2.5 rounded-xl border border-slate-300 font-bold text-sm"
                />
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">
                  {language === 'hi' ? 'विवरण:' : 'Description:'}
                </label>
                <input
                  type="text"
                  value={openingDesc}
                  onChange={(e) => setOpeningDesc(e.target.value)}
                  placeholder="e.g. Previous manual ledger balance"
                  className="w-full p-2.5 rounded-xl border border-slate-300 font-medium"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-200">
              <button
                onClick={() => setIsOpeningModalOpen(false)}
                className="px-4 py-2 rounded-xl border border-slate-300 text-xs font-semibold text-slate-600"
              >
                {language === 'hi' ? 'रद्द करें' : 'Cancel'}
              </button>
              <button
                disabled={!openingAmount}
                onClick={() => {
                  requestPinAuthorizedAction(
                    language === 'hi' ? 'प्रारंभिक शेष पुष्टि' : 'Authorize Opening Balance',
                    language === 'hi' ? 'सुरक्षा पिन दर्ज करें' : 'Enter 6-digit PIN',
                    () => handleAddOpeningBalance()
                  );
                }}
                className={`px-5 py-2 rounded-xl text-xs font-bold text-white ${
                  !openingAmount ? 'bg-slate-300 cursor-not-allowed' : 'bg-[#17307A] hover:bg-[#17307A]/90'
                }`}
              >
                {language === 'hi' ? 'दर्ज करें' : 'Save Balance'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Credit Limit Modal */}
      {isCreditLimitModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-5 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <h3 className="font-bold text-slate-900 text-sm">
                {language === 'hi' ? 'क्रेडिट सीमा संशोधित करें' : 'Adjust Credit Limit'}
              </h3>
              <button onClick={() => setIsCreditLimitModalOpen(false)} className="text-slate-400 hover:text-slate-700 font-bold">
                ✕
              </button>
            </div>

            <div className="text-xs">
              <label className="font-semibold text-slate-700 block mb-1">
                {language === 'hi' ? 'नई क्रेडिट सीमा (₹):' : 'New Credit Limit (₹):'}
              </label>
              <input
                type="number"
                step="100"
                value={newCreditLimit}
                onChange={(e) => setNewCreditLimit(e.target.value)}
                className="w-full p-2.5 rounded-xl border border-slate-300 font-bold text-sm"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-200">
              <button
                onClick={() => setIsCreditLimitModalOpen(false)}
                className="px-4 py-2 rounded-xl border border-slate-300 text-xs font-semibold text-slate-600"
              >
                {language === 'hi' ? 'रद्द करें' : 'Cancel'}
              </button>
              <button
                onClick={handleUpdateCreditLimit}
                className="px-5 py-2 rounded-xl text-xs font-bold text-white bg-[#17307A] hover:bg-[#17307A]/90"
              >
                {language === 'hi' ? 'अपडेट करें' : 'Update Limit'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* PIN Unlock Modal */}
      <PinUnlockModal
        isOpen={isPinModalOpen}
        title={actionTitle}
        subtitle={actionSubtitle}
        sensitiveAction={true}
        onSuccess={() => {
          setIsPinModalOpen(false);
          if (pendingAction) {
            pendingAction();
            setPendingAction(null);
          }
        }}
        onCancel={() => {
          setIsPinModalOpen(false);
          setPendingAction(null);
        }}
      />
    </div>
  );
}
