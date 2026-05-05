import { useState, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate, useLocation } from 'react-router-dom';
import { login, signup, clearError, verify2FA, socialLogin } from '../store/slices/authSlice';
import { AppDispatch, RootState } from '../store';
import api from '../services/api';

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
  const [rememberMe, setRememberMe] = useState(false);
  const [localError, setLocalError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});
  const [isForgotPassword, setIsForgotPassword] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [twoFactorCode, setTwoFactorCode] = useState('');
  
  const dispatch = useDispatch<AppDispatch>();
  const navigate = useNavigate();
  const location = useLocation();
  const { loading, error, require2FA, tempToken } = useSelector((state: RootState) => state.auth);

  const isSignup = location.pathname === '/signup';
  const urlParams = new URLSearchParams(location.search);
  const resetToken = urlParams.get('reset');
  const verifyToken = urlParams.get('verify');
  const oauthCode = urlParams.get('code');
  const oauthState = urlParams.get('state');

  useEffect(() => {
    setLocalError('');
    setSuccessMessage('');
    setValidationErrors({});
    if (!resetToken) setIsForgotPassword(false);
    dispatch(clearError());
  }, [location.pathname, dispatch]);

  useEffect(() => {
    if (oauthCode && oauthState && !isSignup && !resetToken && !verifyToken) {
      const provider = oauthState;
      dispatch(socialLogin({ provider, code: oauthCode }))
        .unwrap()
        .then((res) => {
          if (!res.require2FA) {
            setSuccessMessage('Login successful! Redirecting...');
            setTimeout(() => navigate('/onboarding'), 1000);
          }
          window.history.replaceState({}, document.title, '/login');
        })
        .catch((err: any) => {
          setLocalError(err || 'Social authentication failed');
          window.history.replaceState({}, document.title, '/login');
        });
    }
  }, [oauthCode, oauthState, dispatch, navigate, isSignup, resetToken, verifyToken]);

  useEffect(() => {
    if (verifyToken) {
      verifyEmail(verifyToken);
    }
  }, [verifyToken]);

  const verifyEmail = async (token: string) => {
    try {
      const res = await api.post('/auth/verify-email', { token });
      if (res.data.success) {
        setSuccessMessage(res.data.message);
        window.history.replaceState({}, document.title, '/login');
      }
    } catch (err: any) {
      setLocalError(err.response?.data?.error || 'Verification failed');
    }
  };

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
        const res = await dispatch(signup({ email, password, fullName })).unwrap();
        setSuccessMessage(res.message || 'Account created! Please check your email to verify.');
        setTimeout(() => {
          navigate('/login');
          setEmail('');
          setPassword('');
          setConfirmPassword('');
          setFullName('');
        }, 3000);
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
        const res = await dispatch(login({ email, password, rememberMe })).unwrap();
        if (!res.require2FA) {
          setSuccessMessage('Login successful! Redirecting...');
          setTimeout(() => navigate('/onboarding'), 1000);
        }
      } catch (err: any) {
        setLocalError(err || 'Authentication failed');
      }
    }
  };

  const handleForgotPasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    dispatch(clearError());
    setLocalError('');
    setSuccessMessage('');
    if (!email) {
      setLocalError('Please enter your email address');
      return;
    }
    setIsResetting(true);
    try {
      const response = await api.post('/auth/forgot-password', { email });
      if (response.data.success) {
        setSuccessMessage(response.data.message || 'Password reset link sent to your email.');
      }
    } catch (err: any) {
      setLocalError(err.response?.data?.error || 'Failed to send reset link');
    } finally {
      setIsResetting(false);
    }
  };

  const handleResetPasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError('');
    setSuccessMessage('');
    if (!validatePassword(password)) {
      setLocalError('Password must be at least 8 characters with uppercase, lowercase, and number');
      return;
    }
    if (password !== confirmPassword) {
      setLocalError('Passwords do not match');
      return;
    }
    setIsResetting(true);
    try {
      const response = await api.post('/auth/reset-password', { token: resetToken, newPassword: password });
      if (response.data.success) {
        setSuccessMessage('Password reset successfully! Redirecting to login...');
        setTimeout(() => { navigate('/login'); setPassword(''); setConfirmPassword(''); }, 2000);
      }
    } catch (err: any) {
      setLocalError(err.response?.data?.error || 'Failed to reset password. The link might be expired.');
    } finally {
      setIsResetting(false);
    }
  };

  const handleVerify2FA = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError('');
    try {
      await dispatch(verify2FA({ tempToken, code: twoFactorCode })).unwrap();
      setSuccessMessage('Verification successful! Redirecting...');
      setTimeout(() => navigate('/onboarding'), 1000);
    } catch (err: any) {
      setLocalError(err || 'Invalid authenticator code');
    }
  };

  const handleSocialRedirect = async (provider: 'google' | 'github') => {
    try {
      const res = await api.get(`/auth/${provider}/url`);
      window.location.href = res.data.url;
    } catch (err: any) {
      setLocalError(`Failed to initialize ${provider} login.`);
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
            <p className="text-gray-600">{require2FA ? 'Two-Factor Authentication' : resetToken ? 'Set New Password' : isForgotPassword ? 'Recover Account' : isSignup ? 'Create Account' : 'Welcome Back'}</p>
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
          {require2FA ? (
            <form onSubmit={handleVerify2FA} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2 text-center">Enter 6-Digit Code or Backup Code</label>
                <input type="text" value={twoFactorCode} onChange={(e) => setTwoFactorCode(e.target.value)} placeholder="000000 or a8b2c4d9" maxLength={8} required className="w-full px-4 py-3 text-center tracking-widest text-2xl border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none" />
                <p className="text-xs text-gray-500 mt-2 text-center">Open Google Authenticator, or use an 8-character backup code.</p>
              </div>
              <button type="submit" disabled={loading} className="w-full px-4 py-2 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 disabled:bg-gray-400 transition duration-200">
                {loading ? 'Verifying...' : 'Verify & Login'}
              </button>
            </form>
          ) : resetToken ? (
            <form onSubmit={handleResetPasswordSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">New Password</label>
                <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent ${validationErrors.password ? 'border-red-300' : 'border-gray-300'}`} />
                {password && (
                  <div className="mt-2 space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-gray-600">Strength:</span>
                      <span className={`text-xs font-semibold ${passwordStrength.color}`}>{passwordStrength.text}</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div className={`h-2 rounded-full transition-all ${passwordStrength.strength === 1 ? 'w-1/5 bg-red-600' : passwordStrength.strength === 2 ? 'w-2/5 bg-orange-600' : passwordStrength.strength === 3 ? 'w-3/5 bg-yellow-600' : passwordStrength.strength === 4 ? 'w-4/5 bg-green-600' : passwordStrength.strength === 5 ? 'w-full bg-green-700' : 'w-0'}`}></div>
                    </div>
                  </div>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Confirm New Password</label>
                <input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} placeholder="••••••••" className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 border-gray-300" />
                {confirmPassword && password && confirmPassword === password && <p className="text-green-600 text-xs mt-1">✓ Passwords match</p>}
              </div>
              <button type="submit" disabled={isResetting} className="w-full px-4 py-2 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 disabled:bg-gray-400 transition duration-200">
                {isResetting ? 'Resetting...' : 'Set New Password'}
              </button>
            </form>
          ) : isForgotPassword ? (
            <form onSubmit={handleForgotPasswordSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Email Address</label>
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@company.com" required className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 border-gray-300" />
                <p className="text-xs text-gray-500 mt-2">Enter the email associated with your account to receive a reset link.</p>
              </div>
              <button type="submit" disabled={isResetting} className="w-full px-4 py-2 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 disabled:bg-gray-400 transition duration-200">
                {isResetting ? 'Sending...' : 'Send Reset Link'}
              </button>
            </form>
          ) : (
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
              
              {(isSignup || resetToken) && password && (
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
              {!isSignup && !isForgotPassword && (
                <div className="flex justify-end mt-1">
                  <button type="button" onClick={() => { setIsForgotPassword(true); setLocalError(''); setSuccessMessage(''); dispatch(clearError()); }} className="text-sm text-blue-600 hover:underline font-medium">Forgot Password?</button>
                </div>
              )}
              {!isSignup && !isForgotPassword && !resetToken && (
                <div className="flex items-center mt-4">
                  <input type="checkbox" id="rememberMe" checked={rememberMe} onChange={(e) => setRememberMe(e.target.checked)} className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded" />
                  <label htmlFor="rememberMe" className="ml-2 block text-sm text-gray-700">Remember me for 30 days</label>
                </div>
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
          )}

          {/* Social Login Buttons */}
          {!resetToken && !require2FA && !isForgotPassword && (
            <div className="mt-6">
              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-gray-300"></div>
                </div>
                <div className="relative flex justify-center text-sm">
                  <span className="px-2 bg-white text-gray-500">Or continue with</span>
                </div>
              </div>

              <div className="mt-6 grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => handleSocialRedirect('google')}
                  disabled={loading}
                  className="w-full inline-flex justify-center items-center py-2 px-4 border border-gray-300 rounded-md shadow-sm bg-white text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 transition"
                >
                  <svg className="w-5 h-5 mr-2" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                  </svg>
                  Google
                </button>
                <button
                  type="button"
                  onClick={() => handleSocialRedirect('github')}
                  disabled={loading}
                  className="w-full inline-flex justify-center items-center py-2 px-4 border border-gray-300 rounded-md shadow-sm bg-white text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 transition"
                >
                  <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                    <path fillRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" clipRule="evenodd" />
                  </svg>
                  GitHub
                </button>
              </div>
            </div>
          )}

          {/* Toggle */}
          <p className="text-center text-gray-600 text-sm mt-6">
            {require2FA ? (
               <button onClick={() => window.location.reload()} className="text-blue-600 font-semibold hover:underline">Cancel and return to Login</button>
            ) : resetToken ? (
              <button onClick={() => navigate('/login')} className="text-blue-600 font-semibold hover:underline">Return to Login</button>
            ) : isForgotPassword ? (
              <><span className="text-gray-500">Remember your password?</span> <button onClick={() => { setIsForgotPassword(false); setLocalError(''); setSuccessMessage(''); }} className="text-blue-600 font-semibold hover:underline">Back to Login</button></>
            ) : (
              <><span className="text-gray-500">{isSignup ? 'Already have an account? ' : "Don't have an account? "}</span>
              <button onClick={() => { isSignup ? navigate('/login') : navigate('/signup'); setLocalError(''); setValidationErrors({}); }} className="text-blue-600 font-semibold hover:underline">{isSignup ? 'Login' : 'Sign Up'}</button></>
            )}
          </p>
        </div>
      </div>
    </div>
  );
}
