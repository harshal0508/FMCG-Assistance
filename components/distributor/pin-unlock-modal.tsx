'use client';

import React, { useState, useEffect } from 'react';
import { Lock, KeyRound, ShieldAlert, Fingerprint, Loader2 } from 'lucide-react';

interface PinUnlockModalProps {
  isOpen: boolean;
  onSuccess: () => void;
  onCancel?: () => void;
  title?: string;
  subtitle?: string;
  sensitiveAction?: boolean;
}

export function PinUnlockModal({
  isOpen,
  onSuccess,
  onCancel,
  title = 'सुरक्षा पिन दर्ज करें',
  subtitle = 'सत्र को अनलॉक करने के लिए अपना 6-अंकीय पिन दर्ज करें',
  sensitiveAction = false,
}: PinUnlockModalProps) {
  const [pin, setPin] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLocked, setIsLocked] = useState(false);
  const [remainingAttempts, setRemainingAttempts] = useState<number | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [supportsPasskey, setSupportsPasskey] = useState(false);

  useEffect(() => {
    if (typeof window !== 'undefined' && window.PublicKeyCredential) {
      setSupportsPasskey(true);
    }
  }, []);

  useEffect(() => {
    if (isOpen) {
      setPin('');
      setError(null);
      setIsLocked(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleDigitClick = (digit: string) => {
    if (pin.length < 6 && !isLocked && !isSubmitting) {
      const nextPin = pin + digit;
      setPin(nextPin);
      setError(null);
      if (nextPin.length === 6) {
        verifyPin(nextPin);
      }
    }
  };

  const handleDelete = () => {
    if (pin.length > 0 && !isLocked && !isSubmitting) {
      setPin(pin.slice(0, -1));
      setError(null);
    }
  };

  const handleClear = () => {
    if (!isLocked && !isSubmitting) {
      setPin('');
      setError(null);
    }
  };

  const verifyPin = async (pinToVerify: string) => {
    setIsSubmitting(true);
    setError(null);

    try {
      const res = await fetch('/api/auth/device/verify-pin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin: pinToVerify }),
      });

      const data = await res.json();

      if (res.ok && data.success) {
        setPin('');
        onSuccess();
      } else {
        setPin('');
        if (data.locked) {
          setIsLocked(true);
          setError('सुरक्षा कारणों से डिवाइस लॉक कर दिया गया है। पुनः लॉगिन करें।');
        } else {
          setError(data.error || 'गलत पिन दर्ज किया गया। पुनः प्रयास करें।');
          if (typeof data.remainingAttempts === 'number') {
            setRemainingAttempts(data.remainingAttempts);
          }
        }
      }
    } catch {
      setError('सर्वर से संपर्क करने में विफल। पुनः प्रयास करें।');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full p-6 text-center border border-slate-100 flex flex-col items-center">
        {/* Icon Header */}
        <div className={`w-14 h-14 rounded-2xl flex items-center justify-center mb-3 shadow-inner ${
          isLocked
            ? 'bg-rose-100 text-rose-600'
            : sensitiveAction
            ? 'bg-amber-100 text-amber-600'
            : 'bg-[#17307A]/10 text-[#17307A]'
        }`}>
          {isLocked ? (
            <ShieldAlert className="w-7 h-7" />
          ) : sensitiveAction ? (
            <KeyRound className="w-7 h-7" />
          ) : (
            <Lock className="w-7 h-7" />
          )}
        </div>

        <h3 className="text-lg font-bold text-slate-900 leading-snug">{title}</h3>
        <p className="text-xs text-slate-500 mt-1 mb-5">{subtitle}</p>

        {/* PIN Dots Display */}
        <div className="flex justify-center gap-3 mb-4">
          {[0, 1, 2, 3, 4, 5].map((idx) => (
            <div
              key={idx}
              className={`w-4 h-4 rounded-full border-2 transition-all duration-150 ${
                pin.length > idx
                  ? 'bg-[#17307A] border-[#17307A] scale-110'
                  : 'bg-slate-100 border-slate-300'
              }`}
            />
          ))}
        </div>

        {/* Error / Attempt Warning */}
        {error && (
          <div className="w-full bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-lg p-2.5 mb-3 leading-relaxed">
            {error}
            {remainingAttempts !== null && remainingAttempts > 0 && (
              <div className="font-semibold mt-1">
                शेष प्रयास: {remainingAttempts}
              </div>
            )}
          </div>
        )}

        {/* Loading Spinner */}
        {isSubmitting && (
          <div className="flex items-center justify-center gap-2 text-xs font-medium text-[#17307A] py-2">
            <Loader2 className="w-4 h-4 animate-spin" />
            सत्यापित किया जा रहा है...
          </div>
        )}

        {/* Numeric Keypad (48px min touch target compliant) */}
        {!isLocked && (
          <div className="grid grid-cols-3 gap-2.5 w-full mt-2">
            {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((digit) => (
              <button
                key={digit}
                type="button"
                onClick={() => handleDigitClick(digit)}
                disabled={isSubmitting}
                className="h-13 min-h-[52px] rounded-xl bg-slate-50 hover:bg-slate-100 active:bg-slate-200 text-xl font-bold text-slate-800 transition shadow-sm border border-slate-200/60 disabled:opacity-50"
              >
                {digit}
              </button>
            ))}
            <button
              type="button"
              onClick={handleClear}
              disabled={isSubmitting || pin.length === 0}
              className="h-13 min-h-[52px] rounded-xl bg-slate-100/70 hover:bg-slate-200 text-xs font-semibold text-slate-600 transition border border-slate-200/60 disabled:opacity-40"
            >
              साफ़ करें
            </button>
            <button
              type="button"
              onClick={() => handleDigitClick('0')}
              disabled={isSubmitting}
              className="h-13 min-h-[52px] rounded-xl bg-slate-50 hover:bg-slate-100 active:bg-slate-200 text-xl font-bold text-slate-800 transition shadow-sm border border-slate-200/60 disabled:opacity-50"
            >
              0
            </button>
            <button
              type="button"
              onClick={handleDelete}
              disabled={isSubmitting || pin.length === 0}
              className="h-13 min-h-[52px] rounded-xl bg-slate-100/70 hover:bg-slate-200 text-xs font-semibold text-slate-600 transition border border-slate-200/60 disabled:opacity-40"
            >
              हटाएं
            </button>
          </div>
        )}

        {/* Passkey Biometric Unlock (Optional) */}
        {supportsPasskey && !isLocked && (
          <button
            type="button"
            onClick={async () => {
              try {
                // Optional biometric passkey flow
              } catch (e) {
                console.error(e);
              }
            }}
            className="w-full mt-3 py-2.5 px-3 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-medium flex items-center justify-center gap-2 transition"
          >
            <Fingerprint className="w-4 h-4 text-[#17307A]" />
            बायोमेट्रिक से अनलॉक करें
          </button>
        )}

        {/* Footer Actions */}
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="w-full mt-3 text-xs font-semibold text-slate-500 hover:text-slate-800 py-2 transition"
          >
            रद्द करें
          </button>
        )}
      </div>
    </div>
  );
}
