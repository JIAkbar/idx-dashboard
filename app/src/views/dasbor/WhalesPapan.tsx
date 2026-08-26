import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { StockAutocomplete } from '../../components/dasbor/StockAutocomplete'
import { CatatanCakupan } from '../../components/dasbor/CatatanCakupan'
import { LencanaBeku, tidakDiperdagangkan } from '../../components/dasbor/LencanaBeku'
import { useStockIndex } from '../../lib/dasbor/stockDetailData'
import { useBrokerTahunan } from '../../lib/dasbor/brokerTahunanData'
import { useRingkasKartu } from '../../lib/dasbor/kartuRingkas'
import { warnaBrokerCanvas } from '../../lib/dasbor/kelompokBroker'
import {
  agregatArea, batasKanvas, profilHarga, saringSignifikan,
  type RingkasBroker, type SeleksiArea,
} from '../../lib/dasbor/whalesPapan'
import './WhalesPapan.css'

/**
 * Whales Papan — kanvas jejak bandar harian.
 *
 * Bentuknya dipetik dari whales.id (audit `docs/riset/whales-bongkar.md`),
 * datanya milik kita sendiri. Seret persegi di kanvas → panel kanan memecah
 * siapa menampung dan siapa melepas di rentang harga × waktu itu.
 *
 * Kanvas 2D mentah, BUKAN `lightweight-charts` seperti Grafik Emiten. Alasan:
 * yang dibutuhkan di sini seret-pilih dua dimensi di atas sebaran titik,
 * bukan deret lilin dengan sumbu waktu yang dikelola pustaka. Memaksakan
 * pustaka itu berarti melawan model interaksinya untuk hal yang di kanvas
 * mentah cuma ±40 baris.
 */

const PANEL_AWAL = 8

function rupiahRingkas(n: number): string {
  const a = Math.abs(n)
  if (a >= 1e12) return `${(n / 1e12).toFixed(2)} T`
  if (a >= 1e9) return `${(n / 1e9).toFixed(2)} M`
  if (a >= 1e6) return `${(n / 1e6).toFixed(1)} jt`
  return n.toLocaleString('id-ID')
}
function lotRingkas(n: number): string {
  const a = Math.abs(n)
  if (a >= 1e6) return `${(n / 1e6).toFixed(2)} jt`
  if (a >= 1e3) return `${(n / 1e3).toFixed(1)}rb`
  return String(Math.round(n))
}

interface Kotak { x0: number; y0: number; x1: number; y1: number }

export default function WhalesPapan() {
  const { index: indeks } = useStockIndex()
  const [ketik, setKetik] = useState('BUMI')
  const [kode, setKode] = useState('BUMI')
  const { hari, tahunAda, muat, galat } = useBrokerTahunan(kode)

  const ringkasKartu = useRingkasKartu()
  const barisKartu = useMemo(
    () => ringkasKartu?.emiten.find((b) => b.kode === kode) ?? null,
    [ringkasKartu, kode],
  )

  const [sel, setSel] = useState<SeleksiArea | null>(null)
  const [seret, setSeret] = useState<Kotak | null>(null)
  // Empat kuadran, empat batas "tampilkan lagi" — memperluas satu tak boleh
  // ikut memperluas yang lain, keduanya baris broker tapi peringkat berbeda.
  const [batasGrossBeli, setBatasGrossBeli] = useState(PANEL_AWAL)
  const [batasGrossJual, setBatasGrossJual] = useState(PANEL_AWAL)
  const [batasNetBeli, setBatasNetBeli] = useState(PANEL_AWAL)
  const [batasNetJual, setBatasNetJual] = useState(PANEL_AWAL)
  // Significant (default, pola whales.id) menyembunyikan broker recehan lewat
  // AMBANG_SIGNIFIKAN; Full menampilkan semua yang pernah bertransaksi.
  const [modeBaris, setModeBaris] = useState<'signifikan' | 'penuh'>('signifikan')

  const kanvasRef = useRef<HTMLCanvasElement | null>(null)
  const bungkusRef = useRef<HTMLDivElement | null>(null)

  const resetBatas = () => {
    setBatasGrossBeli(PANEL_AWAL)
    setBatasGrossJual(PANEL_AWAL)
    setBatasNetBeli(PANEL_AWAL)
    setBatasNetJual(PANEL_AWAL)
  }

  // Ganti emiten = buang seleksi lama. Tanpa ini, kotak yang diseret di
  // emiten sebelumnya tetap hidup dan panelnya memecah broker pada rentang
  // harga milik saham LAIN — angkanya sah, kepalanya berbohong.
  useEffect(() => {
    setSel(null)
    resetBatas()
  }, [kode])

  const batas = useMemo(() => batasKanvas(hari), [hari])
  const profil = useMemo(() => profilHarga(hari, 28), [hari])
  const hasil = useMemo(() => (sel ? agregatArea(hari, sel) : null), [hari, sel])

  // ── menggambar ───────────────────────────────────────────────────────────
  const gambar = useCallback(() => {
    const cv = kanvasRef.current
    const bungkus = bungkusRef.current
    if (!cv || !bungkus || !batas) return

    // Clamp + round, pola acuan `bandingEmiten.ts` — dpr mentah tanpa clamp
    // berisiko kanvas raksasa di layar DPR tinggi (temuan audit chart 26 Agu;
    // versi pertama berkas ini memakai dpr mentah).
    const dpr = Math.min(3, Math.max(1, Math.round(window.devicePixelRatio || 1)))
    const lebarCss = bungkus.clientWidth
    const tinggiCss = Math.max(320, Math.min(560, Math.round(lebarCss * 0.52)))
    if (cv.width !== Math.round(lebarCss * dpr) || cv.height !== Math.round(tinggiCss * dpr)) {
      cv.width = Math.round(lebarCss * dpr)
      cv.height = Math.round(tinggiCss * dpr)
      cv.style.height = `${tinggiCss}px`
    }
    const ctx = cv.getContext('2d')
    if (!ctx) return
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.clearRect(0, 0, lebarCss, tinggiCss)

    const gaya = getComputedStyle(cv)
    const c = (v: string, cad: string) => (gaya.getPropertyValue(v) || '').trim() || cad
    const warnaGaris = c('--line', '#24262E')
    const warnaTeks3 = c('--text3', '#888D99')
    const warnaTeks2 = c('--text2', '#9CA0AC')
    const warnaAksen = c('--accent', '#F2C230')

    const padKiri = 52, padKanan = 78, padAtas = 12, padBawah = 26
    const plotW = lebarCss - padKiri - padKanan
    const plotH = tinggiCss - padAtas - padBawah
    if (plotW <= 10 || plotH <= 10) return

    const berharga = hari.filter((h) => h.avg != null)
    const t0 = new Date(batas.tglMulai).getTime()
    const t1 = new Date(batas.tglAkhir).getTime()
    const rentangT = Math.max(1, t1 - t0)
    const xDari = (tgl: string) => padKiri + ((new Date(tgl).getTime() - t0) / rentangT) * plotW
    const yDari = (h: number) =>
      padAtas + plotH - ((h - batas.hargaMin) / (batas.hargaMax - batas.hargaMin)) * plotH

    // kisi + sumbu harga
    ctx.font = '10px ui-monospace, monospace'
    ctx.textBaseline = 'middle'
    ctx.textAlign = 'right'
    for (let i = 0; i <= 5; i++) {
      const harga = batas.hargaMin + ((batas.hargaMax - batas.hargaMin) * i) / 5
      const y = yDari(harga)
      ctx.strokeStyle = warnaGaris
      ctx.lineWidth = 1
      ctx.beginPath(); ctx.moveTo(padKiri, y + 0.5); ctx.lineTo(padKiri + plotW, y + 0.5); ctx.stroke()
      ctx.fillStyle = warnaTeks3
      ctx.fillText(Math.round(harga).toLocaleString('id-ID'), padKiri - 7, y)
    }

    // sumbu tanggal
    ctx.textAlign = 'center'
    const nLabel = Math.max(2, Math.min(6, Math.floor(plotW / 110)))
    for (let i = 0; i <= nLabel; i++) {
      const ts = t0 + (rentangT * i) / nLabel
      const d = new Date(ts)
      const x = padKiri + (plotW * i) / nLabel
      ctx.fillStyle = warnaTeks3
      ctx.fillText(
        d.toLocaleDateString('id-ID', { month: 'short', year: '2-digit' }),
        Math.min(padKiri + plotW - 18, Math.max(padKiri + 18, x)),
        tinggiCss - padBawah / 2,
      )
    }

    // profil harga di kanan — padanan harian "market profile"
    const lotMaks = Math.max(1, ...profil.map((p) => p.lot))
    for (const p of profil) {
      const yA = yDari(p.hargaAtas)
      const yB = yDari(p.hargaBawah)
      const w = (p.lot / lotMaks) * (padKanan - 16)
      if (w < 0.5) continue
      ctx.fillStyle = warnaGaris
      ctx.fillRect(padKiri + plotW + 6, yA, w, Math.max(1, yB - yA - 1))
    }
    ctx.textAlign = 'left'
    ctx.fillStyle = warnaTeks3
    ctx.fillText('lot', padKiri + plotW + 6, padAtas + 6)

    // titik harian — jari-jari mengikuti lot, warna kelompok broker terbesar
    for (const h of berharga) {
      const x = xDari(h.tanggal)
      const y = yDari(h.avg as number)
      const terbesar = h.broker.reduce<[string, number]>(
        (m, b) => (Math.abs(b[1] - b[3]) > m[1] ? [b[0], Math.abs(b[1] - b[3])] : m),
        ['', 0],
      )[0]
      const r = Math.max(1.4, Math.min(4.5, Math.sqrt(h.totalLot) / 60))
      ctx.fillStyle = terbesar ? warnaBrokerCanvas(terbesar) : warnaTeks3
      ctx.globalAlpha = 0.75
      ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill()
      ctx.globalAlpha = 1
    }

    // kotak seleksi
    const kotak = seret ?? (sel && batas ? {
      x0: xDari(sel.tglMulai), y0: yDari(sel.hargaMax),
      x1: xDari(sel.tglAkhir), y1: yDari(sel.hargaMin),
    } : null)
    if (kotak) {
      const x = Math.min(kotak.x0, kotak.x1), y = Math.min(kotak.y0, kotak.y1)
      const w = Math.abs(kotak.x1 - kotak.x0), h = Math.abs(kotak.y1 - kotak.y0)
      ctx.fillStyle = warnaAksen
      ctx.globalAlpha = 0.14
      ctx.fillRect(x, y, w, h)
      ctx.globalAlpha = 1
      ctx.strokeStyle = warnaAksen
      ctx.lineWidth = 1.5
      ctx.setLineDash([5, 3])
      ctx.strokeRect(x + 0.5, y + 0.5, w, h)
      ctx.setLineDash([])
    }

    if (!sel && !seret) {
      ctx.textAlign = 'center'
      ctx.fillStyle = warnaTeks2
      ctx.font = '11px ui-monospace, monospace'
      ctx.fillText('seret persegi untuk memilih rentang harga × waktu', padKiri + plotW / 2, padAtas + 16)
    }
  }, [batas, hari, profil, sel, seret])

  useEffect(() => { gambar() }, [gambar])
  useEffect(() => {
    const r = () => gambar()
    window.addEventListener('resize', r)
    return () => window.removeEventListener('resize', r)
  }, [gambar])

  // ── seret memilih ────────────────────────────────────────────────────────
  const posisi = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const r = e.currentTarget.getBoundingClientRect()
    return { x: e.clientX - r.left, y: e.clientY - r.top }
  }
  const keSeleksi = (k: Kotak): SeleksiArea | null => {
    const cv = kanvasRef.current
    if (!cv || !batas) return null
    const lebarCss = cv.clientWidth
    const tinggiCss = cv.clientHeight
    const padKiri = 52, padKanan = 78, padAtas = 12, padBawah = 26
    const plotW = lebarCss - padKiri - padKanan
    const plotH = tinggiCss - padAtas - padBawah
    const t0 = new Date(batas.tglMulai).getTime()
    const t1 = new Date(batas.tglAkhir).getTime()
    const iso = (x: number) => {
      const f = Math.min(1, Math.max(0, (x - padKiri) / plotW))
      return new Date(t0 + (t1 - t0) * f).toISOString().slice(0, 10)
    }
    const harga = (y: number) => {
      const f = Math.min(1, Math.max(0, (padAtas + plotH - y) / plotH))
      return batas.hargaMin + (batas.hargaMax - batas.hargaMin) * f
    }
    return {
      tglMulai: iso(Math.min(k.x0, k.x1)),
      tglAkhir: iso(Math.max(k.x0, k.x1)),
      hargaMin: harga(Math.max(k.y0, k.y1)),
      hargaMax: harga(Math.min(k.y0, k.y1)),
    }
  }

  const onDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!batas) return
    e.currentTarget.setPointerCapture(e.pointerId)
    const p = posisi(e)
    setSeret({ x0: p.x, y0: p.y, x1: p.x, y1: p.y })
  }
  const onMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!seret) return
    const p = posisi(e)
    setSeret((s) => (s ? { ...s, x1: p.x, y1: p.y } : s))
  }
  const onUp = () => {
    if (!seret) return
    // Seret sangat kecil dianggap klik, bukan seleksi — kalau tidak, satu
    // ketukan tak sengaja akan mengosongkan panel tanpa sebab yang terlihat.
    const cukup = Math.abs(seret.x1 - seret.x0) > 6 && Math.abs(seret.y1 - seret.y0) > 6
    if (cukup) {
      const s = keSeleksi(seret)
      if (s) { setSel(s); resetBatas() }
    }
    setSeret(null)
  }

  // `nilai` memilih ruas dipakai untuk lebar bar & urutan; `nilaiRp` ruas Rp
  // dicetak di sebelahnya — beda per kuadran (gross pakai beliNilai/jualNilai
  // sisi itu sendiri, net pakai netNilai).
  const daftar = (
    baris: RingkasBroker[],
    batasTampil: number,
    setBatas: (n: number) => void,
    nilai: (r: RingkasBroker) => number,
    nilaiRp: (r: RingkasBroker) => number,
  ) => {
    const maks = Math.max(1, ...baris.map((r) => Math.abs(nilai(r))))
    return baris.slice(0, batasTampil).map((r) => (
      <div className="wp-baris" key={r.kode}>
        <span className="wp-kode">{r.kode}</span>
        <span className="wp-bar" style={{ width: `${Math.max(4, (Math.abs(nilai(r)) / maks) * 100)}%` }} />
        <span className="wp-nilai">
          {lotRingkas(Math.abs(nilai(r)))} · Rp {rupiahRingkas(Math.abs(nilaiRp(r)))}
        </span>
      </div>
    )).concat(
      baris.length > batasTampil
        ? [
            <button key="lagi" type="button" className="wp-lagi" onClick={() => setBatas(baris.length)}>
              +{baris.length - batasTampil} broker lain
            </button>,
          ]
        : [],
    )
  }

  // Toggle Significant/Full: baris broker recehan disaring di mode Significant
  // (bawaan), ditampilkan semua di Full. Ambang & fungsinya di whalesPapan.ts
  // supaya bisa diuji tanpa render.
  const saring = (baris: RingkasBroker[], nilai: (r: RingkasBroker) => number) =>
    modeBaris === 'signifikan' ? saringSignifikan(baris, nilai) : baris

  return (
    <div className="lantai">
      <div className="vhead">
        <h1>Whales Papan</h1>
        <span className="sub">jejak bandar harian — pilih rentang harga &amp; waktu, lihat siapa menampung</span>
      </div>

      <CatatanCakupan />

      <div className="wp-atur">
        <div className="wp-emiten">
          <StockAutocomplete
            stocks={indeks?.stocks || []}
            value={ketik}
            onChange={setKetik}
            onSelect={(v) => { setKetik(v); setKode(v.toUpperCase()) }}
            placeholder="Cari emiten: BUMI, BBCA…"
          />
        </div>
        <strong>{kode}</strong>
        {tidakDiperdagangkan(barisKartu) && (
          <LencanaBeku beku={barisKartu?.beku} sejak={barisKartu?.beku_sejak} />
        )}
        {tahunAda.length > 0 && (
          <span className="muted" style={{ fontSize: 12 }}>
            {tahunAda[0]}–{tahunAda[tahunAda.length - 1]} · {hari.length.toLocaleString('id-ID')} hari
          </span>
        )}
        {muat && <span className="muted" style={{ fontSize: 12 }}>memuat…</span>}
        {sel && (
          <button type="button" className="btn-p wp-sisa" onClick={() => setSel(null)}>
            Hapus seleksi
          </button>
        )}
      </div>

      {galat === 'belum-ada' || galat === 'kosong' ? (
        <div className="wp-kosong">
          Riwayat broker bertahun untuk <strong>{kode}</strong> belum tersedia.
          <br />
          Data yang sudah tervalidasi baru sejak 2020, dan emiten ini belum masuk
          gelombang pengumpulannya.
        </div>
      ) : (
        <div className="wp-panggung">
          <div className="wp-kanvas-bungkus" ref={bungkusRef}>
            <canvas
              ref={kanvasRef}
              onPointerDown={onDown}
              onPointerMove={onMove}
              onPointerUp={onUp}
              onPointerCancel={onUp}
            />
          </div>

          <div className="wp-hasil">
            <h3>Hasil seleksi</h3>
            {hasil ? (
              <>
                <p className="wp-sub">
                  {hasil.nHari.toLocaleString('id-ID')} hari bursa · {hasil.nBroker} broker ·{' '}
                  {Math.round(sel!.hargaMin).toLocaleString('id-ID')}–
                  {Math.round(sel!.hargaMax).toLocaleString('id-ID')}
                </p>

                <div className="wp-toggle" role="group" aria-label="Baris broker">
                  <button type="button" className={`chip-t${modeBaris === 'signifikan' ? ' on' : ''}`}
                    aria-pressed={modeBaris === 'signifikan'}
                    title="Sembunyikan broker yang porsinya di bawah 1% dari sisi ini"
                    onClick={() => setModeBaris('signifikan')}>Significant</button>
                  <button type="button" className={`chip-t${modeBaris === 'penuh' ? ' on' : ''}`}
                    aria-pressed={modeBaris === 'penuh'}
                    title="Tampilkan semua broker yang bertransaksi"
                    onClick={() => setModeBaris('penuh')}>Full</button>
                </div>

                <div className="wp-kuadran">GROSS — tanpa dikurangi lawannya</div>
                <div className="wp-sisi wp-beli">
                  <div className="wp-sisi-judul">
                    <span>Gross Beli</span>
                    <span>+{lotRingkas(hasil.totalGrossBeliLot)} lot</span>
                  </div>
                  {(() => {
                    const b = saring(hasil.grossBeli, (r) => r.beliLot)
                    return b.length
                      ? daftar(b, batasGrossBeli, setBatasGrossBeli, (r) => r.beliLot, (r) => r.beliNilai)
                      : <p className="wp-sub">tak ada</p>
                  })()}
                </div>
                <div className="wp-sisi wp-jual">
                  <div className="wp-sisi-judul">
                    <span>Gross Jual</span>
                    <span>{lotRingkas(hasil.totalGrossJualLot)} lot</span>
                  </div>
                  {(() => {
                    const b = saring(hasil.grossJual, (r) => r.jualLot)
                    return b.length
                      ? daftar(b, batasGrossJual, setBatasGrossJual, (r) => r.jualLot, (r) => r.jualNilai)
                      : <p className="wp-sub">tak ada</p>
                  })()}
                </div>

                <div className="wp-kuadran">NET — beli dikurangi jual</div>
                <div className="wp-sisi wp-beli">
                  <div className="wp-sisi-judul">
                    <span>Net Beli</span>
                    <span>+{lotRingkas(hasil.totalNetBeliLot)} lot</span>
                  </div>
                  {(() => {
                    const b = saring(hasil.netBeli, (r) => r.netLot)
                    return b.length
                      ? daftar(b, batasNetBeli, setBatasNetBeli, (r) => r.netLot, (r) => r.netNilai)
                      : <p className="wp-sub">tak ada</p>
                  })()}
                </div>
                <div className="wp-sisi wp-jual">
                  <div className="wp-sisi-judul">
                    <span>Net Jual</span>
                    <span>{lotRingkas(hasil.totalNetJualLot)} lot</span>
                  </div>
                  {(() => {
                    const b = saring(hasil.netJual, (r) => r.netLot)
                    return b.length
                      ? daftar(b, batasNetJual, setBatasNetJual, (r) => r.netLot, (r) => r.netNilai)
                      : <p className="wp-sub">tak ada</p>
                  })()}
                </div>
              </>
            ) : (
              <p className="wp-sub">Seret persegi di kanvas untuk memilih rentang.</p>
            )}

            <div className="wp-batas">
              Empat kuadran di sini <strong>GROSS/NET</strong> (total transaksi vs. beli dikurangi
              jual), <strong>bukan</strong> agresif/pasif — sisi mana yang menyerang harga tak
              tersedia pada data harian.
              <br />
              Rentang harga menyaring <strong>hari yang harga rata-ratanya</strong> jatuh di situ,
              bukan lot yang tereksekusi persis di harga itu.
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
