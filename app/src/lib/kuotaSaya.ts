import { useEffect, useState } from 'react'
import { supabase } from './supabase'
import { useAuth } from '../context/AuthContext'

/**
 * Kuota unggah harian milik pengguna sendiri, LANGSUNG dari server.
 *
 * Aturannya tidak ditulis ulang di sini. RPC `kuota_saya()` sudah memuatnya
 * lengkap: superadmin dapat sekurangnya 50, `kuota_manual` mengalahkan kuota
 * jenjang, dan tanpa manual jatuh ke kuota jenjang pemiliknya.
 *
 * Kenapa perlu: kolom `profil.kuota_harian` peninggalan Fase 1 masih ada dan
 * masih dipakai server untuk superadmin, tetapi sejak Fase 6 ia BUKAN lagi
 * kuota efektif kontributor. Layar yang membacanya langsung menampilkan angka
 * yang berbeda dari yang ditegakkan server — dan kalau angka itu dipakai
 * sebagai gerbang di klien, kontributor diblokir pada batas yang lebih rendah
 * daripada yang sebenarnya boleh (terlihat 15 Agu 2026: header menulis 1/hari
 * sementara server mengizinkan 2).
 *
 * `null` = belum terjawab atau belum login. Pemanggil yang memakainya sebagai
 * gerbang harus memperlakukan `null` sebagai "belum tahu" dan membiarkan
 * server yang menolak, bukan menebak 0.
 */
export function useKuotaSaya() {
  const { session } = useAuth()
  const [kuota, setKuota] = useState<number | null>(null)

  useEffect(() => {
    if (!session) {
      setKuota(null)
      return
    }
    let batal = false
    supabase
      .rpc('kuota_saya')
      .then(({ data, error }) => {
        if (batal || error) return
        setKuota(typeof data === 'number' ? data : null)
      })
    return () => {
      batal = true
    }
  }, [session])

  return kuota
}

/** Versi sekali-panggil untuk pemeriksaan sesaat (mis. sebelum membuka form). */
export async function ambilKuotaSaya(): Promise<number | null> {
  const { data, error } = await supabase.rpc('kuota_saya')
  if (error) return null
  return typeof data === 'number' ? data : null
}
