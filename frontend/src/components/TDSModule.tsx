import { useState } from 'react';
import api from '../services/api';
interface TDSModuleProps {
companyId: string;
}
export default function TDSModule({ companyId }: TDSModuleProps) {
const [tdsRecords, setTdsRecords] = useState<any[]>([]);
const [quarter, setQuarter] = useState(1);
const [year, setYear] = useState(new Date().getFullYear());
const [form26q, setForm26q] = useState<any>(null);
const [loading, setLoading] = useState(false);
const [showForm, setShowForm] = useState(false);
const [error, setError] = useState('');
const [success, setSuccess] = useState(false);
const [formData, setFormData] = useState({
vendorName: '',
vendorPan: '',
paymentDate: new Date().toISOString().split('T')[0],
paymentAmount: '',
category: 'services'
});
const TDS_RATES: Record<string, number> = {
services: 10,
goods: 15,
commission: 10,
rent: 10
};
const QUARTER_MONTHS: Record<number, string> = {
1: 'Apr-Jun',
2: 'Jul-Sep',
3: 'Oct-Dec',
4: 'Jan-Mar'
};
const handleAddPayment = async (e: React.FormEvent) => {
e.preventDefault();
setLoading(true);
setError('');
setSuccess(false);
try {
  const response = await api.post('/tds/records', {
    companyId,
    vendorName: formData.vendorName,
    vendorPan: formData.vendorPan || null,
    paymentDate: formData.paymentDate,
    paymentAmount: parseFloat(formData.paymentAmount),
    category: formData.category
  });

  if (response.data.success) {
    setTdsRecords([...tdsRecords, response.data.tdsRecord]);
    setFormData({
      vendorName: '',
      vendorPan: '',
      paymentDate: new Date().toISOString().split('T')[0],
      paymentAmount: '',
      category: 'services'
    });
    setShowForm(false);
    setSuccess(true);
    setTimeout(() => setSuccess(false), 3000);
  }
} catch (err: any) {
  setError(err.response?.data?.error || 'Failed to record payment');
} finally {
  setLoading(false);
}
};
const handleGenerateForm26Q = async () => {
setLoading(true);
setError('');
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
const downloadForm26Q = () => {
if (!form26q) return;
const dataStr = JSON.stringify(form26q, null, 2);
const dataBlob = new Blob([dataStr], { type: 'application/json' });
const url = URL.createObjectURL(dataBlob);
const link = document.createElement('a');
link.href = url;
link.download = `Form-26Q_Q${quarter}_${year}.json`;
link.click();
};
const calculateTdsAmount = (amount: number) => {
const rate = TDS_RATES[formData.category] || 10;
return (amount * rate) / 100;
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
          {Array.from({ length: 5 }, (_, i) => year - i).map(y => (
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
      ✓ Payment recorded successfully!
    </div>
  )}

  {/* Add Vendor Payment Form */}
  {showForm && (
    <form onSubmit={handleAddPayment} className="bg-white p-6 rounded-lg border border-gray-200">
      <h3 className="text-lg font-semibold mb-4">Record Vendor Payment (TDS)</h3>

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
            onChange={(e) => setFormData({ ...formData, vendorPan: e.target.value })}
            placeholder="ABCDE1234F"
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Payment Amount (₹) *
          </label>
          <input
            type="number"
            value={formData.paymentAmount}
            onChange={(e) => setFormData({ ...formData, paymentAmount: e.target.value })}
            required
            placeholder="50000"
            step="0.01"
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
              <p className="text-lg font-bold text-blue-600">₹{calculateTdsAmount(parseFloat(formData.paymentAmount)).toFixed(2)}</p>
            </div>
            <div>
              <p className="text-xs text-gray-600">Net Payment</p>
              <p className="text-lg font-bold text-blue-600">₹{(parseFloat(formData.paymentAmount) - calculateTdsAmount(parseFloat(formData.paymentAmount))).toFixed(2)}</p>
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
          {loading ? 'Recording...' : 'Record Payment'}
        </button>
        <button
          type="button"
          onClick={() => setShowForm(false)}
          className="px-6 py-2 bg-gray-400 text-white rounded-lg hover:bg-gray-500 font-semibold transition"
        >
          Cancel
        </button>
      </div>
    </form>
  )}

  {!showForm && (
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
      <h3 className="text-lg font-semibold mb-4">TDS Payment Records ({tdsRecords.length})</h3>
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
            </tr>
          </thead>
          <tbody>
            {tdsRecords.map((record, idx) => (
              <tr key={record.id} className={idx % 2 === 0 ? 'bg-gray-50' : 'bg-white'}>
                <td className="py-3">{record.vendorName}</td>
                <td className="py-3">{new Date(record.paymentDate).toLocaleDateString()}</td>
                <td className="text-right py-3">₹{record.paymentAmount.toLocaleString()}</td>
                <td className="text-center py-3 capitalize">{record.category}</td>
                <td className="text-right py-3">{record.tdsRate}%</td>
                <td className="text-right py-3 font-semibold text-red-600">₹{record.tdsDeducted.toLocaleString()}</td>
                <td className="text-right py-3 font-semibold text-green-600">₹{record.paymentMade.toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-gray-300 bg-gray-50">
              <td colSpan={2} className="py-3 font-semibold">Total</td>
              <td className="text-right py-3 font-semibold">
                ₹{tdsRecords.reduce((sum, r) => sum + r.paymentAmount, 0).toLocaleString()}
              </td>
              <td colSpan={1}></td>
              <td></td>
              <td className="text-right py-3 font-semibold text-red-600">
                ₹{tdsRecords.reduce((sum, r) => sum + r.tdsDeducted, 0).toLocaleString()}
              </td>
              <td className="text-right py-3 font-semibold text-green-600">
                ₹{tdsRecords.reduce((sum, r) => sum + r.paymentMade, 0).toLocaleString()}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  )}

  {/* Generate Form 26Q */}
  <button
    onClick={handleGenerateForm26Q}
    disabled={loading || tdsRecords.length === 0}
    className="px-6 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:bg-gray-400 font-semibold transition"
  >
    {loading ? 'Generating...' : 'Generate Form 26Q'}
  </button>

  {/* Form 26Q Result */}
  {form26q && (
    <div className="bg-white p-6 rounded-lg border border-gray-200">
      <h3 className="text-lg font-semibold mb-4">Form 26Q - Q{quarter} {year}</h3>

      <div className="grid grid-cols-4 gap-4 mb-6">
        <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
          <p className="text-sm text-gray-600">Total Payments</p>
          <p className="text-2xl font-bold text-blue-600">₹{form26q.totalPayments.toLocaleString()}</p>
        </div>
        <div className="p-4 bg-red-50 rounded-lg border border-red-200">
          <p className="text-sm text-gray-600">TDS Deducted</p>
          <p className="text-2xl font-bold text-red-600">₹{form26q.totalTdsDeducted.toLocaleString()}</p>
        </div>
        <div className="p-4 bg-green-50 rounded-lg border border-green-200">
          <p className="text-sm text-gray-600">Net Paid to Vendors</p>
          <p className="text-2xl font-bold text-green-600">₹{(form26q.totalPayments - form26q.totalTdsDeducted).toLocaleString()}</p>
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
                  <td className="text-right py-2">₹{vendor.amount.toLocaleString()}</td>
                  <td className="py-2 capitalize">{vendor.category}</td>
                  <td className="text-right py-2 font-semibold">₹{vendor.tdsDeducted.toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <button
        onClick={downloadForm26Q}
        className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 font-semibold transition"
      >
        📥 Download Form 26Q
      </button>
    </div>
  )}
</div>
);
}