import { Link } from 'react-router-dom'

/** Halaman publik — tidak perlu login. Diisi 11 menu dasbor bertahap di Fase 5. */
export function Home() {
  return (
    <div className="public-shell">
      <header className="public-topbar">
        <span className="login-brand" style={{ fontSize: '14pt' }}>ARUS PASAR</span>
        <Link to="/login" className="public-admin-link">Admin</Link>
      </header>
      <main className="admin-main">
        <p>Dasbor publik — menu-menu (Top Stocks, Chart, Broker Summary, dst.) dipindah
          ke sini satu per satu di Fase 5. Tidak perlu login untuk melihat.</p>
        <p>Login hanya diperlukan admin untuk mengunggah screenshot dan mengelola edisi
          Arus Pasar.</p>
      </main>
    </div>
  )
}
