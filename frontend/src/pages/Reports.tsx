// frontend/src/pages/Reports.tsx
import { useState } from 'react';
import { Download } from 'lucide-react';
import DatePicker from 'react-datepicker';
import { useReports, type ReportKey } from '../hooks/useReports';
import 'react-datepicker/dist/react-datepicker.css';
import { formatCurrency } from '../lib/utils';
import { useRestaurantSettingsContext } from '../contexts/useRestaurantSettingsContext';

const REPORTS: { key: ReportKey; label: string }[] = [
  { key: 'work-period', label: 'Work Period' },
  { key: 'group-sales-amount', label: 'Group Sales by Amount' },
  { key: 'group-sales-quantity', label: 'Group Sales by Quantity' },
  { key: 'item-sales', label: 'Item Sales' },
  { key: 'cash-transactions', label: 'Cash Transactions' },
  { key: 'inventory-transactions', label: 'Inventory Transactions' },
  { key: 'cost', label: 'Cost' },
  { key: 'online_delivery', label: 'Online Delivery' },
  { key: 'delivery', label: 'Delivery' },
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
  const keysSet = rows.reduce((acc: Set<string>, r) => {
    if (r && typeof r === 'object') {
      Object.keys(r).forEach(k => acc.add(k));
    }
    return acc;
  }, new Set<string>());
  const keys = Array.from(keysSet);

  const header = keys.join(',');
  const lines = rows.map(r =>
    keys
      .map(k => {
        const v = r?.[k];
        if (v === null || v === undefined) return '';
        const s = String(v).replace(/"/g, '""');
        return `"${s}"`;
      })
      .join(',')
  );
  return [header, ...lines].join('\n');
}

export function Reports() {
  const { fetchReport, loading, error } = useReports();
  const { settings } = useRestaurantSettingsContext();

  const [reportKey, setReportKey] = useState<ReportKey>('work-period');
  const [from, setFrom] = useState<Date | null>(
    new Date(new Date().setDate(new Date().getDate() - 7))
  );
  const [to, setTo] = useState<Date | null>(new Date());
  const [rows, setRows] = useState<any[]>([]);
  const [columns, setColumns] = useState<string[]>([]);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const [expandedPartners, setExpandedPartners] = useState<Set<string>>(new Set());

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
    setExpandedPartners(new Set());

    try {
      const data = await fetchReport(reportKey, buildParams());

      if (reportKey === "item-sales" || reportKey === "online_delivery") {
        setRows(data);
        setColumns([]);
        return;
      }

      const out: any[] = Array.isArray(data) ? data : (data ? [data] : []);
      setRows(out);

      const colsSet = out.reduce((acc: Set<string>, r) => {
        if (r && typeof r === 'object') {
          Object.keys(r).forEach(k => acc.add(k));
        }
        return acc;
      }, new Set<string>());
      setColumns(Array.from(colsSet));

      if (out.length === 0) {
        setStatusMsg('No rows returned for the selected date range.');
      }
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
    a.download = `${reportKey.replace(/\//g, '_')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const renderCell = (row: any, col: string) => {
    const value = row?.[col];
    if (typeof value === "number") {
      return formatCurrency(value, settings?.currency || "OMR");
    }
    if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}T/.test(value)) {
      return formatDateTime(value);
    }
    return String(value ?? "");
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Reports</h1>
          <p className="mt-1 text-gray-600">Generate and export business reports.</p>
        </div>
        <button
          onClick={exportCSV}
          disabled={rows.length === 0}
          className={`px-4 py-2 rounded-md ${rows.length === 0 ? 'bg-gray-200' : 'bg-green-600 text-white'
            }`}
        >
          <Download size={16} className="inline mr-2" />
          Export CSV
        </button>
      </div>

      <div className="mb-6 bg-white p-4 rounded-lg shadow-sm">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-medium">Report</label>
            <select
              value={reportKey}
              onChange={e => setReportKey(e.target.value as ReportKey)}
              className="mt-1 w-full border rounded p-2"
            >
              {REPORTS.map(r => (
                <option key={r.key} value={r.key}>
                  {r.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium">From</label>
            <DatePicker
              selected={from}
              onChange={d => setFrom(d)}
              className="mt-1 w-full border rounded p-2"
            />
          </div>
          <div>
            <label className="block text-sm font-medium">To</label>
            <DatePicker
              selected={to}
              onChange={d => setTo(d)}
              className="mt-1 w-full border rounded p-2"
            />
          </div>
          <div className="flex items-end gap-2">
            <button onClick={run} className="px-4 py-2 bg-blue-600 text-white rounded">Generate</button>
            <button
              onClick={() => {
                setRows([]);
                setColumns([]);
                setStatusMsg(null);
              }}
              className="px-4 py-2 bg-gray-100 rounded"
            >
              Clear
            </button>
          </div>
        </div>
      </div>

      <div className="bg-white p-4 rounded-lg shadow-sm">
        {loading && <div>Loading...</div>}
        {statusMsg && <div className="mb-4">{statusMsg}</div>}
        {error && <div className="text-red-600">{error}</div>}

        {!loading && rows.length > 0 && reportKey === "item-sales" && (
          <div className="overflow-auto">
            <table className="min-w-full border">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="px-4 py-2 text-left text-xs uppercase">Item / Portion</th>
                  <th className="px-4 py-2 text-left text-xs uppercase">Quantity</th>
                  <th className="px-4 py-2 text-left text-xs uppercase">Sales</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((group, i) => {
                  const hasPortion = group.portions.some((p: any) => p.portion_name);
                  const totalCount = group.portions.reduce((sum: number, p: any) => sum + p.total_quantity, 0);
                  const totalSales = group.portions.reduce((sum: number, p: any) => sum + p.total_sales, 0);

                  return (
                    <>
                      <tr key={i} className="font-semibold">
                        <td className="px-4 py-2">{group.item_name}</td>
                        <td className="px-4 py-2">{hasPortion ? totalCount : group.portions[0].total_quantity}</td>
                        <td className="px-4 py-2">{hasPortion ? formatCurrency(totalSales, settings?.currency || "OMR") : formatCurrency(group.portions[0].total_sales, settings?.currency || "OMR")}</td>
                      </tr>

                      {hasPortion && group.portions.map((p: any, idx: number) => (
                        <tr key={`${i}-${idx}`}>
                          <td className="px-6 py-2">↳ {p.portion_name}</td>
                          <td className="px-4 py-2">{p.total_quantity}</td>
                          <td className="px-4 py-2">{formatCurrency(p.total_sales, settings?.currency || "OMR")}</td>
                        </tr>
                      ))}
                    </>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Online Delivery Report - Custom Rendering with Expandable Partners */}
        {!loading && rows.length > 0 && reportKey === "online_delivery" && (
          <div className="overflow-auto">
            <table className="min-w-full border">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="px-4 py-2 text-left text-xs uppercase">Partner Name</th>
                  <th className="px-4 py-2 text-left text-xs uppercase">Orders</th>
                  <th className="px-4 py-2 text-left text-xs uppercase">Completed</th>
                  <th className="px-4 py-2 text-left text-xs uppercase">Cancelled</th>
                  <th className="px-4 py-2 text-left text-xs uppercase">Total Sales</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((partner: any, i: number) => {
                  const isExpanded = expandedPartners.has(partner.partner_name);
                  return (
                    <>
                      {/* Partner Summary Row - Clickable */}
                      <tr
                        key={i}
                        className="font-semibold cursor-pointer hover:bg-blue-50 transition-colors"
                        onClick={() => {
                          setExpandedPartners(prev => {
                            const newSet = new Set(prev);
                            if (newSet.has(partner.partner_name)) {
                              newSet.delete(partner.partner_name);
                            } else {
                              newSet.add(partner.partner_name);
                            }
                            return newSet;
                          });
                        }}
                      >
                        <td className="px-4 py-3">
                          <span className="mr-2">{isExpanded ? '▼' : '▶'}</span>
                          {partner.partner_name}
                        </td>
                        <td className="px-4 py-3">{partner.order_count}</td>
                        <td className="px-4 py-3 text-green-600">{partner.completed_orders}</td>
                        <td className="px-4 py-3 text-red-600">{partner.cancelled_orders}</td>
                        <td className="px-4 py-3">{formatCurrency(partner.total_sales, settings?.currency || "OMR")}</td>
                      </tr>

                      {/* Expanded Orders */}
                      {isExpanded && partner.orders && partner.orders.length > 0 && (
                        <tr key={`${i}-orders`}>
                          <td colSpan={5} className="p-0">
                            <div className="bg-gray-50 p-4 border-t border-b">
                              <table className="min-w-full">
                                <thead>
                                  <tr className="text-xs text-gray-500 uppercase">
                                    <th className="px-3 py-2 text-left">Order #</th>
                                    <th className="px-3 py-2 text-left">Customer</th>
                                    <th className="px-3 py-2 text-left">Status</th>
                                    <th className="px-3 py-2 text-left">Subtotal</th>
                                    <th className="px-3 py-2 text-left">Tax</th>
                                    <th className="px-3 py-2 text-left">Total</th>
                                    <th className="px-3 py-2 text-left">Date</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {partner.orders.map((order: any, idx: number) => (
                                    <tr key={idx} className="border-b border-gray-200 last:border-b-0">
                                      <td className="px-3 py-2 text-sm">{order.order_number}</td>
                                      <td className="px-3 py-2 text-sm">{order.customer_name || '—'}</td>
                                      <td className="px-3 py-2 text-sm">
                                        <span className={`px-2 py-1 rounded text-xs ${order.status === 'completed' ? 'bg-green-100 text-green-700' :
                                            order.status === 'cancelled' ? 'bg-red-100 text-red-700' :
                                              'bg-yellow-100 text-yellow-700'
                                          }`}>
                                          {order.status}
                                        </span>
                                      </td>
                                      <td className="px-3 py-2 text-sm">{formatCurrency(order.subtotal, settings?.currency || "OMR")}</td>
                                      <td className="px-3 py-2 text-sm">{formatCurrency(order.tax_amount, settings?.currency || "OMR")}</td>
                                      <td className="px-3 py-2 text-sm font-medium">{formatCurrency(order.grand_total, settings?.currency || "OMR")}</td>
                                      <td className="px-3 py-2 text-sm">{formatDateTime(order.created_at)}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </td>
                        </tr>
                      )}
                    </>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {!loading && rows.length > 0 && reportKey !== "item-sales" && reportKey !== "online_delivery" && (
          <div className="overflow-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  {columns.map(col => (
                    <th key={col} className="px-6 py-3 text-left text-xs uppercase">
                      {col}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row, i) => (
                  <tr key={i} className={i % 2 ? "bg-gray-50" : ""}>
                    {columns.map(col => (
                      <td key={col} className="px-6 py-3 text-sm">
                        {renderCell(row, col)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {!loading && rows.length === 0 && (
          <div className="text-gray-500">No data — choose a report and click Generate</div>
        )}
      </div>
    </div>
  );
}

export default Reports;
