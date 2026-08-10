import { useAuth } from '../context/AuthContext'

export function AdminHome() {
  const { session, signOut } = useAuth()

  return (
    <div className="admin-shell">
      <header className="admin-topbar">
        <span className="login-brand" style={{ fontSize: '14pt' }}>ARUS PASAR</span>
        <div className="admin-topbar-right">
          <span className="admin-email">{session?.user.email}</span>
          <button type="button" onClick={() => signOut()}>Keluar</button>
        </div>
      </header>
      <div className="admin-status">
        <span><span className="l">Sesi</span><b>Aktif</b></span>
        <span><span className="l">Edisi terakhir</span><b>AP-100826-E01</b></span>
        <span><span className="l">Fase</span><b>0 — Auth &amp; scaffold</b></span>
      </div>
      <main className="admin-main">
        <p>Login &amp; route admin terlindungi berjalan.</p>
        <p>Menu-menu (Top Stocks, Chart, Broker Summary, dst.) dipindah satu per satu
          di Fase 5, masing-masing sebagai file terpisah di <code>src/views/</code>.</p>
      </main>
    </div>
  )
}
