import React, { useState, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate, Link } from 'react-router-dom';
import { logout, fetchCurrentUser } from '../store/slices/authSlice';
import { RootState, AppDispatch } from '../store';
import { setSelectedCompanyId } from '../store/slices/companySlice';
import api from '../services/api';

export default function Navbar() {
const dispatch = useDispatch<AppDispatch>();
const navigate = useNavigate();
const { user } = useSelector((state: RootState) => state.auth);
const { companies, selectedCompanyId } = useSelector((state: RootState) => state.company);
const selectedCompany = companies.find(company => company.id === selectedCompanyId) as any;

const [showSettings, setShowSettings] = useState(false);
const [formData, setFormData] = useState({ fullName: '', currentPassword: '', newPassword: '' });
const [loading, setLoading] = useState(false);
const [error, setError] = useState('');
const [success, setSuccess] = useState('');
const [setup2FA, setSetup2FA] = useState(false);
const [qrCodeUrl, setQrCodeUrl] = useState('');
const [twoFactorCode, setTwoFactorCode] = useState('');
const [backupCodes, setBackupCodes] = useState<string[]>([]);

useEffect(() => {
  if (user) setFormData(prev => ({ ...prev, fullName: user.fullName }));
}, [user]);

const handleUpdateProfile = async (e: React.FormEvent) => {
  e.preventDefault();
  setLoading(true); setError(''); setSuccess('');
  try {
    const res = await api.put('/auth/profile', formData);
    if (res.data.success) {
      setSuccess('Profile updated successfully!');
      dispatch(fetchCurrentUser());
      setTimeout(() => { setShowSettings(false); setFormData({ ...formData, currentPassword: '', newPassword: '' }); setSuccess(''); }, 2000);
    }
  } catch (err: any) { setError(err.response?.data?.error || 'Failed to update profile'); }
  finally { setLoading(false); }
};

const handleSetup2FA = async () => {
  setLoading(true); setError(''); setSuccess('');
  try {
    const res = await api.post('/auth/2fa/setup');
    setQrCodeUrl(res.data.qrCodeUrl);
    setSetup2FA(true);
  } catch (err: any) { setError(err.response?.data?.error || 'Failed to setup 2FA'); }
  finally { setLoading(false); }
};

const handleEnable2FA = async () => {
  setLoading(true); setError(''); setSuccess('');
  try {
    const res = await api.post('/auth/2fa/enable', { code: twoFactorCode });
    setSuccess(res.data.message);
    setBackupCodes(res.data.backupCodes);
    setSetup2FA(false); setTwoFactorCode('');
    dispatch(fetchCurrentUser());
  } catch (err: any) { setError(err.response?.data?.error || 'Invalid code'); }
  finally { setLoading(false); }
};

const handleDisable2FA = async () => {
  if (!twoFactorCode) return setError('Please enter a 2FA code to disable');
  setLoading(true); setError(''); setSuccess('');
  try {
    const res = await api.post('/auth/2fa/disable', { code: twoFactorCode });
    setSuccess(res.data.message);
    setTwoFactorCode('');
    dispatch(fetchCurrentUser());
  } catch (err: any) { setError(err.response?.data?.error || 'Invalid code'); }
  finally { setLoading(false); }
};

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
            onClick={() => setShowSettings(true)}
            className="p-2 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-full transition"
            title="Account Settings"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"></path><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path></svg>
          </button>
          <button
            onClick={handleLogout}
            className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 font-semibold text-sm transition"
          >
            Logout
          </button>
        </div>
      </div>
    </div>

    {/* Settings Modal */}
    {showSettings && (
      <div className="fixed inset-0 bg-black bg-opacity-50 z-[200] flex items-center justify-center p-4">
        <div className="bg-white p-8 rounded-xl shadow-2xl w-full max-w-md">
          <h3 className="text-2xl font-bold mb-6 text-gray-900">Account Settings</h3>
          {error && <div className="mb-4 p-3 bg-red-50 text-red-700 rounded-lg text-sm">{error}</div>}
          {success && <div className="mb-4 p-3 bg-green-50 text-green-700 rounded-lg text-sm">{success}</div>}
          
          <form onSubmit={handleUpdateProfile} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Full Name</label>
              <input type="text" value={formData.fullName} onChange={(e) => setFormData({...formData, fullName: e.target.value})} required className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500" />
            </div>
            <div className="pt-4 border-t border-gray-200">
              <h4 className="text-sm font-bold text-gray-800 mb-3">Change Password (Optional)</h4>
              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Current Password</label>
                  <input type="password" value={formData.currentPassword} onChange={(e) => setFormData({...formData, currentPassword: e.target.value})} placeholder="••••••••" className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">New Password</label>
                  <input type="password" value={formData.newPassword} onChange={(e) => setFormData({...formData, newPassword: e.target.value})} placeholder="••••••••" className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500" />
                </div>
              </div>
            </div>
            
            <div className="pt-4 border-t border-gray-200">
              <h4 className="text-sm font-bold text-gray-800 mb-3">Two-Factor Authentication (2FA)</h4>
              {backupCodes.length > 0 ? (
                <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                  <h5 className="font-bold text-yellow-800 mb-2">Save Your Backup Codes</h5>
                  <p className="text-sm text-yellow-700 mb-4">If you lose access to your authenticator app, you can use these one-time codes to log in. Please save them somewhere safe!</p>
                  <div className="grid grid-cols-2 gap-2 mb-4">
                    {backupCodes.map((code, i) => (
                      <code key={i} className="bg-white p-2 text-center rounded border border-yellow-300 font-mono text-sm tracking-widest">{code}</code>
                    ))}
                  </div>
                  <button type="button" onClick={() => setBackupCodes([])} className="w-full px-4 py-2 bg-yellow-600 text-white rounded font-semibold text-sm hover:bg-yellow-700 transition">
                    I have saved these safely
                  </button>
                </div>
              ) : (user as any)?.isTwoFactorEnabled ? (
                <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                  <p className="text-sm text-green-800 font-semibold mb-3">✅ 2FA is currently enabled</p>
                  <div className="flex gap-2">
                    <input type="text" value={twoFactorCode} onChange={(e) => setTwoFactorCode(e.target.value)} placeholder="000000" maxLength={6} className="w-1/2 px-3 py-1 border border-gray-300 rounded text-center tracking-widest focus:ring-2 focus:ring-red-500" />
                    <button type="button" onClick={handleDisable2FA} disabled={loading} className="w-1/2 px-3 py-1 bg-red-600 text-white font-semibold rounded hover:bg-red-700 disabled:opacity-50">Disable 2FA</button>
                  </div>
                </div>
              ) : setup2FA ? (
                <div className="p-4 border border-blue-200 rounded-lg bg-blue-50 text-center">
                  <p className="text-sm text-gray-700 mb-2">1. Scan this QR code using Google Authenticator or Authy.</p>
                  {qrCodeUrl && <img src={qrCodeUrl} alt="2FA QR Code" className="mx-auto w-32 h-32 mb-2 bg-white p-1 rounded border border-gray-300" />}
                  <p className="text-sm text-gray-700 mb-2 mt-4">2. Enter the 6-digit code to confirm.</p>
                  <div className="flex gap-2 justify-center">
                    <input type="text" value={twoFactorCode} onChange={(e) => setTwoFactorCode(e.target.value)} placeholder="000000" maxLength={6} className="w-32 px-3 py-2 border border-gray-300 rounded text-center tracking-widest text-lg focus:ring-2 focus:ring-blue-500" />
                  </div>
                  <div className="flex gap-2 mt-4 justify-center">
                    <button type="button" onClick={() => { setSetup2FA(false); setTwoFactorCode(''); }} className="px-3 py-1 bg-gray-400 text-white rounded font-semibold text-sm hover:bg-gray-500">Cancel</button>
                    <button type="button" onClick={handleEnable2FA} disabled={loading || twoFactorCode.length !== 6} className="px-4 py-1 bg-blue-600 text-white rounded font-semibold text-sm hover:bg-blue-700 disabled:opacity-50">Verify & Enable</button>
                  </div>
                </div>
              ) : (
                <div>
                  <p className="text-xs text-gray-500 mb-2">Protect your account from unauthorized access by requiring a second authentication method.</p>
                  <button type="button" onClick={handleSetup2FA} disabled={loading} className="px-4 py-2 bg-gray-900 text-white rounded font-semibold text-sm hover:bg-black transition">
                    Set up 2FA
                  </button>
                </div>
              )}
            </div>

            <div className="flex gap-3 justify-end pt-4 mt-4 border-t border-gray-200">
              <button type="button" onClick={() => setShowSettings(false)} className="px-5 py-2 text-gray-600 hover:text-gray-900 font-semibold transition">
                Cancel
              </button>
              <button type="submit" disabled={loading} className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-blue-400 font-semibold transition shadow-md">
                {loading ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </form>
        </div>
      </div>
    )}
  </div>
</nav>
);
}
