'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useLanguage } from '@/lib/i18n/context';
import { formatPaise } from '@/lib/money';
import {
  UploadCloud,
  FileSpreadsheet,
  Download,
  CheckCircle2,
  AlertCircle,
  ArrowLeft,
  Check,
  Boxes,
  Trash2,
} from 'lucide-react';

interface ParsedRow {
  brandName: string;
  skuName: string;
  hindiName?: string;
  categoryName?: string;
  mrpPaise: number;
  ratePaise: number;
  stockQty: number;
  baseUnit: string;
  orderUnit: string;
  isValid: boolean;
  error?: string;
}

export default function CsvImporter() {
  const { t, language } = useLanguage();
  const router = useRouter();
  const [csvText, setCsvText] = useState('');
  const [parsedRows, setParsedRows] = useState<ParsedRow[]>([]);
  const [importing, setImporting] = useState(false);
  const [importSuccess, setImportSuccess] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Template generator
  const downloadTemplate = () => {
    const headers = [
      'Brand',
      'SKU Name',
      'Hindi Name',
      'Category',
      'MRP (INR)',
      'PTR Rate (INR)',
      'Stock (Base Unit)',
      'Base Unit',
      'Order Unit',
    ];
    const samples = [
      ['Sunrise Foods', 'Chakki Fresh Whole Wheat Atta 10kg', 'चक्की फ्रेश आटा १० कि.ग्रा.', 'Flour & Atta', '420.00', '365.00', '500', 'packet', 'packet'],
      ['Crunch Co', 'Salted Potato Chips 50g', 'आलू चिप्स ५० ग्राम', 'Snacks & Namkeen', '20.00', '16.50', '1200', 'packet', 'packet'],
      ['Golden Grains', 'Pure Fine Besan 500g', 'बारीक बेसन ५०० ग्राम', 'Flour & Atta', '60.00', '49.00', '800', 'packet', 'packet'],
      ['Daily Fresh', 'Refined Soyabean Oil 1L Pouch', 'रिफाइंड सोयाबीन तेल १ लीटर', 'Edible Oils', '140.00', '122.00', '600', 'pouch', 'pouch'],
      ['Spice Craft', 'Royal Garam Masala 100g Box', 'शाही गरम मसाला १०० ग्राम', 'Spices & Condiments', '95.00', '78.00', '450', 'box', 'box'],
    ];

    const csvContent = [headers.join(','), ...samples.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'vitarak_inventory_template.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // CSV Line Parser
  const parseCsv = (text: string) => {
    setErrorMsg(null);
    const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    if (lines.length < 2) {
      setParsedRows([]);
      return;
    }

    const headers = lines[0].split(',').map((h) => h.trim().toLowerCase());
    const brandIdx = headers.findIndex((h) => h.includes('brand'));
    const skuIdx = headers.findIndex((h) => h.includes('sku') || h.includes('name') || h.includes('product'));
    const hindiIdx = headers.findIndex((h) => h.includes('hindi'));
    const catIdx = headers.findIndex((h) => h.includes('cat') || h.includes('group'));
    const mrpIdx = headers.findIndex((h) => h.includes('mrp'));
    const ptrIdx = headers.findIndex((h) => h.includes('ptr') || h.includes('rate'));
    const stockIdx = headers.findIndex((h) => h.includes('stock') || h.includes('qty'));
    const baseUnitIdx = headers.findIndex((h) => h.includes('base'));
    const orderUnitIdx = headers.findIndex((h) => h.includes('order'));

    const parsed: ParsedRow[] = [];

    for (let i = 1; i < lines.length; i++) {
      const parts = lines[i].split(',').map((p) => p.trim());
      if (parts.length < 3) continue;

      const brandName = parts[brandIdx >= 0 ? brandIdx : 0] || 'General';
      const skuName = parts[skuIdx >= 0 ? skuIdx : 1] || '';
      const hindiName = hindiIdx >= 0 ? parts[hindiIdx] : undefined;
      const categoryName = catIdx >= 0 ? parts[catIdx] : 'General';
      const mrpVal = parseFloat(parts[mrpIdx >= 0 ? mrpIdx : 4] || '0');
      const ptrVal = parseFloat(parts[ptrIdx >= 0 ? ptrIdx : 5] || '0');
      const stockVal = parseInt(parts[stockIdx >= 0 ? stockIdx : 6] || '0', 10);
      const baseUnit = (baseUnitIdx >= 0 ? parts[baseUnitIdx] : 'unit') || 'unit';
      const orderUnit = (orderUnitIdx >= 0 ? parts[orderUnitIdx] : baseUnit) || baseUnit;

      const isValid = Boolean(brandName && skuName && ptrVal > 0);

      parsed.push({
        brandName,
        skuName,
        hindiName,
        categoryName,
        mrpPaise: Math.round(mrpVal * 100),
        ratePaise: Math.round(ptrVal * 100),
        stockQty: isNaN(stockVal) ? 0 : Math.max(0, stockVal),
        baseUnit,
        orderUnit,
        isValid,
        error: !isValid ? 'Missing Brand, SKU name, or PTR rate' : undefined,
      });
    }

    setParsedRows(parsed);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      setCsvText(content);
      parseCsv(content);
    };
    reader.readAsText(file);
  };

  const handleConfirmImport = async () => {
    const validRows = parsedRows.filter((r) => r.isValid);
    if (validRows.length === 0) {
      setErrorMsg('No valid product rows to import');
      return;
    }

    setImporting(true);
    setErrorMsg(null);
    try {
      const res = await fetch('/api/distributor/inventory/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rows: validRows }),
      });

      const data = await res.json();
      if (!res.ok) {
        setErrorMsg(data.error || 'Import failed');
      } else {
        setImportSuccess(true);
        setTimeout(() => {
          router.push('/d/inventory');
        }, 1500);
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Network error');
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header & Actions */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Link
              href="/d/inventory"
              className="text-xs font-semibold text-slate-500 hover:text-slate-800 flex items-center gap-1 transition-colors"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Back to Inventory</span>
            </Link>
          </div>
          <h1 className="text-2xl font-bold text-[#17307A] tracking-tight flex items-center gap-2">
            <FileSpreadsheet className="w-6 h-6 text-[#F58220]" />
            <span>{t('csvImportTitle')}</span>
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            {t('csvImportSubtitle')}
          </p>
        </div>

        <button
          type="button"
          onClick={downloadTemplate}
          className="touch-target px-4 py-2.5 rounded-xl border border-slate-300 text-slate-700 font-semibold text-xs sm:text-sm hover:bg-slate-50 transition-colors shadow-2xs flex items-center gap-2"
        >
          <Download className="w-4 h-4 text-slate-500" />
          <span>{t('downloadTemplate')}</span>
        </button>
      </div>

      {importSuccess && (
        <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 font-bold text-sm flex items-center gap-2 animate-in fade-in">
          <CheckCircle2 className="w-5 h-5 text-emerald-600" />
          <span>{t('importSuccess')}! Redirecting to stock catalog...</span>
        </div>
      )}

      {errorMsg && (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Upload & Paste Area */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* File Dropzone */}
        <div className="bg-white border-2 border-dashed border-slate-300 hover:border-[#17307A] rounded-2xl p-6 text-center transition-colors flex flex-col items-center justify-center space-y-3 cursor-pointer relative">
          <input
            type="file"
            accept=".csv"
            onChange={handleFileUpload}
            className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
          />
          <div className="w-12 h-12 rounded-xl bg-blue-50 text-[#17307A] flex items-center justify-center">
            <UploadCloud className="w-6 h-6 text-[#17307A]" />
          </div>
          <div>
            <h4 className="font-bold text-sm text-slate-800">{t('uploadCsvFile')}</h4>
            <p className="text-xs text-slate-400 mt-0.5">Click or drag a .csv spreadsheet file here</p>
          </div>
        </div>

        {/* Text Paste Area */}
        <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-xs space-y-2">
          <label className="block text-xs font-semibold text-slate-700">
            {t('pasteCsvData')}
          </label>
          <textarea
            rows={5}
            value={csvText}
            onChange={(e) => {
              setCsvText(e.target.value);
              parseCsv(e.target.value);
            }}
            placeholder="Brand,SKU Name,Hindi Name,Category,MRP,PTR,Stock,BaseUnit,OrderUnit..."
            className="w-full p-2.5 font-mono text-xs border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#17307A]/20 focus:border-[#17307A]"
          />
        </div>
      </div>

      {/* Parsed Rows Preview */}
      {parsedRows.length > 0 && (
        <div className="bg-white border border-slate-200/80 rounded-2xl shadow-xs overflow-hidden space-y-4 p-5">
          <div className="flex justify-between items-center border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2">
              <Boxes className="w-5 h-5 text-[#17307A]" />
              <h3 className="font-bold text-sm text-slate-900">
                {t('previewRows')} ({parsedRows.filter((r) => r.isValid).length} valid / {parsedRows.length} total)
              </h3>
            </div>

            <button
              type="button"
              onClick={handleConfirmImport}
              disabled={importing || parsedRows.filter((r) => r.isValid).length === 0}
              className="touch-target px-5 py-2 rounded-xl bg-[#17307A] text-white font-bold text-xs sm:text-sm hover:bg-[#17307A]/90 transition-all shadow-sm flex items-center gap-2 active:scale-95 disabled:opacity-50"
            >
              <Check className="w-4 h-4 text-[#F58220]" />
              <span>{importing ? '...' : t('confirmImport')}</span>
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200">
                <tr>
                  <th className="p-3">Brand</th>
                  <th className="p-3">SKU Name</th>
                  <th className="p-3">Category</th>
                  <th className="p-3 text-right">MRP</th>
                  <th className="p-3 text-right font-bold text-slate-900">PTR Rate</th>
                  <th className="p-3 text-right font-bold text-slate-900">Stock Qty</th>
                  <th className="p-3 text-center">Units</th>
                  <th className="p-3 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {parsedRows.map((row, idx) => (
                  <tr key={idx} className={row.isValid ? 'hover:bg-slate-50/60' : 'bg-rose-50/40'}>
                    <td className="p-3 font-bold text-slate-900">
                      <span className="px-2 py-0.5 rounded bg-blue-50 text-[#17307A] font-semibold text-[11px]">
                        {row.brandName}
                      </span>
                    </td>
                    <td className="p-3">
                      <div className="font-bold text-slate-800">{row.skuName}</div>
                      {row.hindiName && (
                        <div className="text-[11px] text-slate-500">{row.hindiName}</div>
                      )}
                    </td>
                    <td className="p-3 text-slate-600">{row.categoryName}</td>
                    <td className="p-3 text-right text-slate-500">{formatPaise(row.mrpPaise)}</td>
                    <td className="p-3 text-right font-bold text-[#17307A]">{formatPaise(row.ratePaise)}</td>
                    <td className="p-3 text-right font-bold text-slate-900">{row.stockQty}</td>
                    <td className="p-3 text-center text-slate-500">
                      {row.baseUnit} / {row.orderUnit}
                    </td>
                    <td className="p-3 text-center">
                      {row.isValid ? (
                        <span className="inline-flex items-center gap-1 text-emerald-700 font-semibold text-[11px]">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          Ready
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-rose-600 font-semibold text-[11px]">
                          <AlertCircle className="w-3.5 h-3.5" />
                          {row.error}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
