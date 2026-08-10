import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import { ProtectedRoute } from './components/ProtectedRoute'
import { Home } from './views/Home'
import { Login } from './views/Login'
import { AdminHome } from './views/AdminHome'
import './App.css'

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          {/* Publik — dasbor, tanpa login. Diisi 11 menu di Fase 5. */}
          <Route path="/" element={<Home />} />
          {/* Login hanya gerbang ke fitur upload/kelola edisi. */}
          <Route path="/login" element={<Login />} />
          <Route element={<ProtectedRoute />}>
            <Route path="/admin" element={<AdminHome />} />
          </Route>
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  )
}

export default App
