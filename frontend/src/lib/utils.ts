export const TAX_RATE = 0.05;

// This function now returns a clean number, avoiding .toFixed for calculations.
export function calculateTax(subtotal: number): number {
  const tax = subtotal * TAX_RATE;
  // Round to 2 decimal places and return a number.
  return Math.round(tax * 100) / 100;
}

// This function now ensures both inputs are treated as numbers before adding.
export function calculateGrandTotal(subtotal: number, taxAmount: number): number {
  // Use Number() to prevent accidental string concatenation.
  return Number(subtotal) + Number(taxAmount);
}

// formatCurrency is the ONLY place we should use .toFixed or similar methods.
export function formatCurrency(amount: number, currency: string = 'OMR'): string {
  // Use en-OM as the default locale for Omani Riyal. If you need to format in a
  // different currency (e.g. INR), pass the currency code as the 2nd arg.
  const locale = currency === 'OMR' ? 'en-OM' : 'en-IN';
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
  }).format(amount);
}

export function generateOrderNumber(): string {
  const timestamp = Date.now().toString().slice(-6);
  const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
  return `ORD-${timestamp}${random}`;
}

export function generateBillNumber(): string {
  const timestamp = Date.now().toString().slice(-6);
  const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
  return `BILL-${timestamp}${random}`;
}

export function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-IN', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

// --- Functions needed for OrderDetailsModal ---

// Formats an order type string for display (e.g., 'dine_in' -> 'Dine In')
export function formatOrderType(type: string): string {
  return (type || 'dine_in')
    .replace('_', ' ')
    .replace(/\b\w/g, l => l.toUpperCase());
}

// Returns the Tailwind CSS classes for an order status badge
export function getStatusBadge(status: string): string {
  switch (status) {
    case 'completed': return 'bg-green-100 text-green-700';
    case 'pending': return 'bg-yellow-100 text-yellow-700';
    case 'cancelled': return 'bg-red-100 text-red-700';
    default: return 'bg-gray-100 text-gray-700';
  }
}

export function formatDateTime(dateString: string): string {
  if (!dateString) return 'N/A';
  return new Date(dateString).toLocaleString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

