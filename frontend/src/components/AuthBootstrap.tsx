import { useEffect } from 'react';
import { useDispatch } from 'react-redux';
import { AppDispatch } from '../store';
import { fetchCurrentUser } from '../store/slices/authSlice';
import { ToastProvider } from './ToastContext';

export default function AuthBootstrap({ children }: { children: React.ReactNode }) {
  const dispatch = useDispatch<AppDispatch>();

  useEffect(() => {
    dispatch(fetchCurrentUser());
  }, [dispatch]);

  return <ToastProvider>{children}</ToastProvider>;
}
