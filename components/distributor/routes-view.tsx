'use client';

import React, { useState } from 'react';
import { useTranslation } from '@/lib/i18n/context';
import {
  MapPin,
  Calendar,
  Clock,
  Package,
  Truck,
  Plus,
  Edit2,
  Check,
  AlertCircle,
  Sparkles,
  Info,
  CheckCircle2,
  ArrowRight,
} from 'lucide-react';

interface RouteGroupData {
  id: string;
  name: string;
  areas: { id: string; name: string }[];
  schedules: {
    id: string;
    order_day_of_week: number;
    order_cutoff_time: string;
    packing_day_of_week: number;
    delivery_day_of_week: number;
    is_active: boolean;
  }[];
}

interface AreaData {
  id: string;
  name: string;
  shopCount: number;
  assignedRouteGroupId: string | null;
}

interface Props {
  initialRouteGroups: RouteGroupData[];
  initialAreas: AreaData[];
  totalShops: number;
}

const DAY_LABELS_EN = [
  '',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
  'Sunday',
];

const DAY_LABELS_HI = [
  '',
  'सोमवार',
  'मंगलवार',
  'बुधवार',
  'गुरुवार',
  'शुक्रवार',
  'शनिवार',
  'रविवार',
];

export default function RoutesView({
  initialRouteGroups,
  initialAreas,
  totalShops,
}: Props) {
  const { language } = useTranslation();
  const [routeGroups, setRouteGroups] = useState<RouteGroupData[]>(initialRouteGroups);
  const [areas, setAreas] = useState<AreaData[]>(initialAreas);

  // Edit / Create modal state
  const [isEditing, setIsEditing] = useState(false);
  const [editingGroupId, setEditingGroupId] = useState<string | null>(null);
  const [formName, setFormName] = useState('');
  const [formOrderDay, setFormOrderDay] = useState(1);
  const [formCutoffTime, setFormCutoffTime] = useState('18:00');
  const [formPackingDay, setFormPackingDay] = useState(1);
  const [formDeliveryDay, setFormDeliveryDay] = useState(2);
  const [formSelectedAreaIds, setFormSelectedAreaIds] = useState<string[]>([]);
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveSuccessMessage, setSaveSuccessMessage] = useState<string | null>(null);

  const dayLabels = language === 'hi' ? DAY_LABELS_HI : DAY_LABELS_EN;

  const openCreateModal = () => {
    setEditingGroupId(null);
    setFormName('');
    setFormOrderDay(1);
    setFormCutoffTime('18:00');
    setFormPackingDay(1);
    setFormDeliveryDay(2);
    setFormSelectedAreaIds([]);
    setFormError(null);
    setIsEditing(true);
  };

  const openEditModal = (group: RouteGroupData) => {
    setEditingGroupId(group.id);
    setFormName(group.name);
    const sched = group.schedules[0] || {
      order_day_of_week: 1,
      order_cutoff_time: '18:00',
      packing_day_of_week: 1,
      delivery_day_of_week: 2,
    };
    setFormOrderDay(sched.order_day_of_week);
    setFormCutoffTime(sched.order_cutoff_time);
    setFormPackingDay(sched.packing_day_of_week);
    setFormDeliveryDay(sched.delivery_day_of_week);
    setFormSelectedAreaIds(group.areas.map((a) => a.id));
    setFormError(null);
    setIsEditing(true);
  };

  const toggleAreaSelection = (areaId: string) => {
    setFormSelectedAreaIds((prev) =>
      prev.includes(areaId) ? prev.filter((id) => id !== areaId) : [...prev, areaId]
    );
  };

  const handleSaveRoute = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    // Validation: Name
    if (!formName.trim()) {
      setFormError(
        language === 'hi'
          ? 'कृपया रूट का नाम दर्ज करें।'
          : 'Please enter a route group name.'
      );
      return;
    }

    // Validation: Time format
    if (!/^([01]\d|2[0-3]):([0-5]\d)$/.test(formCutoffTime)) {
      setFormError(
        language === 'hi'
          ? 'कट-ऑफ समय चौबीस घंटे प्रारूप में होना चाहिए।'
          : 'Cut-off time must be in HH:mm 24-hour format (e.g. 18:00).'
      );
      return;
    }

    // Validation: At least one area
    if (formSelectedAreaIds.length === 0) {
      setFormError(
        language === 'hi'
          ? 'कम से कम एक बाज़ार क्षेत्र का चयन आवश्यक है।'
          : 'At least one market area must be assigned to this route.'
      );
      return;
    }

    setSaving(true);
    try {
      const res = await fetch('/api/distributor/routes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          routeGroupId: editingGroupId,
          name: formName.trim(),
          orderDayOfWeek: formOrderDay,
          orderCutoffTime: formCutoffTime,
          packingDayOfWeek: formPackingDay,
          deliveryDayOfWeek: formDeliveryDay,
          assignedAreaIds: formSelectedAreaIds,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to save route schedule');
      }

      // Refresh list
      const refetch = await fetch('/api/distributor/routes');
      if (refetch.ok) {
        const refreshedData = await refetch.json();
        setRouteGroups(refreshedData.routeGroups);
        setAreas(refreshedData.areas);
      }

      setIsEditing(false);
      const msg =
        language === 'hi'
          ? 'रूट अनुसूची सफलतापूर्वक अद्यतन की गई।'
          : 'Route schedule and cut-off updated successfully.';
      setSaveSuccessMessage(msg);
      setTimeout(() => setSaveSuccessMessage(null), 4000);
    } catch (err: any) {
      setFormError(err.message || 'Error saving route');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4 sm:space-y-6 max-w-6xl mx-auto pb-12">
      {/* Top Header & Overview */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4 border-b border-slate-200 pb-3 sm:pb-4">
        <div>
          <h1 className="text-lg sm:text-xl md:text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
            <Truck className="w-5 h-5 sm:w-6 sm:h-6 text-[#17307A] shrink-0" />
            <span>
              {language === 'hi'
                ? 'साप्ताहिक डिलीवरी रूट एवं कट-ऑफ अनुसूची'
                : 'Weekly Delivery Routes & Cut-off Schedule'}
            </span>
          </h1>
        </div>

        <button
          type="button"
          onClick={openCreateModal}
          className="w-full sm:w-auto justify-center px-3 py-1.5 sm:px-4 sm:py-2.5 rounded-lg sm:rounded-xl bg-[#17307A] hover:bg-[#11235A] text-white font-semibold text-xs shadow-xs flex items-center gap-1.5 transition-all self-start sm:self-auto cursor-pointer"
        >
          <Plus className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-white" />
          <span>{language === 'hi' ? 'नया रूट जोड़ें' : 'Create Route Group'}</span>
        </button>
      </div>

      {/* Success Notification Banner */}
      {saveSuccessMessage && (
        <div className="p-3 sm:p-4 rounded-xl sm:rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs font-bold flex items-center gap-2 animate-in fade-in">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{saveSuccessMessage}</span>
        </div>
      )}

      {/* Weekly Schedule Grid Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 sm:gap-5">
        {routeGroups.map((group) => {
          const schedule = group.schedules[0] || {
            order_day_of_week: 1,
            order_cutoff_time: '18:00',
            packing_day_of_week: 1,
            delivery_day_of_week: 2,
          };

          const orderDayName = dayLabels[schedule.order_day_of_week] || 'Monday';
          const packingDayName = dayLabels[schedule.packing_day_of_week] || 'Monday';
          const deliveryDayName = dayLabels[schedule.delivery_day_of_week] || 'Tuesday';

          const totalShopsInGroup = group.areas.reduce((acc, a) => {
            const found = areas.find((ar) => ar.id === a.id);
            return acc + (found?.shopCount || 0);
          }, 0);

          return (
            <div
              key={group.id}
              className="bg-white rounded-xl sm:rounded-3xl border border-slate-200/90 shadow-2xs sm:shadow-sm hover:shadow-md transition-all p-3 sm:p-6 space-y-2.5 sm:space-y-5 flex flex-col justify-between"
            >
              <div className="space-y-3 sm:space-y-4">
                {/* Header */}
                <div className="flex items-start justify-between gap-3 border-b border-slate-100 pb-2.5 sm:pb-3">
                  <div>
                    <h3 className="font-black text-sm sm:text-base md:text-lg text-slate-900 leading-tight">
                      {group.name}
                    </h3>
                    <span className="text-[11px] sm:text-xs text-slate-500 font-medium">
                      {group.areas.length} {language === 'hi' ? 'बाज़ार क्षेत्र' : 'Areas'} • {totalShopsInGroup} {language === 'hi' ? 'संबद्ध दुकानें' : 'Registered Shops'}
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={() => openEditModal(group)}
                    className="p-1.5 sm:p-2 rounded-lg sm:rounded-xl bg-slate-100 hover:bg-blue-50 hover:text-[#17307A] text-slate-600 transition-colors cursor-pointer border border-slate-200"
                    title={language === 'hi' ? 'संपादित करें' : 'Edit Route'}
                  >
                    <Edit2 className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                  </button>
                </div>

                {/* 3-Step Operational Flow Grid (Compact on mobile) */}
                <div className="grid grid-cols-3 gap-1.5 sm:gap-2 text-center text-xs">
                  {/* Step 1: Ordering & Cut-off */}
                  <div className="p-1.5 sm:p-3 rounded-xl sm:rounded-2xl bg-blue-50/70 border border-blue-200/70 space-y-0.5 sm:space-y-1">
                    <span className="text-[8px] sm:text-[10px] font-bold text-slate-500 uppercase block truncate">
                      {language === 'hi' ? 'कट-ऑफ' : 'Cut-off'}
                    </span>
                    <span className="font-bold text-xs sm:text-sm text-[#17307A] block truncate">
                      {orderDayName}
                    </span>
                    <span className="inline-flex items-center justify-center gap-0.5 sm:gap-1 font-mono text-[9px] sm:text-[11px] font-bold text-orange-700 bg-orange-100 px-1 sm:px-2 py-0.5 rounded-md">
                      <Clock className="w-2.5 h-2.5 sm:w-3 sm:h-3 shrink-0" />
                      <span>{schedule.order_cutoff_time}</span>
                    </span>
                  </div>

                  {/* Step 2: Packing */}
                  <div className="p-1.5 sm:p-3 rounded-xl sm:rounded-2xl bg-amber-50/70 border border-amber-200/70 space-y-0.5 sm:space-y-1">
                    <span className="text-[8px] sm:text-[10px] font-bold text-slate-500 uppercase block truncate">
                      {language === 'hi' ? 'पैकिंग' : 'Packing'}
                    </span>
                    <span className="font-bold text-xs sm:text-sm text-amber-900 block truncate">
                      {packingDayName}
                    </span>
                    <span className="text-[9px] sm:text-[11px] text-slate-500 block truncate">
                      {language === 'hi' ? 'रात्रि लोडिंग' : 'Evening Batch'}
                    </span>
                  </div>

                  {/* Step 3: Truck Delivery */}
                  <div className="p-1.5 sm:p-3 rounded-xl sm:rounded-2xl bg-emerald-50/70 border border-emerald-200/70 space-y-0.5 sm:space-y-1">
                    <span className="text-[8px] sm:text-[10px] font-bold text-slate-500 uppercase block truncate">
                      {language === 'hi' ? 'डिलीवरी' : 'Delivery'}
                    </span>
                    <span className="font-bold text-xs sm:text-sm text-emerald-900 block truncate">
                      {deliveryDayName}
                    </span>
                    <span className="text-[9px] sm:text-[11px] text-slate-500 block truncate">
                      {language === 'hi' ? 'प्रातः' : 'Morning Run'}
                    </span>
                  </div>
                </div>

                {/* Assigned Market Areas */}
                <div className="space-y-1.5">
                  <span className="text-[11px] font-bold text-slate-500 uppercase block">
                    {language === 'hi' ? 'संबद्ध बाज़ार क्षेत्र' : 'Assigned Market Areas'}:
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {group.areas.map((area) => (
                      <span
                        key={area.id}
                        className="inline-flex items-center gap-1 px-3 py-1 rounded-xl bg-slate-100 border border-slate-200 text-xs font-semibold text-slate-800"
                      >
                        <MapPin className="w-3 h-3 text-slate-500" />
                        <span>{area.name}</span>
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              {/* Status Footer */}
              <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
                <span className="flex items-center gap-1 font-semibold text-emerald-700">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>{language === 'hi' ? 'सक्रिय साप्ताहिक अनुसूची' : 'Active Weekly Schedule'}</span>
                </span>
                <span className="font-mono text-[11px] text-slate-400">
                  ID: {group.id.slice(0, 10)}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Edit / Create Route Group Modal */}
      {isEditing && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white rounded-3xl max-w-xl w-full p-6 shadow-2xl border border-slate-200 space-y-5 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="font-black text-lg text-slate-900">
                {editingGroupId
                  ? language === 'hi'
                    ? 'रूट अनुसूची संपादित करें'
                    : 'Edit Route Group Schedule'
                  : language === 'hi'
                  ? 'नया रूट समूह बनाएं'
                  : 'Create Route Group'}
              </h3>
              <button
                type="button"
                onClick={() => setIsEditing(false)}
                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center font-bold text-sm cursor-pointer"
              >
                ✕
              </button>
            </div>

            {formError && (
              <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-bold flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                <span>{formError}</span>
              </div>
            )}

            <form onSubmit={handleSaveRoute} className="space-y-4 text-xs">
              {/* Route Group Name */}
              <div>
                <label className="font-bold text-slate-700 block mb-1">
                  {language === 'hi' ? 'रूट समूह का नाम' : 'Route Group Name'} *
                </label>
                <input
                  type="text"
                  required
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder={
                    language === 'hi'
                      ? 'उदा. सोमवार शहर रूट'
                      : 'e.g. Monday City Central Route'
                  }
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-[#17307A]"
                />
              </div>

              {/* Schedule Selectors (Order Day, Cut-off, Packing Day, Delivery Day) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">
                    {language === 'hi' ? 'ऑर्डर दिवस' : 'Order Day'} *
                  </label>
                  <select
                    value={formOrderDay}
                    onChange={(e) => setFormOrderDay(Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-[#17307A]"
                  >
                    {[1, 2, 3, 4, 5, 6, 7].map((d) => (
                      <option key={d} value={d}>
                        {dayLabels[d]}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="font-bold text-slate-700 block mb-1">
                    {language === 'hi' ? 'ऑर्डर कट-ऑफ समय' : 'Cut-off Time (24h IST)'} *
                  </label>
                  <input
                    type="time"
                    required
                    value={formCutoffTime}
                    onChange={(e) => setFormCutoffTime(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs font-mono font-bold focus:outline-none focus:ring-2 focus:ring-[#17307A]"
                  />
                </div>

                <div>
                  <label className="font-bold text-slate-700 block mb-1">
                    {language === 'hi' ? 'पैकिंग दिवस' : 'Packing Day'} *
                  </label>
                  <select
                    value={formPackingDay}
                    onChange={(e) => setFormPackingDay(Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-[#17307A]"
                  >
                    {[1, 2, 3, 4, 5, 6, 7].map((d) => (
                      <option key={d} value={d}>
                        {dayLabels[d]}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="font-bold text-slate-700 block mb-1">
                    {language === 'hi' ? 'डिलीवरी दिवस' : 'Delivery Day'} *
                  </label>
                  <select
                    value={formDeliveryDay}
                    onChange={(e) => setFormDeliveryDay(Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-[#17307A]"
                  >
                    {[1, 2, 3, 4, 5, 6, 7].map((d) => (
                      <option key={d} value={d}>
                        {dayLabels[d]}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Area Assignment Checkboxes */}
              <div className="pt-2">
                <label className="font-bold text-slate-700 block mb-1.5">
                  {language === 'hi'
                    ? 'इस रूट से संबद्ध बाज़ार क्षेत्र चुनें:'
                    : 'Assign Market Areas to this Route:'}
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 border border-slate-200 rounded-2xl p-3 bg-slate-50/50 max-h-48 overflow-y-auto">
                  {areas.map((a) => {
                    const isSelected = formSelectedAreaIds.includes(a.id);
                    const isOtherGroup =
                      a.assignedRouteGroupId &&
                      a.assignedRouteGroupId !== editingGroupId;

                    return (
                      <label
                        key={a.id}
                        className={`p-2.5 rounded-xl border flex items-center justify-between cursor-pointer transition-colors ${
                          isSelected
                            ? 'bg-blue-50/80 border-[#17307A] text-[#17307A] font-bold'
                            : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                        }`}
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleAreaSelection(a.id)}
                            className="rounded border-slate-300 text-[#17307A] focus:ring-[#17307A]"
                          />
                          <span className="truncate">{a.name}</span>
                        </div>
                        <span className="text-[10px] text-slate-400 shrink-0 font-medium ml-1">
                          {a.shopCount} {language === 'hi' ? 'दुकानें' : 'shops'}
                        </span>
                      </label>
                    );
                  })}
                </div>
              </div>

              {/* Actions */}
              <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsEditing(false)}
                  className="px-4 py-2.5 rounded-xl border border-slate-300 text-slate-700 font-bold hover:bg-slate-50 cursor-pointer"
                >
                  {language === 'hi' ? 'रद्द करें' : 'Cancel'}
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-5 py-2.5 rounded-xl bg-[#17307A] hover:bg-[#11235A] text-white font-extrabold shadow-md shadow-blue-950/20 cursor-pointer disabled:opacity-50"
                >
                  {saving
                    ? language === 'hi'
                      ? 'सुरक्षित हो रहा है...'
                      : 'Saving...'
                    : language === 'hi'
                    ? 'अनुसूची सहेजें'
                    : 'Save Route Schedule'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
