'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

function StaffJoinForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get('token') || '';

  const [name, setName] = useState('');
  const [pin, setPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [deviceName, setDeviceName] = useState('My Phone');

  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [fingerprint, setFingerprint] = useState('');

  useEffect(() => {
    // Generate or read persistent client device fingerprint
    let fp = localStorage.getItem('vitarak_device_fp');
    if (!fp) {
      fp = 'dev_' + Math.random().toString(36).substring(2, 10);
      localStorage.setItem('vitarak_device_fp', fp);
    }
    setFingerprint(fp);

    // Auto-detect phone model / browser for device label
    if (typeof navigator !== 'undefined') {
      const ua = navigator.userAgent;
      if (/Android/i.test(ua)) setDeviceName('Android Phone');
      else if (/iPhone/i.test(ua)) setDeviceName('iPhone');
      else setDeviceName('Chrome Workstation');
    }
  }, []);

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!token) {
      setError('Invalid or missing staff invite token.');
      return;
    }

    if (!name.trim()) {
      setError('Please enter your full name.');
      return;
    }

    if (pin.length !== 6 || !/^\d{6}$/.test(pin)) {
      setError('PIN must be exactly 6 digits.');
      return;
    }

    if (pin !== confirmPin) {
      setError('PIN and Confirm PIN do not match.');
      return;
    }

    setLoading(true);

    try {
      const res = await fetch('/api/distributor/staff/redeem-invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token,
          name: name.trim(),
          pin,
          deviceFingerprint: fingerprint,
          deviceName,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Failed to register staff device');
        setLoading(false);
      } else {
        router.push('/d/dashboard');
      }
    } catch (err: any) {
      setError(err.message || 'Network error');
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-4 py-12">
      <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl space-y-6">
        <div className="text-center space-y-2">
          <div className="w-12 h-12 bg-amber-500 rounded-2xl mx-auto flex items-center justify-center font-bold text-2xl text-slate-950 shadow-lg">
            👥
          </div>
          <h1 className="text-2xl font-extrabold text-white">Staff Device Registration</h1>
          <p className="text-xs text-slate-400">
            You have been invited by your distributor to access the staff portal. Register your phone and set a 6-digit PIN.
          </p>
        </div>

        {error && (
          <div className="p-3.5 bg-rose-500/10 border border-rose-500/30 text-rose-300 rounded-xl text-xs flex items-start gap-2">
            <span>⚠️</span>
            <div>{error}</div>
          </div>
        )}

        <form onSubmit={handleJoin} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              Your Full Name *
            </label>
            <input
              type="text"
              required
              placeholder="e.g. Ramesh Kumar"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-amber-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              Device Name
            </label>
            <input
              type="text"
              value={deviceName}
              onChange={(e) => setDeviceName(e.target.value)}
              className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-amber-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              Create 6-Digit PIN *
            </label>
            <input
              type="password"
              inputMode="numeric"
              maxLength={6}
              required
              placeholder="••••••"
              value={pin}
              onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
              className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-lg text-center tracking-widest text-white focus:outline-none focus:border-amber-500 font-mono"
            />
            <span className="text-[11px] text-slate-400">You will use this PIN to unlock the app on this device.</span>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              Confirm 6-Digit PIN *
            </label>
            <input
              type="password"
              inputMode="numeric"
              maxLength={6}
              required
              placeholder="••••••"
              value={confirmPin}
              onChange={(e) => setConfirmPin(e.target.value.replace(/\D/g, ''))}
              className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-lg text-center tracking-widest text-white focus:outline-none focus:border-amber-500 font-mono"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-xl shadow-lg transition-colors disabled:opacity-50 text-sm mt-2"
          >
            {loading ? 'Registering device...' : 'Complete Registration & Open Portal →'}
          </button>
        </form>
      </div>
    </div>
  );
}

export default function StaffJoinPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-slate-950 flex items-center justify-center text-slate-400 text-sm">Loading invitation...</div>}>
      <StaffJoinForm />
    </Suspense>
  );
}
