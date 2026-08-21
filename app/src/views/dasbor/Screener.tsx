import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { IkonMenu, IKON_CARI, IKON_PERINGATAN } from '../../components/dasbor/IkonMenu'
import { useUrut } from '../../lib/dasbor/useUrut'
import { useLayarSempit } from '../../lib/dasbor/useLayarSempit'
import { fp } from '../../lib/dasbor/format'
import { fRingkas } from '../../lib/dasbor/stockDetailFormat'
import { keFraksi } from '../../lib/fraksiHarga'
import { MOMENTUM_HARI } from '../../lib/dasbor/skorTeknikal'
import {
  useScreener, saring, sektorUnik, kelasSss, kelasArah, kelasPosisi, fDec, ringkasLembarBertanda,
  LABEL_SSS, type BarisScreener,
} from '../../lib/dasbor/screener'
import './Screener.css'

type UrutState = { kunci: keyof BarisScreener; arah: 'naik' | 'turun'; klik: (k: keyof BarisScreener) => void }

/** Judul kolom yang bisa diklik untuk mengurutkan — pola sama TopStocks.tsx/
 *  KartuAnalisa.tsx, disalin bukan diimpor karena `keyof`-nya beda tiap tabel. */
function thSort(s: UrutState, k: keyof BarisScreener, label: string, kanan = false) {
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
  const sempit = useLayarSempit()
  const [cari, setCari] = useState('')
  const [sssAktif, setSssAktif] = useState<string[]>([])
  const [sektorAktif, setSektorAktif] = useState<string[]>([])
  const ukuranHalaman = sempit ? 25 : 100
  const [tampil, setTampil] = useState(ukuranHalaman)

  const baris = useMemo(() => data?.emiten ?? [], [data])
  const daftarSektor = useMemo(() => sektorUnik(baris), [baris])
  const hasil = useMemo(() => saring(baris, sssAktif, sektorAktif, cari), [baris, sssAktif, sektorAktif, cari])
  const s = useUrut<BarisScreener>(hasil, 'kode', 'naik')

  // Saringan/cari baru = mulai dari halaman pertama lagi, bukan menyambung
  // dari batas lama (bisa lebih besar dari hasil baru).
  useEffect(() => { setTampil(ukuranHalaman) }, [sssAktif, sektorAktif, cari, ukuranHalaman])

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
          <div className="scr-chips">
            {LABEL_SSS.map((lbl) => (
              <button
                key={lbl} type="button"
                className={`chip-t${sssAktif.includes(lbl) ? ' on' : ''}`}
                onClick={() => toggleSss(lbl)}
              >
                {lbl}
              </button>
            ))}
          </div>
          <div className="scr-chips">
            {daftarSektor.map((sek) => (
              <button
                key={sek} type="button"
                className={`chip-t${sektorAktif.includes(sek) ? ' on' : ''}`}
                onClick={() => toggleSektor(sek)}
              >
                {sek}
              </button>
            ))}
          </div>
          <span className="muted scr-jumlah">{hasil.length} dari {baris.length} emiten lolos</span>
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
              </tr>
            </thead>
            <tbody>
              {tampilBaris.map((b) => <BarisScreenerTbl key={b.kode} b={b} />)}
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
        jual</b>.
      </div>
    </div>
  )
}

/** Satu baris tabel — dipisah dari `Screener()` supaya badan fungsi utama
 *  tetap terbaca; tak ada state sendiri di sini (beda dari BarisWatchlist). */
function BarisScreenerTbl({ b }: { b: BarisScreener }) {
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
      <td className="r num">{fDec(b.close_gap)}</td>
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
    </tr>
  )
}
