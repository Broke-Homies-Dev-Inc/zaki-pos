import { X, Download, Printer } from "lucide-react";
import { formatCurrency, formatDate } from "../lib/utils";
import { useRestaurantSettings } from "../hooks/useRestaurantSettings";
import type { BillWithOrder } from "../hooks/useBills";

interface BillPreviewModalProps {
    bill: BillWithOrder;
    onClose: () => void;
}

export function BillPreviewModal({ bill, onClose }: BillPreviewModalProps) {
    const { settings } = useRestaurantSettings();

    // Get tax rate from settings, default to 5% if not available
    const taxRate = settings?.tax_rate ? Number(settings.tax_rate) / 100 : 0.05;

    const handlePrint = () => {
        window.print();
    };

    const handleDownload = () => {
        const billContent = document.getElementById("bill-content");
        if (!billContent) return;

        const printWindow = window.open("", "", "width=800,height=600");
        if (!printWindow) return;

        printWindow.document.write(`
      <html>
        <head>
          <title>Bill - ${bill.bill_number}</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 40px; max-width: 800px; margin: 0 auto; }
            .header { text-align: center; border-bottom: 2px solid #000; padding-bottom: 20px; margin-bottom: 30px; }
            .header h1 { margin: 0 0 10px 0; font-size: 32px; }
            .info-section { display: flex; justify-content: space-between; margin-bottom: 30px; }
            table { width: 100%; border-collapse: collapse; }
            th, td { padding: 12px 8px; text-align: left; }
            thead { background-color: #f2f2f2; border-bottom: 2px solid #000; }
            tfoot { border-top: 2px solid #000; font-weight: bold; }
            .totals { margin-left: auto; max-width: 250px; }
            .text-center { text-align: center; }
            .text-right { text-align: right; }
          </style>
        </head>
        <body>${billContent.innerHTML}</body>
      </html>
    `);

        printWindow.document.close();
        printWindow.print();
        printWindow.close();
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50 p-4">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-3xl flex flex-col max-h-[90vh]">
                <div className="flex justify-between items-center p-6 border-b border-gray-200">
                    <h2 className="text-2xl font-semibold text-gray-800">
                        Bill Preview
                    </h2>
                    <div className="flex gap-2">
                        <button
                            onClick={handleDownload}
                            className="p-2 text-gray-500 hover:text-gray-800"
                        >
                            <Download size={20} />
                        </button>
                        <button
                            onClick={handlePrint}
                            className="p-2 text-gray-500 hover:text-gray-800"
                        >
                            <Printer size={20} />
                        </button>
                        <button
                            onClick={onClose}
                            className="p-2 text-gray-500 hover:text-gray-800"
                        >
                            <X size={24} />
                        </button>
                    </div>
                </div>

                <div id="bill-content" className="p-8 overflow-y-auto">
                    <div className="text-center mb-8 pb-6 border-b-2 border-gray-900">
                        <h1 className="text-3xl font-bold">
                            {settings.restaurant_name}
                        </h1>
                        <p className="text-gray-600">{settings.address}</p>
                        <p className="text-gray-600">
                            {settings.contact_number}
                        </p>
                    </div>

                    <div className="flex justify-between mb-8 text-sm">
                        <div>
                            <p className="font-semibold text-gray-800">
                                Bill To:
                            </p>
                            <p>
                                {bill.orders.customer_name ||
                                    "Walk-in Customer"}
                            </p>
                        </div>
                        <div>
                            <p>
                                <span className="font-semibold text-gray-800">
                                    Bill No:
                                </span>{" "}
                                {bill.bill_number}
                            </p>
                            <p>
                                <span className="font-semibold text-gray-800">
                                    Date:
                                </span>{" "}
                                {formatDate(bill.created_at)}
                            </p>
                            <p>
                                <span className="font-semibold text-gray-800">
                                    Payment:
                                </span>{" "}
                                <span className="capitalize">
                                    {bill.payment_method}
                                </span>
                            </p>
                        </div>
                    </div>

                    <table className="w-full text-sm">
                        <thead className="bg-gray-100">
                            <tr>
                                <th className="px-4 py-3 text-left font-semibold text-gray-700">
                                    #
                                </th>
                                <th className="px-4 py-3 text-left font-semibold text-gray-700">
                                    Item
                                </th>
                                <th className="px-4 py-3 text-right font-semibold text-gray-700">
                                    Qty
                                </th>
                                <th className="px-4 py-3 text-right font-semibold text-gray-700">
                                    Price
                                </th>
                                <th className="px-4 py-3 text-right font-semibold text-gray-700">
                                    Total
                                </th>
                            </tr>
                        </thead>
                        <tbody>
                            {bill.orders.order_items.map((item, index) => (
                                <tr key={item.id} className="border-b">
                                    <td className="px-4 py-3">{index + 1}</td>
                                    <td className="px-4 py-3 font-medium text-gray-800">
                                        {item.menu_items.name}
                                    </td>
                                    <td className="px-4 py-3 text-right text-gray-900">
                                        {item.quantity}
                                    </td>
                                    <td className="px-4 py-3 text-right text-gray-900">
                                        {formatCurrency(item.unit_price, settings?.currency || 'OMR')}
                                    </td>
                                    <td className="px-4 py-3 text-right text-gray-900 font-medium">
                                        {formatCurrency(item.total_price, settings?.currency || 'OMR')}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>

                    <div className="ml-auto max-w-sm space-y-2 mt-6">
                        <div className="flex justify-between py-2 text-gray-700">
                            <span>Subtotal:</span>
                                <span className="font-medium">
                                {formatCurrency(bill.orders.subtotal, settings?.currency || 'OMR')}
                            </span>
                        </div>
                        <div className="flex justify-between py-2 text-gray-700">
                            <span>Tax ({(taxRate * 100).toFixed(0)}%):</span>
                            <span className="font-medium">
                                {formatCurrency(bill.orders.tax_amount, settings?.currency || 'OMR')}
                            </span>
                        </div>
                        <div className="flex justify-between py-3 border-t-2 border-gray-900 text-lg font-bold text-gray-900">
                            <span>Grand Total:</span>
                            <span>
                                {formatCurrency(bill.orders.grand_total, settings?.currency || 'OMR')}
                            </span>
                        </div>
                    </div>

                    <div className="text-center mt-12 pt-6 border-t border-gray-300">
                        <p className="text-gray-600 text-sm">
                            Thank you for your business!
                        </p>
                        <p className="text-gray-500 text-xs mt-2">
                            This is a computer-generated bill and does not
                            require a signature.
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}
