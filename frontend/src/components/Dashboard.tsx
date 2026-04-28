import { useEffect } from 'react';
import { useSelector } from 'react-redux';
import { RootState } from '../store';
export default function Dashboard() {
const user = useSelector((state: RootState) => state.auth.user);
useEffect(() => {
  // Fetch dashboard stats
}, []);
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
      <p className="text-3xl font-bold text-blue-600 mt-2">0</p>
      <p className="text-xs text-gray-500 mt-2">This year</p>
    </div>

    <div className="bg-white p-6 rounded-lg border border-gray-200 hover:shadow-lg transition">
      <p className="text-sm text-gray-600 font-medium">TDS Filed</p>
      <p className="text-3xl font-bold text-green-600 mt-2">0</p>
      <p className="text-xs text-gray-500 mt-2">This year</p>
    </div>

    <div className="bg-white p-6 rounded-lg border border-gray-200 hover:shadow-lg transition">
      <p className="text-sm text-gray-600 font-medium">Total Tax Payable</p>
      <p className="text-3xl font-bold text-orange-600 mt-2">₹0</p>
      <p className="text-xs text-gray-500 mt-2">Current month</p>
    </div>

    <div className="bg-white p-6 rounded-lg border border-gray-200 hover:shadow-lg transition">
      <p className="text-sm text-gray-600 font-medium">Days to Filing</p>
      <p className="text-3xl font-bold text-red-600 mt-2">7</p>
      <p className="text-xs text-gray-500 mt-2">GST due</p>
    </div>
  </div>

  {/* Quick Actions */}
  <div className="bg-white p-6 rounded-lg border border-gray-200">
    <h2 className="text-lg font-semibold mb-4">Quick Actions</h2>
    <div className="grid grid-cols-4 gap-4">
      <button className="p-4 bg-blue-50 hover:bg-blue-100 rounded-lg border border-blue-200 text-blue-700 font-semibold transition">
        + Add Invoice
      </button>
      <button className="p-4 bg-green-50 hover:bg-green-100 rounded-lg border border-green-200 text-green-700 font-semibold transition">
        Generate GSTR-1
      </button>
      <button className="p-4 bg-purple-50 hover:bg-purple-100 rounded-lg border border-purple-200 text-purple-700 font-semibold transition">
        Record TDS Payment
      </button>
      <button className="p-4 bg-orange-50 hover:bg-orange-100 rounded-lg border border-orange-200 text-orange-700 font-semibold transition">
        Generate Form 26Q
      </button>
    </div>
  </div>
</div>
);
}
