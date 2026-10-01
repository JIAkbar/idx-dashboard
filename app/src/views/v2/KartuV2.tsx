import { useEffect, useMemo, useRef, useState } from 'react'
import { CandlestickSeries, createChart, type Time } from 'lightweight-charts'
import { urlData } from '../../lib/dasbor/baseData'
import './KartuV2.css'

/** Kartu Emiten v2 — halaman berdiri sendiri (tanpa ThemeProvider/AuthProvider). */

type Lvl = { level: number; sentuhan: number; terakhir: string; skor: number }
type Horizon = 'harian' | 'mingguan' | 'bulanan'
type Kartu = {
  kode: string; nama: string; tgl: string; harga: number; chg: number
  tren: Record<Horizon, { arah: string; sejak: string }>
  level: { resistance: Lvl[]; support: Lvl[]; angka_bulat: number[] }
  mode: { adx: number; di_plus: number; di_min: number; label: string; ma: Record<string, number> }
  sinyal: { status: string; judul: string; ket?: string }
  cek: { teks: string; lulus: boolean }[]
  skor: number
  peluang: { rezim: string; p: number; jebakan: string[] } | null
}
type Indeks = { tgl: string; emiten: [string, string, number][]; nama_sinyal: Record<string, string> }
type Bar = { time: string; open: number; high: number; low: number; close: number }

const angka = new Intl.NumberFormat('id-ID', { maximumFractionDigits: 2 })
const BULAN = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des']
const tgl = (iso: string, tahun = true) =>
  `${Number(iso.slice(8, 10))} ${BULAN[Number(iso.slice(5, 7)) - 1]}${tahun ? ' ' + iso.slice(0, 4) : ''}`
const pct = (v: number) => `${v > 0 ? '+' : v < 0 ? '−' : ''}${angka.format(Math.abs(v))}%`
const warna = (v: number) => (v > 0 ? 'kv-naik' : v < 0 ? 'kv-turun' : '')
const kapital = (s: string) => s[0].toUpperCase() + s.slice(1)
const ARAH: Record<string, string> = { naik: 'Naik', turun: 'Turun', sideways: 'Sideways' }
const HORIZON_HARI: Record<Horizon, number> = { harian: 365, mingguan: 365 * 3, bulanan: 365 * 5 }

function kunciMinggu(iso: string) {
  const d = new Date(iso + 'T00:00:00Z')
  d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7))
  return d.toISOString().slice(0, 10)
}

/** Open pertama, high maks, low min, close terakhir per kunci periode. */
function agregasi(harian: Bar[], kunci: (t: string) => string): Bar[] {
  const out: Bar[] = []
  let kTerakhir = ''
  for (const b of harian) {
    const k = kunci(b.time)
    const l = out[out.length - 1]
    if (l && k === kTerakhir) {
      l.high = Math.max(l.high, b.high); l.low = Math.min(l.low, b.low); l.close = b.close
    } else { out.push({ ...b, time: k }); kTerakhir = k }
  }
  return out
}

function Grafik({ bars, kartu, horizon }: { bars: Bar[]; kartu: Kartu; horizon: Horizon }) {
  const kotak = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const el = kotak.current
    if (!el || !bars.length) return
    const s = getComputedStyle(el)
    const v = (n: string) => s.getPropertyValue(n).trim()
    const t = { teks: v('--kv-redup'), garis: v('--kv-garis'), naik: v('--kv-hijau'), turun: v('--kv-merah') }
    const chart = createChart(el, {
      width: el.clientWidth, height: el.clientHeight,
      layout: { background: { color: 'transparent' }, textColor: t.teks, fontFamily: 'inherit', attributionLogo: false },
      grid: { vertLines: { color: t.garis }, horzLines: { color: t.garis } },
      rightPriceScale: { borderColor: t.garis }, timeScale: { borderColor: t.garis },
      localization: { locale: 'id-ID', priceFormatter: (p: number) => p.toLocaleString('id-ID', { maximumFractionDigits: 0 }) },
    })
    const seri = chart.addSeries(CandlestickSeries, {
      upColor: t.naik, downColor: t.turun, borderVisible: false,
      wickUpColor: t.naik, wickDownColor: t.turun, priceLineVisible: false,
    })
    seri.setData(bars.map((b) => ({ ...b, time: b.time as Time })))
    for (const l of kartu.level.support.slice(0, 3))
      seri.createPriceLine({ price: l.level, color: t.naik, lineWidth: 1, lineStyle: 2, title: 'S' })
    for (const l of kartu.level.resistance.slice(0, 3))
      seri.createPriceLine({ price: l.level, color: t.turun, lineWidth: 1, lineStyle: 2, title: 'R' })
    chart.timeScale().fitContent()
    const ro = new ResizeObserver(() => chart.resize(el.clientWidth, el.clientHeight))
    ro.observe(el)
    return () => { ro.disconnect(); chart.remove() }
  }, [bars, kartu, horizon])
  return <div ref={kotak} className="kv-grafik" role="img" aria-label={`Grafik candlestick ${kartu.kode}, ${horizon}`} />
}

const TITIK = (n: number) => '●'.repeat(n) + '○'.repeat(5 - n)

function BarisLevel({ l, jenis }: { l: Lvl; jenis: 'r' | 's' }) {
  return (
    <li className={`kv-lvl kv-lvl-${jenis}`}>
      <b>{angka.format(l.level)}</b>
      <span className="kv-titik" role="img" aria-label={`kekuatan ${l.skor} dari 5`}>{TITIK(l.skor)}</span>
      <span className="kv-redup">{l.sentuhan} sentuhan · terakhir {tgl(l.terakhir, false)}</span>
    </li>
  )
}

export function KartuV2() {
  const [kode, setKode] = useState(() => (new URLSearchParams(location.search).get('kode') || 'BBCA').toUpperCase())
  const [input, setInput] = useState(kode)
  const [indeks, setIndeks] = useState<Indeks | null>(null)
  const [kartu, setKartu] = useState<Kartu | null>(null)
  const [harian, setHarian] = useState<Bar[]>([])
  const [galat, setGalat] = useState(false)
  const [horizon, setHorizon] = useState<Horizon>('harian')

  useEffect(() => {
    fetch(urlData('/data-idx/json/kartu_v2/_indeks.json')).then((r) => r.json()).then(setIndeks).catch(() => {})
  }, [])

  useEffect(() => {
    let batal = false
    setKartu(null); setGalat(false); setHarian([])
    Promise.all([
      fetch(urlData(`/data-idx/json/kartu_v2/${kode}.json`)).then((r) => { if (!r.ok) throw new Error('x'); return r.json() }),
      fetch(urlData(`/data-idx/json/ohlc/${kode}.json`)).then((r) => (r.ok ? r.json() : { d: [] })).catch(() => ({ d: [] })),
    ]).then(([k, o]) => {
      if (batal) return
      setKartu(k)
      setHarian((o.d as number[][]).map((r) => ({ time: String(r[0]), open: r[1], high: r[2], low: r[3], close: r[4] })))
    }).catch(() => { if (!batal) setGalat(true) })
    return () => { batal = true }
  }, [kode])

  const ganti = (v: string) => {
    const k = v.trim().toUpperCase()
    if (!k || k === kode) return
    history.replaceState(null, '', `?kode=${encodeURIComponent(k)}`)
    setKode(k)
  }

  const bars = useMemo(() => {
    if (!harian.length) return []
    const dasar = horizon === 'harian' ? harian
      : agregasi(harian, horizon === 'mingguan' ? kunciMinggu : (t) => t.slice(0, 7) + '-01')
    const batas = new Date(Date.now() - HORIZON_HARI[horizon] * 864e5).toISOString().slice(0, 10)
    return dasar.filter((b) => b.time >= batas)
  }, [harian, horizon])

  const nama = (k: string) => indeks?.nama_sinyal[k] ?? k

  return (
    <div className="kv-halaman">
      <main className="kv-isi">
        <header className="kv-kop">
          <div>
            <p className="kv-eyebrow">PAPAN v2 · Kartu Emiten · <a href="/">← Kembali</a></p>
            <h1>{kartu?.kode ?? kode} <span className="kv-nama">{kartu?.nama}</span></h1>
            {kartu && (
              <p className="kv-harga">
                <strong>{angka.format(kartu.harga)}</strong>
                <span className={warna(kartu.chg)}>{pct(kartu.chg)}</span>
                <span className="kv-redup">Data per {tgl(kartu.tgl)}</span>
              </p>
            )}
          </div>
          <form className="kv-cari" onSubmit={(e) => { e.preventDefault(); ganti(input) }}>
            <label htmlFor="kv-kode" className="kv-sr">Cari emiten</label>
            <input id="kv-kode" list="kv-daftar" value={input} placeholder="Cari emiten…" autoComplete="off"
              onChange={(e) => { setInput(e.target.value); if (indeks?.emiten.some((x) => x[0] === e.target.value.toUpperCase())) ganti(e.target.value) }} />
            <datalist id="kv-daftar">{indeks?.emiten.map(([k, n]) => <option key={k} value={k}>{n}</option>)}</datalist>
            <button type="submit">Buka</button>
          </form>
        </header>

        {galat && <p className="kv-status" role="alert">Data emiten ini belum tersedia.</p>}
        {!galat && !kartu && <p className="kv-status" role="status">Memuat…</p>}

        {kartu && (
          <div className="kv-kolom">
            <div className="kv-kiri">
              <section className="kv-panel" aria-labelledby="kv-h-ring">
                <h2 id="kv-h-ring">Ringkasan</h2>
                <div className="kv-meter" role="img" aria-label={`${kartu.skor} dari 6 syarat terpenuhi`}>
                  {Array.from({ length: 6 }, (_, i) => <i key={i} className={i < kartu.skor ? 'on' : ''} />)}
                </div>
                <p className="kv-redup"><b>{kartu.skor}</b> dari 6 syarat terpenuhi</p>
                <ul className="kv-cek">
                  {kartu.cek.map((c) => (
                    <li key={c.teks} className={c.lulus ? 'lulus' : 'gagal'}>
                      <span aria-hidden="true">{c.lulus ? '✓' : '✕'}</span>
                      <span><span className="kv-sr">{c.lulus ? 'Lulus: ' : 'Tidak lulus: '}</span>{c.teks}</span>
                    </li>
                  ))}
                </ul>
              </section>

              <section className="kv-panel" aria-labelledby="kv-h-tren">
                <h2 id="kv-h-tren">Tren tiga lapis</h2>
                <div className="kv-pil-baris">
                  {(['harian', 'mingguan', 'bulanan'] as Horizon[]).map((h) => {
                    const t = kartu.tren[h]
                    return (
                      <button key={h} type="button" aria-pressed={horizon === h} className={`kv-pil ${horizon === h ? 'aktif' : ''}`} onClick={() => setHorizon(h)}>
                        <span className="kv-redup">{kapital(h)}</span>
                        <b className={t.arah === 'naik' ? 'kv-naik' : t.arah === 'turun' ? 'kv-turun' : ''}>{ARAH[t.arah] ?? 'Belum jelas'}</b>
                        <small className="kv-redup">sejak {tgl(t.sejak, false)}</small>
                      </button>
                    )
                  })}
                </div>
                <p className="kv-kecil">Mengetuk satu lapis mengganti horizon grafik.</p>
              </section>

              <section className={`kv-panel kv-sinyal kv-s-${kartu.sinyal.status === 'beli' ? 'beli' : kartu.sinyal.status === 'jual' ? 'jual' : 'netral'}`} aria-labelledby="kv-h-sin">
                <h2 id="kv-h-sin">Satu sinyal</h2>
                <p className="kv-sin-judul">{kartu.sinyal.judul}</p>
                {kartu.sinyal.ket && <p>{kartu.sinyal.ket}</p>}
                <p className="kv-kecil">Tembus level sah hanya bila harga ditutup di luar level plus toleransi 1,5%, lalu dikonfirmasi hari berikutnya.</p>
              </section>

              {kartu.peluang && (
                <section className="kv-panel" aria-labelledby="kv-h-pel">
                  <h2 id="kv-h-pel">Peluang</h2>
                  <p>Rezim pasar: <b className={kartu.peluang.rezim === 'bullish' ? 'kv-naik' : 'kv-turun'}>{kartu.peluang.rezim}</b></p>
                  <p>Peluang naik 5% sebelum turun 5% dalam 20 hari bursa: <b className="kv-besar">{Math.round(kartu.peluang.p * 100)}%</b></p>
                  {kartu.peluang.jebakan.length > 0 && (
                    <>
                      <p className="kv-redup">Sinyal penjebak di rezim ini</p>
                      <ul className="kv-daftar">{kartu.peluang.jebakan.map((j) => <li key={j}>{nama(j)}</li>)}</ul>
                    </>
                  )}
                  <p className="kv-kecil">Dihitung dari uji akhir Juli 2024 sampai September 2026 di seluruh IDX; peta peluang, bukan janji.</p>
                </section>
              )}

              <section className="kv-panel" aria-labelledby="kv-h-mode">
                <h2 id="kv-h-mode">Mode pasar</h2>
                <p><b>{kapital(kartu.mode.label)}</b>{' '}
                  <span className="kv-redup">ADX {angka.format(kartu.mode.adx)} · DI+ {angka.format(kartu.mode.di_plus)} · DI− {angka.format(kartu.mode.di_min)}</span></p>
                <dl className="kv-ma">
                  {Object.entries(kartu.mode.ma).map(([k, v]) => (
                    <div key={k}><dt className="kv-redup">Jarak ke {k}</dt><dd className={warna(v)}>{pct(v)}</dd></div>
                  ))}
                </dl>
              </section>
            </div>

            <div className="kv-kanan">
              <section className="kv-panel" aria-labelledby="kv-h-graf">
                <h2 id="kv-h-graf">Grafik · {kapital(horizon)}</h2>
                {bars.length ? <Grafik bars={bars} kartu={kartu} horizon={horizon} /> : <p className="kv-redup">Grafik belum tersedia.</p>}
                <p className="kv-kecil">Garis putus-putus: tiga support (hijau, S) dan tiga resistance (merah, R).</p>
              </section>

              <section className="kv-panel" aria-labelledby="kv-h-lvl">
                <h2 id="kv-h-lvl">Tangga level</h2>
                <ul className="kv-tangga">
                  {[...kartu.level.resistance].sort((a, b) => b.level - a.level).slice(0, 3).map((l) => <BarisLevel key={l.level} l={l} jenis="r" />)}
                  <li className="kv-lvl kv-sekarang"><b>{angka.format(kartu.harga)}</b><span>Harga sekarang</span></li>
                  {[...kartu.level.support].sort((a, b) => b.level - a.level).slice(0, 3).map((l) => <BarisLevel key={l.level} l={l} jenis="s" />)}
                </ul>
                <p className="kv-redup">Angka bulat terdekat: {kartu.level.angka_bulat.map((x) => angka.format(x)).join(' · ')}</p>
              </section>
            </div>
          </div>
        )}

        <footer className="kv-kaki">
          <p>Informasi edukatif, bukan ajakan membeli atau menjual.</p>
          <p>Grafik: <a href="https://www.tradingview.com/" target="_blank" rel="noopener noreferrer">TradingView Lightweight Charts</a></p>
        </footer>
      </main>
    </div>
  )
}
