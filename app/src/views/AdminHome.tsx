import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { daftarEdisi, daftarTanggalUnggahan, type EdisiRow } from '../lib/supabaseEdisi'

export function AdminHome() {
  const { session, signOut } = useAuth()
  const [edisi, setEdisi] = useState<EdisiRow[] | null>(null)
  const [tanggalUnggahan, setTanggalUnggahan] = useState<string[] | null>(null)
  const [err, setErr] = useState('')

  useEffect(() => {
    let batal = false
    daftarEdisi()
      .then((rows) => !batal && setEdisi(rows))
      .catch((e: Error) => !batal && setErr(e.message))
    daftarTanggalUnggahan()
      .then((tgl) => !batal && setTanggalUnggahan(tgl))
      .catch(() => !batal && setTanggalUnggahan([]))
    return () => {
      batal = true
    }
  }, [])

  const tanggalSudahTerbit = new Set(edisi?.map((r) => r.tanggal))

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
        <span><span className="l">Edisi terbit</span><b>{edisi ? edisi.length : '…'}</b></span>
        <span><span className="l">Fase</span><b>3 — Kotak masuk</b></span>
      </div>
      <main className="admin-main">
        <Link to="/admin/upload" className="admin-cta">+ Unggah screenshot</Link>

        <section className="admin-section">
          <div className="admin-section-head">
            <h3>Kotak masuk</h3>
          </div>
          <p className="hint">Upload menunggu dianalisa. Sesi Claude Code menarik screenshot dari sini, menyusun edisi, lalu menyimpannya sebagai terbitan.</p>
          {tanggalUnggahan === null && <p className="admin-empty">Memuat…</p>}
          {tanggalUnggahan && tanggalUnggahan.length === 0 && <p className="admin-empty">Belum ada upload.</p>}
          {tanggalUnggahan && tanggalUnggahan.length > 0 && (
            <div className="inbox-grid">
              {tanggalUnggahan.map((tgl) => (
                <Link key={tgl} to="/admin/upload" className="inbox-card">
                  <span className="tgl">{tgl}</span>
                  {tanggalSudahTerbit.has(tgl) && <span className="ket">Sudah terbit</span>}
                </Link>
              ))}
            </div>
          )}
        </section>

        <section className="admin-section">
          <div className="admin-section-head">
            <h3>Rak terbitan</h3>
          </div>
          {err && <p className="admin-empty" style={{ color: 'var(--bear)' }}>Gagal memuat daftar: {err}</p>}
          {edisi && edisi.length === 0 && <p className="admin-empty">Belum ada edisi terbit.</p>}
          {edisi && edisi.length > 0 && (
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Kode</th>
                  <th>Tanggal</th>
                  <th>Status</th>
                  <th>Emiten</th>
                </tr>
              </thead>
              <tbody>
                {edisi.map((r) => (
                  <tr key={r.kode}>
                    <td><Link to={`/admin/edisi/${r.kode}`}>{r.kode}</Link></td>
                    <td>{r.tanggal}</td>
                    <td><span className={`status-pill ${r.status}`}>{r.status}</span></td>
                    <td>{r.edisi_data.emiten.length}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      </main>
    </div>
  )
}
