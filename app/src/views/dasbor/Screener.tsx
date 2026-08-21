import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { IkonMenu, IKON_CARI, IKON_PERINGATAN } from '../../components/dasbor/IkonMenu'
import { useUrut } from '../../lib/dasbor/useUrut'
import { useLayarSempit } from '../../lib/dasbor/useLayarSempit'
import { fp } from '../../lib/dasbor/format'
import { fRingkas } from '../../lib/dasbor/stockDetailFormat'
import { keFraksi } from '../../lib/fraksiHarga'
import { MOMENTUM_HARI } from '../../lib/dasbor/skorTeknikal'
import { LABEL_POLA_KLASIK } from '../../lib/dasbor/polaKlasik'
import {
  useScreener, usePolaScreener, saring, sektorUnik, kelasSss, kelasArah, kelasPosisi, kelasPolaArah,
  fDec, ringkasLembarBertanda, labelPolaSingkat, LABEL_SSS, type BarisScreener, type PolaAktifScreener,
} from '../../lib/dasbor/screener'
import './Screener.css'

/** Baris screener + pola aktif digabung dari `pola_screener.json` (berkas
 *  terpisah, lihat `screener.ts`) — `pola_arah` cuma untuk sort kolom Pola
 *  lewat mekanisme teks yang sudah ada (`bandingkanBaris`), `pola` untuk
 *  tampilan sel. */
type BarisGab = BarisScreener & { pola: PolaAktifScreener | null; pola_arah: 'bullish' | 'bearish' | null }

type UrutState = { kunci: keyof BarisGab; arah: 'naik' | 'turun'; klik: (k: keyof BarisGab) => void }

/** Judul kolom yang bisa diklik untuk mengurutkan — pola sama TopStocks.tsx/
 *  KartuAnalisa.tsx, disalin bukan diimpor karena `keyof`-nya beda tiap tabel. */
function thSort(s: UrutState, k: keyof BarisGab, label: string, kanan = false) {
  const aktif = s.kunci === k
  return (
    <th className={kanan ? 'r' : undefined}>
      <button type="button" className="th-sort" onClick={() => s.klik(k)}>
        {label}{aktif ? (s.arah === 'naik' ? ' ▲' : ' ▼') : ''}
      </button>
    </th>
  )
}

/** Teks berwarna, BUKAN lencana berlatar — 962 baris × label berlatar penuh
 *  terbaca seperti papan peringatan. `kuat` menebalkan Strong Buy/Strong Sell
 *  lewat elemen <b>, bukan warna kedua. */
function LabelBerwarna({ teks, warna, kuat }: { teks: string; warna: 'up' | 'dn' | ''; kuat: boolean }) {
  const cls = warna || undefined
  return kuat ? <b className={cls}>{teks}</b> : <span className={cls}>{teks}</span>
}

function Panah({ posisi, label }: { posisi: 'atas' | 'bawah' | null; label: string }) {
  if (posisi == null) return <span className="muted">—</span>
  return (
    <span className={kelasPosisi(posisi)} title={`${label}: ${posisi === 'atas' ? 'di atas' : 'di bawah'}`}>
      {posisi === 'atas' ? '▲' : '▼'}
    </span>
  )
}

/**
 * Screener (`/screener`, backlog B31) — satu baris per emiten (962), seluruh
 * ruas `data-idx/json/screener.json` sekaligus. Angkanya sudah dihitung di
 * sisi Python (`scripts/riset/screener.py` — TIDAK dihitung ulang di sini);
 * berkas ini cuma saring/urut/format, lewat `lib/dasbor/screener.ts` supaya
 * logikanya bisa diuji tanpa merender React.
 *
 * 962 baris × 21 kolom sekaligus terlalu berat untuk DOM — dibatasi 100 baris
 * (25 di layar sempit) sesudah urut/saring, dengan tombol "tampilkan lebih
 * banyak", pola sama `TabelScreenerKartu` di KartuAnalisa.tsx.
 */
export function Screener() {
  const data = useScreener()
  const polaData = usePolaScreener()
  const sempit = useLayarSempit()
  const [cari, setCari] = useState('')
  const [sssAktif, setSssAktif] = useState<string[]>([])
  const [sektorAktif, setSektorAktif] = useState<string[]>([])
  const [berpolaAktif, setBerpolaAktif] = useState(false)
  const ukuranHalaman = sempit ? 25 : 100
  const [tampil, setTampil] = useState(ukuranHalaman)

  // Gabung baris screener + pola aktif per kode — dua berkas terpisah
  // (`screener.json` dari Python, `pola_screener.json` dari mesin pola),
  // digabung di sini supaya `saring`/`useUrut` tak perlu tahu soal pola sama
  // sekali.
  const baris = useMemo<BarisGab[]>(() => {
    const rows = data?.emiten ?? []
    return rows.map((b) => {
      const p = polaData?.d[b.kode] ?? null
      return { ...b, pola: p, pola_arah: p ? p[1] : null }
    })
  }, [data, polaData])
  const daftarSektor = useMemo(() => sektorUnik(baris), [baris])

  // Jumlah emiten per chip, untuk `title` — menjawab "sektor ini isinya
  // berapa" tanpa harus mengekliknya. Dihitung dari SELURUH baris, bukan
  // hasil saringan: title yang ikut menyusut saat difilter cuma membingungkan.
  const jumlahSss = useMemo(() => {
    const m = new Map<string, number>()
    for (const b of baris) { if (b.sss_d) m.set(b.sss_d, (m.get(b.sss_d) ?? 0) + 1) }
    return m
  }, [baris])
  const jumlahSektor = useMemo(() => {
    const m = new Map<string, number>()
    for (const b of baris) m.set(b.sektor, (m.get(b.sektor) ?? 0) + 1)
    return m
  }, [baris])
  const hasilSaring = useMemo(() => saring(baris, sssAktif, sektorAktif, cari), [baris, sssAktif, sektorAktif, cari])
  const hasil = useMemo(
    () => (berpolaAktif ? hasilSaring.filter((b) => b.pola_arah != null) : hasilSaring),
    [hasilSaring, berpolaAktif],
  )
  const s = useUrut<BarisGab>(hasil, 'kode', 'naik')

  // Saringan/cari baru = mulai dari halaman pertama lagi, bukan menyambung
  // dari batas lama (bisa lebih besar dari hasil baru).
  useEffect(() => { setTampil(ukuranHalaman) }, [sssAktif, sektorAktif, cari, berpolaAktif, ukuranHalaman])

  function toggleSss(label: string) {
    setSssAktif((a) => (a.includes(label) ? a.filter((x) => x !== label) : [...a, label]))
  }
  function toggleSektor(sek: string) {
    setSektorAktif((a) => (a.includes(sek) ? a.filter((x) => x !== sek) : [...a, sek]))
  }

  if (!data) {
    return (
      <div className="lantai">
        <div className="vhead"><h1>Screener</h1></div>
        <div className="panel panel-b" style={{ textAlign: 'center', padding: '40px 20px' }}>
          <p><IkonMenu d={IKON_PERINGATAN} size={28} /></p>
          <p className="lbl">Memuat data screener…</p>
        </div>
      </div>
    )
  }

  const tampilBaris = s.urut.slice(0, tampil)
  const sisa = s.urut.length - tampilBaris.length

  return (
    <div className="lantai">
      <div className="vhead">
        <div>
          <h1>Screener</h1>
          <span className="sub">{data.n} emiten, satu baris per emiten — saring, urutkan, cari.</span>
        </div>
      </div>

      <div className="panel">
        <div className="panel-b scr-alat">
          <span className="af-cari scr-cari">
            <IkonMenu d={IKON_CARI} size={13} />
            <input
              className="inp" type="search" placeholder="Cari kode atau nama…" value={cari}
              onChange={(e) => setCari(e.target.value)}
            />
          </span>
          {/* Bilah saring dirombak 21 Agu 2026 — Johan menanyakan chip "-"
              ("fungsi ini apa ya?") lalu "biking bingung... perlu di re
              imagined". Akar bingungnya dua: deret chip tanpa NAMA KELOMPOK
              (tak terbaca mana rating mana sektor), dan chip "-" yang tak
              menjelaskan dirinya. Jawabannya label kelompok + nama yang
              bicara + tombol hapus — bukan dropdown yang menyembunyikan
              pilihan. */}
          <div className="scr-saring">
            <span className="scr-saring-lbl">Rating</span>
            <div className="scr-chips">
              {LABEL_SSS.map((lbl) => (
                <button
                  key={lbl} type="button"
                  className={`chip-t${sssAktif.includes(lbl) ? ' on' : ''}`}
                  title={`${jumlahSss.get(lbl) ?? 0} emiten`}
                  onClick={() => toggleSss(lbl)}
                >
                  {lbl}
                </button>
              ))}
            </div>
          </div>
          <div className="scr-saring">
            <span className="scr-saring-lbl">Sektor</span>
            <div className="scr-chips">
              {daftarSektor.map((sek) => (
                <button
                  key={sek} type="button"
                  className={`chip-t${sektorAktif.includes(sek) ? ' on' : ''}`}
                  title={sek === '-'
                    ? `${jumlahSektor.get(sek) ?? 0} emiten belum terklasifikasi IDX-IC — kebanyakan emiten suspensi/bermasalah yang tak masuk peta sektor resmi`
                    : `${jumlahSektor.get(sek) ?? 0} emiten`}
                  onClick={() => toggleSektor(sek)}
                >
                  {sek === '-' ? 'Tanpa sektor' : sek}
                </button>
              ))}
            </div>
          </div>
          <div className="scr-saring">
            <span className="scr-saring-lbl">Pola</span>
            <div className="scr-chips">
              <button
                type="button"
                className={`chip-t${berpolaAktif ? ' on' : ''}`}
                title="Hanya emiten dengan pola chart klasik yang sedang menunggu target"
                onClick={() => setBerpolaAktif((v) => !v)}
              >
                Berpola aktif
              </button>
            </div>
          </div>
          <div className="scr-saring scr-saring-kaki">
            {/* Hitungan duduk TEPAT di bawah chip-nya: ubah saringan, angkanya
                berubah di tempat mata sedang berada — bukan di ujung bilah. */}
            <span className="muted scr-jumlah">{hasil.length} dari {baris.length} emiten lolos</span>
            {(sssAktif.length > 0 || sektorAktif.length > 0 || berpolaAktif || cari.trim() !== '') && (
              <button
                type="button" className="chip-t scr-reset"
                onClick={() => { setSssAktif([]); setSektorAktif([]); setBerpolaAktif(false); setCari('') }}
              >
                ✕ Hapus semua saringan
              </button>
            )}
          </div>
        </div>

        <div className="board-tbl-wrap">
          <table className="tbl scr-tbl">
            <thead>
              <tr>
                {thSort(s, 'kode', 'Kode')}
                {thSort(s, 'nama', 'Nama')}
                {thSort(s, 'sektor', 'Sektor')}
                {thSort(s, 'harga', 'Harga', true)}
                {thSort(s, 'tdm_persen', `TDM% ${MOMENTUM_HARI}H`, true)}
                {thSort(s, 'volume', 'Volume', true)}
                {thSort(s, 'rvol10', 'RVol10', true)}
                {thSort(s, 'nilai', 'Nilai', true)}
                {thSort(s, 'sss_d', 'SSS D')}
                {thSort(s, 'sss_w', 'SSS W')}
                {thSort(s, 'sss_m', 'SSS M')}
                {thSort(s, 'free_float', 'Free Float', true)}
                {thSort(s, 'ma20_arah', 'Arah MA20')}
                {thSort(s, 'close_gap', 'Close Gap', true)}
                {thSort(s, 'chg_1d', '%chg 1D', true)}
                {thSort(s, 'chg_wtd', '%chg WTD', true)}
                {thSort(s, 'chg_mtd', '%chg MTD', true)}
                {thSort(s, 'posisi_ema5', 'vs EMA5')}
                {thSort(s, 'posisi_ma10', 'vs MA10')}
                {thSort(s, 'posisi_ma20', 'vs MA20')}
                {thSort(s, 'net_asing_lembar', 'Net Asing', true)}
                {thSort(s, 'pola_arah', 'Pola')}
              </tr>
            </thead>
            <tbody>
              {tampilBaris.map((b) => <BarisScreenerTbl key={b.kode} b={b} tanggalData={data?.tanggal ?? null} />)}
            </tbody>
          </table>
        </div>

        {tampilBaris.length === 0 && (
          <p className="muted" style={{ padding: '10px 14px' }}>Tak ada emiten cocok dengan saringan/kata cari ini.</p>
        )}

        {sisa > 0 && (
          <div className="scr-lebih">
            <button type="button" className="btn-p" onClick={() => setTampil((t) => t + ukuranHalaman)}>
              Tampilkan {Math.min(sisa, ukuranHalaman)} lagi
            </button>
          </div>
        )}
      </div>

      <div className="asal">
        Data <b>{data.tanggal}</b> · <b>{data.n}</b> emiten · diperbarui {data.diperbarui}. <b>Net Asing</b> dalam{' '}
        <b>lembar</b>, bukan rupiah — IDX tidak melaporkan aliran asing dalam rupiah. <b>TDM%</b> adalah perubahan
        harga {MOMENTUM_HARI} hari bursa terakhir. Skor SSS D/W/M menyajikan keadaan, <b>bukan saran beli atau
        jual</b>. Kolom <b>Pola</b> adalah deskripsi bentuk chart, bukan sinyal beli — backtest sapuan penuh 915
        emiten menunjukkan sebagian besar pola klasik TIDAK mengungguli peluang dasar (rincian di halaman Grafik).
      </div>
    </div>
  )
}

/** Sel kolom Pola — label singkat + panah arah, atau "—" tanpa pola aktif.
 *  `title` bawa keterangan penuh (label lengkap, arah, tanggal sinyal,
 *  target) supaya potongan label singkat tak membuang informasi. */
function SelPola({ p, tanggalData }: { p: PolaAktifScreener | null; tanggalData: string | null }) {
  if (!p) return <span className="muted">—</span>
  const [nama, arah, tanggal, target] = p
  // Usia sinyal IKUT TAMPAK begitu melewati ±sebulan bursa — audit 21 Agu
  // (#5): tanpa ini pola dua bulan lalu dan pola kemarin terlihat persis
  // sama, dan tanggal yang cuma hidup di tooltip tak menolong pembaca cepat.
  const usiaHari = tanggalData
    ? Math.round((Date.parse(tanggalData) - Date.parse(tanggal)) / 86_400_000)
    : null
  return (
    <span
      className={kelasPolaArah(arah)}
      title={`${LABEL_POLA_KLASIK[nama]} (${arah}) — sinyal ${tanggal}, target ${target.toLocaleString('id-ID')}`}
    >
      {labelPolaSingkat(nama)} {arah === 'bullish' ? '▲' : '▼'}
      {usiaHari !== null && usiaHari > 30 && <span className="muted"> ±{Math.round(usiaHari / 7)}mgg</span>}
    </span>
  )
}

/** Satu baris tabel — dipisah dari `Screener()` supaya badan fungsi utama
 *  tetap terbaca; tak ada state sendiri di sini (beda dari BarisWatchlist). */
function BarisScreenerTbl({ b, tanggalData }: { b: BarisGab; tanggalData: string | null }) {
  const sss = (v: BarisScreener['sss_d']) => (v == null
    ? <span className="muted">—</span>
    : <LabelBerwarna teks={v} {...kelasSss(v)} />)

  return (
    <tr>
      <td><Link to={`/grafik?kode=${b.kode}`} className="tick">{b.kode}</Link></td>
      <td className="scr-nama" title={b.nama}>{b.nama}</td>
      <td>{b.sektor}</td>
      <td className="r num">
        {b.harga == null ? '—' : keFraksi(b.harga, 'dekat').toLocaleString('id-ID')}
      </td>
      <td className={`r num ${b.tdm_persen == null ? '' : b.tdm_persen >= 0 ? 'up' : 'dn'}`}>
        {b.tdm_persen == null ? '—' : fp(b.tdm_persen)}
      </td>
      <td className="r num" title={b.volume == null ? undefined : `${b.volume.toLocaleString('id-ID')} lembar`}>
        {b.volume == null ? '—' : fRingkas(b.volume)}
      </td>
      <td className="r num">{b.rvol10 == null ? '—' : `${fDec(b.rvol10)}×`}</td>
      <td className="r num" title={b.nilai == null ? undefined : `Rp${b.nilai.toLocaleString('id-ID')}`}>
        {b.nilai == null ? '—' : `Rp${fRingkas(b.nilai)}`}
      </td>
      <td>{sss(b.sss_d)}</td>
      <td>{sss(b.sss_w)}</td>
      <td>{sss(b.sss_m)}</td>
      <td className="r num">{b.free_float == null ? '—' : `${fDec(b.free_float)}%`}</td>
      <td className={kelasArah(b.ma20_arah)}>
        {b.ma20_arah == null ? <span className="muted">—</span> : b.ma20_arah}
      </td>
      {/* Close Gap = PERSEN, dan bertanda — audit 21 Agu (#3): dirender
          angka polos ia satu-satunya kolom persen yang tak bisa dibaca
          arah maupun satuannya sekilas. Format sama dengan %chg di kanan. */}
      <td className={`r num ${b.close_gap == null ? '' : b.close_gap > 0 ? 'up' : b.close_gap < 0 ? 'dn' : ''}`}>
        {b.close_gap == null ? '—' : fp(b.close_gap)}
      </td>
      <td className={`r num ${b.chg_1d == null ? '' : b.chg_1d >= 0 ? 'up' : 'dn'}`}>
        {b.chg_1d == null ? '—' : fp(b.chg_1d)}
      </td>
      <td className={`r num ${b.chg_wtd == null ? '' : b.chg_wtd >= 0 ? 'up' : 'dn'}`}>
        {b.chg_wtd == null ? '—' : fp(b.chg_wtd)}
      </td>
      <td className={`r num ${b.chg_mtd == null ? '' : b.chg_mtd >= 0 ? 'up' : 'dn'}`}>
        {b.chg_mtd == null ? '—' : fp(b.chg_mtd)}
      </td>
      <td className="r"><Panah posisi={b.posisi_ema5} label="vs EMA5" /></td>
      <td className="r"><Panah posisi={b.posisi_ma10} label="vs MA10" /></td>
      <td className="r"><Panah posisi={b.posisi_ma20} label="vs MA20" /></td>
      <td
        className={`r num ${b.net_asing_lembar == null ? '' : b.net_asing_lembar >= 0 ? 'up' : 'dn'}`}
        title={b.net_asing_lembar == null ? undefined : `${b.net_asing_lembar.toLocaleString('id-ID')} lembar`}
      >
        {ringkasLembarBertanda(b.net_asing_lembar)}
      </td>
      <td><SelPola p={b.pola} tanggalData={tanggalData} /></td>
    </tr>
  )
}
