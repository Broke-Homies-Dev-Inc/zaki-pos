import type { RestaurantTable } from '../hooks/useSettings';
import { toast } from 'react-toastify';
import api from './api';
import { generateThermalReceiptHTML, type ReceiptData, type ReceiptItem } from '../components/ThermalReceipt';

interface BillData {
  table: RestaurantTable;
}

interface OrderItem {
  menu_item_name: string;
  menu_item_name_ar?: string;
  quantity: number;
  unit_price: number;
  total_price: number;
  complimentary_quantity?: number;
}

interface OrderDetails {
  id: string;
  order_number: string;
  order_type: string;
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
  waiter_name?: string;
  bill_number?: string;
  receipt_number?: string;
}

interface RestaurantSettings {
  restaurant_name: string;
  address: string;
  contact_number: string;
  registration_number?: string;
  print_preview_enabled?: boolean;
  currency?: string;
  tax_rate?: number;
}

// Map order type to display format
function getOrderTypeDisplay(orderType: string): 'Dine-in' | 'Takeaway' | 'Delivery' | 'PICKUP' {
  switch (orderType?.toLowerCase()) {
    case 'dine_in':
    case 'dine-in':
      return 'Dine-in';
    case 'takeaway':
    case 'take_away':
      return 'Takeaway';
    case 'delivery':
      return 'Delivery';
    default:
      return 'PICKUP';
  }
}

// Format date for receipt
function formatReceiptDate(dateString: string): { date: string; time: string } {
  const date = new Date(dateString);
  return {
    date: date.toLocaleDateString('en-US'),
    time: date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })
  };
}

export const printBill = async ({ table }: BillData) => {
  const activeOrder = table.active_order;
  if (!activeOrder) {
    toast.error('No active order to print');
    return;
  }

  try {
    // Fetch order details and settings in PARALLEL
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
      print_preview_enabled: true,
      tax_rate: 5
    };

    if (settingsResponse.status === 'fulfilled') {
      restaurantSettings = settingsResponse.value.data;
    } else {
      console.warn('Could not fetch restaurant settings, using defaults');
    }

    // Format date and time
    const { date, time } = formatReceiptDate(orderDetails.created_at);

    // Convert order items to receipt format
    const receiptItems: ReceiptItem[] = orderDetails.order_items.map(item => {
      const compQty = item.complimentary_quantity || 0;
      const chargedQty = item.quantity - compQty;
      return {
        name: item.menu_item_name,
        nameAr: item.menu_item_name_ar,
        qty: item.quantity,
        unitPrice: Number(item.unit_price),
        totalPrice: Number(item.unit_price) * chargedQty
      };
    });

    // Build receipt data
    const receiptData: ReceiptData = {
      storeName: restaurantSettings.restaurant_name || 'ZAKI RESTAURANT',
      storeLogo: '🍽️',
      address: restaurantSettings.address || 'Sur, Sultanate of Oman',
      phone: restaurantSettings.contact_number || '',
      vatin: restaurantSettings.registration_number || undefined,
      orderType: getOrderTypeDisplay(orderDetails.order_type),
      orderNumber: orderDetails.order_number || activeOrder.order_id,
      receiptNumber: orderDetails.receipt_number || orderDetails.bill_number || orderDetails.id?.slice(-6) || Date.now().toString().slice(-6),
      date: date,
      time: time,
      waiter: orderDetails.waiter_name || `ORDER No. ${orderDetails.order_number}`,
      items: receiptItems,
      subtotal: Number(orderDetails.subtotal) || 0,
      taxRate: Number(restaurantSettings.tax_rate) || 5,
      taxAmount: Number(orderDetails.tax_amount) || 0,
      total: Number(orderDetails.grand_total) || 0,
      currency: restaurantSettings.currency || 'OMR',
      message: 'THANK YOU FOR THE VISIT',
      arabicMessage: 'شكرا لزيارتك'
    };

    // Always use browser print preview for thermal receipts
    // This is more reliable than backend PDF generation which requires Puppeteer
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      toast.error('Please allow popups to print bills');
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

    // Generate thermal receipt HTML
    const billHTML = generateThermalReceiptHTML(receiptData);

    // Clear and write in one operation
    printWindow.document.open();
    printWindow.document.write(billHTML);
    printWindow.document.close();
  } catch (error) {
    console.error('Error generating bill:', error);
    toast.error('Failed to generate bill. Please try again.');
  }
};

