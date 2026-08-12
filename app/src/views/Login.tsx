import { Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

/**
 * Rute /login lama dipertahankan untuk bookmark/tautan luar (#38) — login
 * sekarang LoginModal (dipicu dari Sidebar/MobileNav, dirender DasborLayout),
 * bukan halaman sendiri. Sudah masuk -> langsung /admin (perilaku lama).
 * Belum -> balik ke dasbor publik dengan modal otomatis terbuka lewat
 * location.state.openLogin (lihat DasborLayout).
 */
export function Login() {
  const { session } = useAuth()
  if (session) return <Navigate to="/admin" replace />
  return <Navigate to="/" replace state={{ openLogin: true }} />
}
