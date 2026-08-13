import { useEffect, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { IkonMenu, IKON_KOTAK_ARSIP, IKON_PAPAN_KLIP } from '../components/dasbor/IkonMenu'
import {
  daftarEdisi,
  daftarScreenshot,
  daftarTanggalUnggahan,
  unggahScreenshot,
  type EdisiRow,
} from '../lib/supabaseEdisi'

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

/** Blok kosong seragam utk panel tanpa isi — pola fd-empty StockDetail.tsx,
 *  padding diperkecil karena di sini dia hidup di dalam panel, bukan satu
 *  halaman penuh. */
function PanelKosong({ ikon, pesan, petunjuk }: { ikon: string; pesan: string; petunjuk?: string }) {
  return (
    <div className="fd-empty" style={{ padding: '28px 16px' }}>
      <p style={{ marginBottom: 8 }}><IkonMenu d={ikon} size={26} /></p>
      <p>{pesan}</p>
      {petunjuk && <p style={{ fontSize: 10, marginTop: 6 }}>{petunjuk}</p>}
    </div>
  )
}

/**
 * Halaman admin Arus Pasar — SATU halaman (route /admin), gabungan bekas
 * AdminHome + Unggah (#39): upload screenshot, kotak masuk (tanggal yang
 * sudah punya upload), dan rak terbitan tampil sekaligus, tanpa sub-page.
 *
 * Sejak #41 dirender DI DALAM <DasborLayout> (rail kiri tetap tampil, entri
 * Admin di kaki rail menyala saat aktif) — jadi tak perlu lagi bungkus
 * .dasbor-shell sendiri ataupun tombol "← Dasbor". Guard auth tetap di
 * App.tsx (ProtectedRoute membungkus route ini di dalam grup layout).
 *
 * Tata letak: .admin-view (cap lebar, lantai.css — pola .kalkulator-view),
 * grid2 dua kolom di layar lebar (kiri form unggah, kanan status hari ini),
 * rak terbitan lebar penuh di bawah. grid2 fluid, jatuh satu kolom di telepon.
 */
export function AdminHome() {
  const { session, signOut } = useAuth()

  const [edisi, setEdisi] = useState<EdisiRow[] | null>(null)
  const [tanggalUnggahan, setTanggalUnggahan] = useState<string[] | null>(null)
  const [err, setErr] = useState('')

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
    daftarEdisi()
      .then((rows) => !batal && setEdisi(rows))
      .catch((e: Error) => !batal && setErr(e.message))
    daftarTanggalUnggahan()
      .then((tgl) => !batal && setTanggalUnggahan(tgl))
      .catch(() => !batal && setTanggalUnggahan([]))
    return () => {
      batal = true
    }
  }, [status])

  useEffect(() => {
    let batal = false
    daftarScreenshot(tanggal)
      .then((paths) => !batal && setSudah(rangkumBerkas(paths)))
      .catch(() => !batal && setSudah([]))
    return () => {
      batal = true
    }
  }, [tanggal, status])

  const tanggalSudahTerbit = new Set(edisi?.map((r) => r.tanggal))

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
    <div className="lantai admin-view">
      <div className="vhead" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1>Arus Pasar</h1>
          <span className="sub">Area admin — unggah &amp; kelola edisi</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11 }}>
          <span className="muted">{session?.user.email}</span>
          <button type="button" className="dd-btn" onClick={() => signOut()}>Keluar</button>
        </div>
      </div>

      <div className="grid2">
        <section className="panel">
          <div className="panel-h"><span className="lbl">Unggah screenshot</span></div>
          <div className="panel-b">
            <p className="muted" style={{ marginTop: 0, fontSize: 11 }}>
              Orderbook wajib, chart opsional.
            </p>
            <form onSubmit={handleSubmit} style={{ display: 'grid', gap: 12 }}>
              <div className="field">
                <span className="lbl">Tanggal</span>
                <input className="inp" type="date" value={tanggal} onChange={(e) => setTanggal(e.target.value)} required />
              </div>
              <div className="field">
                <span className="lbl">Ticker</span>
                <input
                  className="inp"
                  type="text"
                  value={ticker}
                  onChange={(e) => setTicker(e.target.value.toUpperCase())}
                  placeholder="ARCI"
                  required
                />
              </div>
              <div className="field">
                <span className="lbl">Orderbook (Stockbit) — wajib</span>
                <input
                  key={`ob-${resetKey}`}
                  className="inp"
                  type="file"
                  accept="image/*"
                  onChange={(e) => setOrderbook(e.target.files?.[0] ?? null)}
                  required
                />
              </div>
              <div className="field">
                <span className="lbl">Chart (TradingView) — opsional</span>
                <input
                  key={`ch-${resetKey}`}
                  className="inp"
                  type="file"
                  accept="image/*"
                  onChange={(e) => setChart(e.target.files?.[0] ?? null)}
                />
              </div>
              <button type="submit" className="btn-p" style={{ justifySelf: 'start' }} disabled={mengunggah}>
                {mengunggah ? 'Mengunggah…' : 'Unggah'}
              </button>
              {status && <p className="muted" style={{ margin: 0 }}>{status}</p>}
            </form>
          </div>
        </section>

        <div style={{ display: 'grid', gap: 14, alignContent: 'start' }}>
          <section className="panel">
            <div className="panel-h"><span className="lbl">Sudah diunggah — {tanggal}</span></div>
            <div className="panel-b">
              {sudah.length === 0 && (
                <PanelKosong
                  ikon={IKON_PAPAN_KLIP}
                  pesan={`Belum ada unggahan untuk ${tanggal}.`}
                  petunjuk="Pilih tanggal, isi ticker, lalu unggah screenshot orderbook lewat form Unggah Screenshot."
                />
              )}
              {sudah.length > 0 && (
                <table className="tbl">
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
                        <td className="tick">{b.ticker}</td>
                        <td>{b.orderbook ? '✓' : '—'}</td>
                        <td>{b.chart ? '✓' : '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </section>

          <section className="panel">
            <div className="panel-h"><span className="lbl">Kotak masuk</span></div>
            <div className="panel-b">
              {tanggalUnggahan === null && <p className="muted">Memuat…</p>}
              {tanggalUnggahan && tanggalUnggahan.length === 0 && (
                <PanelKosong
                  ikon={IKON_KOTAK_ARSIP}
                  pesan="Belum ada tanggal dengan unggahan."
                  petunjuk="Tanggal yang sudah punya screenshot akan berbaris di sini."
                />
              )}
              {tanggalUnggahan && tanggalUnggahan.length > 0 && (
                <div className="grid3">
                  {tanggalUnggahan.map((tgl) => (
                    <button
                      key={tgl}
                      type="button"
                      className="vcard"
                      style={{ textAlign: 'left', cursor: 'pointer' }}
                      onClick={() => setTanggal(tgl)}
                      title="Pilih tanggal ini di form unggah"
                    >
                      <span className="v-num" style={{ fontSize: 15 }}>{tgl}</span>
                      <span className="v-note">{tanggalSudahTerbit.has(tgl) ? 'Sudah terbit' : 'Menunggu'}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </section>
        </div>
      </div>

      <section className="panel">
        <div className="panel-h"><span className="lbl">Rak terbitan</span></div>
        <div className="panel-b">
          {err && <p className="muted" style={{ color: 'var(--red)' }}>Gagal memuat daftar: {err}</p>}
          {edisi && edisi.length === 0 && (
            <PanelKosong
              ikon={IKON_KOTAK_ARSIP}
              pesan="Belum ada edisi terbit."
              petunjuk="Edisi yang sudah dirakit dari unggahan akan tampil di rak ini."
            />
          )}
          {edisi && edisi.length > 0 && (
            <table className="tbl">
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
                    <td><Link to={`/admin/edisi/${r.kode}`} className="tick">{r.kode}</Link></td>
                    <td>{r.tanggal}</td>
                    <td><span className={`chip ${r.status === 'terbit' ? 'up' : 'warn'}`}>{r.status}</span></td>
                    <td>{r.edisi_data.emiten.length}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </section>
    </div>
  )
}
