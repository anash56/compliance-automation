import { useNavigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { RootState } from '../store';
export default function HomePage() {
const navigate = useNavigate();
const { token } = useSelector((state: RootState) => state.auth);
if (token) {
navigate('/dashboard');
return null;
}
return (
<div className="min-h-screen bg-gradient-to-br from-blue-600 via-blue-700 to-blue-900 flex items-center justify-center">
<div className="text-center text-white max-w-2xl px-4">
<h1 className="text-6xl font-bold mb-4">ComplianceBot</h1>
<p className="text-2xl mb-4 font-light">GST & TDS Compliance Automation</p>
<p className="text-lg mb-12 opacity-90">
Automate your GST & TDS compliance, save time, and ensure accuracy for your SME
</p>
    <div className="space-y-4">
      <button
        onClick={() => navigate('/signup')}
        className="px-8 py-4 bg-white text-blue-600 rounded-lg font-bold hover:bg-gray-100 text-lg transition duration-200 shadow-lg"
      >
        Get Started Free
      </button>
      <p className="text-sm opacity-75">No credit card required • Free for 30 days</p>
    </div>

    <div className="mt-16 grid grid-cols-3 gap-8">
      <div>
        <p className="text-4xl mb-2">📄</p>
        <p className="font-semibold">Auto GST</p>
        <p className="text-sm opacity-75">GSTR-1 & GSTR-3B</p>
      </div>
      <div>
        <p className="text-4xl mb-2">💳</p>
        <p className="font-semibold">TDS Tracking</p>
        <p className="text-sm opacity-75">Form 26Q</p>
      </div>
      <div>
        <p className="text-4xl mb-2">📅</p>
        <p className="font-semibold">Compliance</p>
        <p className="text-sm opacity-75">Smart Calendar</p>
      </div>
    </div>
  </div>
</div>
);
}