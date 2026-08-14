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
  ditolak: number
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

/** 50 baris terbaru (atau sesuai `limit`), opsional disaring per jenis. */
export async function jejakTerakhir(jenis: JenisJejak | 'semua', limit = 50): Promise<JejakAkses[]> {
  let q = supabase.from('jejak_akses').select('*').order('waktu', { ascending: false }).limit(limit)
  if (jenis !== 'semua') q = q.eq('jenis', jenis)
  const { data, error } = await q
  if (error) throw error
  return (data ?? []) as JejakAkses[]
}
