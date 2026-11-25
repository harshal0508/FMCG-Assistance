'use client';

import React from 'react';
import { ShoppingBag } from 'lucide-react';

export default function RetailerLoading() {
  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4">
      {/* Brand Icon */}
      <div className="relative mb-5">
        <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-[#17307A] to-[#122660] flex items-center justify-center text-white shadow-lg shadow-blue-950/20">
          <ShoppingBag className="w-7 h-7 text-[#F58220]" />
        </div>
        <div className="absolute -inset-2 rounded-3xl border-2 border-t-[#F58220] border-r-[#F58220]/50 border-b-transparent border-l-transparent animate-spin" />
      </div>

      <div className="text-center space-y-1 max-w-xs">
        <h3 className="text-base font-bold text-slate-800">
          Loading Store Catalog...
        </h3>
        <p className="text-xs text-slate-500 font-medium">
          दुकान का कैटलॉग और स्कीमें लोड हो रही हैं...
        </p>
      </div>

      {/* Catalog Skeleton */}
      <div className="w-full max-w-md mt-6 space-y-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="bg-white p-3.5 rounded-2xl border border-slate-200/80 shadow-xs flex items-center gap-3 animate-pulse">
            <div className="w-16 h-16 rounded-xl bg-slate-200 shrink-0" />
            <div className="flex-1 space-y-2">
              <div className="h-3.5 bg-slate-200 rounded w-3/4" />
              <div className="h-3 bg-slate-100 rounded w-1/2" />
              <div className="h-4 bg-slate-200 rounded w-1/3" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
