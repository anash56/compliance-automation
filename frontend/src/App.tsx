import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Provider } from 'react-redux';
import store from './store';
import Login from './components/Login';
import HomePage from './pages/HomePage';
import DashboardPage from './pages/DashboardPage';
import GSTPage from './pages/GSTPage';
import TDSPage from './pages/TDSPage';
import ProtectedRoute from './components/ProtectedRoute';
function App() {
return (
<Provider store={store}>
<BrowserRouter>
<Routes>
<Route path="/" element={<HomePage />} />
<Route path="/login" element={<Login />} />
<Route path="/signup" element={<Login />} />
<Route
path="/dashboard"
element={
<ProtectedRoute>
<DashboardPage />
</ProtectedRoute>
}
/>
<Route
path="/gst"
element={
<ProtectedRoute>
<GSTPage />
</ProtectedRoute>
}
/>
<Route
path="/tds"
element={
<ProtectedRoute>
<TDSPage />
</ProtectedRoute>
}
/>
<Route path="*" element={<Navigate to="/" />} />
</Routes>
</BrowserRouter>
</Provider>
);
}
export default App;