// frontend/src/pages/Reports.tsx
import { useState } from 'react';
import { Download, Calendar, BarChart2 } from 'lucide-react';
import DatePicker from 'react-datepicker';
import { useReports, type ReportKey } from '../hooks/useReports';
import 'react-datepicker/dist/react-datepicker.css';
import { formatCurrency } from '../lib/utils';

const REPORTS: { key: ReportKey; label: string }[] = [
  { key: 'work-period', label: 'Work Period' },
  { key: 'item-sales', label: 'Item Sales' },
  { key: 'cash-transactions', label: 'Cash Transactions' },
  { key: 'inventory-transactions', label: 'Inventory Transactions' },
  { key: 'cost', label: 'Cost' },
  { key: 'talabat', label: 'Talabat' },
  { key: 'delivery', label: 'Online Delivery' },
  { key: 'takeaway', label: 'Takeaway' },
  { key: 'vat/datewise', label: 'VAT (Datewise)' },
  { key: 'vat/itemwise', label: 'VAT (Itemwise)' },
  { key: 'vat/ticketwise', label: 'VAT (Ticketwise)' },
  { key: 'gifts', label: 'Gift Report' },
];

const formatDateTime = (value: string | null) => {
  if (!value) return '—';
  try {
    return new Date(value).toLocaleString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return String(value);
  }
};

function jsonToCSV(rows: any[]): string {
  if (!rows || rows.length === 0) return '';
  // collect keys (string[])
  const keysSet = rows.reduce((acc: Set<string>, r) => {
    // r might not be an object in some responses; guard
    if (r && typeof r === 'object') {
      Object.keys(r).forEach(k => acc.add(k));
    }
    return acc;
  }, new Set<string>());
  const keys = Array.from(keysSet); // string[]

  const header = keys.join(',');
  const lines = rows.map(r =>
    keys
      .map(k => {
        const v = r?.[k];
        if (v === null || v === undefined) return '';
        if (typeof v === 'object') {
          // JSON-stringify objects, escape quotes
          return `"${JSON.stringify(v).replace(/"/g, '""')}"`;
        }
        const s = String(v).replace(/"/g, '""');
        return `"${s}"`;
      })
      .join(',')
  );

  return [header, ...lines].join('\n');
}

export function Reports() {
  const { fetchReport, loading, error } = useReports();
  const [reportKey, setReportKey] = useState<ReportKey>('work-period');
  const [from, setFrom] = useState<Date | null>(new Date(new Date().setDate(new Date().getDate() - 7)));
  const [to, setTo] = useState<Date | null>(new Date());
  const [rows, setRows] = useState<any[]>([]);
  const [columns, setColumns] = useState<string[]>([]);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);

  const buildParams = () => {
    const p: any = {};
    if (from) p.from = from.toISOString().slice(0, 10);
    if (to) p.to = to.toISOString().slice(0, 10);
    return p;
  };

  const run = async () => {
    setStatusMsg(null);
    setRows([]);
    setColumns([]);
    try {
      const data = await fetchReport(reportKey, buildParams());
      // normalize to array of objects
      const out: any[] = Array.isArray(data) ? data : (data ? [data] : []);
      setRows(out);
      // derive columns safely
      const colsSet = out.reduce((acc: Set<string>, r) => {
        if (r && typeof r === 'object') Object.keys(r).forEach(k => acc.add(k));
        return acc;
      }, new Set<string>());
      const cols = Array.from(colsSet);
      setColumns(cols);
      if (out.length === 0) setStatusMsg('No rows returned for the selected date range.');
    } catch (err: any) {
      setStatusMsg(err?.message || 'Error fetching report');
    }
  };

  const exportCSV = () => {
    const csv = jsonToCSV(rows);
    if (!csv) return;
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const fromStr = from?.toISOString().slice(0, 10) ?? 'start';
    const toStr = to?.toISOString().slice(0, 10) ?? 'end';
    a.download = `${reportKey.replace(/\//g, '_')}-${fromStr}_${toStr}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // helper to render a cell with formatting for dates, numbers, objects
  const renderCell = (row: any, col: string) => {
    const value = row?.[col];

    // Detect ISO-like datetime strings and format them
    if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(value)) {
      return formatDateTime(value);
    }

    // sometimes APIs return dates in YYYY-MM-DD format (date only)
    if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
      try {
        return new Date(value + 'T00:00:00').toLocaleDateString('en-IN', {
          day: '2-digit',
          month: 'short',
          year: 'numeric',
        });
      } catch {
        return value;
      }
    }

    if (typeof value === 'number') {
      // For some numeric columns we want currency; but not all numbers are currency.
      // Keep previous behavior: format as currency (consistent with original code).
      return formatCurrency(Number(value));
    }

    if (typeof value === 'object' && value !== null) {
      return <pre className="whitespace-pre-wrap text-xs">{JSON.stringify(value, null, 2)}</pre>;
    }

    return String(value ?? '');
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Reportss</h1>
          <p className="mt-1 text-gray-600">Generate and export business reports.</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={exportCSV} disabled={rows.length === 0} className={`px-4 py-2 rounded-md ${rows.length === 0 ? 'bg-gray-200' : 'bg-green-600 text-white'}`}><Download size={16} /> Export CSV</button>
        </div>
      </div>

      <div className="mb-6 bg-white p-4 rounded-lg shadow-sm">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">Report</label>
            <select value={reportKey} onChange={(e) => setReportKey(e.target.value as ReportKey)} className="mt-1 block w-full rounded border p-2">
              {REPORTS.map(r => <option key={r.key} value={r.key}>{r.label}</option>)}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">From</label>
            <DatePicker selected={from} onChange={(d) => setFrom(d)} className="mt-1 block w-full rounded border p-2" />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">To</label>
            <DatePicker selected={to} onChange={(d) => setTo(d)} className="mt-1 block w-full rounded border p-2" />
          </div>

          <div className="flex items-end gap-2">
            <button onClick={run} className="px-4 py-2 bg-blue-600 text-white rounded-md">Generate</button>
            <button onClick={() => { setRows([]); setColumns([]); setStatusMsg(null); }} className="px-4 py-2 bg-gray-100 rounded-md">Clear</button>
          </div>
        </div>
      </div>

      <div className="bg-white p-4 rounded-lg shadow-sm">
        {loading && <div className="text-gray-500">Loading...</div>}
        {statusMsg && <div className="text-gray-600 mb-4">{statusMsg}</div>}
        {error && <div className="text-red-600">{error}</div>}

        {!loading && rows.length > 0 && (
          <div className="overflow-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  {columns.map(col => <th key={col} className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">{col}</th>)}
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {rows.map((row, i) => (
                  <tr key={i} className={i % 2 === 0 ? '' : 'bg-gray-50'}>
                    {columns.map(col => (
                      <td key={col} className="px-6 py-3 text-sm text-gray-700">
                        {renderCell(row, col)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {!loading && rows.length === 0 && !statusMsg && (
          <div className="text-gray-500">No data — choose a report and click Generate</div>
        )}
      </div>
    </div>
  );
}

export default Reports;
