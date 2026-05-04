import { useState, useEffect, useRef } from 'react';
import { useSelector } from 'react-redux';
import { RootState } from '../store';
import api from '../services/api';
import { TDSRecord } from '../types';
// @ts-ignore
import html2pdf from 'html2pdf.js/dist/html2pdf.bundle.min.js';

interface TDSModuleProps {
companyId: string;
}
const getFinancialQuarter = (date: Date) => {
const month = date.getMonth() + 1;
if (month >= 4 && month <= 6) return 1;
if (month >= 7 && month <= 9) return 2;
if (month >= 10 && month <= 12) return 3;
return 4;
};
const getFinancialYear = (date: Date) => {
const month = date.getMonth() + 1;
return month >= 4 ? date.getFullYear() : date.getFullYear() - 1;
};
export default function TDSModule({ companyId }: TDSModuleProps) {
const { companies } = useSelector((state: RootState) => state.company);
const company = companies.find(c => c.id === companyId);
const userRole = company?.userRole || 'VIEWER';
const canEdit = ['OWNER', 'ADMIN', 'EDITOR'].includes(userRole);
const canFile = ['OWNER', 'ADMIN'].includes(userRole);
const [tdsRecords, setTdsRecords] = useState<TDSRecord[]>([]);
const [quarter, setQuarter] = useState(getFinancialQuarter(new Date()));
const [year, setYear] = useState(getFinancialYear(new Date()));
const [form26q, setForm26q] = useState<any>(null);
const [loading, setLoading] = useState(false);
const [showForm, setShowForm] = useState(false);
const [formMode, setFormMode] = useState<'single' | 'bulk'>('single');
const [uploadingBulk, setUploadingBulk] = useState(false);
const [bulkProgress, setBulkProgress] = useState({ current: 0, total: 0 });
const [error, setError] = useState('');
const [success, setSuccess] = useState('');
const [searchQuery, setSearchQuery] = useState('');
const [currentPage, setCurrentPage] = useState(1);
const [editingRecordId, setEditingRecordId] = useState<string | null>(null);
const itemsPerPage = 10;
const form26qRef = useRef<HTMLDivElement>(null);
const [formData, setFormData] = useState({
vendorName: '',
vendorPan: '',
paymentDate: new Date().toISOString().split('T')[0],
paymentAmount: '',
category: 'services'
});

// Fetch TDS records when company or quarter/year changes
useEffect(() => {
  fetchTDSRecords();
}, [companyId, quarter, year]);

const fetchTDSRecords = async (q = quarter, y = year) => {
  try {
    const response = await api.get(`/tds/records/${companyId}`, {
      params: { quarter: q, year: y }
    });
    if (response.data.success) {
      setTdsRecords(response.data.records);
    }
  } catch (error) {
    console.error('Failed to fetch TDS records:', error);
  }
};

useEffect(() => {
  setCurrentPage(1);
}, [searchQuery, quarter, year]);

const filteredRecords = tdsRecords.filter(record => 
  record.vendorName.toLowerCase().includes(searchQuery.toLowerCase()) || 
  (record.vendorPan && record.vendorPan.toLowerCase().includes(searchQuery.toLowerCase()))
);
const totalPages = Math.max(1, Math.ceil(filteredRecords.length / itemsPerPage));
const paginatedRecords = filteredRecords.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

const TDS_RATES: Record<string, number> = {
services: 10,
goods: 15,
commission: 10,
rent: 10,
other: 10
};
const QUARTER_MONTHS: Record<number, string> = {
1: 'Apr-Jun',
2: 'Jul-Sep',
3: 'Oct-Dec',
4: 'Jan-Mar'
};
const currentYear = new Date().getFullYear();
const yearOptions = Array.from({ length: currentYear - 1990 + 1 }, (_, i) => currentYear - i);
const handleAddPayment = async (e: React.FormEvent) => {
e.preventDefault();
setLoading(true);
setError('');
setSuccess('');
try {
  const paymentAmount = parseFloat(formData.paymentAmount);
  if (!Number.isFinite(paymentAmount) || paymentAmount <= 0) {
    setError('Payment amount must be a positive number.');
    return;
  }

  const payload = {
    companyId: companyId,
    vendorName: formData.vendorName.trim(),
    vendorPan: formData.vendorPan.trim().toUpperCase() || null,
    paymentDate: formData.paymentDate,
    paymentAmount,
    category: formData.category
  };

  let response;
  if (editingRecordId) {
    response = await api.put(`/tds/records/${editingRecordId}`, payload);
  } else {
    response = await api.post('/tds/records', payload);
  }

  if (response.data.success) {
    const paymentDate = new Date(formData.paymentDate);
    const newQuarter = getFinancialQuarter(paymentDate);
    const newYear = getFinancialYear(paymentDate);
    setQuarter(newQuarter);
    setYear(newYear);
    fetchTDSRecords(newQuarter, newYear);
    setForm26q(null);
    setFormData({
      vendorName: '',
      vendorPan: '',
      paymentDate: new Date().toISOString().split('T')[0],
      paymentAmount: '',
      category: 'services'
    });
    setShowForm(false);
    setEditingRecordId(null);
    setSuccess(editingRecordId ? 'Payment updated successfully.' : 'Payment recorded successfully.');
    setTimeout(() => setSuccess(''), 3000);
  }
} catch (err: any) {
  const details = err.response?.data?.details;
  setError(Array.isArray(details) ? details.join(', ') : err.response?.data?.error || 'Failed to record payment');
} finally {
  setLoading(false);
}
};
const handleEditClick = (record: any) => {
  setFormData({
    vendorName: record.vendorName,
    vendorPan: record.vendorPan || '',
    paymentDate: new Date(record.paymentDate).toISOString().split('T')[0],
    paymentAmount: record.paymentAmount.toString(),
    category: record.category
  });
  setEditingRecordId(record.id);
  setFormMode('single');
  setShowForm(true);
  window.scrollTo({ top: 0, behavior: 'smooth' });
};
const handleDeleteRecord = async (recordId: string) => {
if (!window.confirm('Delete this TDS payment record?')) return;
setLoading(true);
setError('');
setSuccess('');
try {
  const response = await api.delete(`/tds/records/${recordId}`);
  if (response.data.success) {
    setTdsRecords(tdsRecords.filter(record => record.id !== recordId));
    setForm26q(null);
    if (editingRecordId === recordId) {
      setEditingRecordId(null);
    }
    setSuccess('TDS payment record deleted.');
    setTimeout(() => setSuccess(''), 3000);
  }
} catch (err: any) {
  setError(err.response?.data?.error || 'Failed to delete TDS record');
} finally {
  setLoading(false);
}
};
const handleDeleteAllRecords = async () => {
if (!window.confirm('Are you sure you want to delete ALL TDS records matching the current search?')) return;
setLoading(true);
setError('');
setSuccess('');
try {
  for (let i = 0; i < filteredRecords.length; i += 10) {
    const chunk = filteredRecords.slice(i, i + 10);
    await Promise.all(chunk.map(record => api.delete(`/tds/records/${record.id}`)));
  }
  setSuccess('All TDS records deleted successfully.');
  setCurrentPage(1);
  fetchTDSRecords();
  setTimeout(() => setSuccess(''), 3000);
} catch (err: any) {
  setError(err.response?.data?.error || 'Failed to delete some records');
} finally {
  setLoading(false);
}
};
const handleExportCSV = () => {
  if (filteredRecords.length === 0) {
    setError('No records available to export.');
    return;
  }
  const headers = ['Vendor Name', 'Vendor PAN', 'Payment Date', 'Category', 'Payment Amount (INR)', 'TDS Rate (%)', 'TDS Deducted (INR)', 'Net Payment (INR)'];
  const csvRows = filteredRecords.map(r => [
    `"${r.vendorName}"`,
    r.vendorPan || '',
    new Date(r.paymentDate).toLocaleDateString(),
    r.category,
    r.paymentAmount,
    r.tdsRate,
    r.tdsDeducted,
    r.paymentMade
  ]);
  const csvContent = [headers.join(','), ...csvRows.map(row => row.join(','))].join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.setAttribute('download', `TDS_Records_Q${quarter}_${year}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};
const handleGenerateForm26Q = async () => {
setLoading(true);
setError('');
setSuccess('');
try {
  const response = await api.post('/tds/form26q/generate', {
    companyId,
    quarter,
    year
  });

  if (response.data.success) {
    setForm26q(response.data.form26q);
  }
} catch (err: any) {
  setError(err.response?.data?.error || 'Failed to generate Form 26Q');
} finally {
  setLoading(false);
}
};
const handleMarkForm26QFiled = async () => {
setLoading(true);
setError('');
setSuccess('');
try {
  const response = await api.post('/tds/form26q/filed', {
    companyId,
    quarter,
    year
  });

  if (response.data.success) {
    setSuccess('Form 26Q marked as filed. Refresh the dashboard to see the updated count.');
  }
} catch (err: any) {
  setError(err.response?.data?.error || 'Failed to mark Form 26Q as filed');
} finally {
  setLoading(false);
}
};
const downloadForm26Q = () => {
  const element = form26qRef.current;
  if (!element) return;
  const opt = {
    margin: 0.5,
    filename: `Form-26Q_Q${quarter}_${year}.pdf`,
    image: { type: 'jpeg', quality: 0.98 },
    html2canvas: { scale: 2, useCORS: true },
    jsPDF: { unit: 'in', format: 'letter', orientation: 'portrait' }
  };
  html2pdf().set(opt).from(element).save();
};
const calculateTdsAmount = (amount: number) => {
const rate = TDS_RATES[formData.category] || 10;
return (amount * rate) / 100;
};

const handleFileUpload = async (e: any) => {
  const file = e.target?.files?.[0];
  if (!file) return;
  
  if (!file.name.toLowerCase().endsWith('.csv') && file.type !== 'text/csv' && file.type !== 'application/vnd.ms-excel') {
    setError('Invalid file type. Please upload a .csv file.');
    return;
  }
  
  const reader = new FileReader();
  reader.onload = async (event) => {
    const text = event.target?.result as string;
    const lines = text.split('\n').filter((line: string) => line.trim() !== '');
    if (lines.length < 2) {
      setError('Invalid CSV format. Header row required.');
      return;
    }

    const headers = lines[0].split(',').map((h: string) => h.trim().toLowerCase());
    const newRecords = lines.slice(1).map((line: string) => {
      const values = line.split(',');
      return {
        vendorName: values[headers.indexOf('vendorname')] || 'Unknown Vendor',
        vendorPan: values[headers.indexOf('vendorpan')] || null,
        paymentAmount: parseFloat(values[headers.indexOf('paymentamount')]) || 0,
        category: values[headers.indexOf('category')] || 'services',
        paymentDate: values[headers.indexOf('paymentdate')] || new Date().toISOString().split('T')[0]
      };
    });

    setUploadingBulk(true);
    setBulkProgress({ current: 0, total: newRecords.length });
    
    let successCount = 0;
    for (let i = 0; i < newRecords.length; i++) {
      try {
        await api.post('/tds/records', { companyId, ...newRecords[i] });
        successCount++;
      } catch (err) {
        console.error('Failed to create TDS record:', newRecords[i].vendorName);
      }
      setBulkProgress({ current: i + 1, total: newRecords.length });
    }
    
    setUploadingBulk(false);
    setSuccess(`Successfully uploaded ${successCount} records.`);
    fetchTDSRecords();
    setTimeout(() => setSuccess(''), 3000);
  };
  reader.readAsText(file);
};

return (
<div className="space-y-6">
{/* Quarter/Year Selector */}
<div className="bg-white p-6 rounded-lg border border-gray-200">
<h3 className="text-lg font-semibold mb-4">Select Quarter & Year</h3>
<div className="flex gap-4 items-end">
<div>
<label className="block text-sm font-medium text-gray-700 mb-2">Quarter</label>
<select
value={quarter}
onChange={(e) => setQuarter(parseInt(e.target.value))}
className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
>
{[1, 2, 3, 4].map(q => (
<option key={q} value={q}>Q{q} ({QUARTER_MONTHS[q]})</option>
))}
</select>
</div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">Year</label>
        <select
          value={year}
          onChange={(e) => setYear(parseInt(e.target.value))}
          className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          {yearOptions.map(y => (
            <option key={y} value={y}>{y}</option>
          ))}
        </select>
      </div>
    </div>
  </div>

  {error && (
    <div className="p-4 bg-red-50 border border-red-200 text-red-700 rounded-lg">
      {error}
    </div>
  )}

  {success && (
    <div className="p-4 bg-green-50 border border-green-200 text-green-700 rounded-lg">
      {success}
    </div>
  )}

  {/* Add Vendor Payment Form */}
  {showForm && (
    <div className="bg-white p-6 rounded-lg border border-gray-200">
      <div className="flex justify-between items-center mb-6">
        <h3 className="text-lg font-semibold">{editingRecordId ? 'Edit Vendor Payment' : 'Record Vendor Payment (TDS)'}</h3>
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

      {formMode === 'bulk' ? (
        <div className="py-8 text-center border-2 border-dashed border-gray-300 rounded-lg bg-gray-50 mb-4">
          <div className="mx-auto w-16 h-16 mb-4 text-gray-400 flex items-center justify-center">
            <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"></path></svg>
          </div>
          <h4 className="text-gray-900 font-medium mb-1">Drag & Drop CSV File</h4>
          <p className="text-gray-500 text-sm mb-4">Required columns: vendorName, vendorPan, paymentAmount, category, paymentDate</p>
          
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
          <div className="mt-6">
            <button type="button" onClick={() => setShowForm(false)} className="px-6 py-2 bg-gray-400 text-white rounded-lg hover:bg-gray-500 font-semibold transition">
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <form onSubmit={handleAddPayment}>
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Vendor Name *
              </label>
              <input
                type="text"
                value={formData.vendorName}
                onChange={(e) => setFormData({ ...formData, vendorName: e.target.value })}
                required
                placeholder="Enter vendor name"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Vendor PAN
              </label>
              <input
                type="text"
                value={formData.vendorPan}
                onChange={(e) => setFormData({ ...formData, vendorPan: e.target.value.toUpperCase() })}
                placeholder="ABCDE1234F"
                maxLength={10}
                pattern="[A-Z]{5}[0-9]{4}[A-Z]"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Payment Amount (INR) *
              </label>
              <input
                type="number"
                value={formData.paymentAmount}
                onChange={(e) => setFormData({ ...formData, paymentAmount: e.target.value })}
                required
                placeholder="50000"
                step="0.01"
                min="0.01"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Category *
              </label>
              <select
                value={formData.category}
                onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="services">Services (10%)</option>
                <option value="goods">Goods (15%)</option>
                <option value="commission">Commission (10%)</option>
                <option value="rent">Rent (10%)</option>
                <option value="other">Other (10%)</option>
              </select>
            </div>

            <div className="col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Payment Date *
              </label>
              <input
                type="date"
                value={formData.paymentDate}
                onChange={(e) => setFormData({ ...formData, paymentDate: e.target.value })}
                required
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          {formData.paymentAmount && (
            <div className="mb-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <p className="text-xs text-gray-600">TDS Rate</p>
                  <p className="text-lg font-bold text-blue-600">{TDS_RATES[formData.category]}%</p>
                </div>
                <div>
                  <p className="text-xs text-gray-600">TDS Amount</p>
                  <p className="text-lg font-bold text-blue-600">INR {calculateTdsAmount(parseFloat(formData.paymentAmount)).toFixed(2)}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-600">Net Payment</p>
                  <p className="text-lg font-bold text-blue-600">INR {(parseFloat(formData.paymentAmount) - calculateTdsAmount(parseFloat(formData.paymentAmount))).toFixed(2)}</p>
                </div>
              </div>
            </div>
          )}

          <div className="flex gap-2">
            <button
              type="submit"
              disabled={loading}
              className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-400 font-semibold transition"
            >
              {loading ? 'Saving...' : editingRecordId ? 'Update Payment' : 'Record Payment'}
            </button>
            <button
              type="button"
              onClick={() => {
                setShowForm(false);
                setEditingRecordId(null);
              }}
              className="px-6 py-2 bg-gray-400 text-white rounded-lg hover:bg-gray-500 font-semibold transition"
            >
              Cancel
            </button>
          </div>
        </form>
      )}
    </div>
  )}

  {!showForm && canEdit && (
    <button
      onClick={() => setShowForm(true)}
      className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-semibold transition"
    >
      + Add Vendor Payment
    </button>
  )}

  {/* TDS Records List */}
  {tdsRecords.length > 0 && (
    <div className="bg-white p-6 rounded-lg border border-gray-200">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-semibold">TDS Payment Records ({filteredRecords.length})</h3>
        <div className="flex items-center gap-2">
          <button
            onClick={handleExportCSV}
            className="px-4 py-2 text-sm font-semibold text-green-700 bg-green-50 border border-green-200 rounded-lg hover:bg-green-100 transition"
          >
            Export CSV
          </button>
          {canEdit && paginatedRecords.length > 0 && (
            <button
              onClick={handleDeleteAllRecords}
              disabled={loading}
              className="px-4 py-2 text-sm font-semibold text-red-700 bg-red-50 border border-red-200 rounded-lg hover:bg-red-100 disabled:opacity-50 transition"
            >
              Delete All
            </button>
          )}
          <input
            type="text"
            placeholder="Search vendor or PAN..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-64 px-4 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b-2 border-gray-300">
              <th className="text-left py-3 font-semibold text-gray-700">Vendor</th>
              <th className="text-left py-3 font-semibold text-gray-700">Date</th>
              <th className="text-right py-3 font-semibold text-gray-700">Payment Amount</th>
              <th className="text-center py-3 font-semibold text-gray-700">Category</th>
              <th className="text-right py-3 font-semibold text-gray-700">TDS %</th>
              <th className="text-right py-3 font-semibold text-gray-700">TDS Deducted</th>
              <th className="text-right py-3 font-semibold text-gray-700">Net Payment</th>
              {canEdit && (
                <th className="text-right py-3 font-semibold text-gray-700">Action</th>
              )}
            </tr>
          </thead>
          <tbody>
            {paginatedRecords.length === 0 ? (
              <tr>
                <td colSpan={canEdit ? 8 : 7} className="text-center py-8 text-gray-500">No records found matching your search.</td>
              </tr>
            ) : paginatedRecords.map((record, idx) => (
              <tr key={record.id} className={idx % 2 === 0 ? 'bg-gray-50 hover:bg-gray-100 transition' : 'bg-white hover:bg-gray-50 transition'}>
                <td className="py-3">{record.vendorName}</td>
                <td className="py-3">{new Date(record.paymentDate).toLocaleDateString()}</td>
                <td className="text-right py-3">INR {Number(record.paymentAmount).toLocaleString()}</td>
                <td className="text-center py-3 capitalize">{record.category}</td>
                <td className="text-right py-3">{record.tdsRate}%</td>
                <td className="text-right py-3 font-semibold text-red-600">INR {Number(record.tdsDeducted).toLocaleString()}</td>
                <td className="text-right py-3 font-semibold text-green-600">INR {Number(record.paymentMade).toLocaleString()}</td>
                {canEdit && (
                  <td className="text-right py-3 space-x-2">
                    <div className="flex justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => handleEditClick(record)}
                        disabled={loading}
                        className="px-3 py-1 text-xs font-semibold text-blue-700 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100 disabled:bg-gray-100 disabled:text-gray-400 transition"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteRecord(record.id)}
                        disabled={loading}
                        className="px-3 py-1 text-xs font-semibold text-red-700 bg-red-50 border border-red-200 rounded-lg hover:bg-red-100 disabled:bg-gray-100 disabled:text-gray-400 transition"
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-gray-300 bg-gray-50">
              <td colSpan={2} className="py-3 font-semibold text-center">Total</td>
              <td className="text-right py-3 font-semibold">
                INR {filteredRecords.reduce((sum, r) => sum + Number(r.paymentAmount), 0).toLocaleString()}
              </td>
              <td></td>
              <td></td>
              <td className="text-right py-3 font-semibold text-red-600">
                INR {filteredRecords.reduce((sum, r) => sum + Number(r.tdsDeducted), 0).toLocaleString()}
              </td>
              <td className="text-right py-3 font-semibold text-green-600">
                INR {filteredRecords.reduce((sum, r) => sum + Number(r.paymentMade), 0).toLocaleString()}
              </td>
              {canEdit && <td></td>}
            </tr>
          </tfoot>
        </table>
      </div>
      {totalPages > 1 && (
        <div className="flex justify-between items-center mt-6 pt-4 border-t border-gray-200">
          <button
            onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
            disabled={currentPage === 1}
            className="px-4 py-2 text-sm font-semibold bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 disabled:opacity-50 transition"
          >
            Previous
          </button>
          <span className="text-sm text-gray-600">
            Page {currentPage} of {totalPages}
          </span>
          <button
            onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
            disabled={currentPage === totalPages}
            className="px-4 py-2 text-sm font-semibold bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 disabled:opacity-50 transition"
          >
            Next
          </button>
        </div>
      )}
    </div>
  )}

  {/* Generate Form 26Q */}
  {canEdit && (
    <button
      onClick={handleGenerateForm26Q}
      disabled={loading || tdsRecords.length === 0}
      className="px-6 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:bg-gray-400 font-semibold transition"
    >
      {loading ? 'Generating...' : 'Generate Form 26Q'}
    </button>
  )}

  {/* Form 26Q Result */}
  {form26q && (
    <div className="bg-white p-6 rounded-lg border border-gray-200" ref={form26qRef}>
      <h3 className="text-lg font-semibold mb-4">Form 26Q - Q{quarter} {year}</h3>

      <div className="grid grid-cols-4 gap-4 mb-6">
        <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
          <p className="text-sm text-gray-600">Total Payments</p>
          <p className="text-2xl font-bold text-blue-600">INR {form26q.totalPayments.toLocaleString()}</p>
        </div>
        <div className="p-4 bg-red-50 rounded-lg border border-red-200">
          <p className="text-sm text-gray-600">TDS Deducted</p>
          <p className="text-2xl font-bold text-red-600">INR {form26q.totalTdsDeducted.toLocaleString()}</p>
        </div>
        <div className="p-4 bg-green-50 rounded-lg border border-green-200">
          <p className="text-sm text-gray-600">Net Paid to Vendors</p>
          <p className="text-2xl font-bold text-green-600">INR {(form26q.totalPayments - form26q.totalTdsDeducted).toLocaleString()}</p>
        </div>
        <div className="p-4 bg-purple-50 rounded-lg border border-purple-200">
          <p className="text-sm text-gray-600">Vendors</p>
          <p className="text-2xl font-bold text-purple-600">{form26q.vendorCount}</p>
        </div>
      </div>

      <div className="mb-6">
        <h4 className="font-semibold mb-3">Vendor-wise Breakdown:</h4>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b-2 border-gray-300">
                <th className="text-left py-2 font-semibold text-gray-700">Vendor</th>
                <th className="text-left py-2 font-semibold text-gray-700">PAN</th>
                <th className="text-right py-2 font-semibold text-gray-700">Payment Amount</th>
                <th className="text-left py-2 font-semibold text-gray-700">Category</th>
                <th className="text-right py-2 font-semibold text-gray-700">TDS Deducted</th>
              </tr>
            </thead>
            <tbody>
              {form26q.vendors.map((vendor: any, idx: number) => (
                <tr key={idx} className={idx % 2 === 0 ? 'bg-gray-50' : 'bg-white'}>
                  <td className="py-2">{vendor.name}</td>
                  <td className="py-2 text-gray-600">{vendor.pan || '-'}</td>
                  <td className="text-right py-2">INR {vendor.amount.toLocaleString()}</td>
                  <td className="py-2 capitalize">{vendor.category}</td>
                  <td className="text-right py-2 font-semibold">INR {vendor.tdsDeducted.toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="flex gap-3 mt-6" data-html2canvas-ignore>
        <button
          onClick={downloadForm26Q}
          className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 font-semibold transition"
        >
          Download PDF
        </button>
        {canFile && (
          <button
            onClick={handleMarkForm26QFiled}
            disabled={loading}
            className="px-6 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:bg-gray-400 font-semibold transition"
          >
            {loading ? 'Saving...' : 'Mark Form 26Q Filed'}
          </button>
        )}
      </div>
    </div>
  )}
</div>
);
}
