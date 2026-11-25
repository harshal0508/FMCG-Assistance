'use client';

import React, { useState, useEffect } from 'react';
import {
  CreditCard,
  Search,
  CheckCircle2,
  AlertCircle,
  FileText,
  RotateCcw,
  Sparkles,
  ArrowRight,
  ShieldCheck,
  Building2,
  Receipt,
  Layers,
  Clock,
  Check,
  AlertTriangle,
  Send,
  HelpCircle
} from 'lucide-react';
import { useTranslation } from '@/lib/i18n/context';
import { parseBankSmsNotification } from '@/lib/services/sms-parser';
import { PinUnlockModal } from './pin-unlock-modal';

interface PaymentAllocation {
  id: string;
  amountPaise: number;
  billId: string;
  billNumber: string;
  billTotalPaise: number;
}

interface PaymentRecord {
  id: string;
  amountPaise: number;
  method: string;
  bankUtr: string | null;
  payerName: string | null;
  rawSms: string | null;
  matchStatus: string;
  paymentDate: string;
  createdAt: string;
  shop: { id: string; name: string; shop_number: string; owner_name: string } | null;
  allocations: PaymentAllocation[];
  isUnmatched: boolean;
}

interface PendingBill {
  id: string;
  billNumber: string;
  orderNumber: string;
  totalPaise: number;
  paidPaise: number;
  remainingPaise: number;
  shop: { id: string; name: string; shop_number: string; owner_name: string };
  createdAt: string;
}

interface ShopItem {
  id: string;
  name: string;
  shop_number: string;
  owner_name: string;
  phone: string;
}

export function PaymentsView() {
  const { language } = useTranslation();
  const [activeTab, setActiveTab] = useState<'match' | 'history' | 'unmatched'>('match');
  const [loading, setLoading] = useState(true);
  const [payments, setPayments] = useState<PaymentRecord[]>([]);
  const [pendingBills, setPendingBills] = useState<PendingBill[]>([]);
  const [shops, setShops] = useState<ShopItem[]>([]);
  
  // SMS Parser & New Payment State
  const [smsText, setSmsText] = useState('');
  const [parsedAmountPaise, setParsedAmountPaise] = useState<number | null>(null);
  const [parsedPayer, setParsedPayer] = useState('');
  const [parsedUtr, setParsedUtr] = useState('');
  const [parseConfidence, setParseConfidence] = useState<string>('');
  
  // Selection & Allocation State
  const [selectedShopId, setSelectedShopId] = useState<string>('');
  const [selectedBillIds, setSelectedBillIds] = useState<string[]>([]);
  const [customAllocations, setCustomAllocations] = useState<{ [billId: string]: number }>({});
  const [keepShortAsDue, setKeepShortAsDue] = useState(true);
  const [paymentMethod, setPaymentMethod] = useState<'UPI' | 'CASH' | 'CHEQUE'>('UPI');

  // PIN Modal State
  const [isPinModalOpen, setIsPinModalOpen] = useState(false);
  const [pendingAction, setPendingAction] = useState<(() => Promise<void>) | null>(null);
  const [actionTitle, setActionTitle] = useState('');
  const [actionSubtitle, setActionSubtitle] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Unmatched Assignment Modal
  const [assigningPayment, setAssigningPayment] = useState<PaymentRecord | null>(null);
  const [assignShopId, setAssignShopId] = useState('');
  const [assignBillIds, setAssignBillIds] = useState<string[]>([]);

  useEffect(() => {
    fetchPaymentsData();
  }, []);

  const fetchPaymentsData = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/distributor/payments');
      if (res.ok) {
        const data = await res.json();
        setPayments(data.payments || []);
        setPendingBills(data.pendingBills || []);
        setShops(data.shops || []);
      }
    } catch (err) {
      console.error('Failed to load payments:', err);
    } finally {
      setLoading(false);
    }
  };

  // Handle parsing when SMS changes or user pastes
  const handleParseSms = (text: string) => {
    setSmsText(text);
    if (!text.trim()) {
      setParsedAmountPaise(null);
      setParsedPayer('');
      setParsedUtr('');
      setParseConfidence('');
      return;
    }

    const parsed = parseBankSmsNotification(text);
    if (parsed.success && parsed.amountPaise) {
      setParsedAmountPaise(parsed.amountPaise);
      setParsedUtr(parsed.bankUtr || '');
      setParsedPayer(parsed.payerName || '');
      setParseConfidence(parsed.bankUtr ? 'HIGH' : 'MEDIUM');

      // Auto-match bill by exact amount first!
      const exactMatch = pendingBills.find((b) => b.remainingPaise === parsed.amountPaise);
      if (exactMatch) {
        setSelectedShopId(exactMatch.shop.id);
        setSelectedBillIds([exactMatch.id]);
        setCustomAllocations({ [exactMatch.id]: parsed.amountPaise });
      } else if (parsed.payerName) {
        // Try matching by shop owner name
        const lowerPayer = parsed.payerName.toLowerCase();
        const matchedShop = shops.find(
          (s) => s.owner_name.toLowerCase().includes(lowerPayer) || s.name.toLowerCase().includes(lowerPayer)
        );
        if (matchedShop) {
          setSelectedShopId(matchedShop.id);
          // auto-select top pending bills for this shop
          const shopBills = pendingBills.filter((b) => b.shop.id === matchedShop.id);
          if (shopBills.length > 0) {
            setSelectedBillIds([shopBills[0].id]);
            setCustomAllocations({ [shopBills[0].id]: Math.min(parsed.amountPaise, shopBills[0].remainingPaise) });
          }
        }
      }
    }
  };

  const selectedBillsTotalRemaining = selectedBillIds.reduce((sum, id) => {
    const bill = pendingBills.find((b) => b.id === id);
    return sum + (bill ? bill.remainingPaise : 0);
  }, 0);

  const totalAllocatedPaise = Object.values(customAllocations).reduce((sum, a) => sum + a, 0);
  const remainingPaymentPaise = (parsedAmountPaise || 0) - totalAllocatedPaise;
  const shortAmountDuePaise = selectedBillsTotalRemaining > (parsedAmountPaise || 0)
    ? selectedBillsTotalRemaining - (parsedAmountPaise || 0)
    : 0;

  // Execute with PIN modal guard
  const requestPinAuthorizedAction = (title: string, subtitle: string, action: () => Promise<void>) => {
    setActionTitle(title);
    setActionSubtitle(subtitle);
    setPendingAction(() => action);
    setIsPinModalOpen(true);
  };

  const handleRecordPayment = async (pin?: string) => {
    if (!parsedAmountPaise || parsedAmountPaise <= 0) {
      setErrorMessage(language === 'hi' ? 'कृपया मान्य भुगतान राशि दर्ज करें।' : 'Please enter a valid payment amount.');
      return;
    }

    // Check duplicate UTR on client side first
    if (parsedUtr) {
      const duplicate = payments.find((p) => p.bankUtr?.trim().toLowerCase() === parsedUtr.trim().toLowerCase());
      if (duplicate) {
        setErrorMessage(
          language === 'hi'
            ? `डुप्लिकेट UTR: यह भुगतान संदर्भ (${parsedUtr}) पहले ही दर्ज किया जा चुका है!`
            : `Duplicate UTR: Reference ${parsedUtr} was already recorded!`
        );
        return;
      }
    }

    try {
      const payload: any = {
        action: 'RECORD',
        amountPaise: parsedAmountPaise,
        bankUtr: parsedUtr,
        payerName: parsedPayer,
        rawSms: smsText,
        method: paymentMethod,
        shopId: selectedShopId || null,
        billAllocations: selectedBillIds.map((id) => ({
          billId: id,
          amountPaise: customAllocations[id] || 0,
        })),
        shortAmountDuePaise: keepShortAsDue ? shortAmountDuePaise : 0,
      };

      if (pin) payload.pin = pin;

      const res = await fetch('/api/distributor/payments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to record payment');
      }

      setSuccessMessage(
        language === 'hi'
          ? 'भुगतान सफलतापूर्वक दर्ज किया गया!'
          : 'Payment recorded and allocated successfully!'
      );
      // Reset form
      setSmsText('');
      setParsedAmountPaise(null);
      setParsedUtr('');
      setParsedPayer('');
      setSelectedShopId('');
      setSelectedBillIds([]);
      setCustomAllocations({});
      fetchPaymentsData();
    } catch (err: any) {
      setErrorMessage(err.message || 'Error recording payment');
    }
  };

  const handleReversePayment = async (paymentId: string, pin?: string) => {
    try {
      const payload: any = {
        action: 'REVERSE',
        paymentId,
      };
      if (pin) payload.pin = pin;

      const res = await fetch('/api/distributor/payments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to reverse payment');
      }

      setSuccessMessage(
        language === 'hi'
          ? 'भुगतान सफलतापूर्वक निरस्त कर दिया गया।'
          : 'Payment reversed and ledger adjusted successfully.'
      );
      fetchPaymentsData();
    } catch (err: any) {
      setErrorMessage(err.message || 'Error reversing payment');
    }
  };

  const handleAssignUnmatched = async (pin?: string) => {
    if (!assigningPayment || !assignShopId) return;

    try {
      const payload: any = {
        action: 'ASSIGN_UNMATCHED',
        paymentId: assigningPayment.id,
        shopId: assignShopId,
        billAllocations: assignBillIds.map((id) => ({
          billId: id,
          amountPaise: customAllocations[id] || 0,
        })),
        shortAmountDuePaise: 0,
      };
      if (pin) payload.pin = pin;

      const res = await fetch('/api/distributor/payments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to assign payment');

      setSuccessMessage(
        language === 'hi'
          ? 'अज्ञात भुगतान को दुकान और बिल से जोड़ दिया गया है।'
          : 'Unmatched payment assigned successfully.'
      );
      setAssigningPayment(null);
      fetchPaymentsData();
    } catch (err: any) {
      setErrorMessage(err.message || 'Assignment failed');
    }
  };

  const unmatchedPayments = payments.filter((p) => p.isUnmatched);

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 flex items-center gap-2.5">
            <CreditCard className="w-6 h-6 text-[#17307A]" />
            <span>{language === 'hi' ? 'भुगतान व बैंक एसएमएस मिलान' : 'Payments & SMS Reconciliation'}</span>
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            {language === 'hi'
              ? 'बैंक एसएमएस या ऐप नोटिफिकेशन से स्वचालित राशि व UTR पहचानें और एक टैप में बिल भुगतान दर्ज करें।'
              : 'Auto-parse incoming UPI bank notifications, match exact bills, handle partial dues and reject duplicate UTRs.'}
          </p>
        </div>

        {/* Tab Buttons */}
        <div className="flex items-center gap-1.5 p-1 bg-slate-100 rounded-xl border border-slate-200 text-xs font-semibold">
          <button
            onClick={() => setActiveTab('match')}
            className={`px-3.5 py-1.5 rounded-lg transition-all cursor-pointer ${
              activeTab === 'match'
                ? 'bg-white text-[#17307A] shadow-xs font-bold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            {language === 'hi' ? 'नया भुगतान व मिलान' : 'Match & Record'}
          </button>
          <button
            onClick={() => setActiveTab('unmatched')}
            className={`px-3.5 py-1.5 rounded-lg transition-all cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'unmatched'
                ? 'bg-white text-[#17307A] shadow-xs font-bold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <span>{language === 'hi' ? 'अज्ञात भुगतान' : 'Unmatched'}</span>
            {unmatchedPayments.length > 0 && (
              <span className="px-1.5 py-0.2 rounded-full bg-rose-500 text-white text-[10px] font-bold">
                {unmatchedPayments.length}
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveTab('history')}
            className={`px-3.5 py-1.5 rounded-lg transition-all cursor-pointer ${
              activeTab === 'history'
                ? 'bg-white text-[#17307A] shadow-xs font-bold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            {language === 'hi' ? 'भुगतान इतिहास' : 'History'}
          </button>
        </div>
      </div>

      {/* Alert Banners */}
      {errorMessage && (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-sm flex items-start justify-between gap-3 animate-in fade-in">
          <div className="flex items-start gap-2.5">
            <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
            <div>
              <div className="font-semibold">{language === 'hi' ? 'कार्रवाई में त्रुटि' : 'Action Error'}</div>
              <div>{errorMessage}</div>
            </div>
          </div>
          <button onClick={() => setErrorMessage(null)} className="text-rose-500 hover:text-rose-800 font-bold text-xs">
            ✕
          </button>
        </div>
      )}

      {successMessage && (
        <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm flex items-start justify-between gap-3 animate-in fade-in">
          <div className="flex items-start gap-2.5">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
            <div>
              <div className="font-semibold">{language === 'hi' ? 'सफलता' : 'Completed'}</div>
              <div>{successMessage}</div>
            </div>
          </div>
          <button onClick={() => setSuccessMessage(null)} className="text-emerald-500 hover:text-emerald-800 font-bold text-xs">
            ✕
          </button>
        </div>
      )}

      {/* TAB 1: MATCH & RECORD NEW PAYMENT */}
      {activeTab === 'match' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left Column: SMS Paste & Parsed Fields */}
          <div className="lg:col-span-5 space-y-5">
            {/* Parser Suggestion Notice Banner (Item 11) */}
            <div className="p-3.5 rounded-xl bg-amber-50/80 border border-amber-200 text-xs text-amber-900 flex items-start gap-2.5">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <span className="font-bold block">
                  {language === 'hi' ? 'सुझाव सूचना' : 'Parser Suggestion Only'}
                </span>
                <span className="text-amber-800">
                  {language === 'hi'
                    ? 'संदेश विश्लेषक केवल सुझाव प्रस्तुत करता है। अंतिम भुगतान दर्ज करने के लिए वितरक मालिक की पुष्टि अनिवार्य है।'
                    : 'The bank SMS parser provides automated suggestions only. The distributor owner must review and confirm all details before recording.'}
                </span>
              </div>
            </div>

            <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-4">
              <div className="flex items-center justify-between">
                <label className="text-sm font-bold text-slate-800 flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-[#F58220]" />
                  <span>{language === 'hi' ? 'बैंक संदेश या सूचना यहाँ पेस्ट करें' : 'Paste Bank SMS / Notification'}</span>
                </label>
                <span className="text-[11px] font-semibold text-slate-400">HDFC, SBI, ICICI, PNB, Axis</span>
              </div>

              <textarea
                value={smsText}
                onChange={(e) => handleParseSms(e.target.value)}
                rows={4}
                placeholder={
                  language === 'hi'
                    ? 'उदाहरण: Your a/c no. XX1234 credited by Rs. 2,450.00 on 24-Nov-26 by UPI/632948291034/Ramesh Kirana Store...'
                    : 'Paste incoming SMS here: e.g. Rs 2,450.00 credited to account XX1234 on 24-Nov-26 by UPI ref 632948291034 from Ramesh Kirana...'
                }
                className="w-full text-xs sm:text-sm font-mono p-3 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-[#17307A] focus:border-transparent bg-slate-50/50"
              />

              {/* Sample SMS Quick Fill for fast demo */}
              <div className="flex flex-wrap gap-1.5 pt-1">
                <span className="text-[11px] text-slate-500 self-center">
                  {language === 'hi' ? 'डेमो टेस्ट करें:' : 'Try Demo SMS:'}
                </span>
                <button
                  type="button"
                  onClick={() => {
                    const sample = pendingBills[0]
                      ? `Your a/c XX8921 is credited by Rs.${(pendingBills[0].remainingPaise / 100).toFixed(2)} on 24-Nov-26 by UPI/632918402910/${pendingBills[0].shop.owner_name} via HDFC Bank.`
                      : 'Your a/c XX8921 is credited by Rs.1250.00 on 24-Nov-26 by UPI/632918402910/Gupta Kirana Store.';
                    handleParseSms(sample);
                  }}
                  className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-medium cursor-pointer transition-colors"
                >
                  ⚡ {language === 'hi' ? 'सटीक बिल मिलान' : 'Exact Bill Match'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const sample = 'Dear Customer, your A/C has been credited with Rs. 500.00 by UPI ref 738192049182 on 24-Nov-26.';
                    handleParseSms(sample);
                  }}
                  className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-medium cursor-pointer transition-colors"
                >
                  ⚡ {language === 'hi' ? 'आंशिक भुगतान' : 'Partial Payment'}
                </button>
              </div>

              {/* Parsed Extracted Values Card */}
              {parsedAmountPaise !== null && (
                <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3 pt-3">
                  <div className="flex items-center justify-between text-xs font-bold text-slate-700 pb-2 border-b border-slate-200">
                    <span className="flex items-center gap-1.5">
                      <Check className="w-3.5 h-3.5 text-emerald-600" />
                      <span>{language === 'hi' ? 'पहचानी गई जानकारी' : 'Extracted Details'}</span>
                    </span>
                    <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 text-[10px] font-bold">
                      {parseConfidence.toUpperCase()} CONFIDENCE
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div>
                      <span className="text-slate-400 block">{language === 'hi' ? 'राशि' : 'Amount'}</span>
                      <div className="text-base font-bold text-emerald-700 mt-0.5">
                        ₹{(parsedAmountPaise / 100).toFixed(2)}
                      </div>
                    </div>
                    <div>
                      <span className="text-slate-400 block">{language === 'hi' ? 'बैंक यूटीआर' : 'Bank UTR'}</span>
                      <div className="font-mono font-semibold text-slate-800 mt-0.5">
                        {parsedUtr || (language === 'hi' ? 'अनुपलब्ध' : 'Not found')}
                      </div>
                    </div>
                    <div className="col-span-2">
                      <span className="text-slate-400 block">{language === 'hi' ? 'भुगतानकर्ता' : 'Payer Name'}</span>
                      <div className="font-semibold text-slate-800 mt-0.5">
                        {parsedPayer || (language === 'hi' ? 'पहचान नहीं हो सकी' : 'Unknown / Bank Transfer')}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Manual Overrides for Cash/Cheque or adjustments */}
              <div className="pt-2 border-t border-slate-200 space-y-3">
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div>
                    <label className="font-semibold text-slate-700 block mb-1">
                      {language === 'hi' ? 'भुगतान माध्यम' : 'Payment Method'}
                    </label>
                    <select
                      value={paymentMethod}
                      onChange={(e: any) => setPaymentMethod(e.target.value)}
                      className="w-full p-2 rounded-lg border border-slate-300 font-medium bg-white"
                    >
                      <option value="UPI">{language === 'hi' ? 'डिजिटल' : 'UPI / Digital'}</option>
                      <option value="CASH">{language === 'hi' ? 'नकद' : 'Cash'}</option>
                      <option value="CHEQUE">{language === 'hi' ? 'चेक' : 'Cheque'}</option>
                    </select>
                  </div>

                  <div>
                    <label className="font-semibold text-slate-700 block mb-1">
                      {language === 'hi' ? 'राशि मैन्युअल बदलें (₹)' : 'Edit Amount (₹)'}
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      value={parsedAmountPaise !== null ? (parsedAmountPaise / 100).toFixed(2) : ''}
                      onChange={(e) => {
                        const val = parseFloat(e.target.value);
                        setParsedAmountPaise(!isNaN(val) ? Math.round(val * 100) : null);
                      }}
                      placeholder="0.00"
                      className="w-full p-2 rounded-lg border border-slate-300 font-medium"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">
                    {language === 'hi' ? 'दुकान चुनें' : 'Target Shop'}
                  </label>
                  <select
                    value={selectedShopId}
                    onChange={(e) => {
                      setSelectedShopId(e.target.value);
                      const shopBills = pendingBills.filter((b) => b.shop.id === e.target.value);
                      if (shopBills.length > 0 && parsedAmountPaise) {
                        setSelectedBillIds([shopBills[0].id]);
                        setCustomAllocations({ [shopBills[0].id]: Math.min(parsedAmountPaise, shopBills[0].remainingPaise) });
                      } else {
                        setSelectedBillIds([]);
                        setCustomAllocations({});
                      }
                    }}
                    className="w-full p-2.5 rounded-xl border border-slate-300 text-xs font-semibold bg-white"
                  >
                    <option value="">{language === 'hi' ? '-- दुकान का चयन करें (या अज्ञात छोड़ें) --' : '-- Select Shop (or leave as unmatched) --'}</option>
                    {shops.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name} ({s.owner_name}) - {s.shop_number}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          </div>

          {/* Right Column: Bill Selection, Allocations, & One-Tap Confirmation */}
          <div className="lg:col-span-7 space-y-5">
            <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-200">
                <div>
                  <h3 className="font-bold text-slate-800 text-sm sm:text-base flex items-center gap-2">
                    <Receipt className="w-4 h-4 text-[#17307A]" />
                    <span>{language === 'hi' ? 'बकाया बिल आवंटन' : 'Pending Bill Allocation'}</span>
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {language === 'hi'
                      ? 'एक भुगतान से कई बिल चुकता करें या आंशिक राशि समायोजित करें।'
                      : 'Cover multiple bills with one payment or adjust partial amounts.'}
                  </p>
                </div>

                {selectedShopId && (
                  <span className="px-2.5 py-1 rounded-lg bg-blue-50 text-[#17307A] text-xs font-bold border border-blue-200">
                    {pendingBills.filter((b) => b.shop.id === selectedShopId).length} {language === 'hi' ? 'बकाया बिल' : 'Bills Due'}
                  </span>
                )}
              </div>

              {/* Bills List for Selected Shop */}
              {selectedShopId ? (
                <div className="space-y-2.5 max-h-[320px] overflow-y-auto pr-1">
                  {pendingBills.filter((b) => b.shop.id === selectedShopId).length === 0 ? (
                    <div className="p-6 text-center text-xs text-slate-500 bg-slate-50 rounded-xl">
                      {language === 'hi' ? 'इस दुकान का कोई बकाया बिल नहीं है।' : 'No pending unpaid bills for this shop.'}
                    </div>
                  ) : (
                    pendingBills
                      .filter((b) => b.shop.id === selectedShopId)
                      .map((bill) => {
                        const isSelected = selectedBillIds.includes(bill.id);
                        const isExact = parsedAmountPaise === bill.remainingPaise;
                        return (
                          <div
                            key={bill.id}
                            className={`p-3.5 rounded-xl border transition-all ${
                              isSelected
                                ? 'bg-blue-50/70 border-[#17307A]'
                                : 'bg-white border-slate-200 hover:border-slate-300'
                            }`}
                          >
                            <div className="flex items-start justify-between gap-3">
                              <label className="flex items-start gap-3 cursor-pointer flex-1">
                                <input
                                  type="checkbox"
                                  checked={isSelected}
                                  onChange={(e) => {
                                    if (e.target.checked) {
                                      setSelectedBillIds([...selectedBillIds, bill.id]);
                                      setCustomAllocations({
                                        ...customAllocations,
                                        [bill.id]: bill.remainingPaise,
                                      });
                                    } else {
                                      setSelectedBillIds(selectedBillIds.filter((id) => id !== bill.id));
                                      const updated = { ...customAllocations };
                                      delete updated[bill.id];
                                      setCustomAllocations(updated);
                                    }
                                  }}
                                  className="w-4 h-4 rounded text-[#17307A] mt-0.5 cursor-pointer"
                                />
                                <div>
                                  <div className="flex items-center gap-2">
                                    <span className="font-bold text-slate-900 text-xs sm:text-sm">
                                      {bill.billNumber}
                                    </span>
                                    {isExact && (
                                      <span className="px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800 text-[10px] font-bold">
                                        ⭐ {language === 'hi' ? 'सटीक राशि मिलान' : 'EXACT MATCH'}
                                      </span>
                                    )}
                                  </div>
                                  <div className="text-[11px] text-slate-500 mt-0.5">
                                    Order #{bill.orderNumber} • {new Date(bill.createdAt).toLocaleDateString('en-IN')}
                                  </div>
                                </div>
                              </label>

                              <div className="text-right">
                                <div className="text-xs font-bold text-slate-900">
                                  ₹{(bill.remainingPaise / 100).toFixed(2)}
                                </div>
                                <div className="text-[10px] text-slate-400">
                                  {language === 'hi' ? 'कुल:' : 'Total:'} ₹{(bill.totalPaise / 100).toFixed(2)}
                                </div>
                              </div>
                            </div>

                            {/* Custom allocation input if selected */}
                            {isSelected && (
                              <div className="mt-3 pt-2.5 border-t border-blue-200 flex items-center justify-between gap-3 text-xs">
                                <span className="text-slate-600 font-medium">
                                  {language === 'hi' ? 'आवंटित राशि:' : 'Amount to Apply:'}
                                </span>
                                <div className="flex items-center gap-1.5">
                                  <span className="font-bold text-slate-700">₹</span>
                                  <input
                                    type="number"
                                    step="0.01"
                                    value={
                                      customAllocations[bill.id] !== undefined
                                        ? (customAllocations[bill.id] / 100).toFixed(2)
                                        : (bill.remainingPaise / 100).toFixed(2)
                                    }
                                    onChange={(e) => {
                                      const val = parseFloat(e.target.value);
                                      if (!isNaN(val)) {
                                        setCustomAllocations({
                                          ...customAllocations,
                                          [bill.id]: Math.round(val * 100),
                                        });
                                      }
                                    }}
                                    className="w-24 p-1 text-right font-bold rounded border border-slate-300 bg-white"
                                  />
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })
                  )}
                </div>
              ) : (
                <div className="p-8 text-center bg-slate-50 rounded-xl border border-dashed border-slate-200 text-slate-500 text-xs">
                  {language === 'hi'
                    ? 'बाईं तरफ दुकान चुनें या बैंक संदेश पेस्ट करें। बकाया बिल यहाँ दिखाई देंगे।'
                    : 'Select a shop on the left or paste an SMS to view and link pending unpaid bills.'}
                </div>
              )}

              {/* Short Payment Due Option (keep Rs X as due) */}
              {shortAmountDuePaise > 0 && selectedShopId && (
                <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-900 space-y-2">
                  <div className="flex items-center justify-between font-bold">
                    <span className="flex items-center gap-1.5">
                      <AlertTriangle className="w-4 h-4 text-amber-600" />
                      <span>{language === 'hi' ? 'कम भुगतान विकल्प' : 'Short Payment Handling'}</span>
                    </span>
                    <span>₹{(shortAmountDuePaise / 100).toFixed(2)} {language === 'hi' ? 'कम' : 'short'}</span>
                  </div>
                  <label className="flex items-center gap-2 cursor-pointer font-medium">
                    <input
                      type="checkbox"
                      checked={keepShortAsDue}
                      onChange={(e) => setKeepShortAsDue(e.target.checked)}
                      className="w-4 h-4 rounded text-amber-600"
                    />
                    <span>
                      {language === 'hi'
                        ? `शेष ₹${(shortAmountDuePaise / 100).toFixed(2)} को ग्राहक के खाते में बकाया के रूप में रखें`
                        : `Keep short amount ₹${(shortAmountDuePaise / 100).toFixed(2)} as customer due in ledger`}
                    </span>
                  </label>
                </div>
              )}

              {/* Confirmation Action Summary Bar */}
              <div className="pt-4 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="text-xs">
                  <span className="text-slate-400 block">{language === 'hi' ? 'कुल दर्ज होने वाली राशि' : 'Total Recording'}</span>
                  <div className="text-lg font-bold text-slate-900">
                    ₹{((parsedAmountPaise || 0) / 100).toFixed(2)}
                  </div>
                </div>

                <div className="flex items-center gap-2.5 w-full sm:w-auto">
                  {/* Record Unmatched Button if no shop */}
                  {!selectedShopId && parsedAmountPaise && parsedAmountPaise > 0 && (
                    <button
                      type="button"
                      onClick={() => {
                        requestPinAuthorizedAction(
                          language === 'hi' ? 'अज्ञात भुगतान दर्ज करें' : 'Record Unmatched Payment',
                          language === 'hi' ? 'पिन दर्ज करके भुगतान सुरक्षित करें' : 'Enter PIN to record payment',
                          () => handleRecordPayment()
                        );
                      }}
                      className="flex-1 sm:flex-none px-4 py-2.5 rounded-xl border border-slate-300 hover:bg-slate-50 text-slate-700 text-xs font-bold transition-all cursor-pointer"
                    >
                      {language === 'hi' ? 'अज्ञात भुगतान दर्ज करें' : 'Record as Unmatched'}
                    </button>
                  )}

                  {/* One-Tap Confirm Button */}
                  <button
                    type="button"
                    disabled={!parsedAmountPaise || parsedAmountPaise <= 0}
                    onClick={() => {
                      requestPinAuthorizedAction(
                        language === 'hi' ? 'भुगतान पुष्टि व रिकॉर्ड' : 'Confirm & Record Payment',
                        language === 'hi'
                          ? 'सुरक्षा पिन दर्ज करें (सुरक्षा ऑडिट हेतु 6-अंक पिन आवश्यक है)'
                          : 'Enter your 6-digit PIN to securely record payment',
                        () => handleRecordPayment()
                      );
                    }}
                    className={`flex-1 sm:flex-none flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl font-bold text-xs sm:text-sm text-white shadow-sm transition-all cursor-pointer ${
                      !parsedAmountPaise || parsedAmountPaise <= 0
                        ? 'bg-slate-300 cursor-not-allowed'
                        : 'bg-[#17307A] hover:bg-[#17307A]/90'
                    }`}
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    <span>
                      {selectedBillIds.length > 0
                        ? language === 'hi'
                          ? 'एक-टैप भुगतान पुष्टि (1-Tap Confirm)'
                          : '1-Tap Confirm Payment'
                        : language === 'hi'
                        ? 'भुगतान दर्ज करें'
                        : 'Record Payment'}
                    </span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: UNMATCHED PAYMENTS LIST */}
      {activeTab === 'unmatched' && (
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-200">
            <div>
              <h3 className="font-bold text-slate-900 text-base flex items-center gap-2">
                <HelpCircle className="w-5 h-5 text-rose-500" />
                <span>{language === 'hi' ? 'अज्ञात व अनिर्धारित भुगतान' : 'Unmatched Payments'}</span>
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                {language === 'hi'
                  ? 'वे भुगतान जिनकी दुकान का स्वचालित मिलान नहीं हो सका। इन्हें दुकान और बिल से लिंक करें।'
                  : 'Payments received without automatic shop match. Assign them to a shop and bill.'}
              </p>
            </div>
            <span className="px-3 py-1 rounded-full bg-rose-50 text-rose-700 text-xs font-bold border border-rose-200">
              {unmatchedPayments.length} {language === 'hi' ? 'अनिर्धारित' : 'Pending'}
            </span>
          </div>

          {unmatchedPayments.length === 0 ? (
            <div className="p-12 text-center text-slate-400 text-xs">
              <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto mb-2 opacity-80" />
              <div className="font-semibold text-slate-700 text-sm">
                {language === 'hi' ? 'सभी भुगतान सफलतापूर्वक मिलान किए जा चुके हैं!' : 'No unmatched payments found!'}
              </div>
              <p className="mt-1">{language === 'hi' ? 'सभी प्राप्त राशियां बिलों से जुड़ी हैं।' : 'All incoming credits are fully reconciled.'}</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {unmatchedPayments.map((p) => (
                <div key={p.id} className="py-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2.5">
                      <span className="text-base font-bold text-slate-900">
                        ₹{(p.amountPaise / 100).toFixed(2)}
                      </span>
                      <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 text-xs font-mono">
                        UTR: {p.bankUtr || 'N/A'}
                      </span>
                      <span className="px-2 py-0.5 rounded bg-rose-100 text-rose-800 text-[10px] font-bold">
                        UNMATCHED
                      </span>
                    </div>

                    <div className="text-xs text-slate-500 mt-1 space-y-0.5">
                      <div>
                        {language === 'hi' ? 'प्रेषक नाम:' : 'Payer:'}{' '}
                        <span className="font-semibold text-slate-700">{p.payerName || 'Unknown'}</span> •{' '}
                        {new Date(p.createdAt).toLocaleDateString('en-IN')}
                      </div>
                      {p.rawSms && (
                        <div className="font-mono text-[11px] text-slate-400 max-w-xl truncate">
                          &quot;{p.rawSms}&quot;
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={() => {
                        setAssigningPayment(p);
                        setAssignShopId('');
                        setAssignBillIds([]);
                      }}
                      className="px-3.5 py-1.5 rounded-xl bg-[#17307A] text-white text-xs font-bold hover:bg-[#17307A]/90 transition-colors cursor-pointer"
                    >
                      {language === 'hi' ? 'दुकान से जोड़ें' : 'Assign to Shop & Bill'}
                    </button>
                    <button
                      onClick={() => {
                        requestPinAuthorizedAction(
                          language === 'hi' ? 'भुगतान निरस्त करें' : 'Reverse Payment',
                          language === 'hi' ? 'पिन दर्ज करके भुगतान निरस्त करें' : 'Enter PIN to reverse payment',
                          () => handleReversePayment(p.id)
                        );
                      }}
                      className="px-3 py-1.5 rounded-xl border border-rose-200 text-rose-600 hover:bg-rose-50 text-xs font-bold transition-colors cursor-pointer"
                    >
                      {language === 'hi' ? 'हटाएं' : 'Delete'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 3: PAYMENTS HISTORY */}
      {activeTab === 'history' && (
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-200">
            <div>
              <h3 className="font-bold text-slate-900 text-base flex items-center gap-2">
                <Clock className="w-5 h-5 text-[#17307A]" />
                <span>{language === 'hi' ? 'पूर्ण भुगतान इतिहास' : 'Reconciliation History'}</span>
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                {language === 'hi'
                  ? 'अंतिम 100 भुगतान प्रविष्टियाँ व उनके आवंटित बिल।'
                  : 'Audit trail of confirmed payments and bill allocations.'}
              </p>
            </div>
            <span className="text-xs font-semibold text-slate-500">
              {payments.length} {language === 'hi' ? 'प्रविष्टियाँ' : 'Records'}
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-600 font-bold uppercase tracking-wider text-[10px] border-b border-slate-200">
                <tr>
                  <th className="p-3">{language === 'hi' ? 'दिनांक' : 'Date'}</th>
                  <th className="p-3">{language === 'hi' ? 'दुकान / पार्टी' : 'Shop'}</th>
                  <th className="p-3">{language === 'hi' ? 'राशि' : 'Amount'}</th>
                  <th className="p-3">UTR / {language === 'hi' ? 'माध्यम' : 'Method'}</th>
                  <th className="p-3">{language === 'hi' ? 'आवंटित बिल' : 'Allocated Bills'}</th>
                  <th className="p-3 text-right">{language === 'hi' ? 'कार्य' : 'Action'}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {payments.map((p) => (
                  <tr key={p.id} className="hover:bg-slate-50/60 transition-colors">
                    <td className="p-3 font-medium text-slate-600 whitespace-nowrap">
                      {new Date(p.createdAt).toLocaleDateString('en-IN', {
                        day: '2-digit',
                        month: 'short',
                        year: 'numeric',
                      })}
                    </td>
                    <td className="p-3">
                      {p.shop ? (
                        <div>
                          <div className="font-bold text-slate-900">{p.shop.name}</div>
                          <div className="text-[11px] text-slate-400">
                            {p.shop.owner_name} ({p.shop.shop_number})
                          </div>
                        </div>
                      ) : (
                        <span className="px-2 py-0.5 rounded bg-rose-50 text-rose-700 text-[10px] font-bold">
                          UNMATCHED
                        </span>
                      )}
                    </td>
                    <td className="p-3 font-bold text-slate-900 whitespace-nowrap text-sm">
                      ₹{(p.amountPaise / 100).toFixed(2)}
                    </td>
                    <td className="p-3 font-mono text-[11px] text-slate-600 whitespace-nowrap">
                      <div>{p.bankUtr || '—'}</div>
                      <div className="text-[10px] text-slate-400">{p.method}</div>
                    </td>
                    <td className="p-3">
                      {p.allocations.length > 0 ? (
                        <div className="flex flex-wrap gap-1">
                          {p.allocations.map((a) => (
                            <span
                              key={a.id}
                              className="px-2 py-0.5 rounded bg-blue-50 text-[#17307A] font-semibold text-[10px] border border-blue-200"
                            >
                              {a.billNumber}: ₹{(a.amountPaise / 100).toFixed(2)}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <span className="text-slate-400 text-[11px]">—</span>
                      )}
                    </td>
                    <td className="p-3 text-right">
                      <button
                        onClick={() => {
                          requestPinAuthorizedAction(
                            language === 'hi' ? 'भुगतान निरस्त करें' : 'Reverse Payment',
                            language === 'hi'
                              ? 'भुगतान निरस्त करने के लिए 6-अंकीय सुरक्षा पिन दर्ज करें।'
                              : 'Enter your 6-digit PIN to reverse payment and adjust customer ledger.',
                            () => handleReversePayment(p.id)
                          );
                        }}
                        className="px-2.5 py-1 rounded-lg border border-slate-200 hover:border-rose-300 hover:bg-rose-50 text-slate-500 hover:text-rose-600 text-[11px] font-semibold transition-colors cursor-pointer"
                      >
                        {language === 'hi' ? 'रद्द करें' : 'Reverse'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Unmatched Assignment Modal */}
      {assigningPayment && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-5 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <h3 className="font-bold text-slate-900 text-sm">
                {language === 'hi' ? 'अज्ञात भुगतान को दुकान से लिंक करें' : 'Assign Unmatched Payment'}
              </h3>
              <button onClick={() => setAssigningPayment(null)} className="text-slate-400 hover:text-slate-700 font-bold">
                ✕
              </button>
            </div>

            <div className="p-3 bg-slate-50 rounded-xl text-xs space-y-1">
              <div className="flex justify-between font-bold text-slate-800">
                <span>{language === 'hi' ? 'राशि:' : 'Amount:'}</span>
                <span className="text-emerald-700">₹{(assigningPayment.amountPaise / 100).toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-slate-500">
                <span>UTR:</span>
                <span className="font-mono">{assigningPayment.bankUtr || 'N/A'}</span>
              </div>
              <div className="flex justify-between text-slate-500">
                <span>{language === 'hi' ? 'प्रेषक:' : 'Payer:'}</span>
                <span>{assigningPayment.payerName || 'Unknown'}</span>
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1">
                {language === 'hi' ? 'दुकान चुनें:' : 'Select Shop:'}
              </label>
              <select
                value={assignShopId}
                onChange={(e) => {
                  setAssignShopId(e.target.value);
                  const bills = pendingBills.filter((b) => b.shop.id === e.target.value);
                  if (bills.length > 0) {
                    setAssignBillIds([bills[0].id]);
                    setCustomAllocations({ [bills[0].id]: Math.min(assigningPayment.amountPaise, bills[0].remainingPaise) });
                  } else {
                    setAssignBillIds([]);
                    setCustomAllocations({});
                  }
                }}
                className="w-full p-2.5 rounded-xl border border-slate-300 text-xs font-semibold bg-white"
              >
                <option value="">{language === 'hi' ? '-- दुकान का चयन करें --' : '-- Select Shop --'}</option>
                {shops.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} ({s.owner_name})
                  </option>
                ))}
              </select>
            </div>

            {assignShopId && (
              <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                <span className="text-[11px] font-bold text-slate-600 block">
                  {language === 'hi' ? 'आवंटन हेतु बिल:' : 'Bills to link:'}
                </span>
                {pendingBills.filter((b) => b.shop.id === assignShopId).length === 0 ? (
                  <div className="text-[11px] text-slate-400 text-center py-2">
                    {language === 'hi' ? 'कोई बकाया बिल नहीं। भुगतान सीधा खाते में जमा होगा।' : 'No open bills. Will credit ledger balance directly.'}
                  </div>
                ) : (
                  pendingBills.filter((b) => b.shop.id === assignShopId).map((b) => (
                    <label key={b.id} className="flex items-center justify-between p-2 rounded-lg border border-slate-200 text-xs cursor-pointer">
                      <div className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={assignBillIds.includes(b.id)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setAssignBillIds([...assignBillIds, b.id]);
                              setCustomAllocations({ ...customAllocations, [b.id]: b.remainingPaise });
                            } else {
                              setAssignBillIds(assignBillIds.filter((id) => id !== b.id));
                            }
                          }}
                        />
                        <span>{b.billNumber}</span>
                      </div>
                      <span className="font-bold text-slate-800">₹{(b.remainingPaise / 100).toFixed(2)}</span>
                    </label>
                  ))
                )}
              </div>
            )}

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-200">
              <button
                onClick={() => setAssigningPayment(null)}
                className="px-4 py-2 rounded-xl border border-slate-300 text-xs font-semibold text-slate-600"
              >
                {language === 'hi' ? 'रद्द करें' : 'Cancel'}
              </button>
              <button
                disabled={!assignShopId}
                onClick={() => {
                  requestPinAuthorizedAction(
                    language === 'hi' ? 'अज्ञात भुगतान लिंक करें' : 'Assign Payment',
                    language === 'hi' ? 'सुरक्षा पिन दर्ज करें' : 'Enter PIN to assign payment',
                    () => handleAssignUnmatched()
                  );
                }}
                className={`px-5 py-2 rounded-xl text-xs font-bold text-white ${
                  !assignShopId ? 'bg-slate-300 cursor-not-allowed' : 'bg-[#17307A] hover:bg-[#17307A]/90'
                }`}
              >
                {language === 'hi' ? 'पुष्टि करें' : 'Confirm Assignment'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* PIN Unlock Modal for sensitive payment actions */}
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
