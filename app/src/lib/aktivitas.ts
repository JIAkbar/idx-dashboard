import { supabase } from './supabase'

/**
 * Satu baris RPC `ringkasan_keaktifan()` (backend Fase 4, sudah jadi, khusus
 * superadmin — RLS/SECURITY DEFINER menegakkan ini di server) — per
 * kontributor: setoran & akurasi + sinyal keaktifan (hari diam sejak
 * setoran disetujui terakhir, jumlah IP berbeda 30 hari terakhir). Bentuk
 * kolom dicek langsung ke database produksi (pg_proc), bukan tebakan.
 */
export interface RingkasanKeaktifan {
  id: string
  email: string
  alias: string | null
  tier: number
  jenjang: string
  aktif: boolean
  setoran: number
  disetujui: number
  dihapus: number
  menunggu: number
  /** Persen (0–100). `null` = belum ada setoran yang dikurasi. */
  akurasi: number | null
  terakhir_setor: string | null
  hari_diam: number
  ip_berbeda: number
}

export async function ringkasanKeaktifan(): Promise<RingkasanKeaktifan[]> {
  const { data, error } = await supabase.rpc('ringkasan_keaktifan')
  if (error) throw error
  return (data ?? []) as RingkasanKeaktifan[]
}

/**
 * Satu baris RPC `sinyal_bruteforce(menit, ambang)` — IP dengan percobaan
 * masuk gagal ≥ `ambang` dalam `menit` menit terakhir. `email_dicoba` itu
 * JUMLAH email berbeda yang dicoba dari IP itu (integer), BUKAN daftar
 * email — dicek langsung ke skema fungsi di database, bukan tebakan.
 */
export interface SinyalBruteforce {
  ip: string
  gagal: number
  email_dicoba: number
  pertama: string
  terakhir: string
}

export async function sinyalBruteforce(menit: number, ambang: number): Promise<SinyalBruteforce[]> {
  const { data, error } = await supabase.rpc('sinyal_bruteforce', { menit, ambang })
  if (error) throw error
  return (data ?? []) as SinyalBruteforce[]
}

export type JenisJejak = 'login_sukses' | 'login_gagal' | 'unggah' | 'kurasi' | 'forum' | 'admin'

export const LABEL_JENIS_JEJAK: Record<JenisJejak, string> = {
  login_sukses: 'Masuk berhasil',
  login_gagal: 'Masuk gagal',
  unggah: 'Unggah',
  kurasi: 'Kurasi',
  forum: 'Forum',
  admin: 'Admin',
}

/** Satu baris tabel `jejak_akses` — RLS: SELECT superadmin saja (`saya_superadmin()`). */
export interface JejakAkses {
  id: number
  waktu: string
  jenis: JenisJejak
  profil_id: string | null
  email: string | null
  ip: string | null
  user_agent: string | null
  /** jsonb di database — bentuknya bebas per jenis, ditampilkan apa adanya. */
  keterangan: unknown
}

/** Satu halaman jejak + jumlah total barisnya (untuk paginasi). */
export interface HalamanJejak {
  baris: JejakAkses[]
  /** Total baris yang cocok filter — bukan cuma yang di halaman ini. */
  total: number
}

/** Berapa baris per halaman di tab Aktivitas. */
export const JEJAK_PER_HAL = 30

/**
 * Satu halaman jejak akses, terbaru dulu, opsional disaring per jenis.
 *
 * Memakai `.range()` + `count: 'exact'` alih-alih `.limit()`: tanpa jumlah
 * total, layar tidak bisa memberi tahu apakah masih ada baris di belakang —
 * dan "50 terbaru" diam-diam menyembunyikan sisanya tanpa petunjuk apa pun.
 */
export async function jejakHalaman(
  jenis: JenisJejak | 'semua',
  halaman = 0,
  perHal = JEJAK_PER_HAL
): Promise<HalamanJejak> {
  const dari = halaman * perHal
  let q = supabase
    .from('jejak_akses')
    .select('*', { count: 'exact' })
    .order('waktu', { ascending: false })
    .range(dari, dari + perHal - 1)
  if (jenis !== 'semua') q = q.eq('jenis', jenis)
  const { data, error, count } = await q
  if (error) throw error
  return { baris: (data ?? []) as JejakAkses[], total: count ?? 0 }
}
