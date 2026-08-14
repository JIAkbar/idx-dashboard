import { supabase } from './supabase'

/** Satu baris tabel `profil`, bentuk hasil aksi `daftar` Edge Function admin-akun. */
export interface AkunRow {
  id: string
  email: string
  alias: string | null
  peran: 'superadmin' | 'kontributor'
  kuota_harian: number
  boleh_bedah: boolean
  aktif: boolean
  dibuat_pada: string
  terakhir_masuk: string | null
  /** Fase 6 (jenjang & kuota manual) — optional: kalau Edge Function `daftar`
   *  belum ikut mengembalikan field ini, UI jatuh ke nilai default (tier 0,
   *  kuota_manual null, beku_otomatis true) alih-alih pecah. */
  tier?: number | null
  kuota_manual?: number | null
  beku_otomatis?: boolean
}

type Aksi = 'daftar' | 'buat' | 'reset_sandi' | 'set_profil' | 'hapus'

/**
 * Panggil Edge Function `admin-akun` (backend Fase 1, sudah jadi) — token
 * diambil dari sesi Supabase aktif, otorisasi superadmin diperiksa di server
 * (non-superadmin dapat 403). Galat server (field `galat`) dilempar sebagai
 * Error biasa supaya pemanggil bisa tampilkan `err.message` apa adanya.
 */
export async function panggilAdminAkun<T>(aksi: Aksi, muatan: Record<string, unknown> = {}): Promise<T> {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) throw new Error('Sesi tidak ditemukan — masuk ulang.')

  const url = import.meta.env.VITE_SUPABASE_URL
  const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY
  const res = await fetch(`${url}/functions/v1/admin-akun`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${session.access_token}`,
      apikey: anonKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ aksi, ...muatan }),
  })
  const body = await res.json().catch(() => ({}) as Record<string, unknown>)
  if (!res.ok || (body as { galat?: string }).galat) {
    throw new Error((body as { galat?: string }).galat || `Gagal memanggil admin-akun (${res.status}).`)
  }
  return body as T
}

export async function daftarAkun(): Promise<AkunRow[]> {
  const r = await panggilAdminAkun<{ ok: true; akun: AkunRow[] }>('daftar')
  return r.akun
}

export function buatAkun(data: { email: string; sandi: string; alias?: string; kuota_harian?: number; boleh_bedah?: boolean }) {
  return panggilAdminAkun<{ ok: true; id: string; email: string }>('buat', data)
}

export function resetSandi(id: string, sandi: string) {
  return panggilAdminAkun<{ ok: true }>('reset_sandi', { id, sandi })
}

export function setProfil(
  id: string,
  patch: Partial<{
    peran: string
    kuota_harian: number
    boleh_bedah: boolean
    aktif: boolean
    alias: string
    /** Fase 6 — TAMBAHKAN ke muatan Edge Function admin-akun (backend sudah
     *  jadi, tidak diubah dari sini). `kuota_manual: null` = ikut jenjang. */
    kuota_manual: number | null
    beku_otomatis: boolean
  }>
) {
  return panggilAdminAkun<{ ok: true }>('set_profil', { id, ...patch })
}

/** Hapus akun permanen (backend Fase 6-adjacent, aksi `hapus` sudah dideploy
 *  di admin-akun) — server menolak kalau menghapus diri sendiri, akun
 *  superadmin (turunkan dulu perannya), atau akun yang punya setoran
 *  `disetujui` (saran server: nonaktifkan saja). */
export function hapusAkun(id: string) {
  return panggilAdminAkun<{ ok: true; email: string }>('hapus', { id })
}
