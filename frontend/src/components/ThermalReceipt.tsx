import { formatCurrency } from '../lib/utils';

export interface ReceiptItem {
  name: string;
  nameAr?: string;
  qty: number;
  unitPrice: number;
  totalPrice: number;
}

export interface ReceiptData {
  storeName: string;
  storeLogo?: string;
  address: string;
  phone: string;
  vatin?: string;
  orderType: 'Dine-in' | 'Takeaway' | 'Delivery' | 'PICKUP';
  orderNumber: number | string;
  receiptNumber: number | string;
  date: string;
  time: string;
  waiter: string;
  items: ReceiptItem[];
  subtotal: number;
  taxRate: number;
  taxAmount: number;
  total: number;
  currency?: string;
  message?: string;
  arabicMessage?: string;
}

interface ThermalReceiptProps {
  data: ReceiptData;
}

export default function ThermalReceipt({ data }: ThermalReceiptProps) {
  const currency = data.currency || 'OMR';

  return (
    <div className="w-80 bg-white shadow-2xl rounded-lg overflow-hidden font-mono text-sm leading-tight">
      {/* Header - Logo & Store Name */}
      <div className="text-center py-4 border-b border-dashed border-gray-400 px-4">
        {data.storeLogo && <div className="text-4xl mb-2">{data.storeLogo}</div>}
        <h1 className="text-lg font-bold tracking-wider">{data.storeName}</h1>
        <p className="text-xs mt-2 text-gray-600">{data.address}</p>
        <p className="text-xs text-gray-600 mt-1">Phone: {data.phone}</p>
        {data.vatin && (
          <p className="text-xs text-gray-600 mt-1">{data.vatin}</p>
        )}
      </div>

      {/* Order Info */}
      <div className="py-3 px-4 text-center border-b border-dashed border-gray-400 space-y-1">
        <div className="flex justify-between text-xs">
          <span>Order Type</span>
          <span className="font-bold">{data.orderType}</span>
        </div>
        <div className="flex justify-between text-xs">
          <span>ORDER No.</span>
          <span className="font-bold">{data.orderNumber}</span>
        </div>
        <div className="flex justify-between text-xs">
          <span>Receipt No.</span>
          <span className="font-bold">{data.receiptNumber}</span>
        </div>
      </div>

      {/* Date/Time Info */}
      <div className="py-3 px-4 text-center border-b border-dashed border-gray-400 space-y-1 text-xs">
        <div>
          <span>Date:</span>
          <span className="ml-2">{data.date}</span>
          <span className="ml-4">{data.time}</span>
        </div>
        <div>
          <span>Waiter:</span>
          <span className="ml-2">{data.waiter}</span>
        </div>
      </div>

      {/* Items Table Header */}
      <div className="py-2 px-4 border-b border-dashed border-gray-400">
        <div className="flex justify-between text-xs font-bold mb-1">
          <span className="flex-1">Item عنصر</span>
          <span className="w-8 text-right">Qty الكمية</span>
          <span className="w-16 text-right">Amount المبلغ</span>
        </div>
        <div className="border-t border-dashed border-gray-300"></div>
      </div>

      {/* Items List */}
      <div className="py-2 px-4 border-b border-dashed border-gray-400 space-y-1">
        {data.items.map((item, idx) => (
          <div key={idx} className="flex justify-between text-xs">
            <span className="flex-1">
              {item.nameAr && (
                <div className="text-gray-600" style={{ direction: 'rtl', textAlign: 'left' }}>{item.nameAr}</div>
              )}
              {item.name}
            </span>
            <span className="w-8 text-right">{item.qty}</span>
            <span className="w-16 text-right">{item.totalPrice.toFixed(3)}</span>
          </div>
        ))}
      </div>

      {/* Order Summary */}
      <div className="py-2 px-4 border-b border-dashed border-gray-400 text-xs space-y-1">
        <div className="text-center mb-2">
          <span className="text-xs text-gray-600">Order Count: {data.items.length}</span>
        </div>

        <div className="flex justify-between">
          <span>Tax Amount:</span>
          <span>{data.taxAmount.toFixed(3)}</span>
        </div>
        <div className="flex justify-between">
          <span>Taxable Amount:</span>
          <span>{(data.subtotal - data.taxAmount).toFixed(3)}</span>
        </div>
        <div className="border-t border-dashed border-gray-300 mt-1 pt-1 flex justify-between font-bold">
          <span>Total:</span>
          <span>{data.total.toFixed(3)}</span>
        </div>
      </div>

      {/* Total Amount */}
      <div className="py-4 px-4 text-center border-b border-dashed border-gray-400">
        <p className="text-xs text-gray-600">TOTAL AMOUNT</p>
        <p className="text-xs text-gray-600 mb-2" dir="rtl">المجموع</p>
        <p className="text-2xl font-bold">{data.total.toFixed(3)}</p>
      </div>

      {/* Footer Message */}
      <div className="py-4 px-4 text-center space-y-1 text-xs">
        <p className="font-semibold">{data.message || 'THANK YOU FOR THE VISIT'}</p>
        {data.arabicMessage && (
          <p className="text-gray-600">{data.arabicMessage}</p>
        )}
      </div>

      {/* Bottom Decoration */}
      <div className="text-center py-2 text-xs text-gray-400">
        ═══════════════════════════
      </div>
    </div>
  );
}

// Export function to generate thermal receipt HTML for printing
export function generateThermalReceiptHTML(data: ReceiptData): string {
  const formatPrice = (price: number) => price.toFixed(3);

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <title>Receipt - ${data.orderNumber}</title>
      <style>
        @media print {
          @page { margin: 0; size: 80mm auto; }
          body { margin: 0; }
        }
        * {
          margin: 0;
          padding: 0;
          box-sizing: border-box;
        }
        body {
          font-family: 'Courier New', monospace;
          width: 80mm;
          margin: 0 auto;
          padding: 5mm;
          font-size: 12px;
          line-height: 1.4;
        }
        .center { text-align: center; }
        .bold { font-weight: bold; }
        .dashed-border {
          border-bottom: 1px dashed #000;
          padding-bottom: 8px;
          margin-bottom: 8px;
        }
        .header {
          text-align: center;
          padding-bottom: 10px;
          border-bottom: 2px dashed #000;
          margin-bottom: 10px;
        }
        .store-name {
          font-size: 16px;
          font-weight: bold;
          letter-spacing: 1px;
        }
        .store-info {
          font-size: 10px;
          color: #333;
          margin-top: 5px;
        }
        .row {
          display: flex;
          justify-content: space-between;
          margin: 3px 0;
          font-size: 11px;
        }
        .items-header {
          display: flex;
          justify-content: space-between;
          font-weight: bold;
          font-size: 11px;
          border-bottom: 1px dashed #000;
          padding-bottom: 5px;
          margin-bottom: 5px;
        }
        .items-header .item-name { flex: 1; }
        .items-header .qty { width: 30px; text-align: right; }
        .items-header .amount { width: 50px; text-align: right; }
        .item-row {
          display: flex;
          font-size: 11px;
          margin: 4px 0;
        }
        .item-row .item-name { flex: 1; }
        .item-row .qty { width: 30px; text-align: right; }
        .item-row .amount { width: 50px; text-align: right; }
        .summary-section {
          border-top: 1px dashed #000;
          padding-top: 8px;
          margin-top: 8px;
        }
        .total-section {
          border-top: 2px solid #000;
          padding-top: 8px;
          margin-top: 8px;
        }
        .grand-total {
          font-size: 18px;
          font-weight: bold;
          text-align: center;
          margin: 10px 0;
        }
        .footer {
          text-align: center;
          border-top: 2px dashed #000;
          padding-top: 10px;
          margin-top: 10px;
          font-size: 11px;
        }
        .arabic {
          font-size: 12px;
          direction: rtl;
        }
        .decoration {
          text-align: center;
          color: #999;
          margin-top: 10px;
        }
      </style>
    </head>
    <body>
      <!-- Header -->
      <div class="header">
        ${data.storeLogo ? `<div style="font-size: 30px; margin-bottom: 5px;">${data.storeLogo}</div>` : ''}
        <div class="store-name">${data.storeName}</div>
        <div class="store-info">${data.address}</div>
        <div class="store-info">Phone: ${data.phone}</div>
        ${data.vatin ? `<div class="store-info">${data.vatin}</div>` : ''}
      </div>

      <!-- Order Info -->
      <div class="dashed-border">
        <div class="row">
          <span>Order Type</span>
          <span class="bold">${data.orderType}</span>
        </div>
        <div class="row">
          <span>ORDER No.</span>
          <span class="bold">${data.orderNumber}</span>
        </div>
        <div class="row">
          <span>Receipt No.</span>
          <span class="bold">${data.receiptNumber}</span>
        </div>
      </div>

      <!-- Date/Time -->
      <div class="dashed-border center">
        <div style="font-size: 11px;">Date: ${data.date} ${data.time}</div>
        <div style="font-size: 11px;">Waiter: ${data.waiter}</div>
      </div>

      <!-- Items Header -->
      <div class="items-header">
        <span class="item-name">Item عنصر</span>
        <span class="qty">Qty الكمية</span>
        <span class="amount">Amount المبلغ</span>
      </div>

      <!-- Items List -->
      ${data.items.map(item => `
        <div class="item-row">
          <span class="item-name">
            ${item.nameAr ? `<div style="color: #666; font-size: 10px; direction: rtl; text-align: left;">${item.nameAr}</div>` : ''}
            ${item.name}
          </span>
          <span class="qty">${item.qty}</span>
          <span class="amount">${formatPrice(item.totalPrice)}</span>
        </div>
      `).join('')}

      <!-- Summary -->
      <div class="summary-section">
        <div class="center" style="font-size: 10px; margin-bottom: 5px;">Order Count: ${data.items.length}</div>
        <div class="row">
          <span>Tax Name: ${data.taxRate}% VAT</span>
        </div>
        <div class="row">
          <span>Tax Amount:</span>
          <span>${formatPrice(data.taxAmount)}</span>
        </div>
        <div class="row">
          <span>Taxable Amount:</span>
          <span>${formatPrice(data.subtotal - data.taxAmount)}</span>
        </div>
      </div>

      <!-- Total -->
      <div class="total-section">
        <div class="row bold">
          <span>Total:</span>
          <span>${formatPrice(data.total)}</span>
        </div>
      </div>

      <!-- Grand Total -->
      <div class="center" style="margin: 15px 0;">
        <div style="font-size: 10px; color: #666;">TOTAL AMOUNT</div>
        <div style="font-size: 10px; color: #666; direction: rtl;">المجموع</div>
        <div class="grand-total">${formatPrice(data.total)}</div>
      </div>

      <!-- Footer -->
      <div class="footer">
        <div class="bold">${data.message || 'THANK YOU FOR THE VISIT'}</div>
        ${data.arabicMessage ? `<div class="arabic">${data.arabicMessage}</div>` : ''}
      </div>

      <div class="decoration">═══════════════════════════</div>

      <script>
        window.onload = function() {
          window.print();
          setTimeout(() => window.close(), 100);
        };
      </script>
    </body>
    </html>
  `;
}
