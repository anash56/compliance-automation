import { useState, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate, useLocation } from 'react-router-dom';
import { login, signup, clearError } from '../store/slices/authSlice';
import { AppDispatch, RootState } from '../store';

// Password strength checker
const getPasswordStrength = (password: string) => {
  if (!password) return { strength: 0, text: '', color: '' };
  
  let strength = 0;
  if (password.length >= 8) strength++;
  if (/[a-z]/.test(password)) strength++;
  if (/[A-Z]/.test(password)) strength++;
  if (/\d/.test(password)) strength++;
  if (/[@$!%*?&]/.test(password)) strength++;

  const levels = [
    { strength: 0, text: '', color: '' },
    { strength: 1, text: 'Weak', color: 'text-red-600' },
    { strength: 2, text: 'Fair', color: 'text-orange-600' },
    { strength: 3, text: 'Good', color: 'text-yellow-600' },
    { strength: 4, text: 'Strong', color: 'text-green-600' },
    { strength: 5, text: 'Very Strong', color: 'text-green-700' }
  ];

  return levels[Math.min(strength, 5)];
};

// Validation helpers
const validateEmail = (email: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
const validateFullName = (fullName: string) => /^[a-zA-Z\s]{4,30}$/.test(fullName.trim());
const validatePassword = (password: string) => /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)[a-zA-Z\d@$!%*?&]{8,}$/.test(password);

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [localError, setLocalError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});
  
  const dispatch = useDispatch<AppDispatch>();
  const navigate = useNavigate();
  const location = useLocation();
  const { loading, error } = useSelector((state: RootState) => state.auth);

  const isSignup = location.pathname === '/signup';

  useEffect(() => {
    setLocalError('');
    setSuccessMessage('');
    setValidationErrors({});
    dispatch(clearError());
  }, [location.pathname, dispatch]);

  // Real-time validation for signup
  useEffect(() => {
    if (!isSignup) return;

    const errors: Record<string, string> = {};
    
    if (fullName && !validateFullName(fullName)) {
      errors.fullName = 'Full name must be 4-30 characters with only letters and spaces';
    }
    
    if (email && !validateEmail(email)) {
      errors.email = 'Invalid email format';
    }
    
    if (password && !validatePassword(password)) {
      errors.password = 'Min 8 chars: uppercase, lowercase, number';
    }
    
    if (password && confirmPassword && password !== confirmPassword) {
      errors.confirmPassword = 'Passwords do not match';
    }

    setValidationErrors(errors);
  }, [email, password, confirmPassword, fullName, isSignup]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    dispatch(clearError());
    setLocalError('');
    setSuccessMessage('');

    if (isSignup) {
      // Signup validation
      if (!email || !password || !fullName || !confirmPassword) {
        setLocalError('Please fill all fields');
        return;
      }

      if (!validateFullName(fullName)) {
        setLocalError('Full name must be 4-30 characters with only letters and spaces');
        return;
      }

      if (!validateEmail(email)) {
        setLocalError('Invalid email format');
        return;
      }

      if (!validatePassword(password)) {
        setLocalError('Password must be at least 8 characters with uppercase, lowercase, and number');
        return;
      }

      if (password !== confirmPassword) {
        setLocalError('Passwords do not match');
        return;
      }

      try {
        await dispatch(signup({ email, password, fullName })).unwrap();
        setSuccessMessage('Account created successfully! Redirecting to dashboard...');
        const token = localStorage.getItem('token');
        if (token) {
          setTimeout(() => navigate('/dashboard'), 1500);
        } else {
          setTimeout(() => navigate('/login'), 1500);
        }
      } catch (err: any) {
        setLocalError(err || 'Signup failed');
      }
    } else {
      // Login validation
      if (!email || !password) {
        setLocalError('Please fill all fields');
        return;
      }

      try {
        await dispatch(login({ email, password })).unwrap();
        setSuccessMessage('Login successful! Redirecting...');
        setTimeout(() => navigate('/dashboard'), 1000);
      } catch (err: any) {
        setLocalError(err || 'Authentication failed');
      }
    }
  };

  const displayError = localError || error;
  const passwordStrength = getPasswordStrength(password);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-blue-100 p-4">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-lg shadow-lg p-8 border border-gray-200">
          {/* Header */}
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-blue-600 mb-2">ComplianceBot</h1>
            <p className="text-gray-600">{isSignup ? 'Create Account' : 'Welcome Back'}</p>
          </div>

          {/* Success Message */}
          {successMessage && (
            <div className="mb-6 p-4 bg-green-50 border border-green-200 text-green-700 rounded-lg text-sm">
              {successMessage}
            </div>
          )}

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
                  className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                    validationErrors.fullName ? 'border-red-300' : 'border-gray-300'
                  }`}
                />
                {validationErrors.fullName && (
                  <p className="text-red-600 text-xs mt-1">{validationErrors.fullName}</p>
                )}
                {fullName && !validationErrors.fullName && (
                  <p className="text-green-600 text-xs mt-1">✓ Valid</p>
                )}
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
                className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                  validationErrors.email ? 'border-red-300' : 'border-gray-300'
                }`}
              />
              {validationErrors.email && (
                <p className="text-red-600 text-xs mt-1">{validationErrors.email}</p>
              )}
              {email && !validationErrors.email && (
                <p className="text-green-600 text-xs mt-1">✓ Valid</p>
              )}
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
                className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                  validationErrors.password ? 'border-red-300' : 'border-gray-300'
                }`}
              />
              
              {isSignup && password && (
                <div className="mt-2 space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-gray-600">Strength:</span>
                    <span className={`text-xs font-semibold ${passwordStrength.color}`}>
                      {passwordStrength.text}
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className={`h-2 rounded-full transition-all ${
                        passwordStrength.strength === 1
                          ? 'w-1/5 bg-red-600'
                          : passwordStrength.strength === 2
                          ? 'w-2/5 bg-orange-600'
                          : passwordStrength.strength === 3
                          ? 'w-3/5 bg-yellow-600'
                          : passwordStrength.strength === 4
                          ? 'w-4/5 bg-green-600'
                          : passwordStrength.strength === 5
                          ? 'w-full bg-green-700'
                          : 'w-0'
                      }`}
                    ></div>
                  </div>
                  <div className="text-xs text-gray-600 mt-2">
                    <p className={`${password.length >= 8 ? 'text-green-600' : 'text-gray-600'}`}>
                      ✓ At least 8 characters
                    </p>
                    <p className={`${/[a-z]/.test(password) ? 'text-green-600' : 'text-gray-600'}`}>
                      ✓ Lowercase letter
                    </p>
                    <p className={`${/[A-Z]/.test(password) ? 'text-green-600' : 'text-gray-600'}`}>
                      ✓ Uppercase letter
                    </p>
                    <p className={`${/\d/.test(password) ? 'text-green-600' : 'text-gray-600'}`}>
                      ✓ Number
                    </p>
                  </div>
                </div>
              )}
              
              {validationErrors.password && !isSignup && (
                <p className="text-red-600 text-xs mt-1">{validationErrors.password}</p>
              )}
            </div>

            {isSignup && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Confirm Password
                </label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="••••••••"
                  className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                    validationErrors.confirmPassword ? 'border-red-300' : 'border-gray-300'
                  }`}
                />
                {validationErrors.confirmPassword && (
                  <p className="text-red-600 text-xs mt-1">{validationErrors.confirmPassword}</p>
                )}
                {confirmPassword && password && confirmPassword === password && !validationErrors.confirmPassword && (
                  <p className="text-green-600 text-xs mt-1">✓ Passwords match</p>
                )}
              </div>
            )}

            <button
              type="submit"
              disabled={loading || (isSignup && Object.keys(validationErrors).length > 0)}
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
                if (isSignup) {
                  navigate('/login');
                } else {
                  navigate('/signup');
                }
                setLocalError('');
                setValidationErrors({});
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
            <p className="text-xs text-gray-600">Password: Demo123</p>
          </div>
        </div>
      </div>
    </div>
  );
}