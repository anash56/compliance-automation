import { useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { login, signup } from '../store/slices/authSlice';
import { AppDispatch, RootState } from '../store';
export default function Login() {
const [email, setEmail] = useState('');
const [password, setPassword] = useState('');
const [fullName, setFullName] = useState('');
const [isSignup, setIsSignup] = useState(false);
const [localError, setLocalError] = useState('');
const dispatch = useDispatch<AppDispatch>();
const navigate = useNavigate();
const { loading, error } = useSelector((state: RootState) => state.auth);
const handleSubmit = async (e: React.FormEvent) => {
e.preventDefault();
setLocalError('');
if (!email || !password || (isSignup && !fullName)) {
  setLocalError('Please fill all fields');
  return;
}

try {
  if (isSignup) {
    await dispatch(signup({ email, password, fullName })).unwrap();
  } else {
    await dispatch(login({ email, password })).unwrap();
  }
  navigate('/dashboard');
} catch (err: any) {
  setLocalError(err || 'Authentication failed');
}
};
const displayError = localError || error;
return (
<div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-blue-100">
<div className="w-full max-w-md">
<div className="bg-white rounded-lg shadow-lg p-8 border border-gray-200">
{/* Header */}
<div className="text-center mb-8">
<h1 className="text-3xl font-bold text-blue-600 mb-2">ComplianceBot</h1>
<p className="text-gray-600">{isSignup ? 'Create Account' : 'Welcome Back'}</p>
</div>
      {/* Error Message */}
      {displayError && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">
          {displayError}
        </div>
      )}

      {/* Form */}
      <form onSubmit={handleSubmit} className="space-y-4">
        {isSignup && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Full Name
            </label>
            <input
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="John Doe"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
        )}

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Email Address
          </label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@company.com"
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Password
          </label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full px-4 py-2 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 disabled:bg-gray-400 transition duration-200"
        >
          {loading ? 'Loading...' : isSignup ? 'Create Account' : 'Login'}
        </button>
      </form>

      {/* Toggle */}
      <p className="text-center text-gray-600 text-sm mt-6">
        {isSignup ? 'Already have an account? ' : "Don't have an account? "}
        <button
          onClick={() => {
            setIsSignup(!isSignup);
            setLocalError('');
          }}
          className="text-blue-600 font-semibold hover:underline"
        >
          {isSignup ? 'Login' : 'Sign Up'}
        </button>
      </p>

      {/* Demo Credentials */}
      <div className="mt-6 p-4 bg-gray-50 rounded-lg border border-gray-200">
        <p className="text-xs text-gray-600 mb-2">Demo Credentials:</p>
        <p className="text-xs text-gray-600">Email: demo@example.com</p>
        <p className="text-xs text-gray-600">Password: demo123</p>
      </div>
    </div>
  </div>
</div>
);
}