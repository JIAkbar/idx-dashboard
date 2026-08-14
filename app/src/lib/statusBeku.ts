import { supabase } from './supabase'

/** Hasil RPC `status_beku_saya()` (backend Fase 6, sudah dideploy) — dipanggil
 *  DARI SISI KONTRIBUTOR sendiri saja. `kontributor_hampir_beku()` (daftar
 *  SEMUA akun hampir beku) itu khusus superadmin — JANGAN dipanggil dari sini. */
export interface StatusBeku {
  hari: number
  ambang: number
  beku_otomatis: boolean
  aktif: boolean
  peringatan: boolean
}

/** `null` kalau RPC gagal (jaringan dsb) atau baris kosong — pemanggil
 *  perlakukan sebagai "jangan tampilkan peringatan", bukan galat fatal. */
export async function statusBekuSaya(): Promise<StatusBeku | null> {
  const { data, error } = await supabase.rpc('status_beku_saya')
  if (error) return null
  // Fungsi RETURNS TABLE/record tunggal — supabase-js kadang balas objek
  // langsung, kadang array satu elemen, tergantung definisi fungsi di server.
  const baris = Array.isArray(data) ? data[0] : data
  return (baris ?? null) as StatusBeku | null
}
