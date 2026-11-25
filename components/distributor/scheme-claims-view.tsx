'use client';

import React, { useState, useEffect } from 'react';
import {
  FileSpreadsheet,
  Download,
  Calendar,
  Tag,
  Store,
  DollarSign,
  TrendingUp,
  Package,
  CheckCircle2,
  Filter,
  Layers,
  ArrowRight
} from 'lucide-react';
import { useTranslation } from '@/lib/i18n/context';

interface SchemeReportRow {
  schemeId: string;
  schemeName: string;
  schemeType: string;
  startDate: string;
  endDate: string;
  dateRangeStr: string;
  cartonsUnitsSold: number;
  shopsCount: number;
  shopsList: { id: string; name: string; shopNumber: string }[];
  claimableBenefitPaise: number;
  claimableBenefitRupees: string;
  applicationsCount: number;
}

interface ReportSummary {
  totalSchemes: number;
  totalCartonsUnits: number;
  totalClaimablePaise: number;
  totalClaimableRupees: string;
}

export function SchemeClaimsView() {
  const { language } = useTranslation();
  const [loading, setLoading] = useState(true);
  const [reportRows, setReportRows] = useState<SchemeReportRow[]>([]);
  const [summary, setSummary] = useState<ReportSummary | null>(null);

  // Date Range filter
  const [startDate, setStartDate] = useState(
    new Date(Date.now() - 90 * 86400000).toISOString().split('T')[0]
  );
  const [endDate, setEndDate] = useState(
    new Date(Date.now() + 86400000).toISOString().split('T')[0]
  );

  const [selectedShopsModalRow, setSelectedShopsModalRow] = useState<SchemeReportRow | null>(null);

  useEffect(() => {
    fetchReport();
  }, [startDate, endDate]);

  const fetchReport = async () => {
    setLoading(true);
    try {
      const res = await fetch(
        `/api/distributor/reports/scheme-claims?startDate=${startDate}&endDate=${endDate}`
      );
      if (res.ok) {
        const data = await res.json();
        setReportRows(data.reportRows || []);
        setSummary(data.summary || null);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadCsv = () => {
    window.location.href = `/api/distributor/reports/scheme-claims?format=csv&startDate=${startDate}&endDate=${endDate}`;
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 flex items-center gap-2.5">
            <FileSpreadsheet className="w-6 h-6 text-[#17307A]" />
            <span>{language === 'hi' ? 'योजना क्लेम रिपोर्ट व सीएसवी' : 'Scheme Claim Report & CSV'}</span>
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            {language === 'hi'
              ? 'ब्रांड कंपनियों से व्यापार योजना छूट व मुफ्त माल की प्रतिपूर्ति क्लेम करने हेतु अधिकृत रिपोर्ट।'
              : 'Audit report and CSV export to claim promotional discounts and free goods subsidies from FMCG brand manufacturers.'}
          </p>
        </div>

        <button
          onClick={handleDownloadCsv}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs sm:text-sm shadow-xs transition-colors cursor-pointer self-start sm:self-auto"
        >
          <Download className="w-4 h-4" />
          <span>{language === 'hi' ? 'सीएसवी रिपोर्ट डाउनलोड करें' : 'Export Claims CSV'}</span>
        </button>
      </div>

      {/* Date Filter Bar */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3 text-xs">
          <span className="font-bold text-slate-700 flex items-center gap-1.5">
            <Calendar className="w-4 h-4 text-[#F58220]" />
            <span>{language === 'hi' ? 'अवधि चुनें:' : 'Date Range:'}</span>
          </span>

          <div className="flex items-center gap-2">
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="p-2 rounded-lg border border-slate-300 font-medium text-xs"
            />
            <span className="text-slate-400 font-bold">→</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="p-2 rounded-lg border border-slate-300 font-medium text-xs"
            />
          </div>
        </div>

        {/* Quick Presets */}
        <div className="flex items-center gap-1.5 text-xs font-semibold">
          <button
            onClick={() => {
              const now = new Date();
              const firstDay = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
              const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0];
              setStartDate(firstDay);
              setEndDate(lastDay);
            }}
            className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 cursor-pointer"
          >
            {language === 'hi' ? 'इस महीने' : 'This Month'}
          </button>
          <button
            onClick={() => {
              setStartDate(new Date(Date.now() - 90 * 86400000).toISOString().split('T')[0]);
              setEndDate(new Date().toISOString().split('T')[0]);
            }}
            className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 cursor-pointer"
          >
            {language === 'hi' ? 'पिछले 90 दिन' : 'Last 90 Days'}
          </button>
          <button
            onClick={() => {
              setStartDate('2026-01-01');
              setEndDate(new Date().toISOString().split('T')[0]);
            }}
            className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 cursor-pointer"
          >
            {language === 'hi' ? 'पूरा वर्ष' : 'All Year'}
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      {summary && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs">
            <span className="text-xs text-slate-500 font-medium block">
              {language === 'hi' ? 'कंपनी से कुल क्लेम योग्य राशि' : 'Total Claimable Amount'}
            </span>
            <div className="text-2xl font-bold text-emerald-700 mt-1">
              ₹{parseFloat(summary.totalClaimableRupees).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
            </div>
            <span className="text-[11px] text-slate-400 mt-1 block">
              {language === 'hi' ? 'वितरक की प्रतिपूर्ति योग्य सब्सिडी' : 'Subsidy payable by brand principal'}
            </span>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs">
            <span className="text-xs text-slate-500 font-medium block">
              {language === 'hi' ? 'कुल योजना बिक्री (कार्टन/इकाइयां)' : 'Total Scheme Cartons/Units Sold'}
            </span>
            <div className="text-2xl font-bold text-[#17307A] mt-1">
              {summary.totalCartonsUnits.toLocaleString()}
            </div>
            <span className="text-[11px] text-slate-400 mt-1 block">
              {language === 'hi' ? 'योजना के अंतर्गत बिका माल' : 'Units sold qualifying for subsidy'}
            </span>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs">
            <span className="text-xs text-slate-500 font-medium block">
              {language === 'hi' ? 'सक्रिय व्यापार योजनाएं' : 'Trade Schemes Count'}
            </span>
            <div className="text-2xl font-bold text-slate-900 mt-1">
              {summary.totalSchemes}
            </div>
            <span className="text-[11px] text-slate-400 mt-1 block">
              {language === 'hi' ? 'मुफ्त माल, स्लैब व कॉम्बो' : 'Free Goods, Slab & Combo'}
            </span>
          </div>
        </div>
      )}

      {/* Report Table */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-slate-200">
          <div>
            <h2 className="text-base font-bold text-slate-900">
              {language === 'hi' ? 'योजना-वार क्लेम विवरण' : 'Scheme-Wise Subsidy Breakdown'}
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              {language === 'hi'
                ? 'प्रत्येक योजना पर कुल बिकी इकाइयां, भाग लेने वाली दुकानें और क्लेम राशि।'
                : 'Aggregated units sold, participating retail partners, and reimbursable claims.'}
            </p>
          </div>
          <span className="text-xs font-semibold text-slate-500">
            {reportRows.length} {language === 'hi' ? 'योजनाएं' : 'Schemes'}
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-600 font-bold uppercase tracking-wider text-[10px] border-b border-slate-200">
              <tr>
                <th className="p-3">{language === 'hi' ? 'योजना का नाम' : 'Scheme'}</th>
                <th className="p-3">{language === 'hi' ? 'प्रकार' : 'Type'}</th>
                <th className="p-3">{language === 'hi' ? 'वैधता अवधि' : 'Validity'}</th>
                <th className="p-3 text-right">{language === 'hi' ? 'बिका माल' : 'Units / Cartons Sold'}</th>
                <th className="p-3 text-center">{language === 'hi' ? 'दुकानें' : 'Shops'}</th>
                <th className="p-3 text-right">{language === 'hi' ? 'क्लेम राशि (₹)' : 'Claimable Amount (₹)'}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {reportRows.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-slate-400">
                    {language === 'hi' ? 'इस अवधि में कोई योजना क्लेम दर्ज नहीं हुआ।' : 'No scheme claims recorded for this date range.'}
                  </td>
                </tr>
              ) : (
                reportRows.map((row) => (
                  <tr key={row.schemeId} className="hover:bg-slate-50/60 transition-colors">
                    <td className="p-3 font-bold text-slate-900 text-xs sm:text-sm">
                      {row.schemeName}
                    </td>
                    <td className="p-3 whitespace-nowrap">
                      <span
                        className={`px-2 py-0.5 rounded font-bold text-[10px] ${
                          row.schemeType === 'FREE_GOODS'
                            ? 'bg-blue-50 text-[#17307A] border border-blue-200'
                            : row.schemeType === 'SLAB_DISCOUNT'
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : 'bg-purple-50 text-purple-700 border border-purple-200'
                        }`}
                      >
                        {row.schemeType}
                      </span>
                    </td>
                    <td className="p-3 text-slate-500 whitespace-nowrap text-[11px]">
                      {row.dateRangeStr}
                    </td>
                    <td className="p-3 text-right font-bold text-slate-900 text-sm">
                      {row.cartonsUnitsSold.toLocaleString()}
                    </td>
                    <td className="p-3 text-center">
                      <button
                        onClick={() => setSelectedShopsModalRow(row)}
                        className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold cursor-pointer transition-colors"
                      >
                        {row.shopsCount} {language === 'hi' ? 'दुकानें' : 'Shops'}
                      </button>
                    </td>
                    <td className="p-3 text-right font-bold text-emerald-700 text-sm whitespace-nowrap">
                      ₹{parseFloat(row.claimableBenefitRupees).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Participating Shops Modal */}
      {selectedShopsModalRow && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-5 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <div>
                <h3 className="font-bold text-slate-900 text-sm">
                  {selectedShopsModalRow.schemeName}
                </h3>
                <span className="text-xs text-slate-500">
                  {language === 'hi' ? 'लाभान्वित दुकानें' : 'Participating Retail Shops'} ({selectedShopsModalRow.shopsCount})
                </span>
              </div>
              <button
                onClick={() => setSelectedShopsModalRow(null)}
                className="text-slate-400 hover:text-slate-700 font-bold"
              >
                ✕
              </button>
            </div>

            <div className="max-h-60 overflow-y-auto divide-y divide-slate-100 pr-1 text-xs">
              {selectedShopsModalRow.shopsList.map((shop) => (
                <div key={shop.id} className="py-2.5 flex items-center justify-between">
                  <span className="font-semibold text-slate-800">{shop.name}</span>
                  <span className="font-mono text-slate-400 text-[11px]">{shop.shopNumber}</span>
                </div>
              ))}
            </div>

            <div className="flex justify-end pt-3 border-t border-slate-200">
              <button
                onClick={() => setSelectedShopsModalRow(null)}
                className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-xs font-semibold text-slate-700"
              >
                {language === 'hi' ? 'बंद करें' : 'Close'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
