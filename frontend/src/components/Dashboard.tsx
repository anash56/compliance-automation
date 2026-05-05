import { useEffect, useState } from 'react';
import { useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { RootState } from '../store';
import api from '../services/api';
import ComplianceCalendar from './ComplianceCalendar';
import { Company } from '../types';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

interface DashboardProps {
  company: Company | null;
  year: number;
}

export default function Dashboard({ company, year }: DashboardProps) {
  const user = useSelector((state: RootState) => state.auth.user);
  const navigate = useNavigate();
  const [stats, setStats] = useState({
    gstInvoiceCount: 0,
    tdsRecordCount: 0,
    gstReturnsFiled: 0,
    tdsReturnsFiled: 0,
    totalInvoiceValue: 0,
    totalGstCollected: 0,
    totalVendorPayments: 0,
    totalTdsDeducted: 0,
    totalTdsDeposited: 0,
    estimatedComplianceOutflow: 0,
    upcomingDeadlines: [] as any[],
    monthlyData: [] as any[],
    auditLogs: [] as any[]
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (company) {
      fetchDashboardStats();
    } else {
      setLoading(false);
    }
  }, [company?.id, year]);

  const fetchDashboardStats = async () => {
    if (!company) return;

    setLoading(true);
    try {
      const response = await api.get(`/companies/${company.id}/dashboard`, {
        params: { year }
      });
      if (response.data.success) {
        setStats(response.data.stats);
      }
    } catch (error) {
      console.error('Failed to fetch dashboard stats:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateTaskStatus = async (taskId: string, newStatus: string) => {
    try {
      await api.put(`/companies/${company?.id}/tasks/${taskId}/status`, { status: newStatus });
      fetchDashboardStats();
    } catch (error) {
      console.error('Failed to update task status:', error);
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
        <h1 className="text-3xl font-bold text-gray-900">Welcome, {user?.fullName}!</h1>
        <p className="text-gray-600 mt-2">
          {company ? `${company.companyName} compliance dashboard for FY ${year}-${String(year + 1).slice(-2)}` : 'Create a company to start tracking compliance'}
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-4 gap-4">
        <div className="bg-white p-6 rounded-lg border border-gray-200 hover:shadow-lg transition">
          <p className="text-sm text-gray-600 font-medium">GST Invoices</p>
          <p className="text-3xl font-bold text-blue-600 mt-2">{loading ? '-' : stats.gstInvoiceCount}</p>
          <p className="text-xs text-gray-500 mt-2">{loading ? 'Financial year' : `${stats.gstReturnsFiled} GST returns filed`}</p>
        </div>

        <div className="bg-white p-6 rounded-lg border border-gray-200 hover:shadow-lg transition">
          <p className="text-sm text-gray-600 font-medium">TDS Records</p>
          <p className="text-3xl font-bold text-green-600 mt-2">{loading ? '-' : stats.tdsRecordCount}</p>
          <p className="text-xs text-gray-500 mt-2">{loading ? 'Financial year' : `${stats.tdsReturnsFiled} TDS returns filed`}</p>
        </div>

        <div className="bg-white p-6 rounded-lg border border-gray-200 hover:shadow-lg transition">
          <p className="text-sm text-gray-600 font-medium">GST Collected</p>
          <p className="text-3xl font-bold text-orange-600 mt-2">INR {loading ? '-' : stats.totalGstCollected.toLocaleString()}</p>
          <p className="text-xs text-gray-500 mt-2">Financial year</p>
        </div>

        <div className="bg-white p-6 rounded-lg border border-gray-200 hover:shadow-lg transition">
          <p className="text-sm text-gray-600 font-medium">Compliance Outflow</p>
          <p className="text-3xl font-bold text-red-600 mt-2">INR {loading ? '-' : stats.estimatedComplianceOutflow.toLocaleString()}</p>
          <p className="text-xs text-gray-500 mt-2">GST plus deposited TDS</p>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white p-6 rounded-lg border border-gray-200">
          <p className="text-sm text-gray-600 font-medium">Invoice Value</p>
          <p className="text-2xl font-bold text-gray-900 mt-2">INR {loading ? '-' : stats.totalInvoiceValue.toLocaleString()}</p>
        </div>
        <div className="bg-white p-6 rounded-lg border border-gray-200">
          <p className="text-sm text-gray-600 font-medium">Vendor Payments</p>
          <p className="text-2xl font-bold text-gray-900 mt-2">INR {loading ? '-' : stats.totalVendorPayments.toLocaleString()}</p>
        </div>
        <div className="bg-white p-6 rounded-lg border border-gray-200">
          <p className="text-sm text-gray-600 font-medium">TDS Deducted</p>
          <p className="text-2xl font-bold text-gray-900 mt-2">INR {loading ? '-' : stats.totalTdsDeducted.toLocaleString()}</p>
        </div>
      </div>

      {/* Financial Overview Chart */}
      <div className="bg-white p-6 rounded-lg border border-gray-200">
        <h2 className="text-lg font-semibold mb-6">Financial Overview</h2>
        <div className="h-80">
          {loading ? (
            <div className="w-full h-full flex items-center justify-center text-gray-400">Loading chart...</div>
          ) : stats.monthlyData && stats.monthlyData.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={stats.monthlyData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#6B7280' }} dy={10} />
                <YAxis width={80} axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#6B7280' }} tickFormatter={(value) => `₹${value.toLocaleString()}`} />
                <Tooltip cursor={{ fill: '#F3F4F6' }} contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' }} formatter={(value: number) => [`₹${value.toLocaleString()}`, undefined]} />
                <Legend iconType="circle" wrapperStyle={{ paddingTop: '20px', fontSize: '14px' }} />
                <Bar dataKey="revenue" name="Revenue" fill="#3B82F6" radius={[4, 4, 0, 0]} maxBarSize={40} />
                <Bar dataKey="tax" name="GST Collected" fill="#F59E0B" radius={[4, 4, 0, 0]} maxBarSize={40} />
                <Bar dataKey="tds" name="TDS Deducted" fill="#EF4444" radius={[4, 4, 0, 0]} maxBarSize={40} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="w-full h-full flex items-center justify-center text-gray-400">No data available for this financial year</div>
          )}
        </div>
      </div>

      {/* Quick Actions */}
      <div className="bg-white p-6 rounded-lg border border-gray-200">
        <h2 className="text-lg font-semibold mb-4">Quick Actions</h2>
        <div className="grid grid-cols-4 gap-4">
          {['OWNER', 'ADMIN', 'EDITOR'].includes(company?.userRole || '') && (
            <>
              <button
                onClick={handleAddInvoice}
                disabled={!company}
                className="p-4 bg-blue-50 hover:bg-blue-100 rounded-lg border border-blue-200 text-blue-700 font-semibold transition"
              >
                + Add Invoice
              </button>
              <button
                onClick={handleGenerateGSTR1}
                disabled={!company}
                className="p-4 bg-green-50 hover:bg-green-100 rounded-lg border border-green-200 text-green-700 font-semibold transition"
              >
                Generate GSTR-1
              </button>
              <button
                onClick={handleRecordTDS}
                disabled={!company}
                className="p-4 bg-purple-50 hover:bg-purple-100 rounded-lg border border-purple-200 text-purple-700 font-semibold transition"
              >
                Record TDS Payment
              </button>
              <button
                onClick={handleGenerateForm26Q}
                disabled={!company}
                className="p-4 bg-orange-50 hover:bg-orange-100 rounded-lg border border-orange-200 text-orange-700 font-semibold transition"
              >
                Generate Form 26Q
              </button>
            </>
          )}
          {company?.userRole === 'VIEWER' && (
            <p className="col-span-4 text-sm text-gray-500 italic p-4 bg-gray-50 rounded-lg border border-gray-200">
              You have viewer access to this workspace. Editing and data generation actions are restricted.
            </p>
          )}
        </div>
      </div>

      {/* Compliance Calendar */}
      {!loading && company && (
        <ComplianceCalendar customDeadlines={stats.upcomingDeadlines} onUpdateStatus={handleUpdateTaskStatus} />
      )}
    </div>
  );
}
