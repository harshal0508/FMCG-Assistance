'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { validateGstin, maskGstin } from '@/lib/services/gstin';

export default function DistributorOnboardingPage() {
  const router = useRouter();

  // Form State
  const [businessName, setBusinessName] = useState('');
  const [ownerName, setOwnerName] = useState('');
  const [phone, setPhone] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('Maharashtra');
  const [areas, setAreas] = useState<string[]>(['Main Market', 'Station Road', 'Industrial Area']);
  const [newAreaInput, setNewAreaInput] = useState('');

  const [upiId, setUpiId] = useState('');
  const [orderCutoffTime, setOrderCutoffTime] = useState('18:00');

  const [gstin, setGstin] = useState('');
  const [gstinException, setGstinException] = useState(false);
  const [gstinExceptionReason, setGstinExceptionReason] = useState('');

  const [pin, setPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [inviteCode, setInviteCode] = useState('');

  const [termsAccepted, setTermsAccepted] = useState(false);
  const [privacyAccepted, setPrivacyAccepted] = useState(false);

  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Live GSTIN check
  const gstinValidation = gstin ? validateGstin(gstin) : null;

  const handleAddArea = () => {
    if (newAreaInput.trim() && !areas.includes(newAreaInput.trim())) {
      setAreas([...areas, newAreaInput.trim()]);
      setNewAreaInput('');
    }
  };

  const handleRemoveArea = (index: number) => {
    setAreas(areas.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!businessName || !ownerName || !city || !upiId) {
      setError('Please fill in all required business details.');
      return;
    }

    if (!gstinException && (!gstin || !gstinValidation?.valid)) {
      setError(gstinValidation?.errorEn || 'A valid 15-character GSTIN is required.');
      return;
    }

    if (gstinException && (!gstinExceptionReason || gstinExceptionReason.length < 5)) {
      setError('Please provide a reason for claiming a GSTIN exemption.');
      return;
    }

    if (pin.length !== 6 || !/^\d{6}$/.test(pin)) {
      setError('PIN must be exactly 6 numeric digits.');
      return;
    }

    if (pin !== confirmPin) {
      setError('PIN and Confirm PIN do not match.');
      return;
    }

    if (!termsAccepted || !privacyAccepted) {
      setError('You must accept the Terms of Service and Privacy Notice.');
      return;
    }

    setLoading(true);

    try {
      const res = await fetch('/api/distributor/onboarding', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          businessName,
          ownerName,
          phone: phone || undefined,
          city,
          state,
          areas,
          upiId,
          orderCutoffTime,
          gstin: gstinException ? undefined : gstin,
          gstinException,
          gstinExceptionReason: gstinException ? gstinExceptionReason : undefined,
          pin,
          inviteCode: inviteCode || undefined,
          termsAccepted,
          termsVersion: 'v1.0-2026',
          privacyAccepted,
          privacyVersion: 'v1.0-2026',
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Onboarding failed');
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
      <div className="w-full max-w-2xl bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-10 shadow-2xl space-y-8">
        {/* Brand Header */}
        <div className="space-y-2 text-center">
          <div className="w-12 h-12 bg-blue-600 rounded-2xl mx-auto flex items-center justify-center font-bold text-2xl text-white shadow-lg">
            V
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
            Distributor Onboarding Wizard
          </h1>
          <p className="text-sm text-slate-400">
            Set up your FMCG distribution hub in one unified setup process.
          </p>
        </div>

        {error && (
          <div className="p-4 bg-rose-500/10 border border-rose-500/30 text-rose-300 rounded-2xl text-sm flex items-start gap-3">
            <span className="text-lg">⚠️</span>
            <div>{error}</div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Section 1: Business Identity */}
          <div className="space-y-4 bg-slate-950/60 border border-slate-800/80 p-5 rounded-2xl">
            <h2 className="text-sm font-bold text-blue-400 uppercase tracking-wider flex items-center gap-2">
              <span>🏢</span>
              <span>Business Profile</span>
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Business / Agency Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Demo Traders"
                  value={businessName}
                  onChange={(e) => setBusinessName(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Owner / Proprietor Full Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Rajesh Kumar"
                  value={ownerName}
                  onChange={(e) => setOwnerName(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  City / Town *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Ratlam, Indore, Ujjain"
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Contact Mobile (Optional)
                </label>
                <input
                  type="tel"
                  placeholder="e.g. 9829012345"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-blue-500"
                />
              </div>
            </div>

            {/* Delivery Areas / Beats */}
            <div className="space-y-2 pt-2">
              <label className="block text-xs font-semibold text-slate-300">
                Delivery Areas / Beats
              </label>
              <div className="flex flex-wrap gap-2 mb-2">
                {areas.map((area, idx) => (
                  <span
                    key={idx}
                    className="inline-flex items-center gap-1.5 px-3 py-1 bg-slate-800 border border-slate-700 rounded-full text-xs text-slate-200"
                  >
                    <span>{area}</span>
                    <button
                      type="button"
                      onClick={() => handleRemoveArea(idx)}
                      className="text-slate-400 hover:text-rose-400"
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="Add delivery beat e.g. North Ward"
                  value={newAreaInput}
                  onChange={(e) => setNewAreaInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleAddArea();
                    }
                  }}
                  className="flex-1 bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
                />
                <button
                  type="button"
                  onClick={handleAddArea}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-semibold"
                >
                  + Add Area
                </button>
              </div>
            </div>
          </div>

          {/* Section 2: Operations & Payments */}
          <div className="space-y-4 bg-slate-950/60 border border-slate-800/80 p-5 rounded-2xl">
            <h2 className="text-sm font-bold text-amber-400 uppercase tracking-wider flex items-center gap-2">
              <span>💳</span>
              <span>Settlement & Timings</span>
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Direct UPI ID for Retailer Payments *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. shreeshyam@okaxis"
                  value={upiId}
                  onChange={(e) => setUpiId(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-amber-500 font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Daily Order Cut-off Time (Asia/Kolkata) *
                </label>
                <input
                  type="time"
                  required
                  value={orderCutoffTime}
                  onChange={(e) => setOrderCutoffTime(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-amber-500 font-mono"
                />
                <span className="text-[11px] text-slate-400">Orders after this cutoff schedule for next day.</span>
              </div>
            </div>
          </div>

          {/* Section 3: GSTIN Verification */}
          <div className="space-y-4 bg-slate-950/60 border border-slate-800/80 p-5 rounded-2xl">
            <h2 className="text-sm font-bold text-emerald-400 uppercase tracking-wider flex items-center gap-2">
              <span>⚖️</span>
              <span>Tax Identification (GSTIN)</span>
            </h2>

            {!gstinException ? (
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  15-Digit GST Identification Number (GSTIN) *
                </label>
                <input
                  type="text"
                  maxLength={15}
                  placeholder="e.g. 27AAAAA0000A1Z5"
                  value={gstin}
                  onChange={(e) => setGstin(e.target.value.toUpperCase())}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-emerald-500 font-mono uppercase"
                />

                {gstin && (
                  <div className="mt-2 text-xs">
                    {gstinValidation?.valid ? (
                      <span className="text-emerald-400 font-semibold flex items-center gap-1.5">
                        <span>✓</span>
                        <span>Valid GSTIN Checksum. State Code: {gstin.slice(0, 2)}</span>
                      </span>
                    ) : (
                      <span className="text-rose-400 font-medium">
                        {gstinValidation?.errorEn} ({gstinValidation?.errorHi})
                      </span>
                    )}
                  </div>
                )}
              </div>
            ) : (
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Reason for GSTIN Exemption *
                </label>
                <input
                  type="text"
                  placeholder="e.g. Annual turnover below ₹40 Lakh threshold"
                  value={gstinExceptionReason}
                  onChange={(e) => setGstinExceptionReason(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-emerald-500"
                />
              </div>
            )}

            <div className="flex items-center gap-2 pt-1">
              <input
                type="checkbox"
                id="gstinExempt"
                checked={gstinException}
                onChange={(e) => setGstinException(e.target.checked)}
                className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 bg-slate-800 border-slate-700"
              />
              <label htmlFor="gstinExempt" className="text-xs text-slate-300 cursor-pointer">
                Claim GSTIN exemption (requires admin review)
              </label>
            </div>
          </div>

          {/* Section 4: Device PIN & Pilot Activation Code */}
          <div className="space-y-4 bg-slate-950/60 border border-slate-800/80 p-5 rounded-2xl">
            <h2 className="text-sm font-bold text-purple-400 uppercase tracking-wider flex items-center gap-2">
              <span>🔒</span>
              <span>Device Security PIN</span>
            </h2>

            <p className="text-xs text-slate-400">
              Create a 6-digit security PIN to quickly unlock your distributor console on this device.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  6-Digit Device PIN *
                </label>
                <input
                  type="password"
                  inputMode="numeric"
                  maxLength={6}
                  required
                  placeholder="••••••"
                  value={pin}
                  onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2.5 text-lg text-center tracking-widest text-white focus:outline-none focus:border-purple-500 font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
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
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2.5 text-lg text-center tracking-widest text-white focus:outline-none focus:border-purple-500 font-mono"
                />
              </div>
            </div>

            <div className="pt-2">
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Pilot Activation Invite Code (Optional)
              </label>
              <input
                type="text"
                placeholder="e.g. VITARAK2026"
                value={inviteCode}
                onChange={(e) => setInviteCode(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-purple-500 font-mono"
              />
              <span className="text-[11px] text-slate-400">
                A valid invite code activates your portal immediately without waiting for admin approval.
              </span>
            </div>
          </div>

          {/* Section 5: Terms & Privacy Notice */}
          <div className="space-y-3 bg-slate-950/60 border border-slate-800/80 p-5 rounded-2xl text-xs text-slate-300">
            <h2 className="text-sm font-bold text-slate-300 uppercase tracking-wider flex items-center gap-2">
              <span>📋</span>
              <span>Legal & Privacy Consent</span>
            </h2>

            <div className="space-y-2 pt-1">
              <label className="flex items-start gap-2.5 cursor-pointer">
                <input
                  type="checkbox"
                  required
                  checked={termsAccepted}
                  onChange={(e) => setTermsAccepted(e.target.checked)}
                  className="mt-0.5 w-4 h-4 rounded text-blue-600 bg-slate-800 border-slate-700"
                />
                <span>
                  I accept the <span className="text-blue-400 underline">Terms of Service (v1.0-2026)</span>, agreeing to operate as a bona fide FMCG distributor.
                </span>
              </label>

              <label className="flex items-start gap-2.5 cursor-pointer">
                <input
                  type="checkbox"
                  required
                  checked={privacyAccepted}
                  onChange={(e) => setPrivacyAccepted(e.target.checked)}
                  className="mt-0.5 w-4 h-4 rounded text-blue-600 bg-slate-800 border-slate-700"
                />
                <span>
                  I accept the <span className="text-blue-400 underline">Privacy Notice (v1.0-2026)</span> and consent to the collection and verification of my GSTIN and business identification for fraud prevention.
                </span>
              </label>
            </div>
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={loading}
            className="w-full py-4 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-2xl shadow-xl transition-colors disabled:opacity-50 text-base"
          >
            {loading ? 'Setting up distributor account...' : 'Complete Registration & Open Portal →'}
          </button>
        </form>
      </div>
    </div>
  );
}
