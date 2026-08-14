import { supabase } from './supabase'

/** Satu baris tabel `jenjang` (baca-saja utk semua yang login, backend sudah jadi). */
export interface JenjangRow {
  tier: number
  nama: string
  min_disetujui: number
  /** Persen (0–100). `null` = tier 0 "Pemula", tanpa syarat akurasi. */
  min_akurasi: number | null
  kuota: number
  hak: string | null
}

let cacheJenjang: JenjangRow[] | null = null

/** Daftar jenjang, urut tier naik — dicache modul (tabel statis, jarang berubah). */
export async function daftarJenjang(): Promise<JenjangRow[]> {
  if (cacheJenjang) return cacheJenjang
  const { data, error } = await supabase.from('jenjang').select('*').order('tier', { ascending: true })
  if (error) throw error
  cacheJenjang = (data ?? []) as JenjangRow[]
  return cacheJenjang
}

/** Jumlah setoran `disetujui` & `ditolak` milik PENGGUNA SENDIRI (semua
 *  tanggal) — dasar kartu jenjang di tab Unggah. `menunggu` tidak dihitung
 *  (belum ikut akurasi). RLS tabel `setoran` sudah membatasi ke baris sendiri,
 *  jadi query di sini tak perlu filter tambahan selain status. */
export async function hitungRingkasanSetoranSaya(): Promise<{ disetujui: number; ditolak: number }> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { disetujui: 0, ditolak: 0 }
  const [disetujui, ditolak] = await Promise.all([
    supabase.from('setoran').select('*', { count: 'exact', head: true }).eq('penyetor', user.id).eq('status', 'disetujui'),
    supabase.from('setoran').select('*', { count: 'exact', head: true }).eq('penyetor', user.id).eq('status', 'ditolak'),
  ])
  if (disetujui.error) throw disetujui.error
  if (ditolak.error) throw ditolak.error
  return { disetujui: disetujui.count ?? 0, ditolak: ditolak.count ?? 0 }
}

export interface RingkasanJenjang {
  jenjangSaatIni: JenjangRow
  /** `kuota_manual` kalau diisi superadmin, jatuh ke kuota jenjang kalau `null`. */
  kuotaEfektif: number
  disetujui: number
  /** `null` = belum ada setoran yang dikurasi (disetujui+ditolak = 0), tampilkan "—". */
  akurasiPersen: number | null
  /** `null` = sudah di tier tertinggi, tak ada jenjang berikutnya. */
  berikutnya: JenjangRow | null
  /** Kekurangan jumlah setoran disetujui menuju `berikutnya` (0 kalau sudah cukup). */
  kurangSetoran: number
  /** Akurasi sudah memenuhi syarat `berikutnya` (tak berarti otomatis naik — cuma salah satu syarat). */
  akurasiCukup: boolean
}

/**
 * Rangkuman kartu jenjang tab Unggah — fungsi murni (gampang diuji), dipanggil
 * dengan angka mentah dari `hitungRingkasanSetoranSaya()` + `profil.tier`.
 * Tier YANG TAMPIL selalu `tierSaatIni` (kolom `profil.tier`, otoritatif) —
 * fungsi ini TIDAK menghitung ulang tier dari angka setoran (kenaikan jenjang
 * itu urusan proses lain di backend), cuma memproyeksikan progres ke tier+1.
 */
export function ringkasanJenjang(
  tierSaatIni: number,
  kuotaManual: number | null,
  disetujui: number,
  ditolak: number,
  daftar: JenjangRow[]
): RingkasanJenjang {
  const urut = [...daftar].sort((a, b) => a.tier - b.tier)
  const jenjangSaatIni = urut.find((j) => j.tier === tierSaatIni) ?? urut[0]
  const dikurasi = disetujui + ditolak
  const akurasiPersen = dikurasi > 0 ? (disetujui / dikurasi) * 100 : null
  const kuotaEfektif = kuotaManual ?? jenjangSaatIni.kuota
  const berikutnya = urut.find((j) => j.tier === tierSaatIni + 1) ?? null

  if (!berikutnya) {
    return { jenjangSaatIni, kuotaEfektif, disetujui, akurasiPersen, berikutnya: null, kurangSetoran: 0, akurasiCukup: true }
  }
  const kurangSetoran = Math.max(0, berikutnya.min_disetujui - disetujui)
  const akurasiCukup = berikutnya.min_akurasi === null || (akurasiPersen ?? 0) >= berikutnya.min_akurasi
  return { jenjangSaatIni, kuotaEfektif, disetujui, akurasiPersen, berikutnya, kurangSetoran, akurasiCukup }
}
