import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { fN, fp } from '../../lib/dasbor/format'

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
export function GrupKonglomerat() {
  const [data, setData] = useState<BerkasGrup | null>(null)
  const [galat, setGalat] = useState(false)

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
              {g.anggota.map((a) => (
                <Link
                  key={a.kode}
                  to={`/grafik?kode=${a.kode}`}
                  className={'gk-chip ' + (a.pct1d == null ? 'nol' : a.pct1d > 0 ? 'naik' : a.pct1d < 0 ? 'turun' : 'nol')}
                  title={
                    a.lewat
                      ? `${a.lewat} — ${a.pct?.toFixed(2)}%${a.harga ? ` · harga ${fN(a.harga, 0)}` : ''}`
                      : (a.alasan ?? a.kode)
                  }
                >
                  <b>{a.kode}</b>
                  <span className="gk-pct">{a.pct1d == null ? '—' : fp(a.pct1d)}</span>
                </Link>
              ))}
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
          lebih. Persen pada chip adalah perubahan harga hari terakhir, bukan porsi kepemilikan.
        </p>
      </div>
    </section>
  )
}
