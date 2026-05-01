import { useEffect, useState } from 'react';
import { useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { RootState } from '../store';
import api from '../services/api';
import ComplianceCalendar from './ComplianceCalendar';

export default function Dashboard() {
  const user = useSelector((state: RootState) => state.auth.user);
  const navigate = useNavigate();
  const [stats, setStats] = useState({
    gstFiled: 0,
    tdsFiled: 0,
    totalTaxPayable: 0,
    daysToFiling: 0
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDashboardStats();
  }, []);

  const fetchDashboardStats = async () => {
    try {
      const response = await api.get('/companies/stats/dashboard');
      if (response.data.success) {
        setStats(response.data.stats);
      }
    } catch (error) {
      console.error('Failed to fetch dashboard stats:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddInvoice = () => {
    navigate('/gst');
  };

  const handleGenerateGSTR1 = () => {
    navigate('/gst');
  };

  const handleRecordTDS = () => {
    navigate('/tds');
  };

  const handleGenerateForm26Q = () => {
    navigate('/tds');
  };

  return (
    <div className="space-y-6">
      {/* Welcome */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Welcome, {user?.fullName}! 👋</h1>
        <p className="text-gray-600 mt-2">GST & TDS Compliance Dashboard</p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-4 gap-4">
        <div className="bg-white p-6 rounded-lg border border-gray-200 hover:shadow-lg transition">
          <p className="text-sm text-gray-600 font-medium">GST Filed</p>
          <p className="text-3xl font-bold text-blue-600 mt-2">{loading ? '-' : stats.gstFiled}</p>
          <p className="text-xs text-gray-500 mt-2">This year</p>
        </div>

        <div className="bg-white p-6 rounded-lg border border-gray-200 hover:shadow-lg transition">
          <p className="text-sm text-gray-600 font-medium">TDS Filed</p>
          <p className="text-3xl font-bold text-green-600 mt-2">{loading ? '-' : stats.tdsFiled}</p>
          <p className="text-xs text-gray-500 mt-2">This year</p>
        </div>

        <div className="bg-white p-6 rounded-lg border border-gray-200 hover:shadow-lg transition">
          <p className="text-sm text-gray-600 font-medium">Total Tax Payable</p>
          <p className="text-3xl font-bold text-orange-600 mt-2">₹{loading ? '-' : stats.totalTaxPayable}</p>
          <p className="text-xs text-gray-500 mt-2">Current month</p>
        </div>

        <div className="bg-white p-6 rounded-lg border border-gray-200 hover:shadow-lg transition">
          <p className="text-sm text-gray-600 font-medium">Days to Filing</p>
          <p className="text-3xl font-bold text-red-600 mt-2">{loading ? '-' : stats.daysToFiling}</p>
          <p className="text-xs text-gray-500 mt-2">GST due</p>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="bg-white p-6 rounded-lg border border-gray-200">
        <h2 className="text-lg font-semibold mb-4">Quick Actions</h2>
        <div className="grid grid-cols-4 gap-4">
          <button
            onClick={handleAddInvoice}
            className="p-4 bg-blue-50 hover:bg-blue-100 rounded-lg border border-blue-200 text-blue-700 font-semibold transition"
          >
            + Add Invoice
          </button>
          <button
            onClick={handleGenerateGSTR1}
            className="p-4 bg-green-50 hover:bg-green-100 rounded-lg border border-green-200 text-green-700 font-semibold transition"
          >
            Generate GSTR-1
          </button>
          <button
            onClick={handleRecordTDS}
            className="p-4 bg-purple-50 hover:bg-purple-100 rounded-lg border border-purple-200 text-purple-700 font-semibold transition"
          >
            Record TDS Payment
          </button>
          <button
            onClick={handleGenerateForm26Q}
            className="p-4 bg-orange-50 hover:bg-orange-100 rounded-lg border border-orange-200 text-orange-700 font-semibold transition"
          >
            Generate Form 26Q
          </button>
        </div>
      </div>

      {/* Compliance Calendar */}
      <ComplianceCalendar />
    </div>
  );
}
