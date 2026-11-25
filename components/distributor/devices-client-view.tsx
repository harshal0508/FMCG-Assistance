'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useLanguage } from '@/lib/i18n/context';
import {
  Smartphone,
  Shield,
  KeyRound,
  Trash2,
  LogOut,
  AlertCircle,
  Clock,
  ShieldCheck,
} from 'lucide-react';

export interface DeviceItem {
  id: string;
  deviceName: string;
  deviceToken: string;
  userName: string;
  userRole?: string;
  lastActiveAt: string;
  createdAt: string;
  isLocked: boolean;
  activeSessionsCount: number;
}

interface Props {
  initialDevices: DeviceItem[];
}

export default function DevicesClientView({ initialDevices }: Props) {
  const { t } = useLanguage();
  const router = useRouter();
  const [devices, setDevices] = useState<DeviceItem[]>(initialDevices);
  const [loading, setLoading] = useState(false);

  const handleRevokeDevice = async (deviceId: string, deviceName: string) => {
    if (!window.confirm(`Revoke device "${deviceName}"? It will be immediately disconnected and all sessions invalidated.`)) {
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`/api/distributor/devices?action=revoke_device&deviceId=${deviceId}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error || 'Failed to revoke device');
      } else {
        setDevices(devices.filter((d) => d.id !== deviceId));
        router.refresh();
      }
    } catch (err: any) {
      alert(err.message || 'Network error');
    } finally {
      setLoading(false);
    }
  };

  const handleLogoutEverywhere = async () => {
    if (!window.confirm('Log out from all other active sessions across all devices?')) {
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/distributor/devices?action=logout_everywhere', {
        method: 'DELETE',
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error || 'Failed to log out everywhere');
      } else {
        alert('All other devices and sessions have been logged out.');
        router.refresh();
      }
    } catch (err: any) {
      alert(err.message || 'Network error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header & Logout Everywhere Action */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#17307A] tracking-tight flex items-center gap-2">
            <Smartphone className="w-6 h-6 text-[#F58220]" />
            <span>Authorized Devices</span>
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Single-owner security terminal: View, monitor, and revoke your registered mobile and desktop devices.
          </p>
        </div>

        <button
          type="button"
          onClick={handleLogoutEverywhere}
          disabled={loading}
          className="touch-target px-4 py-2.5 rounded-xl border border-slate-300 text-slate-700 font-semibold text-xs sm:text-sm hover:bg-slate-50 transition-colors shadow-2xs flex items-center gap-2 active:scale-95"
        >
          <LogOut className="w-4 h-4 text-slate-500" />
          <span>{t('logoutEverywhere')}</span>
        </button>
      </div>

      {/* Security Guidance Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="p-4 rounded-2xl bg-white border border-slate-200/80 shadow-xs space-y-1.5">
          <div className="font-bold text-xs text-[#17307A] flex items-center gap-1.5">
            <KeyRound className="w-4 h-4 text-[#F58220]" />
            <span>Device-Bound PIN</span>
          </div>
          <p className="text-xs text-slate-500">
            Sign in with Google on any new trusted device to register the hardware and set your 6-digit security PIN.
          </p>
        </div>

        <div className="p-4 rounded-2xl bg-white border border-slate-200/80 shadow-xs space-y-1.5">
          <div className="font-bold text-xs text-[#17307A] flex items-center gap-1.5">
            <Clock className="w-4 h-4 text-[#F58220]" />
            <span>15-Minute Idle Lock</span>
          </div>
          <p className="text-xs text-slate-500">
            Inactivity automatically locks your active device. Unlock instantly using your 6-digit device PIN.
          </p>
        </div>

        <div className="p-4 rounded-2xl bg-white border border-slate-200/80 shadow-xs space-y-1.5">
          <div className="font-bold text-xs text-[#17307A] flex items-center gap-1.5">
            <Shield className="w-4 h-4 text-[#F58220]" />
            <span>Remote Revocation</span>
          </div>
          <p className="text-xs text-slate-500">
            Lost your phone or tablet? Click Revoke to immediately disconnect the device and invalidate all session tokens.
          </p>
        </div>
      </div>

      {/* Authorized Devices Section */}
      <div className="bg-white border border-slate-200/80 rounded-2xl shadow-xs overflow-hidden space-y-4 p-5">
        <div className="flex justify-between items-center border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2">
            <Smartphone className="w-5 h-5 text-[#17307A]" />
            <h3 className="font-bold text-sm text-slate-900">
              Registered Devices ({devices.length})
            </h3>
          </div>
        </div>

        {/* Devices Desktop Table (>= 768px) */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200">
              <tr>
                <th className="p-3.5">Device</th>
                <th className="p-3.5">Owner Account</th>
                <th className="p-3.5">Device Token (Random ID)</th>
                <th className="p-3.5">{t('lastActive')}</th>
                <th className="p-3.5 text-center">Status</th>
                <th className="p-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {devices.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-slate-400">
                    No active registered devices found.
                  </td>
                </tr>
              ) : (
                devices.map((device) => (
                  <tr key={device.id} className="hover:bg-slate-50/60 transition-colors">
                    <td className="p-3.5 font-bold text-slate-900">
                      <div className="flex items-center gap-2">
                        <Smartphone className="w-4 h-4 text-slate-500" />
                        <span>{device.deviceName}</span>
                      </div>
                    </td>
                    <td className="p-3.5 font-medium text-slate-700">
                      <div className="flex items-center gap-1.5">
                        <span>{device.userName}</span>
                        <span className="px-2 py-0.5 rounded-full bg-blue-50 text-[#17307A] text-[10px] font-bold border border-blue-200/60">
                          Owner
                        </span>
                      </div>
                    </td>
                    <td className="p-3.5 font-mono text-[11px] text-slate-400">
                      {device.deviceToken ? `${device.deviceToken.slice(0, 16)}...` : 'dev_token'}
                    </td>
                    <td className="p-3.5 text-slate-500 font-medium">
                      {new Date(device.lastActiveAt).toLocaleString()}
                    </td>
                    <td className="p-3.5 text-center">
                      {device.isLocked ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-rose-50 text-rose-700 text-[11px] font-bold border border-rose-200">
                          <AlertCircle className="w-3 h-3 text-rose-600" />
                          <span>Locked</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 text-[11px] font-bold border border-emerald-200">
                          <ShieldCheck className="w-3 h-3 text-emerald-600" />
                          <span>Active</span>
                        </span>
                      )}
                    </td>
                    <td className="p-3.5 text-right">
                      <button
                        type="button"
                        onClick={() => handleRevokeDevice(device.id, device.deviceName)}
                        disabled={loading}
                        className="px-3 py-1.5 rounded-xl border border-rose-200 text-rose-600 hover:bg-rose-50 font-bold text-xs transition-colors flex items-center gap-1 ml-auto"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>Revoke</span>
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Devices Mobile Cards (< 768px) */}
        <div className="md:hidden space-y-3">
          {devices.length === 0 ? (
            <div className="p-6 text-center text-xs text-slate-400">
              No active registered devices found.
            </div>
          ) : (
            devices.map((device) => (
              <div
                key={device.id}
                className="p-4 rounded-xl border border-slate-200/80 bg-slate-50/50 space-y-2.5 text-xs"
              >
                <div className="flex justify-between items-start">
                  <div className="flex items-center gap-2">
                    <Smartphone className="w-4 h-4 text-slate-600" />
                    <span className="font-bold text-slate-900">{device.deviceName}</span>
                  </div>
                  {device.isLocked ? (
                    <span className="px-2 py-0.5 rounded-full bg-rose-50 text-rose-700 text-[10px] font-bold border border-rose-200">
                      Locked
                    </span>
                  ) : (
                    <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 text-[10px] font-bold border border-emerald-200">
                      Active
                    </span>
                  )}
                </div>

                <div className="text-slate-500 text-[11px] space-y-0.5">
                  <div>Owner: {device.userName}</div>
                  <div>Device Token: {device.deviceToken ? `${device.deviceToken.slice(0, 16)}...` : 'dev_token'}</div>
                  <div>Last Active: {new Date(device.lastActiveAt).toLocaleString()}</div>
                </div>

                <div className="pt-2 border-t border-slate-200/60 flex justify-end">
                  <button
                    type="button"
                    onClick={() => handleRevokeDevice(device.id, device.deviceName)}
                    disabled={loading}
                    className="px-3 py-1.5 rounded-xl border border-rose-200 text-rose-600 hover:bg-rose-50 font-bold text-xs flex items-center gap-1 transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Revoke Device</span>
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
