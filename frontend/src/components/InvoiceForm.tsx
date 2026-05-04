import { useState, useEffect } from 'react';
import api from '../services/api';
interface InvoiceFormProps {
companyId: string;
companyState: string;
onSuccess?: () => void;
editData?: any;
onCancelEdit?: () => void;
}
const normalizeState = (state?: string | null) => (state || '').trim().toLowerCase();
export default function InvoiceForm({ companyId, companyState, onSuccess, editData, onCancelEdit }: InvoiceFormProps) {
const [formMode, setFormMode] = useState<'single' | 'bulk'>('single');
const [uploadingBulk, setUploadingBulk] = useState(false);
const [bulkProgress, setBulkProgress] = useState({ current: 0, total: 0 });
const [formData, setFormData] = useState({
invoiceNumber: '',
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
igst: 0,
total: 0
});
const [loading, setLoading] = useState(false);
const [error, setError] = useState('');
const [success, setSuccess] = useState(false);

useEffect(() => {
  if (editData) {
    setFormData({
      invoiceNumber: editData.invoiceNumber,
      vendorName: editData.vendorName,
      vendorGst: editData.vendorGst || '',
      amount: editData.amount.toString(),
      gstRate: editData.gstRate.toString(),
      invoiceDate: new Date(editData.invoiceDate).toISOString().split('T')[0],
      state: editData.state,
      invoiceType: editData.invoiceType,
      hsnCode: editData.hsnCode || '',
      notes: editData.notes || ''
    });
    setCalculatedTax({
      sgst: Number(editData.sgst),
      cgst: Number(editData.cgst),
      igst: Number(editData.igst),
      total: Number(editData.totalTax)
    });
    setFormMode('single');
  }
}, [editData]);

const handleInputChange = (e: any) => {
const { name, value } = e.target;
setFormData(prev => ({
...prev,
[name]: value
}));
// Recalculate tax
if (name === 'amount' || name === 'gstRate' || name === 'invoiceType' || name === 'state') {
  const amt = name === 'amount' ? parseFloat(value) : parseFloat(formData.amount);
  const rate = name === 'gstRate' ? parseFloat(value) : parseFloat(formData.gstRate);
  const nextInvoiceType = name === 'invoiceType' ? value : formData.invoiceType;
  const nextState = name === 'state' ? value : formData.state;

  if (Number.isFinite(amt) && Number.isFinite(rate)) {
    const total = (amt * rate) / 100;
    const isInterstate =
      nextInvoiceType === 'IMPORT' ||
      (!!normalizeState(nextState) && normalizeState(nextState) !== normalizeState(companyState));
    const sgst = isInterstate ? 0 : total / 2;
    const cgst = isInterstate ? 0 : total / 2;
    const igst = isInterstate ? total : 0;
    setCalculatedTax({
      sgst: parseFloat(sgst.toFixed(2)),
      cgst: parseFloat(cgst.toFixed(2)),
      igst: parseFloat(igst.toFixed(2)),
      total: parseFloat(total.toFixed(2))
    });
  } else {
    setCalculatedTax({ sgst: 0, cgst: 0, igst: 0, total: 0 });
  }
}
};
const handleSubmit = async (e: React.FormEvent) => {
e.preventDefault();
setLoading(true);
setError('');
setSuccess(false);
try {
  const payload = {
    companyId: companyId,
    invoiceNumber: formData.invoiceNumber,
    vendorName: formData.vendorName,
    vendorGst: formData.vendorGst || null,
    amount: parseFloat(formData.amount),
    gstRate: parseInt(formData.gstRate),
    invoiceDate: formData.invoiceDate,
    state: formData.state,
    invoiceType: formData.invoiceType,
    hsnCode: formData.hsnCode || null,
    notes: formData.notes || null
  };

  let response;
  if (editData) {
    response = await api.put(`/invoices/${editData.id}`, payload);
  } else {
    response = await api.post('/invoices', payload);
  }

  if (response.data.success) {
    setSuccess(true);
    // Reset form
    setFormData({
      invoiceNumber: '',
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
    setCalculatedTax({ sgst: 0, cgst: 0, igst: 0, total: 0 });

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

const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
  const file = e.target.files?.[0];
  if (!file) return;
  
  if (!file.name.toLowerCase().endsWith('.csv') && file.type !== 'text/csv' && file.type !== 'application/vnd.ms-excel') {
    setError('Invalid file type. Please upload a .csv file.');
    return;
  }
  
  const reader = new FileReader();
  reader.onload = async (event) => {
    const text = event.target?.result as string;
    const lines = text.split('\n').filter(line => line.trim() !== '');
    if (lines.length < 2) {
      setError('Invalid CSV format. Header row required.');
      return;
    }

    const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
    const newInvoices = lines.slice(1).map(line => {
      const values = line.split(',');
      return {
        invoiceNumber: values[headers.indexOf('invoicenumber')] || `INV-${Date.now()}-${Math.floor(Math.random()*1000)}`,
        vendorName: values[headers.indexOf('vendorname')] || 'Unknown Vendor',
        vendorGst: values[headers.indexOf('vendorgst')] || null,
        amount: parseFloat(values[headers.indexOf('amount')]) || 0,
        gstRate: parseInt(values[headers.indexOf('gstrate')]) || 18,
        invoiceDate: values[headers.indexOf('invoicedate')] || new Date().toISOString().split('T')[0],
        state: values[headers.indexOf('state')] || companyState,
        invoiceType: values[headers.indexOf('invoicetype')] || 'B2B',
        hsnCode: values[headers.indexOf('hsncode')] || null,
        notes: values[headers.indexOf('notes')] || null
      };
    });

    setUploadingBulk(true);
    setBulkProgress({ current: 0, total: newInvoices.length });
    
    let successCount = 0;
    for (let i = 0; i < newInvoices.length; i++) {
      try {
        await api.post('/invoices', { companyId, ...newInvoices[i] });
        successCount++;
      } catch (err) {
        console.error('Failed to create invoice:', newInvoices[i].invoiceNumber);
      }
      setBulkProgress({ current: i + 1, total: newInvoices.length });
    }
    
    setUploadingBulk(false);
    setSuccess(true);
    if (onSuccess) onSuccess();
    setTimeout(() => setSuccess(false), 3000);
  };
  reader.readAsText(file);
};

return (
<div className="bg-white p-6 rounded-lg border border-gray-200">
  <div className="flex justify-between items-center mb-6">
    <h3 className="text-xl font-semibold">{editData ? 'Edit Invoice' : 'Add Invoices'}</h3>
    <div className="flex bg-gray-100 rounded-lg p-1">
      <button
        type="button"
        onClick={() => setFormMode('single')}
        className={`px-4 py-1 text-sm font-medium rounded-md transition ${formMode === 'single' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-600'}`}
      >
        Single
      </button>
      <button
        type="button"
        onClick={() => setFormMode('bulk')}
        className={`px-4 py-1 text-sm font-medium rounded-md transition ${formMode === 'bulk' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-600'}`}
      >
        Bulk CSV
      </button>
    </div>
  </div>

  {error && (
    <div className="mb-4 p-4 bg-red-50 border border-red-200 text-red-700 rounded-lg">
      {error}
    </div>
  )}

  {success && (
    <div className="mb-4 p-4 bg-green-50 border border-green-200 text-green-700 rounded-lg">
      {formMode === 'bulk' ? 'Bulk upload completed successfully.' : editData ? 'Invoice updated successfully.' : 'Invoice created successfully.'}
    </div>
  )}

  {formMode === 'bulk' ? (
    <div className="py-8 text-center border-2 border-dashed border-gray-300 rounded-lg bg-gray-50">
      <div className="mx-auto w-16 h-16 mb-4 text-gray-400 flex items-center justify-center">
        <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"></path></svg>
      </div>
      <h4 className="text-gray-900 font-medium mb-1">Drag & Drop CSV File</h4>
      <p className="text-gray-500 text-sm mb-4">Required columns: invoiceNumber, vendorName, amount, gstRate</p>
      
      <label className="cursor-pointer inline-flex items-center px-4 py-2 bg-white border border-gray-300 rounded-md font-semibold text-gray-700 hover:bg-gray-50 transition">
        <span>Browse File</span>
        <input type="file" accept=".csv" className="hidden" onChange={handleFileUpload} disabled={uploadingBulk} />
      </label>

      {uploadingBulk && (
        <div className="mt-6 w-full max-w-md mx-auto">
          <div className="flex justify-between text-sm mb-1 text-blue-600">
            <span>Uploading...</span>
            <span>{bulkProgress.current} / {bulkProgress.total}</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div className="bg-blue-600 h-2 rounded-full transition-all" style={{ width: `${(bulkProgress.current / bulkProgress.total) * 100}%` }}></div>
          </div>
        </div>
      )}
    </div>
  ) : (
    <form onSubmit={handleSubmit}>
      <div className="grid grid-cols-2 gap-4 mb-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Invoice Number *</label>
          <input type="text" name="invoiceNumber" value={formData.invoiceNumber} onChange={handleInputChange} placeholder="INV-001" required className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Vendor Name *</label>
          <input type="text" name="vendorName" value={formData.vendorName} onChange={handleInputChange} placeholder="Enter vendor name" required className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Vendor GST</label>
          <input type="text" name="vendorGst" value={formData.vendorGst} onChange={(e) => setFormData({...formData, vendorGst: e.target.value.toUpperCase()})} placeholder="27AABCT1234H1Z0" pattern="^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$" title="Must be a valid 15-character GSTIN" className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Amount (INR) *</label>
          <input type="number" name="amount" value={formData.amount} onChange={handleInputChange} placeholder="50000" required step="0.01" min="0.01" className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">GST Rate (%) *</label>
          <select name="gstRate" value={formData.gstRate} onChange={handleInputChange} required className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
            <option value="0">0%</option>
            <option value="5">5%</option>
            <option value="12">12%</option>
            <option value="18">18%</option>
            <option value="28">28%</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Invoice Date *</label>
          <input type="date" name="invoiceDate" value={formData.invoiceDate} onChange={handleInputChange} required className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">State *</label>
          <input type="text" name="state" value={formData.state} onChange={handleInputChange} placeholder="Gujarat" required className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Invoice Type</label>
          <select name="invoiceType" value={formData.invoiceType} onChange={handleInputChange} className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
            <option value="B2B">B2B</option>
            <option value="B2C">B2C</option>
            <option value="IMPORT">Import</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">HSN Code</label>
          <input type="text" name="hsnCode" value={formData.hsnCode} onChange={handleInputChange} placeholder="8471" className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
        <div className="col-span-2">
          <label className="block text-sm font-medium text-gray-700 mb-2">Notes</label>
          <textarea name="notes" value={formData.notes} onChange={handleInputChange} placeholder="Additional notes..." rows={2} className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
      </div>

      {calculatedTax.total > 0 && (
        <div className="mb-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
          <div className="grid grid-cols-3 gap-4">
            {calculatedTax.igst > 0 ? (
              <div>
                <p className="text-xs text-gray-600">IGST</p>
                <p className="text-lg font-bold text-blue-600">INR {calculatedTax.igst.toFixed(2)}</p>
              </div>
            ) : (
              <>
                <div>
                  <p className="text-xs text-gray-600">SGST</p>
                  <p className="text-lg font-bold text-blue-600">INR {calculatedTax.sgst.toFixed(2)}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-600">CGST</p>
                  <p className="text-lg font-bold text-blue-600">INR {calculatedTax.cgst.toFixed(2)}</p>
                </div>
              </>
            )}
            <div>
              <p className="text-xs text-gray-600">Total Tax</p>
              <p className="text-lg font-bold text-blue-600">INR {calculatedTax.total.toFixed(2)}</p>
            </div>
          </div>
          <div className="mt-3 pt-3 border-t border-blue-200">
            <p className="text-sm text-gray-700">
              <span className="font-semibold">Grand Total:</span> INR {(parseFloat(formData.amount || '0') + calculatedTax.total).toFixed(2)}
            </p>
          </div>
        </div>
      )}

      <div className="flex gap-3">
        <button
          type="submit"
          disabled={loading}
          className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 font-semibold transition duration-200"
        >
          {loading ? 'Saving...' : editData ? 'Update Invoice' : 'Create Invoice'}
        </button>
        {editData && onCancelEdit && (
          <button
            type="button"
            onClick={onCancelEdit}
            className="px-6 py-2 bg-gray-400 text-white rounded-lg hover:bg-gray-500 font-semibold transition duration-200"
          >
            Cancel
          </button>
        )}
      </div>
    </form>
  )}
</div>
);
}
