import { useEffect, useMemo, useState } from 'react'
import { muatOhlcv, type BarHarga } from '../../../lib/dasbor/neoPapanData'
import { musimanHari, musimanBulan, type StatMusiman } from '../../../lib/dasbor/neoPapan'
import { num, pct, Kosong, Sumber } from './bersama'

const HARI = ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat']
const BULAN = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des']

function warnaSel(v: number | null, jenis: 'naik' | 'turun' | 'exp'): string {
  if (v == null) return ''
  const a = jenis === 'exp' ? Math.min(1, Math.abs(v) / 3) : Math.min(1, (v - 50) / 30)
  if (a <= 0) return ''
  const rgb = jenis === 'turun' || (jenis === 'exp' && v < 0) ? '230,99,90' : '56,183,126'
  return `rgba(${rgb},${(0.12 + a * 0.4).toFixed(2)})`
}

function Tabel({ judul, label, stat }: { judul: string; label: string[]; stat: StatMusiman[] }) {
  return (
    <div className="panel panel-b">
      <h3 style={{ marginTop: 0 }}>{judul}</h3>
      <div className="tbl">
        <table>
          <thead><tr><th></th>{label.map((l) => <th key={l} className="r">{l}</th>)}</tr></thead>
          <tbody>
            <tr><td>naik</td>{stat.map((s, i) => <td key={i} className="r" style={{ background: warnaSel(s.naikPersen, 'naik') }}>{s.naikPersen == null ? '—' : num(s.naikPersen, 1) + '%'}</td>)}</tr>
            <tr><td>turun</td>{stat.map((s, i) => <td key={i} className="r" style={{ background: warnaSel(s.turunPersen, 'turun') }}>{s.turunPersen == null ? '—' : num(s.turunPersen, 1) + '%'}</td>)}</tr>
            <tr><td>ekspektasi</td>{stat.map((s, i) => <td key={i} className="r" style={{ background: warnaSel(s.ekspektasiPersen, 'exp') }}>{s.ekspektasiPersen == null ? '—' : pct(s.ekspektasiPersen)}</td>)}</tr>
            <tr><td>n</td>{stat.map((s, i) => <td key={i} className="r">{s.n}</td>)}</tr>
          </tbody>
        </table>
      </div>
    </div>
  )
}

/** Seasonality — pola return hari kerja & bulan kalender, 12 tahun terakhir. */
export function SeasonTab({ kode }: { kode: string }) {
  const [bars, setBars] = useState<BarHarga[] | null | undefined>(undefined)

  useEffect(() => {
    let batal = false
    setBars(undefined)
    muatOhlcv(kode).then((d) => { if (!batal) setBars(d) })
    return () => { batal = true }
  }, [kode])

  const statHari = useMemo(() => (bars ? musimanHari(bars) : []), [bars])
  const statBulan = useMemo(() => (bars ? musimanBulan(bars) : []), [bars])

  if (bars === undefined) return <Kosong>Memuat…</Kosong>
  if (!bars || bars.length < 2) return <Kosong>Riwayat harga emiten ini belum ada di arsip.</Kosong>

  return (
    <section>
      <div className="panel panel-b">
        <h2>{kode} — Seasonality</h2>
        <p className="np-sub">
          naik/turun = persentase periode dengan return positif/negatif; ekspektasi = rata-rata return.
          Data {bars[0].t} → {bars[bars.length - 1].t}, dipotong ke 12 tahun terakhir.
        </p>
      </div>
      <div className="np-2kol">
        <Tabel judul="Pola hari kerja" label={HARI} stat={statHari} />
        <Tabel judul="Pola bulan" label={BULAN} stat={statBulan} />
      </div>
      <Sumber>Dihitung dari arsip harga Stockbit — hari: return harian per hari kerja; bulan: return penutupan akhir bulan.</Sumber>
    </section>
  )
}
