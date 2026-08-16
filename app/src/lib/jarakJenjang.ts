import { useEffect, useState } from 'react'
import { useAksesHalaman } from '../context/AksesHalamanContext'
import { daftarJenjang, hitungRingkasanSetoranSaya, type JenjangRow } from './jenjang'

export interface JarakJenjang {
  /** Nama jenjang yang membuka kunci ini (mis. "Perak"). */
  nama: string
  /** Kekurangan setoran disetujui menuju jenjang itu (0 kalau volume sudah cukup). */
  kurangSetoran: number
  /** Kekurangan akurasi dalam poin persen — `null` kalau akurasinya sudah cukup. */
  akurasiKurang: number | null
}

/**
 * Jarak menuju jenjang yang membuka `kunci`, dalam satuan yang bisa dikerjakan
 * orangnya: berapa setoran lagi. "Perlu jenjang Perak" tak memberi tahu apa pun
 * tentang usaha yang dibutuhkan — dan syarat yang tak bisa diukur tak akan
 * dikejar siapa pun.
 *
 * Tier target dibaca dari tabel Akses, bukan ditulis tetap: superadmin boleh
 * memindahkan syarat sebuah halaman ke Perunggu atau Emas kapan saja.
 *
 * `aktif=false` (halamannya memang sudah boleh dibuka) tidak menembak kueri
 * sama sekali.
 */
export function useJarakJenjang(kunci: string, aktif: boolean): JarakJenjang | null {
  const { daftar } = useAksesHalaman()
  const [jarak, setJarak] = useState<JarakJenjang | null>(null)
  useEffect(() => {
    if (!aktif) return
    let batal = false
    void Promise.all([daftarJenjang(), hitungRingkasanSetoranSaya()])
      .then(([js, s]: [JenjangRow[], { disetujui: number; dihapus: number }]) => {
        if (batal) return
        const tierPerlu = daftar?.find((h) => h.kunci === kunci)?.min_tier
        if (tierPerlu == null) return
        const target = js.find((j) => j.tier === tierPerlu)
        if (!target) return
        const dikurasi = s.disetujui + s.dihapus
        const pct = dikurasi === 0 ? 100 : Math.round((s.disetujui * 100) / dikurasi)
        setJarak({
          nama: target.nama,
          kurangSetoran: Math.max(0, target.min_disetujui - s.disetujui),
          akurasiKurang: pct >= (target.min_akurasi ?? 0) ? null : (target.min_akurasi ?? 0) - pct,
        })
      })
      .catch(() => {})
    return () => { batal = true }
  }, [kunci, aktif, daftar])
  return jarak
}
