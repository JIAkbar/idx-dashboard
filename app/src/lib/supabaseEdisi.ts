import { supabase } from './supabase'
import type { Edisi, OhlcMap } from './skor/types'

export interface EdisiRow {
  id: string
  kode: string
  tanggal: string
  status: 'draf' | 'terbit'
  edisi_data: Edisi
  ohlc_data: OhlcMap
  created_at: string
  updated_at: string
}

export async function daftarEdisi(): Promise<EdisiRow[]> {
  const { data, error } = await supabase.from('edisi').select('*').order('tanggal', { ascending: false })
  if (error) throw error
  return data as EdisiRow[]
}

export async function ambilEdisi(kode: string): Promise<EdisiRow | null> {
  const { data, error } = await supabase.from('edisi').select('*').eq('kode', kode).maybeSingle()
  if (error) throw error
  return data as EdisiRow | null
}

export async function simpanEdisi(
  kode: string,
  tanggal: string,
  status: 'draf' | 'terbit',
  edisiData: Edisi,
  ohlcData: OhlcMap
): Promise<void> {
  const { error } = await supabase
    .from('edisi')
    .upsert(
      { kode, tanggal, status, edisi_data: edisiData, ohlc_data: ohlcData },
      { onConflict: 'kode' }
    )
  if (error) throw error
}

/** Unggah screenshot ke bucket privat "screenshots", path {tanggal}/{ticker}-{jenis}.{ext}. */
export async function unggahScreenshot(
  file: File,
  tanggal: string,
  ticker: string,
  jenis: 'orderbook' | 'chart'
): Promise<string> {
  const ext = file.name.split('.').pop() || 'png'
  const path = `${tanggal}/${ticker}-${jenis}.${ext}`
  const { error } = await supabase.storage.from('screenshots').upload(path, file, { upsert: true })
  if (error) throw error
  return path
}

/** Hapus screenshot dari bucket "screenshots" berdasarkan path lengkap ({tanggal}/{nama}). */
export async function hapusScreenshot(paths: string[]): Promise<void> {
  if (paths.length === 0) return
  const { error } = await supabase.storage.from('screenshots').remove(paths)
  if (error) throw error
}

/** Signed URL (1 jam) berkas-berkas di bucket privat "screenshots", map path → URL.
 *  Batch satu request; path yang gagal ditandatangani tidak masuk hasil. */
export async function urlScreenshots(paths: string[]): Promise<Record<string, string>> {
  if (paths.length === 0) return {}
  const { data, error } = await supabase.storage.from('screenshots').createSignedUrls(paths, 3600)
  if (error) throw error
  const hasil: Record<string, string> = {}
  for (const d of data ?? []) {
    if (d.path && d.signedUrl) hasil[d.path] = d.signedUrl
  }
  return hasil
}

export async function daftarScreenshot(tanggal: string): Promise<string[]> {
  const { data, error } = await supabase.storage.from('screenshots').list(tanggal)
  if (error) throw error
  return (data ?? []).map((f) => `${tanggal}/${f.name}`)
}

/** Tanggal (folder) yang punya upload di bucket "screenshots", terbaru dulu.
 *  Hanya folder berpola tanggal — folder lain (mis. radar/) bukan antrean
 *  Kotak Masuk. */
export async function daftarTanggalUnggahan(): Promise<string[]> {
  const { data, error } = await supabase.storage.from('screenshots').list('')
  if (error) throw error
  return (data ?? [])
    .filter((f) => f.id === null && /^\d{4}-\d{2}-\d{2}$/.test(f.name))
    .map((f) => f.name)
    .sort()
    .reverse()
}

/** Unggah berkas sumber Radar WDWL (wdwl.png / rbu.pdf) ke bucket
 *  "screenshots", path radar/{tanggal}/{jenis}.{ext} — dipisah prefiks
 *  radar/ supaya tidak tercampur folder tanggal screenshot orderbook. */
export async function unggahRadar(file: File, tanggal: string, jenis: 'wdwl' | 'rbu'): Promise<string> {
  const ext = file.name.split('.').pop() || (jenis === 'rbu' ? 'pdf' : 'png')
  const path = `radar/${tanggal}/${jenis}.${ext}`
  const { error } = await supabase.storage.from('screenshots').upload(path, file, { upsert: true })
  if (error) throw error
  return path
}

/** Nama berkas radar yang sudah terunggah untuk satu tanggal. */
export async function daftarRadar(tanggal: string): Promise<string[]> {
  const { data, error } = await supabase.storage.from('screenshots').list(`radar/${tanggal}`)
  if (error) throw error
  return (data ?? []).map((f) => f.name)
}
