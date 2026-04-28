import { Navigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { RootState } from '../store';
export default function ProtectedRoute({ children }: any) {
const { token } = useSelector((state: RootState) => state.auth);
if (!token) {
return <Navigate to="/login" />;
}
return children;
}