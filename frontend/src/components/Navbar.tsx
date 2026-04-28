import { useDispatch, useSelector } from 'react-redux';
import { useNavigate, Link } from 'react-router-dom';
import { logout } from '../store/slices/authSlice';
import { RootState, AppDispatch } from '../store';
export default function Navbar() {
const dispatch = useDispatch<AppDispatch>();
const navigate = useNavigate();
const { user } = useSelector((state: RootState) => state.auth);
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

        {/* User Section */}
        <div className="flex items-center gap-4 pl-8 border-l border-gray-200">
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