'use client';

import React from 'react';
import Link from 'next/link';
import {
  Store,
  Building2,
  ArrowLeftRight,
  Check,
  LogOut,
  CreditCard,
  Phone,
} from 'lucide-react';

interface DistributorItem {
  id: string;
  name: string;
  owner_name: string;
  phone: string;
  address: string;
  city: string;
  state: string;
  upi_id: string;
  order_cutoff_time: string;
  category_focus: string;
  category_focus_hi: string;
  badge: string;
  badge_hi: string;
  brands: string[];
}

interface Props {
  shop: {
    id: string;
    name: string;
    owner_name: string;
    phone: string;
    address: string;
    area_name: string;
  };
  activeDistributor: DistributorItem;
  activeDistributorId: string;
  registeredDistributors: DistributorItem[];
  language: 'en' | 'hi';
  onSwitchDistributor: (distId: string) => void;
  onOpenDistributorModal: () => void;
  onToggleLanguage: () => void;
}

export default function ProfileTab({
  shop,
  activeDistributor,
  activeDistributorId,
  registeredDistributors,
  language,
  onSwitchDistributor,
  onOpenDistributorModal,
  onToggleLanguage,
}: Props) {
  return (
    <div className="space-y-4 animate-in fade-in duration-150">
      {/* Retailer Shop Details Card */}
      <div className="p-4 sm:p-5 bg-white border border-slate-200 rounded-2xl shadow-xs space-y-3">
        <div className="flex items-center gap-2 border-b border-slate-100 pb-2">
          <Store className="w-4 h-4 text-[#F58220]" />
          <h3 className="font-extrabold text-xs uppercase tracking-wider text-slate-600">
            {language === 'hi' ? 'दुकानदार विवरण' : 'Retailer Details'}
          </h3>
        </div>
        <div className="grid grid-cols-2 gap-3 text-xs">
          <div>
            <span className="text-[10px] text-slate-400 block font-bold">
              {language === 'hi' ? 'दुकान का नाम' : 'Shop Name'}
            </span>
            <span className="font-bold text-slate-900 text-sm">{shop.name}</span>
          </div>
          <div>
            <span className="text-[10px] text-slate-400 block font-bold">
              {language === 'hi' ? 'मालिक का नाम' : 'Proprietor'}
            </span>
            <span className="font-semibold text-slate-800">{shop.owner_name}</span>
          </div>
          <div>
            <span className="text-[10px] text-slate-400 block font-bold">
              {language === 'hi' ? 'पंजीकृत मोबाइल' : 'Registered Phone'}
            </span>
            <span className="font-semibold text-slate-800">+91 {shop.phone}</span>
          </div>
          <div>
            <span className="text-[10px] text-slate-400 block font-bold">
              {language === 'hi' ? 'बाज़ार क्षेत्र' : 'Market Area'}
            </span>
            <span className="font-semibold text-slate-800">{shop.area_name}, Ratlam</span>
          </div>
        </div>
      </div>

      {/* Wholesale Distributor Partnership Details */}
      <div className="p-4 sm:p-5 bg-white border border-slate-200 rounded-2xl shadow-xs space-y-3">
        <div className="flex items-center justify-between border-b border-slate-100 pb-2">
          <div className="flex items-center gap-2">
            <Building2 className="w-4 h-4 text-[#17307A]" />
            <h3 className="font-extrabold text-xs uppercase tracking-wider text-slate-600">
              {language === 'hi' ? 'संबद्ध वितरक' : 'Connected Distributor'}
            </h3>
          </div>
          <button
            type="button"
            onClick={onOpenDistributorModal}
            className="inline-flex items-center gap-1 text-[11px] font-bold text-[#F58220] hover:underline cursor-pointer"
          >
            <ArrowLeftRight className="w-3 h-3" />
            <span>{language === 'hi' ? 'वितरक बदलें' : 'Switch Distributor'}</span>
          </button>
        </div>
        <div className="grid grid-cols-2 gap-3 text-xs">
          <div>
            <span className="text-[10px] text-slate-400 block font-bold">
              {language === 'hi' ? 'वितरक फर्म' : 'Distributor Firm'}
            </span>
            <span className="font-bold text-slate-900 text-sm">{activeDistributor.name}</span>
          </div>
          <div>
            <span className="text-[10px] text-slate-400 block font-bold">
              {language === 'hi' ? 'मंडी पता' : 'Wholesale Mandi'}
            </span>
            <span className="font-semibold text-slate-800">{activeDistributor.address}</span>
          </div>
          <div>
            <span className="text-[10px] text-slate-400 block font-bold">
              {language === 'hi' ? 'भुगतान यूपीआई' : 'Settlement UPI'}
            </span>
            <span className="font-mono font-bold text-emerald-700">{activeDistributor.upi_id}</span>
          </div>
          <div>
            <span className="text-[10px] text-slate-400 block font-bold">
              {language === 'hi' ? 'दैनिक कट-ऑफ' : 'Daily Cut-off'}
            </span>
            <span className="font-semibold text-orange-600">{activeDistributor.order_cutoff_time} IST</span>
          </div>
        </div>
      </div>

      {/* Wholesale Distributor Switcher & Account Session Card */}
      <div className="p-4 sm:p-5 bg-white border border-slate-200 rounded-2xl shadow-xs space-y-3">
        <div className="flex items-center justify-between border-b border-slate-100 pb-2">
          <div className="flex items-center gap-2">
            <ArrowLeftRight className="w-4 h-4 text-[#F58220]" />
            <h3 className="font-extrabold text-xs uppercase tracking-wider text-slate-700">
              {language === 'hi' ? 'अन्य अधिकृत वितरक' : 'Registered Distributors'}
            </h3>
          </div>
          <span className="text-[10px] font-bold text-slate-400">
            {registeredDistributors.length} {language === 'hi' ? 'उपलब्ध' : 'Available'}
          </span>
        </div>

        <p className="text-xs text-slate-500">
          {language === 'hi'
            ? 'अपनी पसंदीदा थोक एजेंसी चुनें और सीधे उनका कैटलॉग व योजनाएं देखें:'
            : 'Select an authorized FMCG distributor to browse their specific catalog and trade offers:'}
        </p>

        <div className="space-y-2.5 pt-1">
          {registeredDistributors.map((dist) => {
            const isActive = dist.id === activeDistributorId;
            return (
              <div
                key={dist.id}
                className={`p-3.5 rounded-xl transition-all ${
                  isActive
                    ? 'border-2 border-[#17307A] bg-blue-50/60 shadow-xs'
                    : 'border border-slate-200 hover:border-slate-300 bg-white'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-extrabold text-xs sm:text-sm text-slate-900 block truncate">
                        {dist.name}
                      </span>
                      {isActive ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-extrabold border border-emerald-300">
                          <Check className="w-3 h-3 text-emerald-700" />
                          <span>{language === 'hi' ? 'सक्रिय वितरक' : 'Active'}</span>
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 text-[10px] font-semibold border border-slate-200">
                          {language === 'hi' ? dist.badge_hi : dist.badge}
                        </span>
                      )}
                    </div>
                    <span className="text-[11px] text-slate-600 block mt-0.5 truncate">
                      {dist.address} • Cut-off {dist.order_cutoff_time} IST
                    </span>
                    <span className="text-[10px] text-blue-700 font-medium block mt-0.5">
                      {language === 'hi' ? 'ब्रांड्स:' : 'Brands:'} {dist.brands.join(', ')}
                    </span>
                  </div>

                  {isActive ? (
                    <div className="w-7 h-7 rounded-full bg-[#17307A] text-white flex items-center justify-center shrink-0">
                      <Check className="w-4 h-4" />
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => onSwitchDistributor(dist.id)}
                      className="px-3 py-1.5 rounded-xl bg-orange-50 hover:bg-[#F58220] hover:text-white text-[#F58220] font-extrabold text-xs border border-orange-200 transition-all shrink-0 flex items-center gap-1.5 shadow-2xs cursor-pointer active:scale-95"
                    >
                      <ArrowLeftRight className="w-3.5 h-3.5" />
                      <span>{language === 'hi' ? 'बदलें' : 'Switch'}</span>
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Action Button: Return / Exit to Portals Hub */}
        <div className="pt-2 border-t border-slate-100">
          <Link
            href="/"
            className="w-full py-2.5 px-3 rounded-xl bg-slate-100 hover:bg-slate-200 active:scale-95 text-slate-700 font-extrabold text-xs transition-all flex items-center justify-center gap-2"
          >
            <LogOut className="w-3.5 h-3.5 text-slate-500" />
            <span>{language === 'hi' ? 'पोर्टल हब पर वापस जाएं' : 'Exit to Portals Hub'}</span>
          </Link>
        </div>
      </div>

      {/* Credit Limit & Ledger Balance Card */}
      <div className="p-4 sm:p-5 bg-gradient-to-br from-blue-50/80 via-white to-slate-50 border border-blue-200 rounded-2xl shadow-xs space-y-3">
        <div className="flex items-center justify-between border-b border-blue-100 pb-2">
          <div className="flex items-center gap-2">
            <CreditCard className="w-4 h-4 text-[#17307A]" />
            <h3 className="font-extrabold text-xs uppercase tracking-wider text-slate-700">
              {language === 'hi' ? 'उधार खाता एवं शेष राशि' : 'Credit Balance & Dues'}
            </h3>
          </div>
          <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-extrabold border border-emerald-300">
            {language === 'hi' ? 'खाता सक्रिय' : 'Good Standing'}
          </span>
        </div>

        <div className="grid grid-cols-3 gap-1.5 text-center pt-1">
          <div className="bg-white p-2 rounded-xl border border-slate-200 shadow-2xs min-w-0">
            <span className="text-[9px] font-bold text-slate-400 block uppercase truncate">
              {language === 'hi' ? 'उधार सीमा' : 'Credit Limit'}
            </span>
            <span className="font-extrabold text-xs sm:text-sm text-slate-800 block truncate">
              ₹50,000
            </span>
          </div>
          <div className="bg-white p-2 rounded-xl border border-slate-200 shadow-2xs min-w-0">
            <span className="text-[9px] font-bold text-slate-400 block uppercase truncate">
              {language === 'hi' ? 'बकाया राशि' : 'Outstanding'}
            </span>
            <span className="font-extrabold text-xs sm:text-sm text-amber-600 block truncate">
              ₹12,450
            </span>
          </div>
          <div className="bg-white p-2 rounded-xl border border-emerald-200 shadow-2xs min-w-0">
            <span className="text-[9px] font-bold text-emerald-700 block uppercase truncate">
              {language === 'hi' ? 'उपलब्ध क्रेडिट' : 'Available Credit'}
            </span>
            <span className="font-extrabold text-xs sm:text-sm text-emerald-700 block truncate">
              ₹37,550
            </span>
          </div>
        </div>
      </div>

      {/* Language & Support Card */}
      <div className="p-4 bg-white border border-slate-200 rounded-2xl shadow-xs space-y-3">
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0">
            <span className="font-bold text-xs text-slate-800 block">
              {language === 'hi' ? 'भाषा प्राथमिकता' : 'Language Preference'}
            </span>
            <span className="text-[11px] text-slate-400">
              {language === 'hi' ? 'वर्तमान: हिंदी' : 'Current: English'}
            </span>
          </div>
          <button
            type="button"
            onClick={onToggleLanguage}
            className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 font-bold text-xs text-slate-700 border border-slate-200 shrink-0"
          >
            {language === 'en' ? 'हिंदी में बदलें' : 'Switch to English'}
          </button>
        </div>

        <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
          <span>{language === 'hi' ? 'वितरक सहायता हेल्पलाइन' : 'Distributor Support Helpline'}</span>
          <a
            href={`tel:${activeDistributor.phone || '9000000000'}`}
            className="font-bold text-[#17307A] flex items-center gap-1 hover:underline shrink-0"
          >
            <Phone className="w-3.5 h-3.5" />
            <span>+91 {activeDistributor.phone || '9000000000'}</span>
          </a>
        </div>
      </div>
    </div>
  );
}
