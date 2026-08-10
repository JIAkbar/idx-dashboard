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
      <main className="admin-main">
        <p>Fase 0 selesai — login &amp; route admin terlindungi berjalan.</p>
        <p>Menu-menu (Top Stocks, Chart, Broker Summary, dst.) dipindah satu per satu
          di Fase 5, masing-masing sebagai file terpisah di <code>src/views/</code>.</p>
      </main>
    </div>
  )
}
