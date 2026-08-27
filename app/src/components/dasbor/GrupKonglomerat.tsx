import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { fN, fp } from '../../lib/dasbor/format'
import { PemilihRentang } from './PemilihRentang'
import { LABEL_RENTANG } from '../../lib/dasbor/periode'
import { ambilScreener } from '../../lib/dasbor/screener'

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
}

interface BerkasGrup {
  dibuat: string
  sumber: string
  ambang_pct: number
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

export function GrupKonglomerat() {
  const [data, setData] = useState<BerkasGrup | null>(null)
  const [galat, setGalat] = useState(false)
  const [rentang, setRentang] = useState<RentangGrup>('h1')
  /** kode -> {h1,wtd,mtd} dari screener; null = belum termuat (chip pakai
   *  pct1d bawaan berkas grup, perilaku lama). */
  const [chg, setChg] = useState<Map<string, { h1: number | null; wtd: number | null; mtd: number | null }> | null>(null)

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
      <div className="panel-h">
        <span className="lbl">Grup Konglomerat</span>
        <PemilihRentang opsi={OPSI_RENTANG_GRUP} nilai={rentang} onGanti={setRentang} ariaLabel="Rentang kinerja harga anggota grup" />
        <span className="v-note">{urut.length} grup · diturunkan dari kepemilikan KSEI ≥{data.ambang_pct}%</span>
      </div>
      <div className="panel-b gk-isi">
        {urut.map(([nama, g]) => (
          <div className="gk-grup" key={nama}>
            <div className="gk-kepala">
              <span className="gk-nama">{nama}</span>
              <span className="gk-kode">{g.kode}</span>
              <span className="gk-jml">{g.anggota.length} emiten</span>
            </div>
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
        </p>
      </div>
    </section>
  )
}
