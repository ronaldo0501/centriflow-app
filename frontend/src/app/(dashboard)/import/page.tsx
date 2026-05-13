'use client';
import { useState, useRef } from 'react';
import { api } from '@/lib/api';
import PageHeader from '@/components/PageHeader';
import { cn } from '@/lib/utils';
import { Upload, CheckCircle, AlertTriangle, FileText, ArrowRight, ArrowLeft, Loader2, Download } from 'lucide-react';

type Step = 1 | 2 | 3 | 4;

interface ParsedRow {
  tag_number: string;
  address_line1: string;
  city: string;
  state: string;
  zip?: string;
  assembly_type: string;
  size: string;
  manufacturer?: string;
  model_number?: string;
  serial_number?: string;
  hazard_classification: string;
  service_type?: string;
  owner_name?: string;
  owner_email?: string;
  owner_phone?: string;
  last_test_date?: string;
  last_test_result?: string;
  next_test_due?: string;
  [key: string]: string | undefined;
}

interface ValidationResult {
  row: number;
  tag: string;
  errors: string[];
  warnings: string[];
}

const REQUIRED_COLS = ['tag_number', 'address_line1', 'city', 'state', 'assembly_type', 'size', 'hazard_classification'];
const VALID_TYPES = ['RP', 'DC', 'PVB', 'SVB', 'AG', 'DCDA', 'RPDA'];
const VALID_HAZARD = ['high', 'low'];

const TEMPLATE_HEADERS = [
  'tag_number', 'address_line1', 'city', 'state', 'zip',
  'assembly_type', 'size', 'manufacturer', 'model_number', 'serial_number',
  'hazard_classification', 'service_type', 'owner_name', 'owner_email', 'owner_phone',
  'last_test_date', 'last_test_result', 'next_test_due',
];

function parseCSV(text: string): ParsedRow[] {
  const lines = text.trim().split('\n');
  if (lines.length < 2) return [];
  const headers = lines[0].split(',').map(h => h.trim().toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, ''));
  return lines.slice(1).map(line => {
    const vals = line.split(',').map(v => v.trim().replace(/^"|"$/g, ''));
    const row: ParsedRow = {} as ParsedRow;
    headers.forEach((h, i) => { row[h] = vals[i] || ''; });
    return row;
  }).filter(r => Object.values(r).some(v => v));
}

function validateRows(rows: ParsedRow[]): ValidationResult[] {
  return rows.map((row, i) => {
    const errors: string[] = [];
    const warnings: string[] = [];
    REQUIRED_COLS.forEach(col => { if (!row[col]) errors.push(`Missing ${col}`); });
    if (row.assembly_type && !VALID_TYPES.includes(row.assembly_type.toUpperCase())) {
      errors.push(`Invalid assembly_type: ${row.assembly_type}`);
    }
    if (row.hazard_classification && !VALID_HAZARD.includes(row.hazard_classification.toLowerCase())) {
      errors.push(`Invalid hazard_classification: must be high or low`);
    }
    if (row.last_test_date && isNaN(Date.parse(row.last_test_date))) {
      warnings.push(`last_test_date format may be invalid`);
    }
    if (!row.owner_email) warnings.push('No owner email — reminders won\'t be sent');
    return { row: i + 2, tag: row.tag_number || `row ${i + 2}`, errors, warnings };
  });
}

export default function ImportPage() {
  const [step, setStep] = useState<Step>(1);
  const [file, setFile] = useState<File | null>(null);
  const [rows, setRows] = useState<ParsedRow[]>([]);
  const [validation, setValidation] = useState<ValidationResult[]>([]);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<{ imported: number; updated: number; errors: string[] } | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFile = (f: File) => {
    setFile(f);
    const reader = new FileReader();
    reader.onload = e => {
      const text = e.target?.result as string;
      const parsed = parseCSV(text);
      setRows(parsed);
      setValidation(validateRows(parsed));
    };
    reader.readAsText(f);
  };

  const errorCount = validation.filter(v => v.errors.length > 0).length;
  const warnCount = validation.filter(v => v.warnings.length > 0).length;

  const handleImport = async () => {
    setImporting(true);
    try {
      const res = await api.post('/api/v1/devices/import', { devices: rows });
      setImportResult(res.data);
      setStep(4);
    } catch (err) {
      console.error(err);
    } finally {
      setImporting(false);
    }
  };

  const downloadTemplate = () => {
    const csv = TEMPLATE_HEADERS.join(',') + '\nCH-0001,123 Main St,Cedar Hills,UT,84062,RP,1",Watts,009M2,SN12345,high,domestic,John Smith,john@example.com,555-1234,2024-01-15,pass,2025-01-15\n';
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'centriflow-import-template.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  const STEPS = [
    { n: 1, label: 'Upload File' },
    { n: 2, label: 'Review & Validate' },
    { n: 3, label: 'Confirm Import' },
    { n: 4, label: 'Complete' },
  ];

  return (
    <div className="max-w-4xl">
      <PageHeader title="Import Devices" subtitle="Bulk import backflow assemblies from a CSV file" />

      {/* Step indicator */}
      <div className="flex items-center gap-0 mb-8">
        {STEPS.map((s, i) => (
          <div key={s.n} className="flex items-center">
            <div className={cn(
              'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium',
              step === s.n ? 'bg-blue-600 text-white' :
              step > s.n ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-400'
            )}>
              {step > s.n ? <CheckCircle className="w-4 h-4" /> : <span className="w-4 h-4 flex items-center justify-center text-xs font-bold">{s.n}</span>}
              {s.label}
            </div>
            {i < STEPS.length - 1 && <ArrowRight className="w-4 h-4 text-gray-300 mx-1" />}
          </div>
        ))}
      </div>

      {/* Step 1 — Upload */}
      {step === 1 && (
        <div className="space-y-4">
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-gray-900">Upload CSV File</h2>
              <button onClick={downloadTemplate} className="flex items-center gap-1.5 text-sm text-blue-600 hover:text-blue-700 font-medium">
                <Download className="w-4 h-4" /> Download Template
              </button>
            </div>

            <div
              onDragOver={e => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={e => { e.preventDefault(); setDragOver(false); const f = e.dataTransfer.files[0]; if (f) handleFile(f); }}
              onClick={() => fileRef.current?.click()}
              className={cn(
                'border-2 border-dashed rounded-xl p-12 text-center cursor-pointer transition-colors',
                dragOver ? 'border-blue-400 bg-blue-50' : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
              )}
            >
              <Upload className="w-10 h-10 text-gray-300 mx-auto mb-3" />
              {file ? (
                <div>
                  <p className="font-medium text-gray-900">{file.name}</p>
                  <p className="text-sm text-gray-500 mt-1">{rows.length} rows detected</p>
                </div>
              ) : (
                <div>
                  <p className="text-gray-600 font-medium">Drop your CSV here or click to browse</p>
                  <p className="text-sm text-gray-400 mt-1">CSV files only</p>
                </div>
              )}
              <input ref={fileRef} type="file" accept=".csv" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); }} />
            </div>
          </div>

          <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 text-sm text-blue-700">
            <p className="font-medium mb-1">Required columns:</p>
            <p className="font-mono text-xs">{REQUIRED_COLS.join(', ')}</p>
            <p className="mt-2 font-medium">Valid assembly types:</p>
            <p className="font-mono text-xs">{VALID_TYPES.join(', ')}</p>
          </div>

          <div className="flex justify-end">
            <button
              onClick={() => setStep(2)}
              disabled={rows.length === 0}
              className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-40"
            >
              Next: Review <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Step 2 — Validate */}
      {step === 2 && (
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-4">
            <div className="bg-white border border-gray-200 rounded-xl p-4 text-center">
              <p className="text-2xl font-bold text-gray-900">{rows.length}</p>
              <p className="text-sm text-gray-500">Total Rows</p>
            </div>
            <div className={cn('border rounded-xl p-4 text-center', errorCount > 0 ? 'bg-red-50 border-red-200' : 'bg-green-50 border-green-200')}>
              <p className={cn('text-2xl font-bold', errorCount > 0 ? 'text-red-700' : 'text-green-700')}>{errorCount}</p>
              <p className="text-sm text-gray-500">Errors</p>
            </div>
            <div className={cn('border rounded-xl p-4 text-center', warnCount > 0 ? 'bg-amber-50 border-amber-200' : 'bg-green-50 border-green-200')}>
              <p className={cn('text-2xl font-bold', warnCount > 0 ? 'text-amber-700' : 'text-green-700')}>{warnCount}</p>
              <p className="text-sm text-gray-500">Warnings</p>
            </div>
          </div>

          {errorCount > 0 && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-2 text-red-700 font-medium text-sm">
                <AlertTriangle className="w-4 h-4" /> Fix these errors before importing
              </div>
              <div className="space-y-1 max-h-48 overflow-y-auto">
                {validation.filter(v => v.errors.length > 0).map(v => (
                  <div key={v.row} className="text-xs text-red-600">
                    <span className="font-medium">Row {v.row} ({v.tag}):</span> {v.errors.join(', ')}
                  </div>
                ))}
              </div>
            </div>
          )}

          {warnCount > 0 && errorCount === 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-2 text-amber-700 font-medium text-sm">
                <AlertTriangle className="w-4 h-4" /> Warnings (import will still proceed)
              </div>
              <div className="space-y-1 max-h-32 overflow-y-auto">
                {validation.filter(v => v.warnings.length > 0).map(v => (
                  <div key={v.row} className="text-xs text-amber-600">
                    <span className="font-medium">Row {v.row} ({v.tag}):</span> {v.warnings.join(', ')}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Preview table */}
          <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-100 flex items-center gap-2 text-sm font-medium text-gray-700">
              <FileText className="w-4 h-4" /> Preview (first 10 rows)
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-100">
                    {['tag_number', 'address_line1', 'city', 'state', 'assembly_type', 'size', 'hazard_classification', 'owner_name'].map(h => (
                      <th key={h} className="text-left px-3 py-2 font-medium text-gray-500">{h}</th>
                    ))}
                    <th className="text-left px-3 py-2 font-medium text-gray-500">status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {rows.slice(0, 10).map((row, i) => {
                    const v = validation[i];
                    return (
                      <tr key={i} className={v.errors.length > 0 ? 'bg-red-50' : ''}>
                        {['tag_number', 'address_line1', 'city', 'state', 'assembly_type', 'size', 'hazard_classification', 'owner_name'].map(h => (
                          <td key={h} className="px-3 py-2 text-gray-700">{row[h] || '—'}</td>
                        ))}
                        <td className="px-3 py-2">
                          {v.errors.length > 0 ? <span className="text-red-600 font-medium">Error</span> :
                           v.warnings.length > 0 ? <span className="text-amber-600">Warning</span> :
                           <span className="text-green-600">OK</span>}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          <div className="flex items-center justify-between">
            <button onClick={() => setStep(1)} className="flex items-center gap-2 px-4 py-2 border border-gray-300 text-gray-600 text-sm font-medium rounded-lg hover:bg-gray-50">
              <ArrowLeft className="w-4 h-4" /> Back
            </button>
            <button
              onClick={() => setStep(3)}
              disabled={errorCount > 0}
              className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-40"
            >
              Next: Confirm <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Step 3 — Confirm */}
      {step === 3 && (
        <div className="space-y-4">
          <div className="bg-white border border-gray-200 rounded-xl p-6">
            <h2 className="font-semibold text-gray-900 mb-4">Confirm Import</h2>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between py-2 border-b border-gray-50">
                <span className="text-gray-600">File</span>
                <span className="font-medium text-gray-900">{file?.name}</span>
              </div>
              <div className="flex justify-between py-2 border-b border-gray-50">
                <span className="text-gray-600">Devices to import</span>
                <span className="font-bold text-blue-600">{rows.length}</span>
              </div>
              <div className="flex justify-between py-2 border-b border-gray-50">
                <span className="text-gray-600">Errors</span>
                <span className={errorCount > 0 ? 'text-red-600 font-medium' : 'text-green-600 font-medium'}>{errorCount}</span>
              </div>
              <div className="flex justify-between py-2">
                <span className="text-gray-600">Warnings</span>
                <span className={warnCount > 0 ? 'text-amber-600' : 'text-green-600'}>{warnCount}</span>
              </div>
            </div>
            <div className="mt-4 p-3 bg-blue-50 rounded-lg text-sm text-blue-700">
              Existing devices with matching tag numbers will be updated, not duplicated.
              New properties will be created automatically for addresses not already in the system.
            </div>
          </div>

          <div className="flex items-center justify-between">
            <button onClick={() => setStep(2)} className="flex items-center gap-2 px-4 py-2 border border-gray-300 text-gray-600 text-sm font-medium rounded-lg hover:bg-gray-50">
              <ArrowLeft className="w-4 h-4" /> Back
            </button>
            <button
              onClick={handleImport}
              disabled={importing}
              className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              {importing ? <><Loader2 className="w-4 h-4 animate-spin" /> Importing...</> : <>Import {rows.length} Devices</>}
            </button>
          </div>
        </div>
      )}

      {/* Step 4 — Complete */}
      {step === 4 && importResult && (
        <div className="bg-white border border-gray-200 rounded-xl p-8 text-center">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle className="w-8 h-8 text-green-600" />
          </div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">Import Complete</h2>
          <div className="grid grid-cols-3 gap-4 max-w-sm mx-auto mt-6 mb-6">
            <div className="bg-green-50 rounded-lg p-3">
              <p className="text-2xl font-bold text-green-700">{importResult.imported}</p>
              <p className="text-xs text-gray-500">Created</p>
            </div>
            <div className="bg-blue-50 rounded-lg p-3">
              <p className="text-2xl font-bold text-blue-700">{importResult.updated}</p>
              <p className="text-xs text-gray-500">Updated</p>
            </div>
            <div className="bg-red-50 rounded-lg p-3">
              <p className="text-2xl font-bold text-red-700">{importResult.errors?.length || 0}</p>
              <p className="text-xs text-gray-500">Failed</p>
            </div>
          </div>
          {importResult.errors?.length > 0 && (
            <div className="text-left bg-red-50 border border-red-100 rounded-lg p-3 mb-4 text-xs text-red-600 max-h-32 overflow-y-auto">
              {importResult.errors.map((e, i) => <div key={i}>{e}</div>)}
            </div>
          )}
          <a href="/devices" className="inline-flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700">
            View Devices
          </a>
        </div>
      )}
    </div>
  );
}
