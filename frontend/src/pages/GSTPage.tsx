import { useEffect, useState } from 'react';
import Navbar from '../components/Navbar';
import InvoiceForm from '../components/InvoiceForm';
import GSTModule from '../components/GSTModule';
import api from '../services/api';
import { Invoice } from '../types';
export default function GSTPage() {
const [companies, setCompanies] = useState<any[]>([]);
const [selectedCompany, setSelectedCompany] = useState<any>(null);
const [invoices, setInvoices] = useState<Invoice[]>([]);
const [loading, setLoading] = useState(false);
const [activeTab, setActiveTab] = useState('invoices');
useEffect(() => {
fetchCompanies();
}, []);
const fetchCompanies = async () => {
try {
const response = await api.get('/companies');
if (response.data.success && response.data.companies.length > 0) {
setCompanies(response.data.companies);
setSelectedCompany(response.data.companies[0]);
fetchInvoices(response.data.companies[0].id);
}
} catch (error) {
console.error('Failed to fetch companies:', error);
}
};
const fetchInvoices = async (companyId: string) => {
  setLoading(true);
  try {
    const response = await api.get(`/invoices/${companyId}`);
    if (response.data.success) {
      setInvoices(response.data.invoices);
    }
  } catch (error) {
    console.error('Failed to fetch invoices:', error);
  } finally {
    setLoading(false);
  }
};
const handleCompanyChange = (company: any) => {
setSelectedCompany(company);
fetchInvoices(company.id);
setActiveTab('invoices');
};
const handleDeleteInvoice = async (invoiceId: string) => {
if (!window.confirm('Delete this invoice?')) return;
try {
await api.delete(`/invoices/${invoiceId}`);
if (selectedCompany) {
fetchInvoices(selectedCompany.id);
}
} catch (error: any) {
alert(error.response?.data?.error || 'Failed to delete invoice');
}
};
return (
<>
<Navbar />
<div className="min-h-screen bg-gray-50">
<div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
<h1 className="text-3xl font-bold mb-2">GST Module</h1>
<p className="text-gray-600 mb-8">Manage invoices and generate GST returns (GSTR-1 & GSTR-3B)</p>
      {loading && (
        <div className="mb-6 rounded-lg bg-blue-50 border border-blue-200 p-4 text-blue-700">
          Loading companies and invoices...
        </div>
      )}
      {/* Company Selector */}
      {companies.length > 0 && (
        <div className="mb-8">
          <label className="block text-sm font-semibold text-gray-700 mb-3">Select Company</label>
          <select
            value={selectedCompany?.id || ''}
            onChange={(e) => {
              const company = companies.find(c => c.id === e.target.value);
              if (company) handleCompanyChange(company);
            }}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {companies.map(c => (
              <option key={c.id} value={c.id}>{c.companyName} - {c.state}</option>
            ))}
          </select>
        </div>
      )}

      {selectedCompany && (
        <>
          {/* Tabs */}
          <div className="flex gap-4 mb-8 border-b border-gray-200">
            <button
              onClick={() => setActiveTab('invoices')}
              className={`px-4 py-3 border-b-2 font-semibold transition ${
                activeTab === 'invoices'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-600 hover:text-gray-900'
              }`}
            >
              📋 Invoices ({invoices.length})
            </button>
            <button
              onClick={() => setActiveTab('gst')}
              className={`px-4 py-3 border-b-2 font-semibold transition ${
                activeTab === 'gst'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-600 hover:text-gray-900'
              }`}
            >
              📊 Generate Returns
            </button>
          </div>

          {/* Tab Content */}
          {activeTab === 'invoices' && (
            <div className="grid grid-cols-3 gap-6">
              <div className="col-span-2">
                <InvoiceForm companyId={selectedCompany.id} onSuccess={() => fetchInvoices(selectedCompany.id)} />
              </div>
              <div>
                <div className="bg-white p-6 rounded-lg border border-gray-200 sticky top-8">
                  <h3 className="text-lg font-semibold mb-4">Recent Invoices</h3>
                  <div className="space-y-3 max-h-96 overflow-y-auto">
                    {invoices.slice(0, 10).map(inv => (
                      <div key={inv.id} className="p-3 bg-gray-50 rounded-lg border border-gray-200 hover:border-blue-300 transition">
                        <div className="flex items-start justify-between gap-2">
                          <p className="text-sm font-semibold text-gray-900">{inv.vendorName}</p>
                          <button
                            type="button"
                            onClick={() => handleDeleteInvoice(inv.id)}
                            className="px-2 py-1 text-xs font-semibold text-red-700 bg-red-50 border border-red-200 rounded hover:bg-red-100"
                          >
                            Delete
                          </button>
                        </div>
                        <p className="text-xs text-gray-600 mt-1">₹{inv.amount.toLocaleString()} @ {inv.gstRate}%</p>
                        <p className="text-xs text-gray-500 mt-1">{new Date(inv.invoiceDate).toLocaleDateString()}</p>
                        <p className="text-xs text-blue-600 mt-1 font-semibold">Tax: ₹{inv.totalTax.toLocaleString()}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'gst' && (
            <GSTModule companyId={selectedCompany.id} invoices={invoices} />
          )}
        </>
      )}
    </div>
  </div>
</>
);
}
