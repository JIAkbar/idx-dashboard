import { supabase } from './supabase'

/** Satu baris `akses_halaman` (14 baris sudah terisi, backend Fase 6). RLS:
 *  semua boleh baca (termasuk anon), cuma superadmin boleh tulis. */
export interface HalamanBaris {
  kunci: string
  label: string
  tingkat: 'publik' | 'login' | 'superadmin'
  min_tier: number | null
  urutan: number
}

export async function daftarHalamanAkses(): Promise<HalamanBaris[]> {
  const { data, error } = await supabase.from('akses_halaman').select('*').order('urutan', { ascending: true })
  if (error) throw error
  return (data ?? []) as HalamanBaris[]
}

export async function ubahHalamanAkses(
  kunci: string,
  patch: Partial<Pick<HalamanBaris, 'tingkat' | 'min_tier' | 'urutan'>>
): Promise<void> {
  const { error } = await supabase.from('akses_halaman').update(patch).eq('kunci', kunci)
  if (error) throw error
}

/** Satu baris `akses_khusus` — pengecualian per akun (`profil_id` + `kunci`).
 *  Embed profil (email/alias) utk ditampilkan tanpa join manual. */
export interface AksesKhususBaris {
  profil_id: string
  kunci: string
  izinkan: boolean
  catatan: string | null
  profil: { email: string; alias: string | null } | null
}

export async function daftarAksesKhusus(): Promise<AksesKhususBaris[]> {
  const { data, error } = await supabase
    .from('akses_khusus')
    .select('*, profil(email, alias)')
    .order('kunci', { ascending: true })
  if (error) throw error
  return (data ?? []) as unknown as AksesKhususBaris[]
}

export async function tambahAksesKhusus(data: {
  profil_id: string
  kunci: string
  izinkan: boolean
  catatan?: string
}): Promise<void> {
  const { error } = await supabase.from('akses_khusus').insert({
    profil_id: data.profil_id,
    kunci: data.kunci,
    izinkan: data.izinkan,
    catatan: data.catatan?.trim() || null,
  })
  if (error) throw error
}

/** Hapus satu pengecualian — kunci alami (profil_id + kunci), bukan asumsi
 *  ada kolom `id` (skema pastinya tak dicek dari sini, backend sudah jadi). */
export async function hapusAksesKhusus(profil_id: string, kunci: string): Promise<void> {
  const { error } = await supabase.from('akses_khusus').delete().match({ profil_id, kunci })
  if (error) throw error
}
