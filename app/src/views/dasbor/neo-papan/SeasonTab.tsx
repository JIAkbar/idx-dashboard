import { useEffect, useMemo, useState } from 'react'
import { muatOhlcv, type BarHarga } from '../../../lib/dasbor/neoPapanData'
import { musimanHari, musimanBulan, type StatMusiman } from '../../../lib/dasbor/neoPapan'
import { PemilihRentang } from '../../../components/dasbor/PemilihRentang'
import { BadgeRapor } from '../../../components/dasbor/BadgeRapor'
import { ambilIndexBt, type RunBt } from '../../../lib/dasbor/raporBadge'
import { num, pct, Kosong, Sumber } from './bersama'
import { InfoIndikator, type ItemInfoIndikator } from '../../../components/dasbor/InfoIndikator'

/** Modal "i" — penjelasan kendali & sel tabel musiman (sweep Johan 27 Agu). */
const INFO_SEASON: ItemInfoIndikator[] = [
  { nama: 'Periode (tahun)', isi: 'Berapa tahun kalender arsip harga yang dipakai menghitung pola musiman. Kalau arsip emiten ini lebih pendek dari pilihan, jumlah tahun yang benar-benar terpakai jujur dikurangi (tertulis di bawah judul).' },
  { nama: 'naik / turun', isi: 'Persentase periode (hari kerja atau bulan) dengan return positif (naik) atau negatif (turun) pada sel tanggal itu.' },
  { nama: 'ekspektasi', isi: 'Rata-rata return pada sel tanggal itu — bukan jaminan, hanya rata-rata historis.' },
  { nama: 'n= dan ⚠', isi: 'Jumlah sampel di sel/kolom itu. Sel dengan sampel di bawah 20 ditandai pudar dan ⚠ — frekuensinya bukan pola yang bisa diandalkan.' },
]

const HARI = ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat']
const BULAN = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des']
/** Arsip harga nyatanya 20-30 tahun untuk emiten lama (koreksi pengawas 26
 *  Agu: IHSG 1997, BBCA/TLKM 2004) — 15/20 bukan angan-angan. */
const OPSI_TAHUN = [3, 5, 9, 12, 15, 20]
/** Di bawah ini sel dianggap sampel kecil (spek §7) — ditandai, bukan diwarnai pekat. */
const N_KECIL = 20

function warnaSel(v: number | null, jenis: 'naik' | 'turun' | 'exp', nKecil: boolean): string {
  if (v == null || nKecil) return ''
  const a = jenis === 'exp' ? Math.min(1, Math.abs(v) / 3) : Math.min(1, (v - 50) / 30)
  if (a <= 0) return ''
  const rgb = jenis === 'turun' || (jenis === 'exp' && v < 0) ? '230,99,90' : '56,183,126'
  return `rgba(${rgb},${(0.12 + a * 0.4).toFixed(2)})`
}

function Tabel({ judul, label, stat }: { judul: string; label: string[]; stat: StatMusiman[] }) {
  const kecil = stat.map((s) => s.n < N_KECIL)
  return (
    <div className="panel panel-b">
      <h3 style={{ marginTop: 0 }}>{judul}</h3>
      <div className="tbl">
        <table>
          <thead>
            <tr>
              <th></th>
              {label.map((l, i) => (
                <th key={l} className="r" style={kecil[i] ? { opacity: 0.55 } : undefined}
                  title={kecil[i] ? `Sampel kecil (n=${stat[i].n} < ${N_KECIL}) — jangan dibaca sebagai pola kuat` : undefined}>
                  {l}
                  <span className="np-n-sel">n={stat[i].n}{kecil[i] ? ' ⚠' : ''}</span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {([
              ['naik', (s: StatMusiman) => s.naikPersen, (v: number) => num(v, 1) + '%', 'naik'],
              ['turun', (s: StatMusiman) => s.turunPersen, (v: number) => num(v, 1) + '%', 'turun'],
              ['ekspektasi', (s: StatMusiman) => s.ekspektasiPersen, (v: number) => pct(v), 'exp'],
            ] as const).map(([nama, ambil, fmt, jenis]) => (
              <tr key={nama}>
                <td>{nama}</td>
                {stat.map((s, i) => {
                  const v = ambil(s)
                  return (
                    <td key={i} className="r"
                      style={{ background: warnaSel(v, jenis, kecil[i]), opacity: kecil[i] ? 0.55 : undefined }}>
                      {v == null ? '—' : fmt(v)}
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

/** Seasonality — pola return hari kerja & bulan kalender (spek §7). */
export function SeasonTab({ kode }: { kode: string }) {
  const [bars, setBars] = useState<BarHarga[] | null | undefined>(undefined)
  const [tahunN, setTahunN] = useState(9)
  const [runMusiman, setRunMusiman] = useState<RunBt | null>(null)

  useEffect(() => {
    let batal = false
    setBars(undefined)
    muatOhlcv(kode).then((d) => { if (!batal) setBars(d) })
    return () => { batal = true }
  }, [kode])

  // BadgeRapor wajib untuk klaim prediktif (spek §7). Angkanya HANYA boleh
  // dari run BT beku — kalau belum ada run musiman di bt/index.json, yang
  // tampil pernyataan jujurnya, bukan badge berisi angka karangan.
  useEffect(() => {
    let batal = false
    ambilIndexBt().then((idx) => {
      if (batal || !idx) return
      setRunMusiman(idx.run.find((r) => r.strategi.startsWith('musiman') || r.strategi.startsWith('seasonality')) ?? null)
    })
    return () => { batal = true }
  }, [])

  /** Berapa tahun kalender yang BENAR-BENAR tersedia di arsip emiten ini. */
  const tahunTersedia = useMemo(() => {
    if (!bars || bars.length < 2) return 0
    return Math.max(1, Math.ceil(
      (Date.parse(bars[bars.length - 1].t) - Date.parse(bars[0].t)) / (365.25 * 86400e3),
    ))
  }, [bars])

  const statHari = useMemo(() => (bars ? musimanHari(bars, tahunN) : []), [bars, tahunN])
  const statBulan = useMemo(() => (bars ? musimanBulan(bars, tahunN) : []), [bars, tahunN])

  if (bars === undefined) return <Kosong>Memuat…</Kosong>
  if (!bars || bars.length < 2) return <Kosong>Riwayat harga emiten ini belum ada di arsip.</Kosong>

  const tahunTerpakai = Math.min(tahunN, tahunTersedia)

  return (
    <section>
      <div className="panel panel-b">
        <h2>{kode} — Seasonality</h2>
        <p className="np-sub">
          naik/turun = persentase periode dengan return positif/negatif; ekspektasi = rata-rata return.
          Arsip {bars[0].t} → {bars[bars.length - 1].t} · <b>{tahunTerpakai} tahun terpakai</b>
          {tahunN > tahunTersedia && ` (diminta ${tahunN}, arsip hanya ${tahunTersedia})`}.
        </p>
        <div className="np-baris">
          <span className="np-lbl">Periode (tahun)</span>
          <PemilihRentang
            opsi={OPSI_TAHUN.map((t) => ({ id: String(t), label: `${t} thn` }))}
            nilai={String(tahunN)}
            onGanti={(id) => setTahunN(Number(id))}
          />
          {runMusiman ? (
            <BadgeRapor run={runMusiman} />
          ) : (
            <span className="muted" style={{ fontSize: 11 }}>
              Pola historis deskriptif — belum ada uji mundur beku untuk strategi musiman;
              badge win-rate menyusul lewat BT Papan.
            </span>
          )}
          <InfoIndikator judul="Indikator Seasonality" item={INFO_SEASON} />
        </div>
      </div>
      <div className="np-2kol">
        <Tabel judul="Pola hari kerja" label={HARI} stat={statHari} />
        <Tabel judul="Pola bulan" label={BULAN} stat={statBulan} />
      </div>
      <Sumber>
        Dihitung dari arsip harga — hari: return harian per hari kerja; bulan: return penutupan akhir
        bulan. Sel ber-⚠ sampelnya kecil (n&lt;{N_KECIL}) dan sengaja tidak diwarnai — frekuensi dari
        sampel sekecil itu bukan pola.
      </Sumber>
    </section>
  )
}
