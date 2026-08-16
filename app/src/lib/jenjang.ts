import { supabase } from './supabase'

/** Satu baris tabel `jenjang` (baca-saja utk semua yang login, backend sudah jadi). */
export interface JenjangRow {
  tier: number
  nama: string
  min_disetujui: number
  /** Persen (0–100). `null` = tier 0 "Pemula", tanpa syarat akurasi. */
  min_akurasi: number | null
  kuota: number
  /** Hari KERJA tanpa setoran sebelum akun dibekukan otomatis — naik seiring
   *  jenjang, jadi imbalan paling nyata dari rekam jejak panjang. */
  hari_beku?: number
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

/** Ringkasan akurasi milik PENGGUNA SENDIRI — dasar kartu jenjang di tab
 *  Unggah. Lewat RPC `akurasi_saya()`, BUKAN dihitung ulang di sini: dulu ada
 *  dua query count langsung ke `setoran` tanpa jendela `akurasi_sejak`, jadi
 *  angkanya bisa berbeda dari yang dipakai server (`hitung_jenjang()`)
 *  menentukan jenjang sesungguhnya begitu superadmin mereset akurasi
 *  seseorang. `sejak` null = akurasi dihitung dari seluruh riwayat. */
export async function hitungRingkasanSetoranSaya(): Promise<{ disetujui: number; dihapus: number; sejak: string | null }> {
  const { data, error } = await supabase.rpc('akurasi_saya')
  if (error) throw error
  const baris = data?.[0]
  return { disetujui: baris?.disetujui ?? 0, dihapus: baris?.dihapus ?? 0, sejak: baris?.sejak ?? null }
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
  /** `null` = akurasi dihitung dari seluruh riwayat. String ISO = superadmin
   *  pernah mereset akurasi akun ini, dihitung ulang sejak tanggal itu. */
  akurasiSejak: string | null
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
  dihapus: number,
  daftar: JenjangRow[],
  akurasiSejak: string | null = null
): RingkasanJenjang {
  const urut = [...daftar].sort((a, b) => a.tier - b.tier)
  const jenjangSaatIni = urut.find((j) => j.tier === tierSaatIni) ?? urut[0]
  const dikurasi = disetujui + dihapus
  const akurasiPersen = dikurasi > 0 ? (disetujui / dikurasi) * 100 : null
  const kuotaEfektif = kuotaManual ?? jenjangSaatIni.kuota
  const berikutnya = urut.find((j) => j.tier === tierSaatIni + 1) ?? null

  if (!berikutnya) {
    return { jenjangSaatIni, kuotaEfektif, disetujui, akurasiPersen, berikutnya: null, kurangSetoran: 0, akurasiCukup: true, akurasiSejak }
  }
  const kurangSetoran = Math.max(0, berikutnya.min_disetujui - disetujui)
  const akurasiCukup = berikutnya.min_akurasi === null || (akurasiPersen ?? 0) >= berikutnya.min_akurasi
  return { jenjangSaatIni, kuotaEfektif, disetujui, akurasiPersen, berikutnya, kurangSetoran, akurasiCukup, akurasiSejak }
}
