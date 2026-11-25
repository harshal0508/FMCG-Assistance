'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useLanguage } from '@/lib/i18n/context';
import {
  Settings,
  Building2,
  Clock,
  Receipt,
  QrCode,
  MapPin,
  Phone,
  Save,
  CheckCircle2,
  AlertCircle,
  Shield,
  HelpCircle,
  LogOut,
} from 'lucide-react';

interface TenantSettings {
  id: string;
  name: string;
  owner_name: string;
  phone: string | null;
  email: string | null;
  upi_id: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  timezone: string;
  order_cutoff_time: string;
  enable_gst: boolean;
}

interface Props {
  initialSettings: TenantSettings;
}

export default function SettingsForm({ initialSettings }: Props) {
  const router = useRouter();
  const { t, language } = useLanguage();
  const [formData, setFormData] = useState<TenantSettings>(initialSettings);
  const [saving, setSaving] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } catch {
      // ignore
    }
    router.push('/d/login');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setErrorMsg(null);
    setSavedSuccess(false);

    try {
      const res = await fetch('/api/distributor/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      const data = await res.json();
      if (!res.ok) {
        setErrorMsg(data.error || 'Failed to save settings');
      } else {
        setSavedSuccess(true);
        setTimeout(() => setSavedSuccess(false), 4000);
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Network error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#17307A] tracking-tight flex items-center gap-2">
            <Settings className="w-6 h-6 text-[#F58220]" />
            <span>{t('settingsTitle')}</span>
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            {t('settingsSubtitle')}
          </p>
        </div>

        {savedSuccess && (
          <div className="px-3.5 py-2 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold flex items-center gap-2 animate-in fade-in">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            <span>{t('settingsSaved')}</span>
          </div>
        )}
      </div>

      {errorMsg && (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Card 1: Business Profile */}
        <div className="bg-white border border-slate-200/80 rounded-2xl shadow-xs p-5 sm:p-6 space-y-4">
          <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
            <Building2 className="w-5 h-5 text-[#17307A]" />
            <h3 className="font-bold text-sm text-slate-900">Distributor Business Profile</h3>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                {t('businessName')}
              </label>
              <input
                type="text"
                required
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs sm:text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#17307A]/20 focus:border-[#17307A]"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                {t('ownerNameLabel')}
              </label>
              <input
                type="text"
                required
                value={formData.owner_name}
                onChange={(e) => setFormData({ ...formData, owner_name: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs sm:text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#17307A]/20 focus:border-[#17307A]"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                {t('phoneLabel')}
              </label>
              <input
                type="tel"
                value={formData.phone || ''}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs sm:text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#17307A]/20 focus:border-[#17307A]"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                {t('settlementUpi')}
              </label>
              <input
                type="text"
                value={formData.upi_id || ''}
                onChange={(e) => setFormData({ ...formData, upi_id: e.target.value })}
                placeholder="e.g. merchant@icici"
                className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs sm:text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#17307A]/20 focus:border-[#17307A]"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              {t('businessAddress')}
            </label>
            <input
              type="text"
              value={formData.address || ''}
              onChange={(e) => setFormData({ ...formData, address: e.target.value })}
              className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs sm:text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#17307A]/20 focus:border-[#17307A]"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">City</label>
              <input
                type="text"
                value={formData.city || ''}
                onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs sm:text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#17307A]/20 focus:border-[#17307A]"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">State</label>
              <input
                type="text"
                value={formData.state || ''}
                onChange={(e) => setFormData({ ...formData, state: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs sm:text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#17307A]/20 focus:border-[#17307A]"
              />
            </div>
          </div>
        </div>

        {/* Card 2: Operations & Cut-off */}
        <div className="bg-white border border-slate-200/80 rounded-2xl shadow-xs p-5 sm:p-6 space-y-4">
          <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
            <Clock className="w-5 h-5 text-[#17307A]" />
            <h3 className="font-bold text-sm text-slate-900">Delivery Schedule & Cut-off</h3>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                {t('cutoffTime')}
              </label>
              <input
                type="time"
                required
                value={formData.order_cutoff_time}
                onChange={(e) => setFormData({ ...formData, order_cutoff_time: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs sm:text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#17307A]/20 focus:border-[#17307A]"
              />
              <span className="text-[11px] text-slate-500 mt-1 block">
                Orders received before cut-off are scheduled for next-morning truck dispatch.
              </span>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Timezone (IST)
              </label>
              <input
                type="text"
                disabled
                value={formData.timezone}
                className="w-full px-3 py-2 border border-slate-200 bg-slate-50 rounded-xl text-xs sm:text-sm text-slate-500 cursor-not-allowed"
              />
              <span className="text-[11px] text-slate-500 mt-1 block">
                All midnight transitions and cut-offs run strictly on Asia/Kolkata timezone.
              </span>
            </div>
          </div>
        </div>

        {/* Card 3: GST Settings */}
        <div className="bg-white border border-slate-200/80 rounded-2xl shadow-xs p-5 sm:p-6 space-y-4">
          <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
            <Receipt className="w-5 h-5 text-[#17307A]" />
            <h3 className="font-bold text-sm text-slate-900">GST Billing Preferences</h3>
          </div>

          <div className="flex items-center justify-between p-4 bg-slate-50 rounded-xl border border-slate-200">
            <div className="space-y-0.5 max-w-lg">
              <label htmlFor="enable_gst_toggle" className="font-bold text-xs sm:text-sm text-slate-900 cursor-pointer">
                {t('enableGst')}
              </label>
              <p className="text-xs text-slate-500">
                {formData.enable_gst ? t('gstEnabledNotice') : t('gstDisabledNotice')}
              </p>
            </div>
            <input
              id="enable_gst_toggle"
              type="checkbox"
              checked={formData.enable_gst}
              onChange={(e) => setFormData({ ...formData, enable_gst: e.target.checked })}
              className="w-5 h-5 rounded border-slate-300 text-[#17307A] focus:ring-[#17307A] cursor-pointer"
            />
          </div>
        </div>

        {/* Card 4: Staff Session & Distributor Account Switcher */}
        <div className="bg-white border border-slate-200/80 rounded-2xl shadow-xs p-5 sm:p-6 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2">
              <LogOut className="w-5 h-5 text-rose-600" />
              <h3 className="font-bold text-sm text-slate-900">
                {language === 'hi' ? 'सत्र व वितरक खाता बदलें' : 'Session & Distributor Account'}
              </h3>
            </div>
            <span className="text-xs text-slate-400">
              {formData.name}
            </span>
          </div>

          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-4 bg-slate-50 rounded-xl border border-slate-200">
            <div>
              <span className="font-bold text-xs sm:text-sm text-slate-900 block">
                {language === 'hi' ? 'वर्तमान वितरक से लॉग आउट करें' : 'Log out of current distributor account'}
              </span>
              <p className="text-xs text-slate-500 mt-0.5">
                {language === 'hi'
                  ? 'इस डिवाइस से सत्र समाप्त करें और दूसरे वितरक खाते में लॉगिन करें।'
                  : 'End your session on this device and sign into another distributor account.'}
              </p>
            </div>

            <button
              type="button"
              onClick={handleLogout}
              className="px-4 py-2 rounded-xl bg-white hover:bg-rose-50 text-rose-700 font-bold text-xs border border-rose-200 hover:border-rose-300 transition-all flex items-center gap-1.5 shrink-0 shadow-2xs"
            >
              <LogOut className="w-4 h-4 text-rose-500" />
              <span>{t('logout')}</span>
            </button>
          </div>
        </div>

        {/* Primary Save Action */}
        <div className="flex justify-end pt-2">
          <button
            type="submit"
            disabled={saving}
            className="touch-target px-6 py-2.5 rounded-xl bg-[#17307A] text-white font-bold text-xs sm:text-sm hover:bg-[#17307A]/90 transition-all shadow-sm flex items-center gap-2 active:scale-95 disabled:opacity-50"
          >
            <Save className="w-4 h-4 text-[#F58220]" />
            <span>{saving ? '...' : t('saveSettings')}</span>
          </button>
        </div>
      </form>
    </div>
  );
}
