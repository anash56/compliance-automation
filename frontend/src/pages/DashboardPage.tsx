import { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useLocation, useNavigate } from 'react-router-dom';
import Navbar from '../components/Navbar';
import Dashboard from '../components/Dashboard';
import api from '../services/api';
import { AppDispatch, RootState } from '../store';
import { addCompany, setCompanies, updateCompany, removeCompany } from '../store/slices/companySlice';
import { useToast } from '../components/ToastContext';
export default function DashboardPage() {
const dispatch = useDispatch<AppDispatch>();
const location = useLocation();
const navigate = useNavigate();
const { companies, selectedCompanyId } = useSelector((state: RootState) => state.company);
const selectedCompany = companies.find(company => company.id === selectedCompanyId) || null;
const [loading, setLoading] = useState(false);
const [showCompanyForm, setShowCompanyForm] = useState(false);
const [editingCompany, setEditingCompany] = useState(false);
const [year, setYear] = useState(new Date().getMonth() + 1 >= 4 ? new Date().getFullYear() : new Date().getFullYear() - 1);
const [showTeamModal, setShowTeamModal] = useState(false);
const [teamMembers, setTeamMembers] = useState<any[]>([]);
const [inviteEmail, setInviteEmail] = useState('');
const [inviteRole, setInviteRole] = useState('VIEWER');
const [formData, setFormData] = useState({
companyName: '',
state: '',
gstNumber: '',
pan: ''
});
  const { showToast } = useToast();

useEffect(() => {
fetchCompanies();
}, []);

useEffect(() => {
  if (location.hash === '#edit' && selectedCompany) {
    startEditingCompany();
    setShowTeamModal(false);
  } else if (location.hash === '#new') {
    setFormData({ companyName: '', state: '', gstNumber: '', pan: '' });
    setShowCompanyForm(true);
    setEditingCompany(false);
    setShowTeamModal(false);
  } else if (location.hash === '#team' && selectedCompany) {
    setShowCompanyForm(false);
    setEditingCompany(false);
    setShowTeamModal(true);
    fetchTeamMembers();
  } else {
    setShowCompanyForm(false);
    setEditingCompany(false);
    setShowTeamModal(false);
  }
}, [location.hash, selectedCompany]);

const closeCompanyForm = () => {
  setShowCompanyForm(false);
  setEditingCompany(false);
  if (location.hash === '#edit' || location.hash === '#new') {
    navigate('/dashboard', { replace: true });
  }
};

const closeTeamModal = () => {
  setShowTeamModal(false);
  if (location.hash === '#team') {
    navigate('/dashboard', { replace: true });
  }
};

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

const fetchTeamMembers = async () => {
  if (!selectedCompany) return;
  try {
    const response = await api.get(`/companies/${selectedCompany.id}/members`);
    if (response.data.success) {
      setTeamMembers(response.data.members);
    }
  } catch (error) {
    console.error('Failed to fetch team members:', error);
  }
};

const handleInviteMember = async (e: React.FormEvent) => {
  e.preventDefault();
  if (!selectedCompany) return;
  setLoading(true);
  try {
    const response = await api.post(`/companies/${selectedCompany.id}/members`, {
      email: inviteEmail,
      role: inviteRole
    });
    if (response.data.success) {
      showToast('Team member added successfully.');
      setInviteEmail('');
      fetchTeamMembers();
    }
  } catch (error: any) {
    showToast(error.response?.data?.error || 'Failed to add team member', 'error');
  } finally {
    setLoading(false);
  }
};

const handleRemoveMember = async (userId: string) => {
  if (!selectedCompany) return;
  if (!window.confirm('Are you sure you want to remove this team member?')) return;
  setLoading(true);
  try {
    const response = await api.delete(`/companies/${selectedCompany.id}/members/${userId}`);
    if (response.data.success) {
      fetchTeamMembers();
    }
  } catch (error: any) {
    showToast(error.response?.data?.error || 'Failed to remove team member', 'error');
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
    dispatch(addCompany(response.data.company));
    setFormData({ companyName: '', state: '', gstNumber: '', pan: '' });
    setShowCompanyForm(false);
        if (location.hash === '#new') navigate('/dashboard', { replace: true });
    showToast('Workspace registered successfully!');
  }
} catch (error: any) {
  showToast(error.response?.data?.error || 'Failed to register workspace', 'error');
} finally {
  setLoading(false);
}
};
const handleUpdateCompany = async (e: React.FormEvent) => {
e.preventDefault();
if (!selectedCompany) return;
setLoading(true);
try {
  const response = await api.put(`/companies/${selectedCompany.id}`, {
    companyName: formData.companyName,
    state: formData.state,
    gstNumber: formData.gstNumber,
    pan: formData.pan
  });
  if (response.data.success) {
    dispatch(updateCompany(response.data.company));
    setEditingCompany(false);
    if (location.hash === '#edit' || location.hash === '#new') navigate('/dashboard', { replace: true });
    showToast('Workspace profile updated successfully.');
  }
} catch (error: any) {
  showToast(error.response?.data?.error || 'Failed to update workspace', 'error');
} finally {
  setLoading(false);
}
};

const handleDeleteWorkspace = async () => {
  if (!selectedCompany || selectedCompany.userRole !== 'OWNER') return;
  
  const confirmStr = window.prompt(`To permanently delete this workspace and all its data, type: ${selectedCompany.companyName}`);
  if (confirmStr !== selectedCompany.companyName) return;

  setLoading(true);
  try {
    await api.delete(`/companies/${selectedCompany.id}`);
    dispatch(removeCompany(selectedCompany.id));
    closeCompanyForm();
    showToast('Workspace deleted successfully.');
  } catch (error: any) {
    showToast(error.response?.data?.error || 'Failed to delete workspace', 'error');
  } finally {
    setLoading(false);
  }
};

const startEditingCompany = () => {
if (!selectedCompany) return;
setFormData({
  companyName: selectedCompany.companyName || '',
  state: selectedCompany.state || '',
  gstNumber: selectedCompany.gstNumber || '',
  pan: selectedCompany.pan || ''
});
setEditingCompany(true);
setShowCompanyForm(false);
};

return (
<>
<Navbar />
<div className="min-h-screen bg-gray-50">
<div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Empty State Warning */}
      {companies.length === 0 && (
        <div className="bg-blue-50 border border-blue-200 p-6 rounded-lg mb-8">
          <p className="text-blue-900 mb-4">No workspace registered yet. Add your details to start tracking compliance.</p>
          <button
            onClick={() => setShowCompanyForm(true)}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-semibold transition"
          >
            Register Workspace
          </button>
        </div>
      )}

      {/* Workspace Form Modal */}
      {(showCompanyForm || editingCompany) && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-[100] flex items-center justify-center p-4">
          <form onSubmit={editingCompany ? handleUpdateCompany : handleCreateCompany} className="bg-white p-8 rounded-xl shadow-2xl w-full max-w-lg">
            <h3 className="text-2xl font-bold mb-6 text-gray-900">{editingCompany ? 'Edit Workspace' : 'New Workspace'}</h3>
            
            <div className="grid grid-cols-2 gap-4 mb-6">
              <div className="col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">Company Name</label>
                <input type="text" value={formData.companyName} onChange={(e) => setFormData({ ...formData, companyName: e.target.value })} required className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500" />
              </div>
              <div className="col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">State</label>
                <input type="text" value={formData.state} onChange={(e) => setFormData({ ...formData, state: e.target.value })} required className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">GST Number</label>
                <input type="text" value={formData.gstNumber} onChange={(e) => setFormData({ ...formData, gstNumber: e.target.value.toUpperCase() })} maxLength={15} pattern="^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$" title="Must be a valid 15-character GSTIN" className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">PAN Number</label>
                <input type="text" value={formData.pan} onChange={(e) => setFormData({ ...formData, pan: e.target.value.toUpperCase() })} maxLength={10} pattern="^[A-Z]{5}[0-9]{4}[A-Z]$" title="Must be a valid 10-character PAN" className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500" />
              </div>
            </div>

            <div className={`flex ${editingCompany ? 'justify-between' : 'justify-end'} items-center border-t border-gray-200 pt-6`}>
              {editingCompany && selectedCompany?.userRole === 'OWNER' && (
                <button type="button" onClick={handleDeleteWorkspace} disabled={loading} className="px-4 py-2 text-red-600 hover:bg-red-50 rounded-lg font-semibold transition">
                  Delete Workspace
                </button>
              )}
              <div className="flex gap-3">
                <button type="button" onClick={closeCompanyForm} className="px-5 py-2 text-gray-600 hover:text-gray-900 font-semibold transition">
                  Cancel
                </button>
                <button type="submit" disabled={loading} className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-blue-400 font-semibold transition shadow-md">
                  {loading ? 'Saving...' : editingCompany ? 'Save Changes' : 'Register'}
                </button>
              </div>
            </div>
          </form>
        </div>
      )}

      {/* Team Modal */}
      {showTeamModal && selectedCompany && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-[100] flex items-center justify-center p-4">
          <div className="bg-white p-8 rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-2xl font-bold text-gray-900">Manage Team - {selectedCompany.companyName}</h3>
              <button onClick={closeTeamModal} className="text-gray-500 hover:text-gray-700">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>

            {['OWNER', 'ADMIN'].includes(selectedCompany?.userRole || '') && (
              <form onSubmit={handleInviteMember} className="mb-8 bg-gray-50 p-4 rounded-lg border border-gray-200">
                <h4 className="font-semibold text-gray-800 mb-3">Invite New Member</h4>
                <div className="flex gap-3">
                  <input
                    type="email"
                    placeholder="Employee Email"
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    required
                    className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                  <select
                    value={inviteRole}
                    onChange={(e) => setInviteRole(e.target.value)}
                    className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="ADMIN">Admin</option>
                    <option value="EDITOR">Editor</option>
                    <option value="VIEWER">Viewer</option>
                  </select>
                  <button type="submit" disabled={loading} className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-blue-400 font-semibold transition">
                    {loading ? 'Inviting...' : 'Invite'}
                  </button>
                </div>
                <p className="text-xs text-gray-500 mt-2">The user must have already created an account using this email.</p>
              </form>
            )}

            <div>
              <h4 className="font-semibold text-gray-800 mb-3">Current Members ({teamMembers.length})</h4>
              <div className="space-y-3">
                {teamMembers.map((member) => (
                  <div key={member.id} className="flex items-center justify-between p-4 bg-white border border-gray-200 rounded-lg">
                    <div>
                      <p className="font-semibold text-gray-900">{member.user.fullName}</p>
                      <p className="text-sm text-gray-500">{member.user.email}</p>
                    </div>
                    <div className="flex items-center gap-4">
                      <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                        member.role === 'OWNER' ? 'bg-purple-100 text-purple-800' :
                        member.role === 'ADMIN' ? 'bg-blue-100 text-blue-800' :
                        member.role === 'EDITOR' ? 'bg-green-100 text-green-800' :
                        'bg-gray-100 text-gray-800'
                      }`}>
                        {member.role}
                      </span>
                      {member.role !== 'OWNER' && (
                        <button
                          onClick={() => handleRemoveMember(member.user.id)}
                          className="text-red-500 hover:text-red-700 text-sm font-semibold transition"
                        >
                          Remove
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

{/* Dashboard Component */}
<div className="mb-8 max-w-sm">
    <label className="block text-sm font-semibold text-gray-700 mb-2">Financial Year</label>
    <select
      value={year}
      onChange={(e) => setYear(parseInt(e.target.value))}
      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
    >
      {Array.from({ length: new Date().getFullYear() - 1990 + 1 }, (_, i) => new Date().getFullYear() - i).map(optionYear => (
        <option key={optionYear} value={optionYear}>{optionYear}-{String(optionYear + 1).slice(-2)}</option>
      ))}
    </select>
</div>
<Dashboard company={selectedCompany} year={year} />
    </div>
  </div>
</>
);
}
