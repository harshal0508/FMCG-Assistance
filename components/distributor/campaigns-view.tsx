'use client';

import React, { useState, useEffect } from 'react';
import { useTranslation } from '@/lib/i18n/context';
import { formatPaise } from '@/lib/money';
import {
  Send,
  Users,
  ShieldAlert,
  CheckCircle2,
  AlertCircle,
  Clock,
  Eye,
  ShoppingBag,
  TrendingUp,
  Inbox,
  Sparkles,
  Phone,
  Calendar,
  Layers,
  ArrowRight,
  Filter,
  Check,
  X,
} from 'lucide-react';

interface RouteGroupOption {
  id: string;
  name: string;
  cutoffTime: string;
  orderDay: number;
  areas: { id: string; name: string }[];
}

interface AreaOption {
  id: string;
  name: string;
  shopCount: number;
}

interface CampaignSummaryItem {
  id: string;
  name: string;
  status: string;
  routeGroupName: string;
  createdAt: string;
  totalTargets: number;
  sentCount: number;
  openedCount: number;
  orderedCount: number;
  totalOrderValuePaise: number;
}

interface OutboxItem {
  id: string;
  shopName: string;
  ownerName: string;
  recipientPhone: string;
  areaName: string;
  campaignName: string;
  channel: string;
  status: string;
  body: string;
  createdAt: string;
  openedAt: string | null;
  orderedAt: string | null;
}

interface Props {
  initialCampaigns: CampaignSummaryItem[];
  initialRouteGroups: RouteGroupOption[];
  initialAreas: AreaOption[];
  initialPlanUsage: { sentThisMonth: number; monthlyLimit: number };
  initialTab?: 'TRIGGER' | 'SUMMARY' | 'OUTBOX' | 'FESTIVALS';
}

export default function CampaignsView({
  initialCampaigns,
  initialRouteGroups,
  initialAreas,
  initialPlanUsage,
  initialTab = 'TRIGGER',
}: Props) {
  const { language } = useTranslation();

  const [activeTab, setActiveTab] = useState<'TRIGGER' | 'SUMMARY' | 'OUTBOX' | 'FESTIVALS'>(initialTab);

  // Festival suggestions state (Part 2.F)
  const [festivals, setFestivals] = useState<any[]>([]);
  const [loadingFestivals, setLoadingFestivals] = useState(false);
  const [isCreatingFestival, setIsCreatingFestival] = useState(false);
  const [festFormName, setFestFormName] = useState('');
  const [festFormStart, setFestFormStart] = useState('');
  const [festFormEnd, setFestFormEnd] = useState('');
  const [festFormNotes, setFestFormNotes] = useState('');
  const [festSaving, setFestSaving] = useState(false);
  const [festError, setFestError] = useState<string | null>(null);

  const loadFestivals = async () => {
    setLoadingFestivals(true);
    try {
      const res = await fetch('/api/distributor/festivals');
      if (res.ok) {
        const data = await res.json();
        setFestivals(data.festivals || []);
      }
    } catch {
      // ignore
    } finally {
      setLoadingFestivals(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'FESTIVALS') {
      loadFestivals();
    }
  }, [activeTab]);

  const handleSaveFestival = async (e: React.FormEvent) => {
    e.preventDefault();
    setFestSaving(true);
    setFestError(null);
    try {
      const res = await fetch('/api/distributor/festivals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          festival_name: festFormName,
          start_date: festFormStart,
          end_date: festFormEnd,
          notes: festFormNotes,
          items: [],
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to save festival');
      }
      setIsCreatingFestival(false);
      setFestFormName('');
      setFestFormStart('');
      setFestFormEnd('');
      setFestFormNotes('');
      loadFestivals();
    } catch (err: any) {
      setFestError(err.message);
    } finally {
      setFestSaving(false);
    }
  };

  // Trigger form state
  const [selectedRouteGroupId, setSelectedRouteGroupId] = useState<string>(
    initialRouteGroups[0]?.id || 'ALL'
  );
  const [selectedAreaIds, setSelectedAreaIds] = useState<string[]>([]);
  const [scheduleFollowUp, setScheduleFollowUp] = useState(true);
  const [followUpHours, setFollowUpHours] = useState(2);

  // Preview data state
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [previewData, setPreviewData] = useState<{
    totalTargets: number;
    eligibleCount: number;
    excludedCount: number;
    excludedBreakdown: {
      CREDIT_HOLD: number;
      OPTED_OUT: number;
      ALREADY_ORDERED: number;
      NO_PHONE: number;
    };
    eligibleShops: any[];
    excludedShops: any[];
    messagePreview: { en: string; hi: string };
    planMessages?: {
      monthlyLimit: number;
      sentThisMonth: number;
      remainingMessages: number;
    };
  } | null>(null);

  // Dispatch state
  const [sending, setSending] = useState(false);
  const [dispatchFeedback, setDispatchFeedback] = useState<string | null>(null);

  // Outbox data
  const [outboxMessages, setOutboxMessages] = useState<OutboxItem[]>([]);
  const [loadingOutbox, setLoadingOutbox] = useState(false);

  // Fetch Preview whenever route group or area selection changes
  useEffect(() => {
    let active = true;
    const fetchPreview = async () => {
      setLoadingPreview(true);
      try {
        const res = await fetch('/api/distributor/campaigns/preview', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            routeGroupId: selectedRouteGroupId,
            areaIds: selectedAreaIds,
          }),
        });
        if (res.ok && active) {
          const data = await res.json();
          setPreviewData(data);
        }
      } catch (err) {
        console.error('Failed to load preview:', err);
      } finally {
        if (active) setLoadingPreview(false);
      }
    };

    fetchPreview();
    return () => {
      active = false;
    };
  }, [selectedRouteGroupId, selectedAreaIds]);

  // Load Outbox when OUTBOX tab is clicked
  useEffect(() => {
    if (activeTab === 'OUTBOX') {
      setLoadingOutbox(true);
      fetch('/api/distributor/outbox')
        .then((r) => r.json())
        .then((d) => {
          if (d.messages) setOutboxMessages(d.messages);
        })
        .finally(() => setLoadingOutbox(false));
    }
  }, [activeTab]);

  const handleSendCampaign = async () => {
    if (!previewData || previewData.eligibleCount === 0 || sending) return;
    setSending(true);
    setDispatchFeedback(null);

    try {
      const selectedGroup = initialRouteGroups.find((g) => g.id === selectedRouteGroupId);
      const groupName = selectedGroup ? selectedGroup.name : 'All Market Areas';

      const res = await fetch('/api/distributor/campaigns/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: `${groupName} Reminder (${new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })})`,
          routeGroupId: selectedRouteGroupId,
          eligibleShopIds: previewData.eligibleShops.map((s) => s.id),
          scheduleFollowUp,
          followUpHoursBeforeCutoff: followUpHours,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to dispatch reminders');
      }

      setDispatchFeedback(data.message);
      // Switch to Outbox to show queued messages
      setTimeout(() => {
        setActiveTab('OUTBOX');
      }, 1200);
    } catch (err: any) {
      alert(err.message || 'Error queuing campaign');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2.5 sm:gap-3 border-b border-slate-200 pb-2.5 sm:pb-4">
        <div>
          <h1 className="text-base sm:text-xl md:text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
            <Send className="w-4 h-4 sm:w-6 sm:h-6 text-[#17307A] shrink-0" />
            <span>
              {language === 'hi'
                ? 'क्षेत्र-आधारित ऑर्डर स्मरण अभियान'
                : 'Area-Triggered Order Reminder Campaigns'}
            </span>
          </h1>
          <p className="hidden sm:block text-xs md:text-sm text-slate-500 mt-1">
            {language === 'hi'
              ? 'रूट के अनुसार पात्र दुकानों को निजी वेब स्टोर लिंक एवं कट-ऑफ सूचना के संदेश भेजें।'
              : 'Dispatch personalized 1-tap re-order links to shops based on their scheduled delivery route.'}
          </p>
        </div>

        {/* 4-Tab Selector */}
        <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl sm:rounded-2xl border border-slate-200 self-start sm:self-auto text-xs font-bold overflow-x-auto max-w-full scrollbar-none">
          <button
            type="button"
            onClick={() => setActiveTab('TRIGGER')}
            className={`px-2.5 sm:px-3.5 py-1 sm:py-1.5 rounded-lg sm:rounded-xl transition-all cursor-pointer shrink-0 whitespace-nowrap text-[11px] sm:text-xs ${
              activeTab === 'TRIGGER'
                ? 'bg-[#17307A] text-white shadow-xs font-bold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            {language === 'hi' ? 'नया अभियान' : 'New Campaign'}
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('SUMMARY')}
            className={`px-2.5 sm:px-3.5 py-1 sm:py-1.5 rounded-lg sm:rounded-xl transition-all cursor-pointer shrink-0 whitespace-nowrap text-[11px] sm:text-xs ${
              activeTab === 'SUMMARY'
                ? 'bg-[#17307A] text-white shadow-xs font-bold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            {language === 'hi' ? 'अभियान सारांश' : 'Campaign Summary'}
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('OUTBOX')}
            className={`px-2.5 sm:px-3.5 py-1 sm:py-1.5 rounded-lg sm:rounded-xl transition-all cursor-pointer shrink-0 whitespace-nowrap text-[11px] sm:text-xs ${
              activeTab === 'OUTBOX'
                ? 'bg-[#17307A] text-white shadow-xs font-bold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            {language === 'hi' ? 'आउटबॉक्स' : 'Outbox Queue'}
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('FESTIVALS')}
            className={`px-2.5 sm:px-3.5 py-1 sm:py-1.5 rounded-lg sm:rounded-xl transition-all cursor-pointer shrink-0 whitespace-nowrap text-[11px] sm:text-xs ${
              activeTab === 'FESTIVALS'
                ? 'bg-[#17307A] text-white shadow-xs font-bold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            {language === 'hi' ? 'त्योहार स्टॉक सुझाव' : 'Festival Stock'}
          </button>
        </div>
      </div>

      {/* Plan Limits Progress Banner (Compact on mobile) */}
      <div className="p-2.5 sm:p-4 bg-white rounded-2xl sm:rounded-3xl border border-slate-200/90 shadow-2xs flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2 sm:gap-3 text-xs">
        <div className="flex items-center gap-2 sm:gap-2.5">
          <Sparkles className="w-4 h-4 sm:w-5 sm:h-5 text-[#17307A] shrink-0" />
          <div>
            <span className="font-bold text-xs sm:text-sm text-slate-900 block leading-tight">
              {language === 'hi' ? 'पायलट प्लान संदेश सीमा' : 'Pilot Plan Reminders Allowance'}
            </span>
            <span className="text-slate-500 text-[10px] sm:text-[11px]">
              {(initialPlanUsage.monthlyLimit - initialPlanUsage.sentThisMonth).toLocaleString()}{' '}
              {language === 'hi' ? 'शेष संदेश' : 'messages remaining'}{' '}
              ({initialPlanUsage.sentThisMonth} / {initialPlanUsage.monthlyLimit.toLocaleString()}{' '}
              {language === 'hi' ? 'प्रयुक्त' : 'used'})
            </span>
          </div>
        </div>

        <div className="w-full sm:w-48 bg-slate-100 rounded-full h-1.5 sm:h-2.5 overflow-hidden border border-slate-200">
          <div
            className="bg-[#17307A] h-full rounded-full transition-all"
            style={{
              width: `${Math.min(
                100,
                (initialPlanUsage.sentThisMonth / initialPlanUsage.monthlyLimit) * 100
              )}%`,
            }}
          />
        </div>
      </div>

      {/* ======================================================== */}
      {/* TAB 1: CAMPAIGN TRIGGER & AUDIENCE PREVIEW               */}
      {/* ======================================================== */}
      {activeTab === 'TRIGGER' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-3.5 sm:gap-6">
          {/* Left Column: Route / Audience Selection */}
          <div className="lg:col-span-5 space-y-3 sm:space-y-4">
            <div className="bg-white rounded-2xl sm:rounded-3xl border border-slate-200 p-3.5 sm:p-5 space-y-2.5 sm:space-y-4 shadow-xs">
              <h3 className="font-bold text-xs sm:text-sm text-slate-900 flex items-center gap-2 border-b border-slate-100 pb-2">
                <Filter className="w-4 h-4 text-[#17307A] shrink-0" />
                <span>{language === 'hi' ? 'लक्षित रूट या बाज़ार क्षेत्र' : 'Target Route Group'}</span>
              </h3>

              {/* Route Group Selector */}
              <div className="space-y-1">
                <label className="text-[11px] sm:text-xs font-bold text-slate-700 block">
                  {language === 'hi' ? 'डिलीवरी रूट चुनें:' : 'Select Scheduled Route:'}
                </label>
                <select
                  value={selectedRouteGroupId}
                  onChange={(e) => setSelectedRouteGroupId(e.target.value)}
                  className="w-full px-2.5 sm:px-3.5 py-1.5 sm:py-2.5 rounded-lg sm:rounded-xl border border-slate-300 text-xs font-medium text-slate-900 bg-white focus:outline-none focus:ring-2 focus:ring-[#17307A]"
                >
                  <option value="ALL">
                    {language === 'hi' ? 'सभी बाज़ार क्षेत्र' : 'All Market Areas'}
                  </option>
                  {initialRouteGroups.map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.name} (Cut-off {g.cutoffTime} IST)
                    </option>
                  ))}
                </select>
              </div>

              {/* Follow-up reminder configuration */}
              <div className="p-2.5 sm:p-3.5 bg-slate-50 border border-slate-200 rounded-xl sm:rounded-2xl space-y-1.5 sm:space-y-2 text-xs">
                <label className="flex items-center gap-2 font-semibold text-slate-800 cursor-pointer text-[11px] sm:text-xs">
                  <input
                    type="checkbox"
                    checked={scheduleFollowUp}
                    onChange={(e) => setScheduleFollowUp(e.target.checked)}
                    className="rounded text-[#17307A] focus:ring-[#17307A]"
                  />
                  <span>
                    {language === 'hi'
                      ? 'अनुत्तरित दुकानों को एक फॉलो-अप स्मरण भेजें'
                      : 'Send 1 follow-up reminder to non-responders'}
                  </span>
                </label>
                {scheduleFollowUp && (
                  <div className="flex items-center gap-2 pl-5 text-[10px] sm:text-[11px] text-slate-600">
                    <span>{language === 'hi' ? 'कट-ऑफ से' : 'Timing:'}</span>
                    <select
                      value={followUpHours}
                      onChange={(e) => setFollowUpHours(Number(e.target.value))}
                      className="px-2 py-0.5 sm:py-1 rounded-md sm:rounded-lg border border-slate-300 font-bold bg-white text-xs"
                    >
                      <option value={1}>1 {language === 'hi' ? 'घंटा पूर्व' : 'hour before cut-off'}</option>
                      <option value={2}>2 {language === 'hi' ? 'घंटे पूर्व' : 'hours before cut-off'}</option>
                      <option value={3}>3 {language === 'hi' ? 'घंटे पूर्व' : 'hours before cut-off'}</option>
                    </select>
                  </div>
                )}
              </div>

              {/* Action Button */}
              <div className="pt-1">
                <button
                  type="button"
                  disabled={
                    sending ||
                    loadingPreview ||
                    !previewData ||
                    previewData.eligibleCount === 0
                  }
                  onClick={handleSendCampaign}
                  className="w-full py-2 sm:py-3 px-3 sm:px-4 rounded-lg sm:rounded-xl bg-[#F58220] hover:bg-[#F58220]/95 text-white font-semibold text-xs sm:text-sm shadow-xs flex items-center justify-center gap-1.5 transition-all active:scale-[0.99] disabled:opacity-50 cursor-pointer"
                >
                  <Send className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-white" />
                  <span>
                    {sending
                      ? language === 'hi'
                        ? 'संदेश कतार में डाले जा रहे हैं...'
                        : 'Queueing Reminders...'
                      : language === 'hi'
                      ? `आउटबॉक्स में कतारबद्ध करें (${previewData?.eligibleCount || 0} दुकानें)`
                      : `Queue in Test Outbox (${previewData?.eligibleCount || 0} Shops)`}
                  </span>
                </button>
                <div className="flex items-center justify-between text-[10px] sm:text-[11px] text-slate-600 bg-blue-50/60 border border-blue-100 rounded-xl px-2.5 py-1.5 mt-2">
                  <span className="font-medium">
                    {language === 'hi' ? 'मासिक संदेश शेष:' : 'Monthly Messages Remaining:'}
                  </span>
                  <span className="font-black text-[#17307A]">
                    {(previewData?.planMessages?.remainingMessages ?? (initialPlanUsage.monthlyLimit - initialPlanUsage.sentThisMonth)).toLocaleString()} / {initialPlanUsage.monthlyLimit.toLocaleString()}
                  </span>
                </div>
                <span className="block text-[10px] sm:text-[11px] text-slate-400 text-center mt-1.5">
                  {language === 'hi'
                    ? '* रिमाइंडर आउटबॉक्स में सुरक्षित रूप से कतारबद्ध किए जाते हैं।'
                    : '* Reminders are safely queued in the outbox ready for dispatch.'}
                </span>
              </div>
            </div>
          </div>

          {/* Right Column: Audience Breakdown & Message Preview */}
          <div className="lg:col-span-7 space-y-3 sm:space-y-4">
            {/* Audience Analysis Cards (Differentiated visual identity & reduced gap) */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 sm:gap-2.5 text-xs">
              {/* Total Target */}
              <div className="p-2 sm:p-2.5 bg-white rounded-xl sm:rounded-2xl border border-slate-200 shadow-2xs flex items-center justify-between px-2.5 sm:px-3 text-left">
                <div className="min-w-0">
                  <span className="text-[9px] sm:text-[10px] font-bold text-slate-400 uppercase block truncate">
                    {language === 'hi' ? 'कुल दुकानें' : 'Total Target'}
                  </span>
                  <span className="font-extrabold text-sm sm:text-base md:text-lg text-slate-900 block mt-0.5">
                    {previewData?.totalTargets || 0}
                  </span>
                </div>
                <div className="w-6 h-6 rounded-lg bg-slate-100 text-slate-600 flex items-center justify-center shrink-0">
                  <Users className="w-3.5 h-3.5" />
                </div>
              </div>

              {/* Eligible to Send - Hero Card */}
              <div className="p-2 sm:p-2.5 bg-emerald-50/90 rounded-xl sm:rounded-2xl border border-emerald-300/90 shadow-2xs flex items-center justify-between px-2.5 sm:px-3 text-left ring-1 ring-emerald-400/20">
                <div className="min-w-0">
                  <span className="text-[9px] sm:text-[10px] font-bold text-emerald-700 uppercase block truncate">
                    {language === 'hi' ? 'पात्र दुकानें' : 'Eligible to Send'}
                  </span>
                  <span className="font-black text-sm sm:text-base md:text-lg text-emerald-800 block mt-0.5">
                    {previewData?.eligibleCount || 0}
                  </span>
                </div>
                <div className="w-6 h-6 rounded-lg bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-2xs">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                </div>
              </div>

              {/* Credit Hold - Warning Card */}
              <div className="p-2 sm:p-2.5 bg-amber-50/70 rounded-xl sm:rounded-2xl border border-amber-200/80 shadow-2xs flex items-center justify-between px-2.5 sm:px-3 text-left">
                <div className="min-w-0">
                  <span className="text-[9px] sm:text-[10px] font-bold text-amber-700 uppercase block truncate">
                    {language === 'hi' ? 'क्रेडिट होल्ड' : 'Credit Hold'}
                  </span>
                  <span className="font-extrabold text-sm sm:text-base md:text-lg text-amber-800 block mt-0.5">
                    {previewData?.excludedBreakdown.CREDIT_HOLD || 0}
                  </span>
                </div>
                <div className="w-6 h-6 rounded-lg bg-amber-100 text-amber-700 flex items-center justify-center shrink-0">
                  <ShieldAlert className="w-3.5 h-3.5" />
                </div>
              </div>

              {/* Ordered / Opt-Out - Inactive Card */}
              <div className="p-2 sm:p-2.5 bg-slate-50/80 rounded-xl sm:rounded-2xl border border-slate-200/80 shadow-2xs flex items-center justify-between px-2.5 sm:px-3 text-left">
                <div className="min-w-0">
                  <span className="text-[9px] sm:text-[10px] font-bold text-slate-500 uppercase block truncate">
                    {language === 'hi' ? 'अन्य बाहर' : 'Ordered / Opt-Out'}
                  </span>
                  <span className="font-extrabold text-sm sm:text-base md:text-lg text-slate-700 block mt-0.5">
                    {(previewData?.excludedBreakdown.ALREADY_ORDERED || 0) +
                      (previewData?.excludedBreakdown.OPTED_OUT || 0) +
                      (previewData?.excludedBreakdown.NO_PHONE || 0)}
                  </span>
                </div>
                <div className="w-6 h-6 rounded-lg bg-slate-200/80 text-slate-600 flex items-center justify-center shrink-0">
                  <Check className="w-3.5 h-3.5" />
                </div>
              </div>
            </div>

            {/* Excluded Shops Detail Card */}
            {previewData && previewData.excludedShops.length > 0 && (
              <div className="p-4 bg-white rounded-3xl border border-slate-200 space-y-2.5 shadow-2xs">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                    <ShieldAlert className="w-4 h-4 text-amber-600" />
                    <span>
                      {language === 'hi' ? 'छोड़ी गई दुकानें एवं कारण' : 'Excluded Shops & Exact Reasons'}
                    </span>
                  </span>
                  <span className="text-[11px] font-mono text-slate-400">
                    {previewData.excludedShops.length} {language === 'hi' ? 'दुकानें' : 'excluded'}
                  </span>
                </div>

                <div className="max-h-44 overflow-y-auto space-y-1.5 pr-1 divide-y divide-slate-100 text-xs">
                  {previewData.excludedShops.map((ex, idx) => (
                    <div key={idx} className="pt-1.5 first:pt-0 flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <span className="font-bold text-slate-900 block truncate">{ex.shopName}</span>
                        <span className="text-[10px] text-slate-500 block truncate">
                          {ex.areaName} • +91 {ex.phone}
                        </span>
                      </div>
                      <span
                        className={`text-[10px] font-extrabold px-2 py-0.5 rounded-md shrink-0 border ${
                          ex.reason === 'CREDIT_HOLD'
                            ? 'bg-amber-100 text-amber-900 border-amber-300'
                            : ex.reason === 'ALREADY_ORDERED'
                            ? 'bg-blue-100 text-blue-900 border-blue-300'
                            : 'bg-slate-100 text-slate-700 border-slate-300'
                        }`}
                      >
                        {language === 'hi' ? ex.reasonLabelHindi : ex.reasonLabel}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Personalized Message Preview Card */}
            <div className="p-4 sm:p-5 bg-gradient-to-br from-[#17307A] to-[#11235A] text-white rounded-3xl shadow-md space-y-3">
              <div className="flex items-center justify-between border-b border-white/10 pb-2">
                <span className="text-xs font-bold text-blue-200 flex items-center gap-1.5">
                  <Eye className="w-4 h-4 text-[#F58220]" />
                  <span>{language === 'hi' ? 'व्यक्तिगत संदेश पूर्वावलोकन' : 'Live WhatsApp Message Preview'}</span>
                </span>
                <span className="text-[10px] bg-white/10 px-2 py-0.5 rounded text-white font-mono">
                  order_reminder
                </span>
              </div>

              <div className="p-3.5 bg-white/10 rounded-2xl text-xs font-mono leading-relaxed whitespace-pre-wrap border border-white/15 text-blue-50">
                {language === 'hi'
                  ? previewData?.messagePreview.hi
                  : previewData?.messagePreview.en}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* TAB 2: CAMPAIGN SUMMARY & HISTORICAL METRICS             */}
      {/* ======================================================== */}
      {activeTab === 'SUMMARY' && (
        <div className="space-y-4">
          <div className="bg-white rounded-3xl border border-slate-200 p-5 shadow-xs">
            <h3 className="font-extrabold text-sm text-slate-900 mb-4">
              {language === 'hi' ? 'पूर्व अभियानों का प्रदर्शन रिकॉर्ड' : 'Campaign Conversion & Response Summary'}
            </h3>

            {initialCampaigns.length === 0 ? (
              <div className="p-8 text-center text-slate-400 space-y-2 text-xs">
                <Inbox className="w-8 h-8 mx-auto text-slate-300" />
                <p>{language === 'hi' ? 'कोई पूर्व अभियान दर्ज नहीं है।' : 'No campaigns dispatched yet.'}</p>
              </div>
            ) : (
              <div className="divide-y divide-slate-100 text-xs">
                {initialCampaigns.map((camp) => {
                  const conversionRate =
                    camp.sentCount > 0
                      ? Math.round((camp.orderedCount / camp.sentCount) * 100)
                      : 0;

                  return (
                    <div
                      key={camp.id}
                      className="py-4 first:pt-0 last:pb-0 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-extrabold text-sm text-slate-900">
                            {camp.name}
                          </span>
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-blue-100 text-[#17307A] border border-blue-200">
                            {camp.status}
                          </span>
                        </div>
                        <span className="text-[11px] text-slate-400 block">
                          {camp.routeGroupName} •{' '}
                          {new Date(camp.createdAt).toLocaleString('en-IN', {
                            day: 'numeric',
                            month: 'short',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>
                      </div>

                      {/* 4 Conversion Metrics */}
                      <div className="grid grid-cols-4 gap-2 text-center shrink-0">
                        <div className="p-2 bg-slate-50 rounded-xl border border-slate-200 min-w-16">
                          <span className="text-[9px] font-bold text-slate-400 uppercase block">
                            {language === 'hi' ? 'कतारबद्ध' : 'Queued'}
                          </span>
                          <span className="font-black text-xs sm:text-sm text-slate-900">
                            {camp.sentCount}
                          </span>
                        </div>
                        <div className="p-2 bg-blue-50 rounded-xl border border-blue-200 min-w-16">
                          <span className="text-[9px] font-bold text-blue-700 uppercase block">
                            {language === 'hi' ? 'खोला गया' : 'Opened'}
                          </span>
                          <span className="font-black text-xs sm:text-sm text-blue-900">
                            {camp.openedCount}
                          </span>
                        </div>
                        <div className="p-2 bg-emerald-50 rounded-xl border border-emerald-200 min-w-16">
                          <span className="text-[9px] font-bold text-emerald-700 uppercase block">
                            {language === 'hi' ? 'ऑर्डर' : 'Ordered'}
                          </span>
                          <span className="font-black text-xs sm:text-sm text-emerald-900">
                            {camp.orderedCount}
                          </span>
                        </div>
                        <div className="p-2 bg-orange-50 rounded-xl border border-orange-200 min-w-20">
                          <span className="text-[9px] font-bold text-orange-700 uppercase block">
                            {language === 'hi' ? 'ऑर्डर मूल्य' : 'Value'}
                          </span>
                          <span className="font-black text-xs sm:text-sm text-[#17307A] font-mono">
                            {formatPaise(camp.totalOrderValuePaise)}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* TAB 3: MOCK OUTBOX QUEUE                                */}
      {/* ======================================================== */}
      {activeTab === 'OUTBOX' && (
        <div className="bg-white rounded-3xl border border-slate-200 p-5 space-y-4 shadow-xs">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div>
              <h3 className="font-extrabold text-sm text-slate-900 flex items-center gap-2">
                <Inbox className="w-4 h-4 text-[#F58220]" />
                <span>
                  {language === 'hi'
                    ? 'परीक्षण आउटबॉक्स संदेश कतार'
                    : 'Test Outbox Message Queue'}
                </span>
              </h3>
              <span className="text-xs text-slate-400">
                {language === 'hi'
                  ? 'पायलट मोड: सभी संदेश यहाँ सुरक्षित रूप से परीक्षण आउटबॉक्स में कतारबद्ध रहते हैं।'
                  : 'Pilot Mode: All messages are safely queued in the test outbox without incurring external SMS costs.'}
              </span>
            </div>
            <span className="text-xs font-mono font-bold text-slate-500 bg-slate-100 px-2.5 py-1 rounded-xl">
              {outboxMessages.length} {language === 'hi' ? 'संदेश' : 'messages'}
            </span>
          </div>

          {loadingOutbox ? (
            <div className="p-8 text-center text-slate-400 text-xs">
              {language === 'hi' ? 'आउटबॉक्स लोड हो रहा है...' : 'Loading outbox...'}
            </div>
          ) : outboxMessages.length === 0 ? (
            <div className="p-8 text-center text-slate-400 space-y-2 text-xs">
              <Inbox className="w-8 h-8 mx-auto text-slate-300" />
              <p>{language === 'hi' ? 'आउटबॉक्स में कोई संदेश नहीं है।' : 'No messages currently in test outbox.'}</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-400 uppercase text-[10px] font-bold">
                    <th className="py-2.5 pr-3">{language === 'hi' ? 'दुकान एवं स्वामी' : 'Shop & Owner'}</th>
                    <th className="py-2.5 px-3">{language === 'hi' ? 'मोबाइल नंबर' : 'Phone'}</th>
                    <th className="py-2.5 px-3">{language === 'hi' ? 'बाज़ार क्षेत्र' : 'Area'}</th>
                    <th className="py-2.5 px-3">{language === 'hi' ? 'स्थिति' : 'Status'}</th>
                    <th className="py-2.5 px-3">{language === 'hi' ? 'समय' : 'Queued At'}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                  {outboxMessages.map((m) => (
                    <tr key={m.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3 pr-3">
                        <span className="font-bold text-slate-900 block">{m.shopName}</span>
                        <span className="text-[11px] text-slate-400">{m.ownerName}</span>
                      </td>
                      <td className="py-3 px-3 font-mono text-[11px]">+91 {m.recipientPhone}</td>
                      <td className="py-3 px-3">{m.areaName}</td>
                      <td className="py-3 px-3">
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-amber-100 text-amber-900 border border-amber-300">
                          <span>{language === 'hi' ? 'आउटबॉक्स कतार' : 'Queued in Test Outbox'}</span>
                        </span>
                      </td>
                      <td className="py-3 px-3 text-[11px] text-slate-400 font-mono">
                        {new Date(m.createdAt).toLocaleTimeString('en-IN', {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* 4. Tab: Festival Stock Suggestions (Part 2.F) */}
      {activeTab === 'FESTIVALS' && (
        <div className="bg-white border border-slate-200 rounded-3xl p-5 shadow-2xs space-y-5 animate-in fade-in duration-150">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
            <div>
              <h3 className="text-base font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
                <Calendar className="w-4 h-4 text-[#F58220]" />
                <span>
                  {language === 'hi'
                    ? 'त्योहार विशेष स्टॉक सुझाव'
                    : 'Festival Stock Suggestions Window'}
                </span>
              </h3>
              <span className="text-xs text-slate-400">
                {language === 'hi'
                  ? 'वितरक द्वारा निर्धारित तिथियों के दौरान सभी दुकानदार पोर्टल पर संबंधित उत्पादों के सुझाव स्वतः दिखते हैं।'
                  : 'Retailers automatically see stocking suggestions during the configured festival date window without invented data.'}
              </span>
            </div>

            <button
              type="button"
              onClick={() => setIsCreatingFestival(true)}
              className="px-3.5 py-2 rounded-xl bg-[#17307A] hover:bg-[#17307A]/90 text-white font-bold text-xs shadow-2xs transition-colors flex items-center gap-1.5 cursor-pointer self-start sm:self-auto"
            >
              <Sparkles className="w-3.5 h-3.5 text-[#F58220]" />
              <span>{language === 'hi' ? '+ नया त्योहार सुझाव' : '+ Add Festival Window'}</span>
            </button>
          </div>

          {loadingFestivals ? (
            <div className="p-8 text-center text-xs text-slate-400">
              {language === 'hi' ? 'लोड हो रहा है...' : 'Loading festival suggestions...'}
            </div>
          ) : festivals.length === 0 ? (
            <div className="p-8 text-center text-xs text-slate-400 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
              {language === 'hi'
                ? 'वर्तमान में कोई सक्रिय त्योहार सुझाव नहीं है।'
                : 'No festival suggestions configured yet.'}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {festivals.map((fest: any) => {
                const now = new Date();
                const start = new Date(fest.start_date);
                const end = new Date(fest.end_date);
                const isActive = start <= now && end >= now;

                let parsedItems: any[] = [];
                try {
                  parsedItems = JSON.parse(fest.items_json);
                } catch {}

                return (
                  <div
                    key={fest.id}
                    className="p-4 rounded-2xl border border-slate-200 bg-slate-50/50 space-y-3 shadow-2xs"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <span className="font-extrabold text-slate-900 text-sm block">
                          {fest.festival_name}
                        </span>
                        <span className="text-xs text-slate-400 block mt-0.5">
                          {new Date(fest.start_date).toLocaleDateString('en-IN', {
                            day: 'numeric',
                            month: 'short',
                          })}{' '}
                          -{' '}
                          {new Date(fest.end_date).toLocaleDateString('en-IN', {
                            day: 'numeric',
                            month: 'short',
                            year: 'numeric',
                          })}
                        </span>
                      </div>

                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                          isActive
                            ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                            : 'bg-slate-100 text-slate-500 border-slate-200'
                        }`}
                      >
                        {isActive
                          ? (language === 'hi' ? 'सक्रिय विंडो' : 'Active Window')
                          : (language === 'hi' ? 'समाप्त' : 'Expired')}
                      </span>
                    </div>

                    {fest.notes && (
                      <p className="text-xs text-slate-600 bg-white p-2.5 rounded-xl border border-slate-200/80">
                        {fest.notes}
                      </p>
                    )}

                    <div className="text-[11px] text-slate-500 pt-1 border-t border-slate-200/60 flex items-center justify-between">
                      <span>
                        {language === 'hi' ? 'सुझाए गए उत्पाद:' : 'Suggested items:'}{' '}
                        <strong>{parsedItems.length}</strong>
                      </span>
                      <span className="text-[#17307A] font-semibold">
                        {language === 'hi' ? 'दुकानदार पोर्टल पर लाइव' : 'Live on Retailer Portal'}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Create Festival Modal */}
          {isCreatingFestival && (
            <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-2xs flex items-center justify-center p-4">
              <div className="bg-white rounded-2xl max-w-md w-full p-5 space-y-4 shadow-2xl animate-in zoom-in-95 duration-150">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <h4 className="font-bold text-slate-900 text-sm">
                    {language === 'hi' ? 'नया त्योहार स्टॉक विंडो जोड़ें' : 'Create Festival Stock Window'}
                  </h4>
                  <button
                    type="button"
                    onClick={() => setIsCreatingFestival(false)}
                    className="w-7 h-7 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 flex items-center justify-center"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                {festError && (
                  <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl text-xs">
                    {festError}
                  </div>
                )}

                <form onSubmit={handleSaveFestival} className="space-y-3 text-xs">
                  <div>
                    <label className="font-bold text-slate-700 block mb-1">
                      {language === 'hi' ? 'त्योहार का नाम' : 'Festival Name'} *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder={language === 'hi' ? 'जैसे: होली विशेष स्टॉक' : 'e.g. Holi Special Demand'}
                      value={festFormName}
                      onChange={(e) => setFestFormName(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-slate-300 font-semibold focus:outline-none focus:ring-2 focus:ring-[#17307A]"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="font-bold text-slate-700 block mb-1">
                        {language === 'hi' ? 'प्रारंभ तिथि' : 'Start Date'} *
                      </label>
                      <input
                        type="date"
                        required
                        value={festFormStart}
                        onChange={(e) => setFestFormStart(e.target.value)}
                        className="w-full px-3 py-2 rounded-xl border border-slate-300 font-semibold focus:outline-none focus:ring-2 focus:ring-[#17307A]"
                      />
                    </div>
                    <div>
                      <label className="font-bold text-slate-700 block mb-1">
                        {language === 'hi' ? 'अंतिम तिथि' : 'End Date'} *
                      </label>
                      <input
                        type="date"
                        required
                        value={festFormEnd}
                        onChange={(e) => setFestFormEnd(e.target.value)}
                        className="w-full px-3 py-2 rounded-xl border border-slate-300 font-semibold focus:outline-none focus:ring-2 focus:ring-[#17307A]"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="font-bold text-slate-700 block mb-1">
                      {language === 'hi' ? 'विशेष टिप्पणी' : 'Stocking Notes'}
                    </label>
                    <textarea
                      rows={2}
                      placeholder={
                        language === 'hi'
                          ? 'त्योहार से पूर्व खुदरा दुकानों पर अनुमानित मांग...'
                          : 'Retail demand advice for shopkeepers...'
                      }
                      value={festFormNotes}
                      onChange={(e) => setFestFormNotes(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-slate-300 font-medium focus:outline-none focus:ring-2 focus:ring-[#17307A]"
                    />
                  </div>

                  <div className="flex gap-2 pt-2">
                    <button
                      type="button"
                      onClick={() => setIsCreatingFestival(false)}
                      className="flex-1 py-2.5 rounded-xl border border-slate-300 text-slate-700 font-semibold"
                    >
                      {language === 'hi' ? 'रद्द करें' : 'Cancel'}
                    </button>
                    <button
                      type="submit"
                      disabled={festSaving}
                      className="flex-1 py-2.5 rounded-xl bg-[#17307A] text-white font-bold hover:bg-[#17307A]/90 transition-colors disabled:opacity-50"
                    >
                      {festSaving
                        ? (language === 'hi' ? 'सहेजा जा रहा है...' : 'Saving...')
                        : (language === 'hi' ? 'सहेजें' : 'Save')}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
