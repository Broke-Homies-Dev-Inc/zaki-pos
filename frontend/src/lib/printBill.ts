import { formatCurrency, formatDateTime } from '../lib/utils';
import type { RestaurantTable } from '../hooks/useSettings';
import api from './api';

interface BillData {
  table: RestaurantTable;
}

interface OrderItem {
  menu_item_name: string;
  quantity: number;
  unit_price: number;
  total_price: number;
}

interface OrderDetails {
  id: string;
  order_number: string;
  customer_name: string | null;
  mobile_number: string | null;
  customer_status: string | null;
  loyalty_points: number | null;
  loyalty_points_earned: number;
  loyalty_points_rate: number;
  subtotal: number;
  tax_amount: number;
  grand_total: number;
  created_at: string;
  order_items: OrderItem[];
}

interface RestaurantSettings {
  restaurant_name: string;
  address: string;
  contact_number: string;
  registration_number?: string;
  print_preview_enabled?: boolean;
  currency?: string;
}

export const printBill = async ({ table }: BillData) => {
  const activeOrder = table.active_order;
  if (!activeOrder) {
    alert('No active order to print');
    return;
  }

  try {
    // OPTIMIZATION 2: Fetch order details and settings in PARALLEL
    const [orderResponse, settingsResponse] = await Promise.allSettled([
      api.get<OrderDetails>(`/orders/${activeOrder.order_id}`),
      api.get<RestaurantSettings>('/setting/settings')
    ]);

    // Extract order details
    if (orderResponse.status === 'rejected') {
      throw new Error('Failed to fetch order details');
    }
    const orderDetails = orderResponse.value.data;

    // Extract restaurant settings with fallback
    let restaurantSettings: RestaurantSettings = {
      restaurant_name: 'Restaurant POS',
      address: '',
      contact_number: '',
      print_preview_enabled: true // Default to true
    };

    if (settingsResponse.status === 'fulfilled') {
      restaurantSettings = settingsResponse.value.data;
    } else {
      console.warn('Could not fetch restaurant settings, using defaults');
    }

    // Determine if we should show print preview
    const showPrintPreview = restaurantSettings.print_preview_enabled !== false;

    if (showPrintPreview) {
      // ORIGINAL FLOW: Open print window immediately (non-blocking)
      const printWindow = window.open('', '_blank');
      if (!printWindow) {
        alert('Please allow popups to print bills');
        return;
      }

      // Show loading state in print window immediately
      printWindow.document.write(`
        <!DOCTYPE html>
        <html>
        <head><title>Generating Bill...</title></head>
        <body style="font-family: Arial; text-align: center; padding: 50px;">
          <h2>Generating Bill...</h2>
          <p>Please wait...</p>
        </body>
        </html>
      `);

      const billHTML = generateBillHTML(orderDetails, restaurantSettings, table, true);

      // OPTIMIZATION 4: Clear and write in one operation
      printWindow.document.open();
      printWindow.document.write(billHTML);
      printWindow.document.close();
    } else {
      // NEW FLOW: Direct PDF save on backend without preview
      try {
        const response = await api.post(`/orders/${activeOrder.order_id}/generate-pdf`, {
          tableName: table.table_name
        });

        if (response.data.success) {
          alert(`✅ Bill saved successfully!\n\nFilename: ${response.data.filename}\nLocation: backend/bill_output/`);
        } else {
          throw new Error('PDF generation failed');
        }
      } catch (pdfError) {
        console.error('PDF generation error:', pdfError);
        alert('Failed to generate PDF bill. Please try again.');
      }
    }
  } catch (error) {
    console.error('Error generating bill:', error);
    alert('Failed to generate bill. Please try again.');
  }
};

// Helper function to generate bill HTML
function generateBillHTML(
  orderDetails: OrderDetails,
  restaurantSettings: RestaurantSettings,
  table: RestaurantTable,
  autoClose: boolean
): string {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <title>Bill - ${orderDetails.order_number}</title>
      <style>
        @media print {
          @page { margin: 0; }
          body { margin: 1cm; }
        }
        body {
          font-family: 'Courier New', monospace;
          max-width: 80mm;
          margin: 0 auto;
          padding: 10px;
          font-size: 12px;
        }
        .center { text-align: center; }
        .bold { font-weight: bold; }
        .header { 
          border-bottom: 2px dashed #000; 
          padding-bottom: 10px; 
          margin-bottom: 10px; 
        }
        .line { 
          border-bottom: 1px dashed #000; 
          margin: 10px 0; 
        }
        .row { 
          display: flex; 
          justify-content: space-between; 
          margin: 5px 0; 
        }
        .item-row {
          margin: 8px 0;
        }
        .item-name {
          font-weight: bold;
        }
        .item-details {
          display: flex;
          justify-content: space-between;
          font-size: 11px;
          color: #333;
        }
        .total-section {
          margin-top: 10px;
          padding-top: 10px;
          border-top: 1px solid #000;
        }
        .total-row {
          font-weight: bold;
          font-size: 14px;
          margin-top: 5px;
        }
        .footer {
          border-top: 2px dashed #000;
          padding-top: 10px;
          margin-top: 15px;
        }
      </style>
    </head>
    <body>
      <div class="header">
        <div class="center bold" style="font-size: 16px;">${restaurantSettings.restaurant_name}</div>
        ${restaurantSettings.address ? `<div class="center">${restaurantSettings.address}</div>` : ''}
        ${restaurantSettings.contact_number ? `<div class="center">Tel: ${restaurantSettings.contact_number}</div>` : ''}
        ${restaurantSettings.registration_number ? `<div class="center" style="font-size: 10px;">Reg: ${restaurantSettings.registration_number}</div>` : ''}
      </div>

      <div class="row">
        <span>Table:</span>
        <span class="bold">${table.table_name}</span>
      </div>
      <div class="row">
        <span>Order #:</span>
        <span>${orderDetails.order_number}</span>
      </div>
      <div class="row">
        <span>Date:</span>
        <span>${formatDateTime(orderDetails.created_at)}</span>
      </div>
      ${orderDetails.customer_name ? `
      <div class="row">
        <span>Customer:</span>
        <span>${orderDetails.customer_name}</span>
      </div>
      ` : ''}

      <div class="line"></div>

      <div style="margin: 15px 0;">
        ${orderDetails.order_items && orderDetails.order_items.length > 0 ?
      orderDetails.order_items.map(item => `
            <div class="item-row">
              <div class="item-name">${item.menu_item_name}</div>
              <div class="item-details">
                <span>${item.quantity} x ${formatCurrency(item.unit_price, restaurantSettings.currency || 'OMR')}</span>
                <span>${formatCurrency(item.total_price, restaurantSettings.currency || 'OMR')}</span>
              </div>
            </div>
          `).join('')
      : '<div class="center">No items</div>'
    }
      </div>

      <div class="total-section">
        <div class="row">
          <span>Subtotal:</span>
          <span>${formatCurrency(orderDetails.subtotal, restaurantSettings.currency || 'OMR')}</span>
        </div>
        <div class="row">
          <span>Tax:</span>
          <span>${formatCurrency(orderDetails.tax_amount, restaurantSettings.currency || 'OMR')}</span>
        </div>
        <div class="row total-row">
          <span>TOTAL:</span>
          <span>${formatCurrency(orderDetails.grand_total, restaurantSettings.currency || 'OMR')}</span>
        </div>
      </div>

      ${orderDetails.customer_status === 'verified' && orderDetails.mobile_number ? `
      <div class="line"></div>
      <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 12px; border-radius: 8px; margin: 15px 0;">
        <div class="center bold" style="font-size: 14px; margin-bottom: 8px;">🎉 Loyalty Rewards 🎉</div>
        ${orderDetails.loyalty_points_earned > 0 ? `
          <div class="row" style="color: #fff; margin: 6px 0; font-size: 13px;">
            <span>Points Earned:</span>
            <span class="bold" style="font-size: 16px;">+${orderDetails.loyalty_points_earned} pts</span>
          </div>
        ` : `
          <div class="center" style="font-size: 12px; opacity: 0.9;">
            Loyalty points not earned for this transaction
          </div>
        `}
        <div class="row" style="color: #fff; margin: 8px 0 4px 0; padding-top: 8px; border-top: 1px solid rgba(255,255,255,0.3);">
          <span>Total Points Balance:</span>
          <span class="bold" style="font-size: 16px;">${(orderDetails.loyalty_points || 0) + (orderDetails.loyalty_points_earned || 0)} pts</span>
        </div>
      </div>
      ` : ''}

      <div class="footer">
        <div class="center bold" style="margin-bottom: 5px;">Thank you for dining with us!</div>
        <div class="center">Please visit again</div>
      </div>
    </body>
    <script>
      window.onload = function() {
        ${autoClose ? `
          // Auto-close after printing (preview mode)
          window.print();
          setTimeout(() => window.close(), 100);
        ` : `
          // Direct save mode - just trigger print dialog which will save as PDF
          window.print();
        `}
      };
    </script>
    </html>
  `;
}
