import { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import Navbar from '../components/Navbar';
import InvoiceForm from '../components/InvoiceForm';
import GSTModule from '../components/GSTModule';
import api from '../services/api';
import { Invoice } from '../types';
import { AppDispatch, RootState } from '../store';
import { setCompanies } from '../store/slices/companySlice';
import { useToast } from '../components/ToastContext';
export default function GSTPage() {
const dispatch = useDispatch<AppDispatch>();
const { companies, selectedCompanyId } = useSelector((state: RootState) => state.company);
const selectedCompany = companies.find(company => company.id === selectedCompanyId) || null;
const userRole = selectedCompany?.userRole || 'VIEWER';
const canEdit = ['OWNER', 'ADMIN', 'EDITOR'].includes(userRole);
const [invoices, setInvoices] = useState<Invoice[]>([]);
const [loading, setLoading] = useState(false);
const [activeTab, setActiveTab] = useState('invoices');
const [searchQuery, setSearchQuery] = useState('');
const [currentPage, setCurrentPage] = useState(1);
const [totalPages, setTotalPages] = useState(1);
const [selectedInvoices, setSelectedInvoices] = useState<Set<string>>(new Set());
const itemsPerPage = 10;
const { showToast } = useToast();

useEffect(() => {
fetchCompanies();
}, []);

useEffect(() => {
if (selectedCompany) {
setSelectedInvoices(new Set());
fetchInvoices(selectedCompany.id, currentPage, searchQuery);
} else {
setInvoices([]);
}
}, [selectedCompany?.id, currentPage]);

useEffect(() => {
  const delayDebounceFn = setTimeout(() => {
    if (selectedCompany) {
      setCurrentPage(1);
      setSelectedInvoices(new Set());
      fetchInvoices(selectedCompany.id, 1, searchQuery);
    }
  }, 500);
  return () => clearTimeout(delayDebounceFn);
}, [searchQuery]);

const fetchCompanies = async () => {
setLoading(true);
try {
const response = await api.get('/companies');
if (response.data.success) {
dispatch(setCompanies(response.data.companies));
}
} catch (error) {
console.error('Failed to fetch companies:', error);
} finally {
setLoading(false);
}
};
const fetchInvoices = async (companyId: string, page: number = 1, search: string = '') => {
  setLoading(true);
  try {
    const response = await api.get(`/companies/${companyId}/invoices/paginated`, {
      params: { page, limit: itemsPerPage, search }
    });
    if (response.data.success) {
      setInvoices(response.data.invoices);
      setTotalPages(response.data.totalPages);
    }
  } catch (error) {
    console.error('Failed to fetch invoices:', error);
  } finally {
    setLoading(false);
  }
};
const toggleInvoiceSelection = (id: string) => {
  const newSelection = new Set(selectedInvoices);
  if (newSelection.has(id)) {
    newSelection.delete(id);
  } else {
    newSelection.add(id);
  }
  setSelectedInvoices(newSelection);
};
const toggleSelectAllInvoices = () => {
  if (selectedInvoices.size === invoices.length && invoices.length > 0) {
    setSelectedInvoices(new Set());
  } else {
    setSelectedInvoices(new Set(invoices.map(i => i.id)));
  }
};
const handleDeleteInvoice = async (invoiceId: string) => {
if (!window.confirm('Delete this invoice?')) return;
try {
await api.delete(`/invoices/${invoiceId}`);
if (selectedCompany) {
        fetchInvoices(selectedCompany.id, currentPage, searchQuery);
}
showToast('Invoice deleted successfully');
} catch (error: any) {
showToast(error.response?.data?.error || 'Failed to delete invoice', 'error');
}
};
const handleDeleteAllInvoices = async () => {
if (!window.confirm('Are you sure you want to delete ALL invoices matching the current search?')) return;
setLoading(true);
try {
  const response = await api.get(`/companies/${selectedCompany?.id}/invoices/paginated`, {
    params: { page: 1, limit: 10000, search: searchQuery }
  });
  const targetInvoices = response.data.invoices || [];
  for (let i = 0; i < targetInvoices.length; i += 10) {
    const chunk = targetInvoices.slice(i, i + 10);
    await Promise.all(chunk.map((inv: any) => api.delete(`/invoices/${inv.id}`)));
  }
  showToast('All invoices deleted successfully');
  if (selectedCompany) {
    setCurrentPage(1);
    fetchInvoices(selectedCompany.id, 1, searchQuery);
  }
} catch (error: any) {
showToast(error.response?.data?.error || 'Failed to delete some invoices', 'error');
} finally {
setLoading(false);
}
};
const handleDeleteSelectedInvoices = async () => {
if (!window.confirm(`Are you sure you want to delete ${selectedInvoices.size} selected invoices?`)) return;
setLoading(true);
try {
  const selectedArray = Array.from(selectedInvoices);
  for (let i = 0; i < selectedArray.length; i += 10) {
    const chunk = selectedArray.slice(i, i + 10);
    await Promise.all(chunk.map((id: string) => api.delete(`/invoices/${id}`)));
  }
  showToast('Selected invoices deleted successfully');
  setSelectedInvoices(new Set());
  if (selectedCompany) {
    fetchInvoices(selectedCompany.id, currentPage, searchQuery);
  }
} catch (error: any) {
showToast(error.response?.data?.error || 'Failed to delete selected invoices', 'error');
} finally {
setLoading(false);
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
              Invoices ({invoices.length})
            </button>
            <button
              onClick={() => setActiveTab('gst')}
              className={`px-4 py-3 border-b-2 font-semibold transition ${
                activeTab === 'gst'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-600 hover:text-gray-900'
              }`}
            >
              GST Returns
            </button>
          </div>

          {/* Tab Content */}
          {activeTab === 'invoices' && (
            <div className="grid grid-cols-3 gap-6">
              <div className="col-span-2">
                {canEdit ? (
                  <InvoiceForm
                    companyId={selectedCompany.id}
                    companyState={selectedCompany.state}
                    onSuccess={() => fetchInvoices(selectedCompany.id, currentPage, searchQuery)}
                  />
                ) : (
                  <div className="bg-white p-8 rounded-lg border border-gray-200 text-center">
                    <p className="text-gray-500">You have viewer access to this workspace. You cannot create new invoices.</p>
                  </div>
                )}
              </div>
              <div>
                <div className="bg-white p-6 rounded-lg border border-gray-200 sticky top-8">
                  <div className="flex justify-between items-center mb-4">
                    <div className="flex items-center gap-3">
                      <h3 className="text-lg font-semibold">Invoices</h3>
                      {canEdit && invoices.length > 0 && (
                        <label className="flex items-center gap-1 text-sm text-gray-600 cursor-pointer">
                          <input 
                            type="checkbox" 
                            checked={selectedInvoices.size === invoices.length && invoices.length > 0} 
                            onChange={toggleSelectAllInvoices}
                            className="rounded text-blue-600 focus:ring-blue-500 cursor-pointer"
                          />
                          Select All
                        </label>
                      )}
                    </div>
                    <div className="flex gap-2">
                      {canEdit && selectedInvoices.size > 0 && (
                        <button
                          onClick={handleDeleteSelectedInvoices}
                          disabled={loading}
                          className="px-3 py-1 text-xs font-semibold text-red-700 bg-red-50 border border-red-200 rounded hover:bg-red-100 disabled:opacity-50 transition"
                        >
                          Delete Selected ({selectedInvoices.size})
                        </button>
                      )}
                      {canEdit && invoices.length > 0 && (
                        <button
                          onClick={handleDeleteAllInvoices}
                          disabled={loading}
                          className="px-3 py-1 text-xs font-semibold text-red-700 bg-red-50 border border-red-200 rounded hover:bg-red-100 disabled:opacity-50 transition"
                        >
                          Delete All
                        </button>
                      )}
                    </div>
                  </div>
                  <div className="mb-4">
                    <input
                      type="text"
                      placeholder="Search vendor or invoice #..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2">
                    {invoices.length === 0 ? (
                      <p className="text-gray-500 text-sm text-center py-4">No invoices found.</p>
                    ) : (
                      invoices.map(inv => (
                        <div key={inv.id} className="p-3 bg-gray-50 rounded-lg border border-gray-200 hover:border-blue-300 transition relative">
                          <div className="flex items-start gap-3">
                            {canEdit && (
                              <input 
                                type="checkbox" 
                                checked={selectedInvoices.has(inv.id)}
                                onChange={() => toggleInvoiceSelection(inv.id)}
                                className="mt-1 rounded text-blue-600 focus:ring-blue-500 cursor-pointer"
                              />
                            )}
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-semibold text-gray-900 truncate" title={inv.vendorName}>{inv.vendorName}</p>
                              <p className="text-xs text-gray-600 mt-1">INR {inv.amount.toLocaleString()} @ {inv.gstRate}%</p>
                              <p className="text-xs text-gray-500 mt-1">{new Date(inv.invoiceDate).toLocaleDateString()}</p>
                              <p className="text-xs text-blue-600 mt-1 font-semibold">Tax: INR {inv.totalTax.toLocaleString()}</p>
                            </div>
                            {canEdit && (
                              <button
                                type="button"
                                onClick={() => handleDeleteInvoice(inv.id)}
                                className="px-2 py-1 text-xs font-semibold text-red-700 bg-red-50 border border-red-200 rounded hover:bg-red-100 shrink-0"
                              >
                                Delete
                              </button>
                            )}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                  {totalPages > 1 && (
                    <div className="flex justify-between items-center mt-4 pt-4 border-t border-gray-200">
                      <button
                        onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                        disabled={currentPage === 1}
                        className="px-3 py-1 text-xs font-semibold bg-gray-100 text-gray-700 rounded hover:bg-gray-200 disabled:opacity-50 transition"
                      >
                        Previous
                      </button>
                      <span className="text-xs text-gray-600">
                        Page {currentPage} of {totalPages}
                      </span>
                      <button
                        onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                        disabled={currentPage === totalPages}
                        className="px-3 py-1 text-xs font-semibold bg-gray-100 text-gray-700 rounded hover:bg-gray-200 disabled:opacity-50 transition"
                      >
                        Next
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'gst' && (
            <GSTModule companyId={selectedCompany.id} invoices={invoices} />
          )}
        </>
      )}

      {companies.length === 0 && !loading && (
        <div className="bg-blue-50 border border-blue-200 p-6 rounded-lg">
          <p className="text-blue-900">No companies found. Create a company in Dashboard first.</p>
        </div>
      )}
    </div>
  </div>
</>
);
}
