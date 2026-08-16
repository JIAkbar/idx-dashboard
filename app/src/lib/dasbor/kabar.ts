import { useEffect, useState } from 'react'

/** Satu kabar dari `data-idx/json/kabar.json` (ditulis `scripts/panen_kabar.py`). */
export interface KabarItem {
  /** 'IDX' · 'IPOT News' · 'Kontan' — nama yang ditampilkan apa adanya. */
  sumber: string
  jenis: 'berita' | 'pengumuman'
  judul: string
  tautan: string
  /** ISO ber-offset WIB. `null` untuk sumber yang halaman daftarnya tak
   *  memuat tanggal (IPOT) — ditampilkan "—", bukan ditebak jadi hari ini. */
  waktu: string | null
  /** Kode emiten yang disebut pengumuman resmi; kosong untuk berita umum. */
  emiten: string[]
  nomor?: string | null
}

export interface Kabar {
  dipanen: string
  sumber: string[]
  item: KabarItem[]
}

/** Cache modul: pindah halaman lalu kembali tak menarik ulang berkasnya —
 *  pola sama dengan `useBulletinList`. */
let cache: Kabar | null = null

/**
 * Kabar pasar dari berkas statis, bukan dari peramban pengunjung.
 *
 * Sengaja TIDAK memanggil RSS/endpoint IDX langsung dari klien: sumbernya
 * tidak mengizinkan CORS, endpoint IDX menolak permintaan tanpa header
 * peramban, dan tiap pengunjung memanggil sendiri berarti ratusan permintaan
 * ke server orang untuk data yang sama. Panen dijalankan di mesin rumahan
 * (`scripts/panen_kabar.py`), hasilnya berkas JSON yang ikut ter-deploy.
 */
export function useKabar() {
  const [kabar, setKabar] = useState<Kabar | null>(cache)
  const [galat, setGalat] = useState(false)

  useEffect(() => {
    if (cache) return
    let batal = false
    fetch('/data-idx/json/kabar.json')
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((d: Kabar) => {
        cache = d
        if (!batal) setKabar(d)
      })
      .catch(() => !batal && setGalat(true))
    return () => { batal = true }
  }, [])

  return { kabar, galat }
}

/** "2 jam lalu" / "Kamis, 14 Agu" — waktu relatif cuma sampai sehari, lewat
 *  itu tanggalnya lebih berguna daripada "31 jam lalu". */
export function waktuKabar(iso: string | null, sekarang = new Date()): string {
  if (!iso) return '—'
  const t = new Date(iso)
  if (Number.isNaN(t.getTime())) return '—'
  const menit = Math.round((sekarang.getTime() - t.getTime()) / 60000)
  if (menit < 1) return 'baru saja'
  if (menit < 60) return `${menit} menit lalu`
  if (menit < 24 * 60) return `${Math.round(menit / 60)} jam lalu`
  const bulan = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'][t.getMonth()]
  return `${t.getDate()} ${bulan}, ${String(t.getHours()).padStart(2, '0')}:${String(t.getMinutes()).padStart(2, '0')}`
}
