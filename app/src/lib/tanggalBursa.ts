/**
 * Tanggal acuan untuk semua form setoran admin.
 *
 * Dulu fungsi ini disalin apa adanya di empat berkas (UnggahHarian,
 * BedahUnggah, RadarUnggah, AdminTanggalContext) — dan keempatnya membawa bug
 * yang sama: mengembalikan tanggal kalender apa adanya, sehingga pada Sabtu
 * dan Minggu form terisi tanggal yang tak punya penutupan sama sekali.
 *
 * Akibatnya bukan cuma janggal. DatePicker hanya menampilkan Senin–Jumat,
 * jadi tanggal akhir pekan itu tak muncul di grid dan TAK BISA dikoreksi
 * dengan mengklik; setorannya tetap tersimpan, ke tanggal yang tak akan
 * pernah punya edisi. Ketahuan 16 Agu 2026: tiga setoran tercatat di Sabtu
 * 15 Agu, padahal isinya penutupan Jumat 14 Agu.
 */

/**
 * Tanggal merah manual. Rumahnya pindah ke sini dari `Kalender.tsx` (yang
 * sekarang mengimpor ulang dari sini) supaya satu-satunya daftar libur bisa
 * dipakai juga oleh `hariBursa()` — tanpa menyeret komponen kalender dasbor ke
 * dalam bundel halaman admin.
 *
 * 17 Agustus 2026 ditambahkan setelah kejadian nyata: bursa libur HUT
 * Kemerdekaan, dua kontributor tetap menyetor untuk tanggal itu karena tak ada
 * satu pun bagian aplikasi yang tahu hari itu libur.
 */
export const HOLIDAYS: Record<string, string> = {
  '2026-05-29': 'Kenaikan Isa Almasih',
  '2026-06-01': 'Hari Lahir Pancasila',
  '2026-08-17': 'HUT Kemerdekaan RI',
}

/**
 * Tanggal hari ini di zona WIB (Asia/Jakarta), BUKAN `toISOString()` (UTC) —
 * itu salah sebelum jam 07:00 WIB karena UTC masih tanggal "kemarin". Pakai
 * `Intl.DateTimeFormat` locale `en-CA` yang defaultnya sudah format
 * YYYY-MM-DD, jadi tidak perlu susun manual.
 *
 * Beda tugas dengan `tanggalBursaTerakhir()` dan jangan ditukar: yang ini
 * "sampai kapan sebuah tanggal masih masuk akal" (batas masa depan), yang itu
 * "tanggal apa yang sedang dikerjakan" (isian awal form).
 */
export function todayIsoJakarta(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta' }).format(new Date())
}

/** Daftar hari bursa sungguhan (`ihsg_harian.json`), kalau sudah dimuat.
 *  `akhirDaftar` = hari bursa terakhir yang tercakup — di luar itu daftarnya
 *  tak boleh dijadikan bukti apa pun (lihat `hariBursa`). */
let daftarBursa: ReadonlySet<string> | null = null
let akhirDaftar = ''

/** Pasang daftar hari bursa yang sudah ada di tangan pemanggil — dipakai
 *  `muatDaftarHariBursa()` dan uji. `akhir` wajib: tanpa batas cakupan, tanggal
 *  yang belum tercatat (hari ini) akan terbaca sebagai "bursa tutup". */
export function pasangDaftarHariBursa(tanggal: Iterable<string>, akhir: string): void {
  daftarBursa = new Set(tanggal)
  akhirDaftar = akhir
}

/** Lupakan daftar — mengembalikan perilaku "cuma akhir pekan + tanggal merah".
 *  Ada untuk uji; tak dipakai aplikasi. */
export function lupakanDaftarHariBursa(): void {
  daftarBursa = null
  akhirDaftar = ''
}

/**
 * Muat daftar hari bursa dari `ihsg_harian.json` (8.849 hari sejak 1990).
 *
 * Sengaja BUKAN daftar libur dari luar: berkas ini mencatat hari yang benar-
 * benar diperdagangkan, jadi ia ikut memuat libur dadakan dan cuti bersama
 * yang tak pernah masuk daftar tanggal merah mana pun.
 *
 * Gagal memuat bukan kondisi galat bagi pemanggil — `hariBursa()` tetap
 * menjawab dengan aturan akhir pekan + `HOLIDAYS`. Halaman tidak boleh berhenti
 * cuma karena satu berkas JSON lambat.
 */
export async function muatDaftarHariBursa(): Promise<void> {
  if (daftarBursa) return
  const r = await fetch('/data-idx/json/ihsg_harian.json')
  if (!r.ok) throw new Error(`ihsg_harian.json: HTTP ${r.status}`)
  const j = (await r.json()) as { tutup?: Record<string, number>; akhir?: string }
  const kunci = Object.keys(j.tutup ?? {})
  if (kunci.length === 0) throw new Error('ihsg_harian.json tidak berisi hari bursa.')
  pasangDaftarHariBursa(kunci, j.akhir || kunci[kunci.length - 1])
}

/**
 * `YYYY-MM-DD` itu hari bursa?
 *
 * Tiga lapis, dari yang paling murah: akhir pekan → tanggal merah → daftar hari
 * bursa sungguhan. Lapis ketiga cuma dipakai untuk tanggal yang SUDAH tercakup
 * daftarnya; di luar itu (hari ini dan seterusnya) ketidakhadiran sebuah
 * tanggal hanya berarti datanya belum masuk, bukan bursanya tutup — dan menuduh
 * "bukan hari bursa" untuk hari yang sedang berjalan akan memblokir setoran
 * yang justru paling wajar.
 */
export function hariBursa(iso: string): boolean {
  const [t, b, d] = iso.split('-').map(Number)
  if (!t || !b || !d) return false
  const hari = new Date(t, b - 1, d).getDay()
  if (hari === 0 || hari === 6) return false
  if (HOLIDAYS[iso]) return false
  if (daftarBursa && iso <= akhirDaftar) return daftarBursa.has(iso)
  return true
}

/** Alasan sebuah tanggal bukan hari bursa, untuk ditulis di layar — null kalau
 *  ia memang hari bursa. */
export function alasanBukanHariBursa(iso: string): string | null {
  if (hariBursa(iso)) return null
  return HOLIDAYS[iso] ?? 'Bursa tutup'
}

const keIso = (d: Date) => {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

export function tanggalBursaTerakhir(kini: Date = new Date()): string {
  const d = new Date(kini)
  // Mundur sehari demi sehari sampai ketemu hari bursa — bukan lagi lompatan
  // tetap Sabtu→Jumat, karena libur nasional bisa jatuh di hari apa saja dan
  // bisa berderet (cuti bersama). Batas 10 langkah: libur terpanjang tak sampai
  // sepuluh hari, dan tanpa batas satu kekeliruan di daftar libur akan membuat
  // fungsi ini berputar selamanya alih-alih menjawab agak meleset.
  for (let i = 0; i < 10; i++) {
    const iso = keIso(d)
    if (hariBursa(iso)) return iso
    d.setDate(d.getDate() - 1)
  }
  return keIso(d)
}
