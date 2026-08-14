import { supabase } from './supabase'

/** Baris ringkasan satu ruang, dari RPC `forum_ringkasan()` — baca publik
 *  (anon termasuk), dipakai daftar `/forum`. */
export interface RuangRingkasan {
  kunci: string
  jenis: 'emiten' | 'topik'
  label: string
  keterangan: string | null
  jumlah: number
  terakhir: string | null
}

/** Baris `forum_ruang` apa adanya — dipakai halaman ruang utk judul/status.
 *  RLS `ruang_baca`: anon/login cuma lihat baris `aktif`; kalau kunci tak
 *  ditemukan (tak pernah dibuat ATAU nonaktif utk viewer biasa) query balas
 *  `null` — dua kasus itu sengaja diperlakukan sama di UI (lihat ForumRuang). */
export interface RuangInfo {
  kunci: string
  jenis: 'emiten' | 'topik'
  label: string
  keterangan: string | null
  aktif: boolean
}

/** Satu baris `forum_pesan`. RLS `pesan_baca` sudah menyaring: baris
 *  `disembunyikan` yang lolos ke klien cuma milik penulisnya sendiri atau
 *  dilihat superadmin — tak perlu filter tambahan di sini. */
export interface Pesan {
  id: string
  ruang: string
  induk: string | null
  penulis: string | null
  nama_anon: string | null
  isi: string
  disembunyikan: boolean
  alasan_sembunyi: string | null
  ditandai: boolean
  laporan: number
  dibuat_pada: string
}

/** Daftar ruang, topik dulu baru emiten (RPC tak menjamin urutan) — tiap
 *  kelompok diurutkan alfabetis biar stabil & tak perlu daftar prioritas. */
export async function ambilRingkasanRuang(): Promise<RuangRingkasan[]> {
  const { data, error } = await supabase.rpc('forum_ringkasan')
  if (error) throw error
  const baris = (data ?? []) as RuangRingkasan[]
  return [...baris].sort((a, b) =>
    a.jenis !== b.jenis ? (a.jenis === 'topik' ? -1 : 1) : a.label.localeCompare(b.label, 'id'),
  )
}

export async function ambilRuang(kunci: string): Promise<RuangInfo | null> {
  const { data, error } = await supabase
    .from('forum_ruang')
    .select('kunci, jenis, label, keterangan, aktif')
    .eq('kunci', kunci)
    .maybeSingle()
  if (error) throw error
  return data
}

export async function ambilPesan(kunci: string): Promise<Pesan[]> {
  const { data, error } = await supabase
    .from('forum_pesan')
    .select('*')
    .eq('ruang', kunci)
    .order('dibuat_pada', { ascending: true })
  if (error) throw error
  return (data ?? []) as Pesan[]
}

/** Insert `forum_laporan` — RLS `laporan_buat` mengizinkan siapa saja
 *  (termasuk anon). Trigger DB yang menaikkan `forum_pesan.laporan`/`ditandai`. */
export async function laporkanPesan(pesanId: string, alasan: string): Promise<string | null> {
  const { error } = await supabase.from('forum_laporan').insert({ pesan_id: pesanId, alasan })
  return error?.message ?? null
}

export interface KirimHasil {
  ok: boolean
  id?: string
  disembunyikan?: boolean
  catatan?: string | null
  sisa_kuota?: number | null
  galat?: string
  kuota_habis?: boolean
}

/** Satu-satunya jalur kirim pesan (anon & login) — Edge Function `forum-kirim`.
 *  Klien TIDAK PERNAH insert langsung ke `forum_pesan`: kuota anon dihitung
 *  dari hash IP yang cuma diketahui server, dan saringan isi juga jalan di
 *  server — kalau ditulis dua jalur, satu di antaranya jadi tak terpercaya. */
export async function kirimPesan(
  ruang: string,
  isi: string,
  induk: string | null,
  accessToken: string | undefined,
): Promise<KirimHasil> {
  const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/forum-kirim`
  const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string
  const headers: Record<string, string> = { 'Content-Type': 'application/json', apikey: anonKey }
  if (accessToken) headers.Authorization = `Bearer ${accessToken}`
  try {
    const res = await fetch(url, { method: 'POST', headers, body: JSON.stringify({ ruang, isi, induk }) })
    const json = await res.json().catch(() => ({}))
    return res.ok ? { ok: true, ...json } : { ok: false, galat: 'Pesan gagal terkirim.', ...json }
  } catch {
    return { ok: false, galat: 'Jaringan bermasalah — coba lagi.' }
  }
}

/** Waktu relatif ringkas ("3 menit lalu"); lewat 7 hari jatuh ke tanggal
 *  id-ID — "123 hari lalu" tak informatif. */
export function waktuRelatif(iso: string): string {
  const detik = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000)
  if (detik < 60) return 'baru saja'
  const menit = Math.floor(detik / 60)
  if (menit < 60) return `${menit} menit lalu`
  const jam = Math.floor(menit / 60)
  if (jam < 24) return `${jam} jam lalu`
  const hari = Math.floor(jam / 24)
  if (hari < 7) return `${hari} hari lalu`
  return new Date(iso).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })
}

/**
 * Alias penulis yang pernah menulis di forum. RLS `profil` membatasi SELECT ke
 * baris sendiri — membuka seluruh tabel ke publik bukan jawabannya (di situ ada
 * email, kuota, peran). Fungsi `forum_penulis` di server hanya mengembalikan
 * alias, dan hanya untuk akun yang memang punya pesan di forum.
 */
export async function ambilAliasPenulis(ids: string[]): Promise<Record<string, string>> {
  const unik = [...new Set(ids.filter(Boolean))]
  if (unik.length === 0) return {}
  const { data, error } = await supabase.rpc('forum_penulis', { ids: unik })
  if (error) return {}
  const peta: Record<string, string> = {}
  for (const b of (data ?? []) as Array<{ id: string; alias: string | null }>) {
    if (b.alias?.trim()) peta[b.id] = b.alias.trim()
  }
  return peta
}

/**
 * Nama tampilan penulis pesan. Urutan: nama tamu → alias sendiri → alias dari
 * `forum_penulis` → potongan id sebagai cadangan (akun tanpa alias; jangan
 * memalsukan identitas dengan menebak nama).
 */
export function namaPenulis(
  p: Pesan,
  idSaya: string | undefined,
  aliasSaya: string | null | undefined,
  petaAlias: Record<string, string> = {}
): string {
  if (p.nama_anon) return p.nama_anon
  if (!p.penulis) return 'Tamu'
  if (p.penulis === idSaya) return aliasSaya?.trim() || 'Anda'
  return petaAlias[p.penulis] || `Anggota-${p.penulis.slice(0, 4)}`
}
