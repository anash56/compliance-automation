import { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import api from '../services/api';
import { AppDispatch, RootState } from '../store';
import { setCompanies } from '../store/slices/companySlice';

export default function RequireCompany({ children }: { children: React.ReactNode }) {
  const dispatch = useDispatch<AppDispatch>();
  const { companies } = useSelector((state: RootState) => state.company);
  const [loading, setLoading] = useState(companies.length === 0);
  const [hasCompany, setHasCompany] = useState(companies.length > 0);

  useEffect(() => {
    if (companies.length > 0) {
      setHasCompany(true);
      setLoading(false);
      return;
    }

    const fetchCompanies = async () => {
      setLoading(true);
      try {
        const response = await api.get('/companies');
        if (response.data.success) {
          dispatch(setCompanies(response.data.companies));
          setHasCompany(response.data.companies.length > 0);
        }
      } catch (error) {
        setHasCompany(false);
      } finally {
        setLoading(false);
      }
    };

    fetchCompanies();
  }, [companies.length, dispatch]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-gray-600">Loading workspace...</p>
      </div>
    );
  }

  if (!hasCompany) {
    return <Navigate to="/onboarding" replace />;
  }

  return <>{children}</>;
}
