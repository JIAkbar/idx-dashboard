import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import { ThemeProvider } from './context/ThemeContext'
import { AksesHalamanProvider } from './context/AksesHalamanContext'
import { ProtectedRoute } from './components/ProtectedRoute'
import { PenjagaHalaman } from './components/PenjagaHalaman'
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
import { AksesAdmin } from './views/admin/AksesAdmin'
import { RakTerbitan } from './views/admin/RakTerbitan'
import { ChangelogAdmin, ChangelogPanel } from './views/admin/ChangelogAdmin'
import { EdisiUjicoba } from './views/EdisiUjicoba'
import { EdisiView } from './views/EdisiView'
import './App.css'

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        {/* Fase 6 — akses & jenjang: satu sumber `halaman_saya()` dipakai
            bareng PenjagaHalaman (guard rute) & badge gembok Sidebar/LaciMobile.
            Di dalam AuthProvider (butuh sesi), di luar ThemeProvider (tak
            terkait tema). */}
        <AksesHalamanProvider>
        <ThemeProvider>
          <Routes>
            {/* Publik — dasbor, tanpa login. Index = Indeks Dunia (panel "active" default di index_live.html). */}
            <Route element={<DasborLayout />}>
              <Route path="/" element={<PenjagaHalaman kunci="dasbor"><IndeksDunia /></PenjagaHalaman>} />
              {/* /stocks (Top Stocks) & /radar (Radar Watchlist) TIDAK dibungkus —
                  tak ada kunci akses_halaman yang cocok utk keduanya (lihat
                  komentar PETA_MENU_KUNCI, lib/aksesHalaman.ts: 'kalender' itu
                  panel di dalam Indeks Dunia, 'radar' itu tab admin WDWL). */}
              <Route path="/stocks" element={<TopStocks />} />
              {/* /broker (Top Broker) juga tak dibungkus — kunci 'broker' cuma
                  utk "Broker Summary" (label sungguhan di database), lihat /broker-summary di bawah. */}
              <Route path="/broker" element={<TopBroker />} />
              <Route path="/sector" element={<PenjagaHalaman kunci="sektor"><SektorIndeks /></PenjagaHalaman>} />
              <Route path="/chart" element={<PenjagaHalaman kunci="chart"><ChartIndeks /></PenjagaHalaman>} />
              <Route path="/stock-detail" element={<PenjagaHalaman kunci="detail"><StockDetail /></PenjagaHalaman>} />
              <Route path="/peta-investor" element={<PenjagaHalaman kunci="peta"><PetaInvestor /></PenjagaHalaman>} />
              <Route path="/broker-summary" element={<PenjagaHalaman kunci="broker"><BrokerSummary /></PenjagaHalaman>} />
              <Route path="/kalkulator" element={<PenjagaHalaman kunci="kalkulator"><KalkulatorJia /></PenjagaHalaman>} />
              <Route path="/bulletin" element={<PenjagaHalaman kunci="bulletin"><Bulletin /></PenjagaHalaman>} />
              <Route path="/radar" element={<Radar />} />
              <Route path="/feedback" element={<PenjagaHalaman kunci="saran"><Feedback /></PenjagaHalaman>} />
              {/* /admin ikut DI DALAM layout (rail/topbar tetap tampil) tapi
                  tetap dijaga ProtectedRoute — belum login dilempar ke /login
                  yang berujung balik ke / dengan LoginModal terbuka (#41).
                  Bersarang di bawah AdminLayout (#shell-tab): satu shell
                  (header + tab bar) yang TIDAK remount saat pindah tab —
                  cuma <Outlet/> isinya yang berganti. Tab tanpa hak (Kurasi/
                  Akun non-superadmin, Bedah tanpa boleh_bedah) disembunyikan
                  di AdminLayout sendiri, tapi URL-nya tetap hidup (guard
                  AksesDitolak di tiap halaman jaga akses langsung/bookmark).
                  CATATAN (Fase 6): kunci akses_halaman 'admin' ("Area Admin")
                  SENGAJA TIDAK dipakai membungkus rute ini — isinya di database
                  tingkat='superadmin', kalau dipasang di sini SEMUA kontributor
                  (bukan cuma superadmin) akan terkunci dari tab Unggah mereka
                  sendiri, padahal itu jalur inti aplikasi. Superadmin-only sudah
                  ditegakkan lewat guard AksesDitolak per-tab yang sudah ada
                  (profil.peran, dicek di server tiap tabel/fungsi) — bukan lewat
                  lapisan Fase 6 ini. Kalau maksud kunci 'admin' sebenarnya beda
                  (mis. seharusnya tingkat='login'), sesuaikan baris itu di tab
                  Akses lalu pasang PenjagaHalaman kunci="admin" di sini. */}
              <Route element={<ProtectedRoute />}>
                <Route path="/admin" element={<AdminLayout />}>
                  <Route index element={<UnggahHarian />} />
                  <Route path="kurasi" element={<KurasiSetoran />} />
                  <Route path="radar" element={<RadarUnggah />} />
                  <Route path="bedah" element={<PenjagaHalaman kunci="bedah"><BedahTab /></PenjagaHalaman>} />
                  <Route path="terbitan" element={<RakTerbitan />} />
                  <Route path="akun" element={<AkunAdmin />} />
                  <Route path="akses" element={<AksesAdmin />} />
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
        </AksesHalamanProvider>
      </AuthProvider>
    </BrowserRouter>
  )
}

export default App
