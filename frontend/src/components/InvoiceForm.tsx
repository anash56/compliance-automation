
import { useState } from 'react';
import api from '../services/api';
interface InvoiceFormProps {
companyId: string;
onSuccess?: () => void;
}
export default function InvoiceForm({ companyId, onSuccess }: InvoiceFormProps) {
const [formData, setFormData] = useState({
vendorName: '',
vendorGst: '',
amount: '',
gstRate: '18',
invoiceDate: new Date().toISOString().split('T')[0],
state: '',
invoiceType: 'B2B',
hsnCode: '',
notes: ''
});
const [calculatedTax, setCalculatedTax] = useState({
sgst: 0,
cgst: 0,
total: 0
});
const [loading, setLoading] = useState(false);
const [error, setError] = useState('');
const [success, setSuccess] = useState(false);
const handleInputChange = (e: any) => {
const { name, value } = e.target;
setFormData(prev => ({
...prev,
[name]: value
}));
// Recalculate tax
if (name === 'amount' || name === 'gstRate') {
  const amt = name === 'amount' ? parseFloat(value) : parseFloat(formData.amount);
  const rate = name === 'gstRate' ? parseFloat(value) : parseFloat(formData.gstRate);

  if (amt && rate) {
    const total = (amt * rate) / 100;
    const sgst = total / 2;
    const cgst = total / 2;
    setCalculatedTax({
      sgst: parseFloat(sgst.toFixed(2)),
      cgst: parseFloat(cgst.toFixed(2)),
      total: parseFloat(total.toFixed(2))
    });
  }
}
};
const handleSubmit = async (e: React.FormEvent) => {
e.preventDefault();
setLoading(true);
setError('');
setSuccess(false);
try {
  const response = await api.post('/invoices', {
    companyId,
    vendorName: formData.vendorName,
    vendorGst: formData.vendorGst || null,
    amount: parseFloat(formData.amount),
    gstRate: parseInt(formData.gstRate),
    invoiceDate: formData.invoiceDate,
    state: formData.state,
    invoiceType: formData.invoiceType,
    hsnCode: formData.hsnCode || null,
    notes: formData.notes || null
  });

  if (response.data.success) {
    setSuccess(true);
    // Reset form
    setFormData({
      vendorName: '',
      vendorGst: '',
      amount: '',
      gstRate: '18',
      invoiceDate: new Date().toISOString().split('T')[0],
      state: '',
      invoiceType: 'B2B',
      hsnCode: '',
      notes: ''
    });
    setCalculatedTax({ sgst: 0, cgst: 0, total: 0 });

    if (onSuccess) onSuccess();

    // Clear success message after 3 seconds
    setTimeout(() => setSuccess(false), 3000);
  }
} catch (err: any) {
  setError(err.response?.data?.error || 'Failed to create invoice');
} finally {
  setLoading(false);
}
};
return (
<form onSubmit={handleSubmit} className="bg-white p-6 rounded-lg border border-gray-200">
<h3 className="text-xl font-semibold mb-6">Add New Invoice</h3>
  {error && (
    <div className="mb-4 p-4 bg-red-50 border border-red-200 text-red-700 rounded-lg">
      {error}
    </div>
  )}

  {success && (
    <div className="mb-4 p-4 bg-green-50 border border-green-200 text-green-700 rounded-lg">
      ✓ Invoice created successfully!
    </div>
  )}

  <div className="grid grid-cols-2 gap-4 mb-4">
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-2">
        Vendor Name *
      </label>
      <input
        type="text"
        name="vendorName"
        value={formData.vendorName}
        onChange={handleInputChange}
        placeholder="Enter vendor name"
        required
        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
      />
    </div>

    <div>
      <label className="block text-sm font-medium text-gray-700 mb-2">
        Vendor GST
      </label>
      <input
        type="text"
        name="vendorGst"
        value={formData.vendorGst}
        onChange={handleInputChange}
        placeholder="27AABCT1234H1Z0"
        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
      />
    </div>

    <div>
      <label className="block text-sm font-medium text-gray-700 mb-2">
        Amount (₹) *
      </label>
      <input
        type="number"
        name="amount"
        value={formData.amount}
        onChange={handleInputChange}
        placeholder="50000"
        required
        step="0.01"
        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
      />
    </div>

    <div>
      <label className="block text-sm font-medium text-gray-700 mb-2">
        GST Rate (%) *
      </label>
      <select
        name="gstRate"
        value={formData.gstRate}
        onChange={handleInputChange}
        required
        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
      >
        <option value="0">0%</option>
        <option value="5">5%</option>
        <option value="12">12%</option>
        <option value="18">18%</option>
        <option value="28">28%</option>
      </select>
    </div>

    <div>
      <label className="block text-sm font-medium text-gray-700 mb-2">
        Invoice Date *
      </label>
      <input
        type="date"
        name="invoiceDate"
        value={formData.invoiceDate}
        onChange={handleInputChange}
        required
        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
      />
    </div>

    <div>
      <label className="block text-sm font-medium text-gray-700 mb-2">
        State *
      </label>
      <input
        type="text"
        name="state"
        value={formData.state}
        onChange={handleInputChange}
        placeholder="Gujarat"
        required
        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
      />
    </div>

    <div>
      <label className="block text-sm font-medium text-gray-700 mb-2">
        Invoice Type
      </label>
      <select
        name="invoiceType"
        value={formData.invoiceType}
        onChange={handleInputChange}
        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
      >
        <option value="B2B">B2B</option>
        <option value="B2C">B2C</option>
        <option value="IMPORT">Import</option>
      </select>
    </div>

    <div>
      <label className="block text-sm font-medium text-gray-700 mb-2">
        HSN Code
      </label>
      <input
        type="text"
        name="hsnCode"
        value={formData.hsnCode}
        onChange={handleInputChange}
        placeholder="8471"
        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
      />
    </div>

    <div className="col-span-2">
      <label className="block text-sm font-medium text-gray-700 mb-2">
        Notes
      </label>
      <textarea
        name="notes"
        value={formData.notes}
        onChange={handleInputChange}
        placeholder="Additional notes..."
        rows={2}
        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
      />
    </div>
  </div>

  {calculatedTax.total > 0 && (
    <div className="mb-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
      <div className="grid grid-cols-3 gap-4">
        <div>
          <p className="text-xs text-gray-600">SGST (9%)</p>
          <p className="text-lg font-bold text-blue-600">₹{calculatedTax.sgst.toFixed(2)}</p>
        </div>
        <div>
          <p className="text-xs text-gray-600">CGST (9%)</p>
          <p className="text-lg font-bold text-blue-600">₹{calculatedTax.cgst.toFixed(2)}</p>
        </div>
        <div>
          <p className="text-xs text-gray-600">Total Tax</p>
          <p className="text-lg font-bold text-blue-600">₹{calculatedTax.total.toFixed(2)}</p>
        </div>
      </div>
      <div className="mt-3 pt-3 border-t border-blue-200">
        <p className="text-sm text-gray-700">
          <span className="font-semibold">Grand Total:</span> ₹{(parseFloat(formData.amount || '0') + calculatedTax.total).toFixed(2)}
        </p>
      </div>
    </div>
  )}

  <button
    type="submit"
    disabled={loading}
    className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 font-semibold transition duration-200"
  >
    {loading ? 'Creating Invoice...' : 'Create Invoice'}
  </button>
</form>
);
}