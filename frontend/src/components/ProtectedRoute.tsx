import { Navigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { RootState } from '../store';
export default function ProtectedRoute({ children }: any) {
const { user, loading } = useSelector((state: RootState) => state.auth);

if (loading && !user) {
  return <div className="min-h-screen flex items-center justify-center text-gray-500">Verifying session...</div>;
}

if (!user && !loading) {
  return <Navigate to="/login" replace />;
}
return children;
}