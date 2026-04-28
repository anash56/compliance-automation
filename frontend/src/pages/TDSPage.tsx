import { useEffect, useState } from 'react';
import Navbar from '../components/Navbar';
import TDSModule from '../components/TDSModule';
import api from '../services/api';
export default function TDSPage() {
const [companies, setCompanies] = useState<any[]>([]);
const [selectedCompany, setSelectedCompany] = useState<any>(null);
const [loading, setLoading] = useState(false);
useEffect(() => {
fetchCompanies();
}, []);
const fetchCompanies = async () => {
setLoading(true);
try {
const response = await api.get('/companies');
if (response.data.success && response.data.companies.length > 0) {
setCompanies(response.data.companies);
setSelectedCompany(response.data.companies[0]);
}
} catch (error) {
console.error('Failed to fetch companies:', error);
} finally {
setLoading(false);
}
};
const handleCompanyChange = (company: any) => {
setSelectedCompany(company);
};
return (
<>
<Navbar />
<div className="min-h-screen bg-gray-50">
<div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
<h1 className="text-3xl font-bold mb-2">TDS Module</h1>
<p className="text-gray-600 mb-8">Track vendor payments and generate Form 26Q</p>
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

      {selectedCompany && !loading && (
        <TDSModule companyId={selectedCompany.id} />
      )}

      {loading && (
        <div className="text-center py-8">
          <p className="text-gray-600">Loading...</p>
        </div>
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