import { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import Navbar from '../components/Navbar';
import TDSModule from '../components/TDSModule';
import api from '../services/api';
import { AppDispatch, RootState } from '../store';
import { setCompanies } from '../store/slices/companySlice';
export default function TDSPage() {
const dispatch = useDispatch<AppDispatch>();
const { companies, selectedCompanyId } = useSelector((state: RootState) => state.company);
const selectedCompany = companies.find(company => company.id === selectedCompanyId) || null;
const [loading, setLoading] = useState(false);
useEffect(() => {
fetchCompanies();
}, []);
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
return (
<>
<Navbar />
<div className="min-h-screen bg-gray-50">
<div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
<h1 className="text-3xl font-bold mb-2">TDS Module</h1>
<p className="text-gray-600 mb-8">Track vendor payments and generate Form 26Q</p>

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
