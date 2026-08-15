import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { PemuatHalaman } from './dasbor/PemuatHalaman'

export function ProtectedRoute() {
  const { session, loading } = useAuth()

  if (loading) return <PemuatHalaman />
  if (!session) return <Navigate to="/login" replace />

  return <Outlet />
}
