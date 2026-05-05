import { useState, useRef, useEffect } from 'react';
import api from '../services/api';
import { Invoice } from '../types';
// @ts-ignore
import html2pdf from 'html2pdf.js/dist/html2pdf.bundle.min.js';
import { useSelector } from 'react-redux';
import { RootState } from '../store';

interface GSTModuleProps {
companyId: string;
}
export default function GSTModule({ companyId }: GSTModuleProps) {
const { companies } = useSelector((state: RootState) => state.company);
const company = companies.find(c => c.id === companyId);
const userRole = company?.userRole || 'VIEWER';
const canEdit = ['OWNER', 'ADMIN', 'EDITOR'].includes(userRole);

const prevMonthDate = new Date(new Date().getFullYear(), new Date().getMonth() - 1, 1);
const [month, setMonth] = useState(prevMonthDate.getMonth() + 1);
const [year, setYear] = useState(prevMonthDate.getFullYear());
const [gstr1, setGstr1] = useState<any>(null);
const [gstr3b, setGstr3b] = useState<any>(null);
const [monthInvoices, setMonthInvoices] = useState<Invoice[]>([]);
const [loading, setLoading] = useState(false);
const [error, setError] = useState('');
const [success, setSuccess] = useState('');
const gstr1Ref = useRef<HTMLDivElement>(null);
const gstr3bRef = useRef<HTMLDivElement>(null);

useEffect(() => {
  const fetchMonthInvoices = async () => {
    try {
      const response = await api.get(`/invoices/${companyId}`);
      if (response.data.success) {
        const filtered = response.data.invoices.filter((inv: Invoice) => {
          const invDate = new Date(inv.invoiceDate);
          return invDate.getMonth() + 1 === month && invDate.getFullYear() === year;
        });
        setMonthInvoices(filtered);
      }
    } catch (err) {
      console.error('Failed to fetch invoices for GST module');
    }
  };
  if (companyId) {
    fetchMonthInvoices();
  }
}, [companyId, month, year]);
const handleGenerateGSTR1 = async () => {
setLoading(true);
setError('');
setSuccess('');
try {
  const response = await api.post('/gst/gstr1/generate', {
    companyId,
    month: parseInt(month.toString()),
    year: parseInt(year.toString())
  });

  if (response.data.success) {
    setGstr1(response.data.gstr1);
    setGstr3b(null);
  }
} catch (err: any) {
  setError(err.response?.data?.error || 'Failed to generate GSTR-1');
} finally {
  setLoading(false);
}
};
const handleGenerateGSTR3B = async () => {
setLoading(true);
setError('');
setSuccess('');
try {
  const response = await api.post('/gst/gstr3b/generate', {
    companyId,
    month: parseInt(month.toString()),
    year: parseInt(year.toString())
  });

  if (response.data.success) {
    setGstr1(response.data.gstr1);
    setGstr3b(response.data.gstr3b);
  }
} catch (err: any) {
  setError(err.response?.data?.error || 'Failed to generate GSTR-3B');
} finally {
  setLoading(false);
}
};
const handleMarkGSTR1Filed = async () => {
setLoading(true);
setError('');
setSuccess('');
try {
  const response = await api.post('/gst/gstr1/filed', {
    companyId,
    month,
    year
  });

  if (response.data.success) {
    setSuccess('GSTR-1 marked as filed. Refresh the dashboard to see the updated count.');
  }
} catch (err: any) {
  setError(err.response?.data?.error || 'Failed to mark GSTR-1 as filed');
} finally {
  setLoading(false);
}
};
const handleMarkGSTR3BFiled = async () => {
setLoading(true);
setError('');
setSuccess('');
try {
  const response = await api.post('/gst/gstr3b/filed', {
    companyId,
    month,
    year
  });

  if (response.data.success) {
    setSuccess('GSTR-3B marked as filed. Refresh the dashboard to see the updated count.');
  }
} catch (err: any) {
  setError(err.response?.data?.error || 'Failed to mark GSTR-3B as filed');
} finally {
  setLoading(false);
}
};
const downloadGSTR1 = () => {
  const element = gstr1Ref.current;
  if (!element) return;
  const opt = {
    margin: 0.5,
    filename: `GSTR-1_${month}_${year}.pdf`,
    image: { type: 'jpeg', quality: 0.98 },
    html2canvas: { scale: 2, useCORS: true },
    jsPDF: { unit: 'in', format: 'letter', orientation: 'portrait' }
  };
  html2pdf().set(opt).from(element).save();
};
const downloadGSTR3B = () => {
  const element = gstr3bRef.current;
  if (!element) return;
  const opt = {
    margin: 0.5,
    filename: `GSTR-3B_${month}_${year}.pdf`,
    image: { type: 'jpeg', quality: 0.98 },
    html2canvas: { scale: 2, useCORS: true },
    jsPDF: { unit: 'in', format: 'letter', orientation: 'portrait' }
  };
  html2pdf().set(opt).from(element).save();
};
return (
<div className="space-y-6">
{/* Month/Year Selector */}
<div className="bg-white p-6 rounded-lg border border-gray-200">
<h3 className="text-lg font-semibold mb-4">Select Month & Year</h3>
<div className="flex gap-4 items-end">
<div>
<label className="block text-sm font-medium text-gray-700 mb-2">Month</label>
<select
value={month}
onChange={(e) => setMonth(parseInt(e.target.value))}
className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
>
{Array.from({ length: 12 }, (_, i) => i + 1).map(m => (
<option key={m} value={m}>
{new Date(2024, m - 1).toLocaleString('default', { month: 'long' })}
</option>
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
      {success}
    </div>
  )}

  {/* Invoice List for Selected Month */}
  {!gstr1 && (
    <div className="bg-white p-6 rounded-lg border border-gray-200">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-semibold mb-0">
          Invoices for {new Date(year, month - 1).toLocaleString('default', { month: 'long', year: 'numeric' })}
        </h3>
      </div>

      {monthInvoices.length === 0 ? (
        <p className="text-gray-600">No invoices found for this month</p>
      ) : (
        <>
          <div className="overflow-x-auto mb-4">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b-2 border-gray-300">
                  <th className="text-left py-3 font-semibold text-gray-700">Vendor</th>
                  <th className="text-left py-3 font-semibold text-gray-700">Date</th>
                  <th className="text-right py-3 font-semibold text-gray-700">Amount</th>
                  <th className="text-right py-3 font-semibold text-gray-700">GST Rate</th>
                  <th className="text-right py-3 font-semibold text-gray-700">Tax</th>
                </tr>
              </thead>
              <tbody>
                {monthInvoices.map((inv, idx) => (
                  <tr key={inv.id} className={idx % 2 === 0 ? 'bg-gray-50 hover:bg-gray-100 transition' : 'bg-white hover:bg-gray-50 transition'}>
                    <td className="py-3">{inv.vendorName}</td>
                    <td className="py-3">{new Date(inv.invoiceDate).toLocaleDateString()}</td>
                    <td className="text-right py-3">INR {inv.amount.toLocaleString()}</td>
                    <td className="text-right py-3">{inv.gstRate}%</td>
                    <td className="text-right py-3 font-semibold">INR {inv.totalTax.toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-gray-300 bg-gray-50">
                  <td colSpan={2} className="py-3 font-semibold">Total</td>
                  <td className="text-right py-3 font-semibold">
                    INR {monthInvoices.reduce((sum, inv) => sum + inv.amount, 0).toLocaleString()}
                  </td>
                  <td colSpan={1}></td>
                  <td className="text-right py-3 font-semibold">
                    INR {monthInvoices.reduce((sum, inv) => sum + inv.totalTax, 0).toLocaleString()}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>

          <button
            onClick={handleGenerateGSTR1}
            disabled={loading}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 font-semibold transition"
          >
            {loading ? 'Generating...' : 'Generate GSTR-1'}
          </button>
        </>
      )}
    </div>
  )}

  {/* GSTR-1 Result */}
  {gstr1 && (
    <div className="bg-white p-6 rounded-lg border border-gray-200" ref={gstr1Ref}>
      <h3 className="text-lg font-semibold mb-4">GSTR-1 Summary</h3>

      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
          <p className="text-sm text-gray-600">Total Sales</p>
          <p className="text-2xl font-bold text-blue-600">INR {gstr1.totalSales.toLocaleString()}</p>
        </div>
        <div className="p-4 bg-green-50 rounded-lg border border-green-200">
          <p className="text-sm text-gray-600">Total Tax</p>
          <p className="text-2xl font-bold text-green-600">INR {gstr1.totalTax.toLocaleString()}</p>
        </div>
        <div className="p-4 bg-purple-50 rounded-lg border border-purple-200">
          <p className="text-sm text-gray-600">Invoice Count</p>
          <p className="text-2xl font-bold text-purple-600">{gstr1.invoiceCount}</p>
        </div>
      </div>

      <div className="mb-6">
        <h4 className="font-semibold mb-3">Sales by GST Rate:</h4>
        <div className="space-y-2">
          {gstr1.byRate.map((item: any) => (
            <div key={item.rate} className="flex justify-between p-3 bg-gray-50 rounded-lg border border-gray-200">
              <span className="font-medium">{item.rate}% GST ({item.count} invoices)</span>
              <span className="text-gray-700">INR {item.amount.toLocaleString()} / Tax: INR {item.tax.toLocaleString()}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="flex gap-3 mt-6" data-html2canvas-ignore>
        <button
          onClick={downloadGSTR1}
          className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 font-semibold transition"
        >
          Download PDF
        </button>
        <button
          onClick={handleGenerateGSTR3B}
          disabled={loading}
          className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 font-semibold transition"
        >
          {loading ? 'Generating...' : 'Generate GSTR-3B'}
        </button>
        <button
          onClick={handleMarkGSTR1Filed}
          disabled={loading}
          className="px-6 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:bg-gray-400 font-semibold transition"
        >
          {loading ? 'Saving...' : 'Mark GSTR-1 Filed'}
        </button>
        <button
          onClick={() => {
            setGstr1(null);
            setGstr3b(null);
          }}
          className="px-6 py-2 bg-gray-400 text-white rounded-lg hover:bg-gray-500 font-semibold transition"
        >
          Reset
        </button>
      </div>
    </div>
  )}

  {/* GSTR-3B Result */}
  {gstr3b && (
    <div className="bg-white p-6 rounded-lg border border-gray-200" ref={gstr3bRef}>
      <h3 className="text-lg font-semibold mb-4">GSTR-3B Summary (Payment Liability)</h3>

      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
          <p className="text-sm text-gray-600">Tax Liability</p>
          <p className="text-2xl font-bold text-blue-600">INR {gstr3b.totalTax.toLocaleString()}</p>
        </div>
        <div className="p-4 bg-yellow-50 rounded-lg border border-yellow-200">
          <p className="text-sm text-gray-600">Input Credit</p>
          <p className="text-2xl font-bold text-yellow-600">INR {gstr3b.inputCredit.toLocaleString()}</p>
        </div>
        <div className="p-4 bg-red-50 rounded-lg border border-red-200">
          <p className="text-sm text-gray-600">Net Payable</p>
          <p className="text-2xl font-bold text-red-600">INR {gstr3b.netPayable.toLocaleString()}</p>
        </div>
      </div>

      <div className="p-4 bg-gray-50 rounded-lg border border-gray-200 mb-6">
        <h4 className="font-semibold mb-2">Calculation Breakdown:</h4>
        <p className="text-sm text-gray-700">Tax Liability: INR {gstr3b.totalTax.toLocaleString()}</p>
        <p className="text-sm text-gray-700">Less: Input Credit: INR {gstr3b.inputCredit.toLocaleString()}</p>
        <p className="text-sm text-gray-700 font-semibold mt-2">Net Amount to Pay: INR {gstr3b.netPayable.toLocaleString()}</p>
      </div>

      <div className="flex gap-3 mt-6" data-html2canvas-ignore>
        <button
          onClick={downloadGSTR3B}
          className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 font-semibold transition"
        >
          Download PDF
        </button>
        <button
          onClick={handleMarkGSTR3BFiled}
          disabled={loading}
          className="px-6 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:bg-gray-400 font-semibold transition"
        >
          {loading ? 'Saving...' : 'Mark GSTR-3B Filed'}
        </button>
      </div>
    </div>
  )}
</div>
);
}
