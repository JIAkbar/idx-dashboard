import { useEffect, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { daftarScreenshot, unggahScreenshot } from '../lib/supabaseEdisi'

function tanggalHariIni(): string {
  const d = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

interface Baris {
  ticker: string
  orderbook: boolean
  chart: boolean
}

function rangkumBerkas(path: string[]): Baris[] {
  const map = new Map<string, Baris>()
  for (const p of path) {
    const nama = p.split('/').pop() ?? ''
    const m = /^([A-Z0-9]+)-(orderbook|chart)\./.exec(nama)
    if (!m) continue
    const [, ticker, jenis] = m
    const baris = map.get(ticker) ?? { ticker, orderbook: false, chart: false }
    if (jenis === 'orderbook') baris.orderbook = true
    else baris.chart = true
    map.set(ticker, baris)
  }
  return [...map.values()].sort((a, b) => a.ticker.localeCompare(b.ticker))
}

export function Unggah() {
  const { session, signOut } = useAuth()
  const [tanggal, setTanggal] = useState(tanggalHariIni())
  const [ticker, setTicker] = useState('')
  const [orderbook, setOrderbook] = useState<File | null>(null)
  const [chart, setChart] = useState<File | null>(null)
  const [sudah, setSudah] = useState<Baris[]>([])
  const [status, setStatus] = useState('')
  const [mengunggah, setMengunggah] = useState(false)
  const [resetKey, setResetKey] = useState(0)

  useEffect(() => {
    let batal = false
    daftarScreenshot(tanggal)
      .then((paths) => !batal && setSudah(rangkumBerkas(paths)))
      .catch(() => !batal && setSudah([]))
    return () => {
      batal = true
    }
  }, [tanggal, status])

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!ticker.trim() || !orderbook) {
      setStatus('Ticker dan screenshot orderbook wajib diisi.')
      return
    }
    setMengunggah(true)
    setStatus('')
    try {
      const kode = ticker.trim().toUpperCase()
      await unggahScreenshot(orderbook, tanggal, kode, 'orderbook')
      if (chart) await unggahScreenshot(chart, tanggal, kode, 'chart')
      setStatus(`${kode} tersimpan.`)
      setTicker('')
      setOrderbook(null)
      setChart(null)
      setResetKey((k) => k + 1)
    } catch (err) {
      setStatus(err instanceof Error ? err.message : 'Gagal unggah.')
    } finally {
      setMengunggah(false)
    }
  }

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
        <Link to="/admin" className="field-note">← Kotak masuk</Link>

        <section className="admin-section">
          <div className="admin-section-head">
            <h3>Unggah screenshot</h3>
          </div>
          <p className="hint">
            Orderbook wajib, chart opsional (lihat standar upload di rencana refactor).
            Setelah terkumpul, sesi Claude Code yang membaca &amp; menyusun edisi.
          </p>

          <form onSubmit={handleSubmit} className="field-grid">
            <label>
              Tanggal
              <input type="date" value={tanggal} onChange={(e) => setTanggal(e.target.value)} required />
            </label>
            <label>
              Ticker
              <input
                type="text"
                value={ticker}
                onChange={(e) => setTicker(e.target.value.toUpperCase())}
                placeholder="ARCI"
                required
              />
            </label>
            <label>
              Orderbook (Stockbit) — wajib
              <input
                key={`ob-${resetKey}`}
                type="file"
                accept="image/*"
                onChange={(e) => setOrderbook(e.target.files?.[0] ?? null)}
                required
              />
            </label>
            <label>
              Chart (TradingView) — opsional
              <input
                key={`ch-${resetKey}`}
                type="file"
                accept="image/*"
                onChange={(e) => setChart(e.target.files?.[0] ?? null)}
              />
            </label>
            <button type="submit" disabled={mengunggah}>
              {mengunggah ? 'Mengunggah…' : 'Unggah'}
            </button>
            {status && <p className="field-note">{status}</p>}
          </form>
        </section>

        <section className="admin-section">
          <div className="admin-section-head">
            <h3>Sudah diunggah — {tanggal}</h3>
          </div>
          {sudah.length === 0 && <p className="admin-empty">Belum ada.</p>}
          {sudah.length > 0 && (
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Ticker</th>
                  <th>Orderbook</th>
                  <th>Chart</th>
                </tr>
              </thead>
              <tbody>
                {sudah.map((b) => (
                  <tr key={b.ticker}>
                    <td>{b.ticker}</td>
                    <td>{b.orderbook ? '✓' : '—'}</td>
                    <td>{b.chart ? '✓' : '—'}</td>
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
