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

/** Unggah berkas sumber Bedah Arus Saham (broksum-rentang / done-summary) ke
 *  bucket "screenshots", path bedah/{TICKER}/{tanggal}/{jenis}.{ext} — prefiks
 *  bedah/ (seperti radar/) supaya tidak masuk hitungan Kotak Masuk harian
 *  (daftarTanggalUnggahan cuma menghitung folder berpola tanggal ISO). */
export async function unggahBedah(
  file: File,
  ticker: string,
  tanggal: string,
  jenis: 'broksum-rentang' | 'done-summary'
): Promise<string> {
  const ext = file.name.split('.').pop() || 'png'
  const path = `bedah/${ticker}/${tanggal}/${jenis}.${ext}`
  const { error } = await supabase.storage.from('screenshots').upload(path, file, { upsert: true })
  if (error) throw error
  return path
}

/** Nama berkas Bedah yang sudah terunggah untuk satu emiten + tanggal. */
export async function daftarBedah(ticker: string, tanggal: string): Promise<string[]> {
  const { data, error } = await supabase.storage.from('screenshots').list(`bedah/${ticker}/${tanggal}`)
  if (error) throw error
  return (data ?? []).map((f) => f.name)
}

export interface BedahArsipBaris {
  ticker: string
  tanggalTerakhir: string
  jumlahBerkas: number
  /** Path lengkap semua berkas emiten ini (semua tanggal) — bahan lightbox. */
  paths: string[]
}

/** Arsip unggahan Bedah digrup per emiten (bedah/{TICKER}/{tanggal}/{jenis}.ext).
 *  ponytail: list bertingkat (ticker → tanggal → berkas) — jumlah emiten Bedah
 *  masih kecil, upgrade ke agregat sisi server kalau sudah puluhan. */
export async function daftarBedahArsip(): Promise<BedahArsipBaris[]> {
  const { data: folderTicker, error } = await supabase.storage.from('screenshots').list('bedah')
  if (error) throw error
  const tickers = (folderTicker ?? []).filter((f) => f.id === null).map((f) => f.name)
  const baris = await Promise.all(
    tickers.map(async (ticker): Promise<BedahArsipBaris> => {
      const { data: folderTanggal } = await supabase.storage.from('screenshots').list(`bedah/${ticker}`)
      const tanggalList = (folderTanggal ?? []).filter((f) => f.id === null).map((f) => f.name).sort()
      const perTanggal = await Promise.all(
        tanggalList.map(async (tgl) => {
          const { data: berkas } = await supabase.storage.from('screenshots').list(`bedah/${ticker}/${tgl}`)
          return (berkas ?? []).map((f) => `bedah/${ticker}/${tgl}/${f.name}`)
        })
      )
      const paths = perTanggal.flat()
      return { ticker, tanggalTerakhir: tanggalList[tanggalList.length - 1] ?? '', jumlahBerkas: paths.length, paths }
    })
  )
  return baris.sort((a, b) => a.ticker.localeCompare(b.ticker))
}
