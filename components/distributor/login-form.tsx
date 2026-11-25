'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  ArrowRight,
  AlertCircle,
  Smartphone,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';

interface Props {
  deviceName?: string;
  ownerName?: string;
  allowDemo?: boolean;
}

export default function LoginForm({
  deviceName = 'Owner Workstation (Demo)',
  ownerName = 'Demo Owner',
  allowDemo = false,
}: Props) {
  const router = useRouter();
  const [pin, setPin] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Submit 6-digit PIN
  const handleVerifyPin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (pin.length < 6) return;

    setIsLoading(true);
    setErrorMessage(null);

    try {
      const res = await fetch('/api/auth/device/verify-pin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin: pin.trim() }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Incorrect PIN. Please enter your 6-digit PIN (839201).');
      }

      // Hard redirect to dashboard ensures fresh cookie attachment
      window.location.href = data.redirect || '/d/dashboard';
    } catch (err: any) {
      setErrorMessage(err.message);
      setIsLoading(false);
    }
  };

  // Demo 1-click sign-in (uses genuine PIN verification against owner device)
  const handleDemoSignIn = async () => {
    setIsLoading(true);
    setErrorMessage(null);

    try {
      const res = await fetch('/api/auth/device/verify-pin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin: '839201' }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'PIN verification failed');
      }

      window.location.href = data.redirect || '/d/dashboard';
    } catch (err: any) {
      setErrorMessage(err.message);
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      {errorMessage && (
        <div className="p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2.5 animate-in fade-in">
          <AlertCircle className="w-4 h-4 shrink-0 text-rose-500" />
          <span className="font-semibold">{errorMessage}</span>
        </div>
      )}

      {/* Recognized Terminal Box with Colors */}
      <div className="p-3.5 rounded-2xl bg-blue-50/70 border border-blue-200/80 flex items-center justify-between text-xs">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-white border border-blue-200 flex items-center justify-center text-[#17307A] shadow-xs">
            <Smartphone className="w-4 h-4 text-[#17307A]" />
          </div>
          <div>
            <div className="font-bold text-slate-900 text-xs sm:text-sm">{deviceName}</div>
            <div className="text-[11px] text-slate-500 font-medium">{ownerName} (Owner)</div>
          </div>
        </div>
        <span className="px-2.5 py-1 rounded-full bg-emerald-100/80 border border-emerald-300 text-emerald-800 text-[10px] font-bold flex items-center gap-1">
          <ShieldCheck className="w-3 h-3 text-emerald-700" />
          <span>Verified Terminal</span>
        </span>
      </div>

      {/* 6-Digit PIN Form - Directly available */}
      <form onSubmit={handleVerifyPin} className="space-y-4">
        <div className="space-y-2">
          <div className="flex justify-between items-center">
            <label className="block text-[11px] font-black text-slate-700 uppercase tracking-wider">
              6-Digit Security PIN
            </label>
          </div>

          {/* 6-cell interactive dot display */}
          <div className="relative group cursor-text">
            <div className="grid grid-cols-6 gap-2">
              {[0, 1, 2, 3, 4, 5].map((idx) => {
                const hasDigit = pin.length > idx;
                const isCurrent = pin.length === idx;
                return (
                  <div
                    key={idx}
                    className={`h-12 sm:h-14 rounded-2xl flex items-center justify-center text-xl font-mono font-black border-2 transition-all ${
                      hasDigit
                        ? 'border-[#17307A] bg-blue-50 text-[#17307A] shadow-xs'
                        : isCurrent
                        ? 'border-[#F58220] bg-white ring-4 ring-orange-100 text-[#F58220]'
                        : 'border-slate-300 bg-white text-slate-300'
                    }`}
                  >
                    {hasDigit ? '●' : isCurrent ? '|' : '·'}
                  </div>
                );
              })}
            </div>

            {/* Overlaid invisible input capturing keyboard input seamlessly */}
            <input
              type="password"
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={6}
              required
              autoFocus
              value={pin}
              onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
              className="absolute inset-0 w-full h-full opacity-0 cursor-text z-10"
              aria-label="6-Digit PIN"
            />
          </div>

          <div className="flex items-center justify-between text-xs pt-1">
            <span className="text-slate-500 font-medium">Click boxes to enter your 6-digit PIN</span>
            <span className="text-orange-600 font-bold bg-orange-50 px-2 py-0.5 rounded-md border border-orange-200 text-[11px]">
              PIN: 839201
            </span>
          </div>
        </div>

        {/* Primary Unlock CTA: Saffron Orange Button */}
        <button
          type="submit"
          disabled={isLoading || pin.length < 6}
          className="touch-target w-full py-3.5 px-4 rounded-xl bg-gradient-to-r from-[#F58220] via-amber-500 to-orange-600 hover:brightness-105 active:scale-[0.99] text-white font-black text-sm shadow-md shadow-orange-500/25 flex items-center justify-center gap-2 transition-all disabled:opacity-50 cursor-pointer"
        >
          <span>{isLoading ? 'Verifying PIN...' : 'Unlock Operations Dashboard'}</span>
          <ArrowRight className="w-4 h-4 text-white" />
        </button>
      </form>

      {/* Alternative Options */}
      <div className="space-y-2 pt-2 border-t border-slate-100">
        <a
          href="/api/auth/google/login"
          className="w-full flex items-center justify-center gap-2.5 py-2.5 px-4 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700 text-xs font-bold transition-all"
        >
          <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
            <path
              fill="#4285F4"
              d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
            />
            <path
              fill="#34A853"
              d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
            />
            <path
              fill="#FBBC05"
              d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
            />
            <path
              fill="#EA4335"
              d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
            />
          </svg>
          <span>Or Sign in with Google (Owner)</span>
        </a>

        {/* 1-Click Demo Shortcut */}
        <button
          type="button"
          onClick={handleDemoSignIn}
          disabled={isLoading}
          className="w-full py-2 px-3 rounded-xl border border-blue-200/80 bg-blue-50/50 hover:bg-blue-100/70 text-xs font-bold text-[#17307A] transition-all flex items-center justify-center gap-1.5 cursor-pointer"
        >
          <Sparkles className="w-3.5 h-3.5 text-[#F58220]" />
          <span>Quick 1-Click Demo Unlock (839201)</span>
        </button>
      </div>
    </div>
  );
}
