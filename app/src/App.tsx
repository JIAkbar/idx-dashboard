import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import { ThemeProvider } from './context/ThemeContext'
import { ProtectedRoute } from './components/ProtectedRoute'
import { DasborLayout } from './components/dasbor/DasborLayout'
import { IndeksDunia } from './views/dasbor/IndeksDunia'
import { TopStocks } from './views/dasbor/TopStocks'
import { TopBroker } from './views/dasbor/TopBroker'
import { SektorIndeks } from './views/dasbor/SektorIndeks'
import { ChartIndeks } from './views/dasbor/ChartIndeks'
import { BrokerSummary } from './views/dasbor/BrokerSummary'
import { StockDetail } from './views/dasbor/StockDetail'
import { PetaInvestor } from './views/dasbor/PetaInvestor'
import { KalkulatorJia } from './views/dasbor/KalkulatorJia'
import { Bulletin } from './views/dasbor/Bulletin'
import { Radar } from './views/dasbor/Radar'
import { Feedback } from './views/dasbor/Feedback'
import { Login } from './views/Login'
import { AdminHome } from './views/AdminHome'
import { AkunAdmin } from './views/admin/AkunAdmin'
import { KurasiSetoran } from './views/admin/KurasiSetoran'
import { ChangelogAdmin } from './views/admin/ChangelogAdmin'
import { EdisiUjicoba } from './views/EdisiUjicoba'
import { EdisiView } from './views/EdisiView'
import './App.css'

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <ThemeProvider>
          <Routes>
            {/* Publik — dasbor, tanpa login. Index = Indeks Dunia (panel "active" default di index_live.html). */}
            <Route element={<DasborLayout />}>
              <Route path="/" element={<IndeksDunia />} />
              <Route path="/stocks" element={<TopStocks />} />
              <Route path="/broker" element={<TopBroker />} />
              <Route path="/sector" element={<SektorIndeks />} />
              <Route path="/chart" element={<ChartIndeks />} />
              <Route path="/stock-detail" element={<StockDetail />} />
              <Route path="/peta-investor" element={<PetaInvestor />} />
              <Route path="/broker-summary" element={<BrokerSummary />} />
              <Route path="/kalkulator" element={<KalkulatorJia />} />
              <Route path="/bulletin" element={<Bulletin />} />
              <Route path="/radar" element={<Radar />} />
              <Route path="/feedback" element={<Feedback />} />
              {/* /admin ikut DI DALAM layout (rail/topbar tetap tampil) tapi
                  tetap dijaga ProtectedRoute — belum login dilempar ke /login
                  yang berujung balik ke / dengan LoginModal terbuka (#41). */}
              <Route element={<ProtectedRoute />}>
                <Route path="/admin" element={<AdminHome />} />
                <Route path="/admin/akun" element={<AkunAdmin />} />
                <Route path="/admin/kurasi" element={<KurasiSetoran />} />
              </Route>
            </Route>
            {/* /login lama dipertahankan sbg redirect (bookmark/tautan luar) — login
                sekarang modal, dipicu dari Sidebar/MobileNav (lihat views/Login.tsx). */}
            <Route path="/login" element={<Login />} />
            <Route element={<ProtectedRoute />}>
              <Route path="/admin/changelog" element={<ChangelogAdmin />} />
              <Route path="/admin/edisi/ujicoba" element={<EdisiUjicoba />} />
              <Route path="/admin/edisi/:kode" element={<EdisiView />} />
            </Route>
          </Routes>
        </ThemeProvider>
      </AuthProvider>
    </BrowserRouter>
  )
}

export default App
