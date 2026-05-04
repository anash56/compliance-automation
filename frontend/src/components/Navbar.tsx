import { useDispatch, useSelector } from 'react-redux';
import { useNavigate, Link } from 'react-router-dom';
import { logout } from '../store/slices/authSlice';
import { RootState, AppDispatch } from '../store';
import { setSelectedCompanyId } from '../store/slices/companySlice';

export default function Navbar() {
const dispatch = useDispatch<AppDispatch>();
const navigate = useNavigate();
const { user } = useSelector((state: RootState) => state.auth);
const { companies, selectedCompanyId } = useSelector((state: RootState) => state.company);
const selectedCompany = companies.find(company => company.id === selectedCompanyId);
const handleLogout = async () => {
await dispatch(logout());
navigate('/login');
};
return (
<nav className="bg-white shadow-md border-b border-gray-200">
<div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
<div className="flex justify-between items-center h-16">
{/* Logo */}
<Link to="/dashboard" className="flex items-center">
<div className="text-2xl font-bold text-blue-600">
ComplianceBot
</div>
</Link>
      {/* Navigation Links */}
      <div className="flex items-center gap-8">
        <Link
          to="/dashboard"
          className="text-gray-700 hover:text-blue-600 font-medium transition"
        >
          Dashboard
        </Link>
        <Link
          to="/gst"
          className="text-gray-700 hover:text-blue-600 font-medium transition"
        >
          GST
        </Link>
        <Link
          to="/tds"
          className="text-gray-700 hover:text-blue-600 font-medium transition"
        >
          TDS
        </Link>
        <Link
          to="/reports"
          className="text-gray-700 hover:text-blue-600 font-medium transition"
        >
          Reports
        </Link>

        {/* User Section */}
        <div className="flex items-center gap-4 pl-8 border-l border-gray-200">
          {companies.length > 0 && (
            <div className="flex items-center gap-2 pr-2">
              <span className="text-sm text-gray-500">Workspace:</span>
              <select
                value={selectedCompanyId || ''}
                onChange={(e) => dispatch(setSelectedCompanyId(e.target.value))}
                className="text-sm font-semibold text-gray-900 bg-gray-50 border border-gray-300 rounded-md py-1 px-2 focus:outline-none focus:ring-2 focus:ring-blue-500 max-w-[200px] truncate"
              >
                {companies.map((c: any) => (
                  <option key={c.id} value={c.id}>{c.companyName}</option>
                ))}
              </select>
              {['OWNER', 'ADMIN'].includes(selectedCompany?.userRole || '') && (
                <Link to="/dashboard#edit" className="p-1 text-gray-400 hover:text-blue-600 transition" title="Edit Workspace Settings">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                    <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
                  </svg>
                </Link>
              )}
              <Link to="/dashboard#new" className="p-1 text-gray-400 hover:text-green-600 transition" title="Add New Workspace">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 5a1 1 0 011 1v3h3a1 1 0 110 2h-3v3a1 1 0 11-2 0v-3H6a1 1 0 110-2h3V6a1 1 0 011-1z" clipRule="evenodd" />
                </svg>
              </Link>
              {['OWNER', 'ADMIN'].includes(selectedCompany?.userRole || '') && (
                <Link to="/dashboard#team" className="p-1 text-gray-400 hover:text-indigo-600 transition" title="Manage Team">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                    <path d="M9 6a3 3 0 11-6 0 3 3 0 016 0zM17 6a3 3 0 11-6 0 3 3 0 016 0zM12.93 17c.046-.327.07-.66.07-1a6.97 6.97 0 00-1.5-4.33A5 5 0 0119 16v1h-6.07zM6 11a5 5 0 015 5v1H1v-1a5 5 0 015-5z" />
                  </svg>
                </Link>
              )}
            </div>
          )}
          <div className="text-right">
            <p className="text-sm font-semibold text-gray-900">{user?.fullName}</p>
            <p className="text-xs text-gray-500">{user?.email}</p>
          </div>
          <button
            onClick={handleLogout}
            className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 font-semibold text-sm transition"
          >
            Logout
          </button>
        </div>
      </div>
    </div>
  </div>
</nav>
);
}
