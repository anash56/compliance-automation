import { useEffect, useState } from 'react';
import Navbar from '../components/Navbar';
import Dashboard from '../components/Dashboard';
import ComplianceCalendar from '../components/ComplianceCalendar';
import api from '../services/api';
export default function DashboardPage() {
const [companies, setCompanies] = useState<any[]>([]);
const [selectedCompany, setSelectedCompany] = useState<any>(null);
const [loading, setLoading] = useState(false);
const [showCompanyForm, setShowCompanyForm] = useState(false);
const [formData, setFormData] = useState({
companyName: '',
state: '',
gstNumber: '',
pan: ''
});
useEffect(() => {
fetchCompanies();
}, []);
const fetchCompanies = async () => {
setLoading(true);
try {
const response = await api.get('/companies');
if (response.data.success) {
setCompanies(response.data.companies);
if (response.data.companies.length > 0) {
setSelectedCompany(response.data.companies[0]);
}
}
} catch (error) {
console.error('Failed to fetch companies:', error);
} finally {
setLoading(false);
}
};
const handleCreateCompany = async (e: React.FormEvent) => {
e.preventDefault();
setLoading(true);
try {
  const response = await api.post('/companies', formData);
  if (response.data.success) {
    setCompanies([...companies, response.data.company]);
    setSelectedCompany(response.data.company);
    setFormData({ companyName: '', state: '', gstNumber: '', pan: '' });
    setShowCompanyForm(false);
    alert('Company created successfully!');
  }
} catch (error: any) {
  alert(error.response?.data?.error || 'Failed to create company');
} finally {
  setLoading(false);
}
};
return (
<>
<Navbar />
<div className="min-h-screen bg-gray-50">
<div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
{/* Dashboard Component */}
<Dashboard />
      {/* Company Management */}
      <div className="mt-12">
        <h2 className="text-2xl font-bold mb-6">Companies</h2>

        {companies.length === 0 ? (
          <div className="bg-blue-50 border border-blue-200 p-6 rounded-lg mb-8">
            <p className="text-blue-900 mb-4">No companies yet. Create your first company to get started.</p>
            <button
              onClick={() => setShowCompanyForm(true)}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-semibold transition"
            >
              Create Company
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-4 gap-4 mb-8">
            {companies.map(company => (
              <button
                key={company.id}
                onClick={() => setSelectedCompany(company)}
                className={`p-4 rounded-lg border-2 text-left transition ${
                  selectedCompany?.id === company.id
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-gray-200 bg-white hover:border-blue-300'
                }`}
              >
                <p className="font-semibold text-gray-900">{company.companyName}</p>
                <p className="text-sm text-gray-600">{company.state}</p>
                {company.gstNumber && <p className="text-xs text-gray-500 mt-1">{company.gstNumber}</p>}
              </button>
            ))}
            <button
              onClick={() => setShowCompanyForm(!showCompanyForm)}
              className="p-4 rounded-lg border-2 border-dashed border-gray-300 hover:border-blue-500 text-center transition"
            >
              <p className="text-3xl font-light">+</p>
              <p className="text-sm text-gray-600 mt-2">Add Company</p>
            </button>
          </div>
        )}

        {/* Company Form */}
        {showCompanyForm && (
          <form onSubmit={handleCreateCompany} className="bg-white p-6 rounded-lg border border-gray-200 mb-8">
            <h3 className="text-lg font-semibold mb-4">Add New Company</h3>
            <div className="grid grid-cols-2 gap-4 mb-4">
              <input
                type="text"
                placeholder="Company Name"
                value={formData.companyName}
                onChange={(e) => setFormData({ ...formData, companyName: e.target.value })}
                required
                className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <input
                type="text"
                placeholder="State"
                value={formData.state}
                onChange={(e) => setFormData({ ...formData, state: e.target.value })}
                required
                className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <input
                type="text"
                placeholder="GST Number"
                value={formData.gstNumber}
                onChange={(e) => setFormData({ ...formData, gstNumber: e.target.value })}
                className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <input
                type="text"
                placeholder="PAN"
                value={formData.pan}
                onChange={(e) => setFormData({ ...formData, pan: e.target.value })}
                className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div className="flex gap-2">
              <button type="submit" disabled={loading} className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-400 font-semibold transition">
                {loading ? 'Creating...' : 'Create'}
              </button>
              <button type="button" onClick={() => setShowCompanyForm(false)} className="px-6 py-2 bg-gray-400 text-white rounded-lg hover:bg-gray-500 font-semibold transition">
                Cancel
              </button>
            </div>
          </form>
        )}
      </div>

      {/* Compliance Calendar */}
      <div className="mt-12">
        <ComplianceCalendar />
      </div>
    </div>
  </div>
</>
);
}