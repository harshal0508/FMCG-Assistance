'use client';

import React from 'react';
import { useTranslation } from '@/lib/i18n/context';

interface PageLoadingProps {
  targetPageName?: string;
}

export default function PageLoading({ targetPageName }: PageLoadingProps) {
  const { language } = useTranslation();
  const isHindi = language === 'hi';

  return (
    <div className="w-full min-h-[55vh] flex flex-col items-center justify-center py-10 px-4 animate-in fade-in duration-200">
      {/* Brand Two-Tone Pulsing Spinner Badge */}
      <div className="relative mb-5">
        <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-[#17307A] to-[#122660] flex items-center justify-center shadow-lg shadow-blue-950/20 text-white font-black text-2xl tracking-wider select-none">
          V
        </div>
        <div className="absolute -inset-2 rounded-3xl border-2 border-t-[#F58220] border-r-[#F58220]/50 border-b-transparent border-l-transparent animate-spin" />
      </div>

      {/* Loading Title & Animated Dots */}
      <div className="text-center space-y-1.5 max-w-sm">
        <h3 className="text-base font-bold text-slate-800 tracking-tight flex items-center justify-center gap-1.5">
          <span>
            {targetPageName 
              ? (isHindi ? `${targetPageName} लोड हो रहा है` : `Loading ${targetPageName}`)
              : (isHindi ? 'लोड हो रहा है' : 'Loading Page')
            }
          </span>
          <span className="flex items-center gap-1 inline-flex ml-1">
            <span className="w-1.5 h-1.5 rounded-full bg-[#F58220] animate-bounce" style={{ animationDelay: '0ms' }} />
            <span className="w-1.5 h-1.5 rounded-full bg-[#F58220] animate-bounce" style={{ animationDelay: '150ms' }} />
            <span className="w-1.5 h-1.5 rounded-full bg-[#F58220] animate-bounce" style={{ animationDelay: '300ms' }} />
          </span>
        </h3>
        <p className="text-xs text-slate-500 font-medium">
          {isHindi ? 'सर्वर से डेटा लोड किया जा रहा है...' : 'Fetching updated operational data...'}
        </p>
      </div>

      {/* Realistic Responsive Skeleton Cards */}
      <div className="w-full max-w-5xl mt-6 space-y-3.5 select-none pointer-events-none">
        {/* Metric Cards Skeleton */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-3.5">
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="bg-white/80 p-3 sm:p-4 rounded-xl sm:rounded-2xl border border-slate-200/80 shadow-xs space-y-2 animate-pulse"
            >
              <div className="h-2.5 bg-slate-200 rounded-md w-1/2" />
              <div className="h-5 bg-slate-200 rounded-md w-3/4" />
              <div className="h-2 bg-slate-100 rounded-md w-2/3" />
            </div>
          ))}
        </div>

        {/* Content Box Skeleton */}
        <div className="bg-white/80 p-4 sm:p-5 rounded-xl sm:rounded-2xl border border-slate-200/80 shadow-xs space-y-3.5 animate-pulse">
          <div className="flex justify-between items-center pb-2.5 border-b border-slate-100">
            <div className="h-3.5 bg-slate-200 rounded-md w-1/4" />
            <div className="h-7 bg-slate-200 rounded-lg w-20" />
          </div>
          <div className="space-y-2.5">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-10 bg-slate-100/80 rounded-xl w-full" />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
