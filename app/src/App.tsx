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
import { AdminLayout } from './views/admin/AdminLayout'
import { UnggahHarian } from './views/admin/UnggahHarian'
import { AkunAdmin } from './views/admin/AkunAdmin'
import { KurasiSetoran } from './views/admin/KurasiSetoran'
import { RadarUnggah } from './views/admin/RadarUnggah'
import { BedahTab } from './views/admin/BedahTab'
import { RakTerbitan } from './views/admin/RakTerbitan'
import { ChangelogAdmin, ChangelogPanel } from './views/admin/ChangelogAdmin'
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
                  yang berujung balik ke / dengan LoginModal terbuka (#41).
                  Bersarang di bawah AdminLayout (#shell-tab): satu shell
                  (header + tab bar) yang TIDAK remount saat pindah tab —
                  cuma <Outlet/> isinya yang berganti. Tab tanpa hak (Kurasi/
                  Akun non-superadmin, Bedah tanpa boleh_bedah) disembunyikan
                  di AdminLayout sendiri, tapi URL-nya tetap hidup (guard
                  AksesDitolak di tiap halaman jaga akses langsung/bookmark). */}
              <Route element={<ProtectedRoute />}>
                <Route path="/admin" element={<AdminLayout />}>
                  <Route index element={<UnggahHarian />} />
                  <Route path="kurasi" element={<KurasiSetoran />} />
                  <Route path="radar" element={<RadarUnggah />} />
                  <Route path="bedah" element={<BedahTab />} />
                  <Route path="terbitan" element={<RakTerbitan />} />
                  <Route path="akun" element={<AkunAdmin />} />
                  {/* "riwayat", bukan "changelog": /admin/changelog sudah dipakai
                      halaman mandiri lama (penanda halaman masih beredar), dan
                      dua route berpath sama di dua tingkat bikin bingung. */}
                  <Route path="riwayat" element={<ChangelogPanel />} />
                </Route>
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
