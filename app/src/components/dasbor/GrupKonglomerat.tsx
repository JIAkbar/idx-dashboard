import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import type { ChartConfiguration } from 'chart.js/auto'
import { fN, fp } from '../../lib/dasbor/format'
import { PemilihRentang } from './PemilihRentang'
import { LABEL_RENTANG } from '../../lib/dasbor/periode'
import { ambilScreener } from '../../lib/dasbor/screener'
import { fetchDeret } from '../../lib/dasbor/watchlist'
import { batasBawahHari } from '../../lib/dasbor/grafikEmiten'
import type { BarisOhlc } from '../../lib/dasbor/ihsgOhlc'
import { deretIndeksGrup } from '../../lib/dasbor/grupKinerja'
import { useChartCanvas } from '../../lib/dasbor/useChartJs'
import { useTheme } from '../../context/ThemeContext'

interface Anggota {
  kode: string
  /** Nama pemegang saham yang membuat emiten ini masuk grup — buktinya. */
  lewat: string | null
  /** Persen kepemilikan pemegang saham itu (KSEI ≥1%). */
  pct: number | null
  kelas: string | null
  harga: number | null
  pct1d: number | null
  /** Hanya untuk baris yang ditambahkan manual — alasannya wajib ada. */
  alasan?: string
  /** Arus dana (3 Sep 2026, Johan: "sambungin ke data realtime 6 varian +
   *  OHLCV"). Ditempel di berkas grup, bukan diunduh per emiten dari
   *  peramban — 82 permintaan demi satu ubin tak sepadan. Semua opsional:
   *  hari yang rincian brokernya belum terbit tetap merender ubinnya. */
  vol?: number | null
  nilai?: number | null
  /** Net asing rupiah hari bursa terakhir, dari varian asing. */
  net_asing?: number | null
  accdist?: string | null
  top3_pct?: number | null
  varian_ada?: string[]
}

interface BerkasGrup {
  dibuat: string
  sumber: string
  ambang_pct: number
  /** Tanggal bar OHLC yang dipakai harga & pct1d — BUKAN tanggal posisi KSEI.
   *  Keduanya berbeda jauh (KSEI bulanan, harga harian) dan halaman wajib
   *  menyebutkan yang mana, kalau tidak pembaca menyangka persentase ubin
   *  ikut tanggal kepemilikan di kepala halaman. */
  harga_per?: string | null
  grup: Record<string, { kode: string; anggota: Anggota[] }>
}

/**
 * Panel Grup Konglomerat (#155).
 *
 * Bedanya dengan daftar grup yang beredar di dasbor lain: keanggotaan di sini
 * DITURUNKAN dari nama pemegang saham KSEI (`scripts/petakan_grup.py`), bukan
 * ditulis tangan lalu diperiksa ulang sesekali. Tiap chip menyimpan buktinya —
 * arahkan kursor untuk melihat lewat siapa dan berapa persen.
 *
 * Konsekuensi yang disengaja: grup yang melepas sahamnya akan hilang sendiri
 * pada pemutakhiran KSEI berikutnya, tanpa ada yang perlu ingat menghapusnya.
 */
/** K4 (#170, dibuka Johan 27 Agu "kerjakan K4"): rentang chip grup.
 *
 *  Semantiknya DIPUTUSKAN DATA, bukan ditebak — dua tafsir spek:
 *  (a) perubahan KEPEMILIKAN dalam rentang: TAK BERDATA — KSEI kita satu
 *      potret posisi (investor_map.meta: publish 2026-06-02) tanpa deret
 *      bulanan, jadi tafsir ini mustahil dibangun jujur hari ini;
 *  (b) KINERJA HARGA anggota grup dalam rentang: berdata penuh.
 *  Yang dibangun (b); sumber termurahnya screener.json (chg_1d/wtd/mtd,
 *  satu fetch ber-TTL 30 mnt) — bukan ohlc per anggota (ratusan berkas).
 *  Kalau kelak arsip KSEI berderet bulan, (a) layak dibangun terpisah. */
type RentangGrup = 'h1' | 'wtd' | 'mtd'
const OPSI_RENTANG_GRUP: { id: RentangGrup; label: string }[] = [
  { id: 'h1', label: LABEL_RENTANG.h1 },
  { id: 'wtd', label: LABEL_RENTANG.wtd },
  { id: 'mtd', label: LABEL_RENTANG.mtd },
]

/** K4 lanjutan (Paket J, 27 Agu): mode Deret — grafik garis kumulatif per
 *  grup vs IHSG, melengkapi chip snapshot yang cuma satu titik waktu. */
type Mode = 'kartu' | 'tabel' | 'deret'
const OPSI_MODE: { id: Mode; label: string }[] = [
  { id: 'kartu', label: 'Kartu' },
  { id: 'tabel', label: 'Tabel' },
  { id: 'deret', label: 'Deret' },
]

type RentangDeret = 'b1' | 'b3' | 'ytd'
const OPSI_RENTANG_DERET: { id: RentangDeret; label: string }[] = [
  { id: 'b1', label: LABEL_RENTANG.b1 },
  { id: 'b3', label: LABEL_RENTANG.b3 },
  { id: 'ytd', label: LABEL_RENTANG.ytd },
]

function tanggalMulaiDeret(rentang: RentangDeret, akhir: string): string {
  if (rentang === 'ytd') return `${akhir.slice(0, 4)}-01-01`
  return batasBawahHari(akhir, rentang === 'b1' ? 30 : 91)
}

/** Satu grafik garis grup vs IHSG. Komponen terpisah (bukan di-map dalam
 *  loop) supaya `useChartCanvas` tak dipanggil jumlah kali yang berubah-ubah
 *  dalam satu komponen — tiap grup instance hook-nya sendiri. */
function GrupDeretChart({ kodeAnggota, ihsg, rentang }: {
  kodeAnggota: string[]
  ihsg: BarisOhlc[] | null
  rentang: RentangDeret
}) {
  const { theme } = useTheme()
  const [sorot, setSorot] = useState<'grup' | 'ihsg' | null>(null)
  const [seri, setSeri] = useState<ReturnType<typeof deretIndeksGrup>>(null)

  useEffect(() => {
    let batal = false
    setSeri(null)
    if (!ihsg || !ihsg.length) return
    const akhir = ihsg[ihsg.length - 1][0]
    const mulai = tanggalMulaiDeret(rentang, akhir)
    Promise.all(kodeAnggota.map((k) => fetchDeret(k))).then((hasil) => {
      if (batal) return
      setSeri(deretIndeksGrup(hasil, ihsg, mulai, akhir))
    })
    return () => { batal = true }
  }, [kodeAnggota, ihsg, rentang])

  const config = useMemo<ChartConfiguration<'line'> | null>(() => {
    if (!seri) return null
    const isDark = theme === 'dark'
    const text2Color = isDark ? '#8494a8' : '#4b6070'
    const redup = isDark ? 'rgba(255,255,255,.28)' : 'rgba(0,0,0,.28)'
    return {
      type: 'line',
      data: {
        labels: seri.tgl,
        datasets: [
          {
            label: 'Grup', data: seri.grup, pointRadius: 0, borderWidth: 2.2,
            borderColor: sorot === 'ihsg' ? redup : '#38B77E',
          },
          {
            label: 'IHSG', data: seri.ihsg, pointRadius: 0, borderWidth: 1.6, borderDash: [4, 3],
            borderColor: sorot === 'grup' ? redup : '#5B94E8',
          },
        ],
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        interaction: { mode: 'index', intersect: false },
        plugins: {
          legend: {
            position: 'bottom',
            labels: { color: text2Color, boxWidth: 10, font: { size: 9.5 } },
            // Klik legenda = SOROT (redupkan garis lain), bukan sembunyikan
            // dataset bawaan Chart.js — grup cuma dua garis, menyembunyikan
            // salah satunya membuang perbandingan yang jadi inti panel ini.
            onClick: (_e, item) => {
              const id = item.datasetIndex === 0 ? 'grup' : 'ihsg'
              setSorot((s) => (s === id ? null : id))
            },
          },
        },
        scales: {
          x: { ticks: { display: false }, grid: { display: false } },
          y: { ticks: { color: text2Color, font: { size: 9 }, callback: (v) => Number(v).toFixed(0) }, grid: { color: 'rgba(128,128,128,.08)' } },
        },
      },
    }
  }, [seri, theme, sorot])
  const canvasRef = useChartCanvas(config)

  if (seri === null) {
    return <p className="muted gk-deret-kosong">Memuat / tak cukup irisan tanggal anggota vs IHSG pada rentang ini.</p>
  }
  return <div className="gk-deret-chart"><canvas ref={canvasRef} /></div>
}

export function GrupKonglomerat() {
  const [data, setData] = useState<BerkasGrup | null>(null)
  const [galat, setGalat] = useState(false)
  const [rentang, setRentang] = useState<RentangGrup>('h1')
  const [mode, setMode] = useState<'kartu' | 'tabel' | 'deret'>('kartu')
  const [rentangDeret, setRentangDeret] = useState<RentangDeret>('b3')
  const [ihsg, setIhsg] = useState<BarisOhlc[] | null>(null)
  /** kode -> {h1,wtd,mtd} dari screener; null = belum termuat (chip pakai
   *  pct1d bawaan berkas grup, perilaku lama). */
  const [chg, setChg] = useState<Map<string, { h1: number | null; wtd: number | null; mtd: number | null }> | null>(null)

  useEffect(() => {
    if (mode !== 'deret' || ihsg) return
    let batal = false
    fetchDeret('IHSG').then((d) => { if (!batal) setIhsg(d) })
    return () => { batal = true }
  }, [mode, ihsg])

  useEffect(() => {
    let batal = false
    void ambilScreener().then((scr) => {
      if (batal || !scr) return
      setChg(new Map(scr.emiten.map((e) => [e.kode, { h1: e.chg_1d, wtd: e.chg_wtd, mtd: e.chg_mtd }])))
    })
    return () => { batal = true }
  }, [])

  useEffect(() => {
    let batal = false
    fetch('/data-idx/json/grup_konglomerat.json')
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((j: BerkasGrup) => { if (!batal) setData(j) })
      .catch(() => { if (!batal) setGalat(true) })
    return () => { batal = true }
  }, [])

  if (galat) return null
  if (!data) return <div className="panel panel-b"><p className="muted">Memuat grup konglomerat…</p></div>

  // Grup terbanyak di atas — yang isinya satu-dua emiten tak layak memakan
  // ruang di puncak panel.
  const urut = Object.entries(data.grup)
    .filter(([, g]) => g.anggota.length > 0)
    .sort((a, b) => b[1].anggota.length - a[1].anggota.length)

  return (
    <section className="panel">
      {/* Kepala menyimpan NAMA dan CAKUPAN saja; kendali turun ke bilahnya
          sendiri di dalam badan panel — keputusan Johan 5 Sep 2026 (artifact
          "Empat Bilah Kendali PAPAN", opsi A).

          Sebelumnya satu baris kepala memikul enam benda sekaligus: judul,
          tiga tombol mode, tiga pil rentang, tanggal harga, legenda tiga
          warna, dan catatan jumlah grup. Di ponsel keenamnya jadi empat baris
          sebelum satu kartu pun terlihat — dan bentuknya menyimpang dari
          sistem tata yang sudah dipakai 21 halaman lain, yang menaruh kendali
          di `.bilah-kendali` di bawah judul, bukan di dalam kepala. */}
      <div className="panel-h">
        <span className="lbl">Grup Konglomerat</span>
        <span className="v-note">{urut.length} grup · diturunkan dari kepemilikan KSEI ≥{data.ambang_pct}%</span>
      </div>
      <div className="panel-b">
        <div className="gk-alat">
        <div className="bilah-kendali">
          <div className="grup-k">
            <PemilihRentang opsi={OPSI_MODE} nilai={mode} onGanti={setMode} ariaLabel="Mode tampilan grup" />
          </div>
          <div className="grup-k">
            {mode !== 'deret'
              ? <PemilihRentang opsi={OPSI_RENTANG_GRUP} nilai={rentang} onGanti={setRentang} ariaLabel="Rentang kinerja harga anggota grup" />
              : <PemilihRentang opsi={OPSI_RENTANG_DERET} nilai={rentangDeret} onGanti={setRentangDeret} ariaLabel="Rentang deret kinerja grup" />}
          </div>
          {mode === 'kartu' && (
            <div className="grup-k grup-kanan">
              <span className="gk-legenda" aria-hidden="true">
                <i className="naik" /> Naik <i className="nol" /> Datar <i className="turun" /> Turun
              </span>
            </div>
          )}
        </div>
        {/* Tanggal harga menerangkan ISI, bukan kendali — jadi ia duduk di
            dekat ubinnya, bukan di antara tombol. */}
        {mode === 'kartu' && data.harga_per && (
          <p className="gk-tgl-harga gk-alat-catatan">
            Angka pada ubin adalah harga penutupan {new Date(`${data.harga_per}T12:00:00`).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })}, bukan harga berjalan.
          </p>
        )}
        </div>
      <div className="gk-isi">
        {urut.map(([nama, g]) => (
          <div className="gk-grup" key={nama}>
            <div className="gk-kepala">
              <span className="gk-nama">{nama}</span>
              <span className="gk-kode">{g.kode}</span>
              <span className="gk-jml">{g.anggota.length} emiten</span>
              {mode === 'kartu' && (() => {
                // Rata-rata grup: dari anggota yang PUNYA angka saja. Memasukkan
                // yang kosong sebagai nol akan menyeret rata-rata ke tengah dan
                // membuat grup yang datanya bolong terlihat lebih tenang.
                const nilai = g.anggota
                  .map((a) => (chg ? (chg.get(a.kode)?.[rentang] ?? null) : (rentang === 'h1' ? a.pct1d : null)))
                  .filter((v): v is number => v != null)
                if (!nilai.length) return null
                const rata = nilai.reduce((s2, v) => s2 + v, 0) / nilai.length
                return (
                  <span className={'gk-rata ' + (rata > 0 ? 'naik' : rata < 0 ? 'turun' : 'nol')}>
                    Rata-rata {fp(rata)}
                    {nilai.length < g.anggota.length && <small> ({nilai.length}/{g.anggota.length})</small>}
                  </span>
                )
              })()}
            </div>
            {mode === 'deret' ? (
              <GrupDeretChart kodeAnggota={g.anggota.map((a) => a.kode)} ihsg={ihsg} rentang={rentangDeret} />
            ) : mode === 'kartu' ? (
              <div className="gk-ubin">
                {g.anggota.map((a) => {
                  const nilai = chg ? (chg.get(a.kode)?.[rentang] ?? null) : (rentang === 'h1' ? a.pct1d : null)
                  const arah = nilai == null ? 'nol' : nilai > 0 ? 'naik' : nilai < 0 ? 'turun' : 'nol'
                  return (
                    <Link
                      key={a.kode}
                      to={`/grafik?kode=${a.kode}`}
                      className={'gk-ubin-it ' + arah}
                      title={[
                        a.lewat ? `${a.lewat} — ${a.pct?.toFixed(2)}%` : (a.alasan ?? a.kode),
                        a.harga ? `harga ${fN(a.harga, 0)}` : null,
                        a.vol ? `volume ${fN(a.vol, 0)}` : null,
                        a.net_asing ? `net asing ${a.net_asing > 0 ? '+' : ''}${fN(a.net_asing / 1e9, 1)} miliar` : null,
                        a.varian_ada?.length ? `${a.varian_ada.length} varian rincian broker` : 'rincian broker belum ada',
                      ].filter(Boolean).join(' · ')}
                    >
                      <b>{a.kode}</b>
                      <span className="gk-ubin-pct">{nilai == null ? '—' : fp(nilai)}</span>
                      {(() => {
                        // Net asing hanya ditampilkan kalau angkanya BERARTI di
                        // ubin sekecil ini. Di bawah 100 juta, pembulatan ke
                        // satu desimal miliar mencetak "0,0" — nol yang bukan
                        // nol, dan itu lebih menyesatkan daripada tak ada
                        // baris sama sekali (terlihat 3 Sep: LIFE −14 juta
                        // tampil sebagai "A −0").
                        const na = a.net_asing
                        if (na == null || Math.abs(na) < 1e8) return null
                        const miliar = Math.abs(na) / 1e9
                        return (
                          <span className={'gk-ubin-asing ' + (na > 0 ? 'naik' : 'turun')} title="net asing, miliar rupiah">
                            A {na > 0 ? '+' : '−'}{fN(miliar, miliar >= 10 ? 0 : 1)}
                          </span>
                        )
                      })()}
                    </Link>
                  )
                })}
              </div>
            ) : (
            <div className="gk-chip-baris">
              {g.anggota.map((a) => {
                const nilai = chg
                  ? (chg.get(a.kode)?.[rentang] ?? null)
                  : (rentang === 'h1' ? a.pct1d : null)
                return (
                  <Link
                    key={a.kode}
                    to={`/grafik?kode=${a.kode}`}
                    className={'gk-chip ' + (nilai == null ? 'nol' : nilai > 0 ? 'naik' : nilai < 0 ? 'turun' : 'nol')}
                    title={
                      a.lewat
                        ? `${a.lewat} — ${a.pct?.toFixed(2)}%${a.harga ? ` · harga ${fN(a.harga, 0)}` : ''}`
                        : (a.alasan ?? a.kode)
                    }
                  >
                    <b>{a.kode}</b>
                    <span className="gk-pct">{nilai == null ? '—' : fp(nilai)}</span>
                  </Link>
                )
              })}
            </div>
            )}
          </div>
        ))}
        {/* Batas metode ditulis di panelnya sendiri, bukan disembunyikan di
            dokumentasi: pembaca yang melihat grupnya cuma berisi dua emiten
            berhak tahu kenapa. */}
        <p className="gk-catatan">
          Keanggotaan dicocokkan dari <b>nama pemegang saham ≥{data.ambang_pct}%</b> di data KSEI —
          arahkan kursor ke chip untuk melihat lewat siapa. Kepemilikan yang disamarkan lewat
          perusahaan bernama netral tidak tertangkap cara ini, jadi daftar ini <b>kurang</b>, bukan
          lebih. Persen pada chip adalah <b>perubahan harga pada rentang terpilih</b> ({OPSI_RENTANG_GRUP.find((o) => o.id === rentang)?.label}), bukan porsi
          kepemilikan — deret kepemilikan KSEI antar-waktu belum tersedia, jadi rentang di sini
          mengukur kinerja harga anggota, bukan pergeseran porsi grup.
          {/* Kalimat "harga penutupan, bukan berjalan" TIDAK diulang di sini —
              ia sudah berdiri sendiri tepat di atas ubinnya sejak kendali
              dipindah (5 Sep 2026). Yang tinggal di sini cuma yang belum
              terjawab di sana. */}
          {mode === 'kartu' && ' Mode Kartu: seluruh kartu memakai satu tanggal yang sama — rincian broker memang baru terbit sesudah pasar tutup. Huruf A adalah net asing dalam miliar rupiah dari rincian enam varian; ubin tanpa A berarti nilainya di bawah 100 juta atau rinciannya belum terbit untuk hari itu.'}
          {mode === 'deret' && ' Mode Deret: indeks kumulatif bobot setara anggota grup dibanding IHSG, rebased 100 di awal rentang — klik legenda untuk menyorot satu garis.'}
        </p>
      </div>
      </div>
    </section>
  )
}
