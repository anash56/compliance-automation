import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Provider } from 'react-redux';
import store from './store';
import Login from './components/Login';
import HomePage from './pages/HomePage';
import DashboardPage from './pages/DashboardPage';
import GSTPage from './pages/GSTPage';
import TDSPage from './pages/TDSPage';
import CompanyOnboardingPage from './pages/CompanyOnboardingPage';
import ReportsPage from './pages/ReportsPage';
import ProtectedRoute from './components/ProtectedRoute';
import RequireCompany from './components/RequireCompany';
import AuthBootstrap from './components/AuthBootstrap';
function App() {
return (
<Provider store={store}>
<BrowserRouter>
<AuthBootstrap>
<Routes>
<Route path="/" element={<HomePage />} />
<Route path="/login" element={<Login />} />
<Route path="/signup" element={<Login />} />
<Route
path="/onboarding"
element={
<ProtectedRoute>
<CompanyOnboardingPage />
</ProtectedRoute>
}
/>
<Route
path="/dashboard"
element={
<ProtectedRoute>
<RequireCompany>
<DashboardPage />
</RequireCompany>
</ProtectedRoute>
}
/>
<Route
path="/gst"
element={
<ProtectedRoute>
<RequireCompany>
<GSTPage />
</RequireCompany>
</ProtectedRoute>
}
/>
<Route
path="/tds"
element={
<ProtectedRoute>
<RequireCompany>
<TDSPage />
</RequireCompany>
</ProtectedRoute>
}
/>
<Route
path="/reports"
element={
<ProtectedRoute>
<RequireCompany>
<ReportsPage />
</RequireCompany>
</ProtectedRoute>
}
/>
<Route path="*" element={<Navigate to="/" />} />
</Routes>
</AuthBootstrap>
</BrowserRouter>
</Provider>
);
}
export default App;
