import { supabase } from './supabase'

/**
 * Satu baris tabel `contoh_orderbook` (Fase 5, backend sudah jadi) — galeri
 * contoh screenshot orderbook "benar" vs "terpotong" di panduan tab Unggah.
 * RLS: dibaca semua (termasuk anon), dikelola superadmin saja. `path` = kunci
 * utama, path lengkap bucket privat "screenshots" prefiks "contoh/" (dibaca
 * lewat `urlScreenshots` seperti berkas lain — RLS storage yang mengizinkan
 * anon khusus prefiks ini, bukan urusan fungsi di sini).
 */
export interface ContohOrderbook {
  path: string
  judul: string | null
  keterangan: string | null
  benar: boolean
  urutan: number
}

export async function daftarContohOrderbook(): Promise<ContohOrderbook[]> {
  const { data, error } = await supabase.from('contoh_orderbook').select('*').order('urutan', { ascending: true })
  if (error) throw error
  return (data ?? []) as ContohOrderbook[]
}

/** Unggah gambar contoh ke bucket "screenshots", path contoh/{nama unik}.{ext}
 *  — prefiks contoh/ (pola sama radar/, bedah/ di supabaseEdisi.ts) supaya
 *  tidak ikut hitungan Kotak Masuk (cuma folder bertanggal ISO yang dihitung
 *  di sana). Nama file diacak (bukan nama asli) — kemungkinan tabrakan antar
 *  superadmin yang unggah bersamaan diabaikan. */
export async function unggahContoh(file: File): Promise<string> {
  const ext = file.name.split('.').pop() || 'png'
  const path = `contoh/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`
  const { error } = await supabase.storage.from('screenshots').upload(path, file)
  if (error) throw error
  return path
}

export async function tambahContohOrderbook(data: ContohOrderbook): Promise<void> {
  const { error } = await supabase.from('contoh_orderbook').insert(data)
  if (error) throw error
}

export async function ubahContohOrderbook(
  path: string,
  patch: Partial<Pick<ContohOrderbook, 'judul' | 'keterangan' | 'benar' | 'urutan'>>
): Promise<void> {
  const { error } = await supabase.from('contoh_orderbook').update(patch).eq('path', path)
  if (error) throw error
}

/** Hapus baris dulu, baru berkas storage — kalau baris gagal dihapus (mis.
 *  RLS), berkas TIDAK ikut disentuh (baris jadi wasit, hindari baris yatim
 *  tanpa berkas kalau urutan dibalik). */
export async function hapusContohOrderbook(path: string): Promise<void> {
  const { error } = await supabase.from('contoh_orderbook').delete().eq('path', path)
  if (error) throw error
  await supabase.storage.from('screenshots').remove([path])
}
