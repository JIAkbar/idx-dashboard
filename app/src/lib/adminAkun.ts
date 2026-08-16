import { supabase } from './supabase'

/** Satu baris tabel `profil`, bentuk hasil aksi `daftar` Edge Function admin-akun. */
export interface AkunRow {
  id: string
  email: string
  alias: string | null
  peran: 'superadmin' | 'kontributor'
  kuota_harian: number
  boleh_bedah: boolean
  aktif: boolean
  dibuat_pada: string
  terakhir_masuk: string | null
  /** Fase 6 (jenjang & kuota manual) — optional: kalau Edge Function `daftar`
   *  belum ikut mengembalikan field ini, UI jatuh ke nilai default (tier 0,
   *  kuota_manual null, beku_otomatis true) alih-alih pecah. */
  tier?: number | null
  kuota_manual?: number | null
  beku_otomatis?: boolean
  /** Reset akurasi (pendidikan bukan hukuman): `null` = akurasi dihitung dari
   *  seluruh riwayat, string ISO = dihitung ulang sejak tanggal itu. Jumlah
   *  setoran disetujui TIDAK terpengaruh — itu dihitung sepanjang masa. */
  akurasi_sejak?: string | null
}

/**
 * Berapa baris `setoran` yang IKUT TERHAPUS kalau akun ini dihapus.
 *
 * Bukan hiasan modal: FK `setoran.penyetor` memakai `on delete cascade`, jadi
 * menghapus akun juga membuang seluruh riwayat setorannya — sementara berkas
 * screenshot-nya TETAP tinggal di bucket tanpa baris yang merujuknya. Angka
 * ini yang membedakan "hapus akun kosong" dari "hapus 40 setoran sekaligus",
 * dan keduanya sebelumnya terlihat sama persis di layar.
 */
export async function hitungSetoranAkun(profilId: string): Promise<{ total: number; disetujui: number }> {
  const [total, disetujui] = await Promise.all([
    supabase.from('setoran').select('*', { count: 'exact', head: true }).eq('penyetor', profilId),
    supabase.from('setoran').select('*', { count: 'exact', head: true }).eq('penyetor', profilId).eq('status', 'disetujui'),
  ])
  if (total.error) throw total.error
  if (disetujui.error) throw disetujui.error
  return { total: total.count ?? 0, disetujui: disetujui.count ?? 0 }
}

type Aksi = 'daftar' | 'buat' | 'reset_sandi' | 'set_profil' | 'hapus' | 'set_email'

/** Keputusan murni "perlu diulang atau tidak" (dites tanpa jaringan, lihat
 *  adminAkun.test.ts). Token akses Supabase berumur 1 jam; tab lama yang masih
 *  terbuka mengirim token basi.
 *
 *  Token basi itu bisa ditolak DUA pihak, dan bentuk balasannya berbeda:
 *
 *  * Edge Function kita sendiri → 401 + `sesi_kedaluwarsa: true`
 *  * Gateway Supabase, kalau `verify_jwt` menyala → 401 + `{"message":"Invalid
 *    JWT"}`, tanpa flag apa pun; permintaannya bahkan tak pernah sampai ke
 *    fungsi
 *
 *  Dulu di sini disyaratkan flag itu ada, jadi penolakan gateway lolos dari
 *  jaring dan jalur "segarkan lalu ulangi" tak pernah jalan — orang cuma lihat
 *  "Gagal memanggil admin-akun (401)" dan harus memuat ulang halaman sendiri.
 *  Sekarang 401 apa pun memicu satu kali segarkan-dan-ulang: penyebab 401 yang
 *  bukan sesi (jarang) paling banter membayar satu permintaan tambahan, dan
 *  benar untuk kedua setelan `verify_jwt` — jadi setelan itu tak lagi jadi
 *  syarat diam-diam yang bisa terbalik tanpa disadari saat deploy ulang. */
export function perluUlangSesi(status: number, _body: { sesi_kedaluwarsa?: boolean }): boolean {
  return status === 401
}

async function panggilSekali(aksi: Aksi, muatan: Record<string, unknown>, token: string) {
  const url = import.meta.env.VITE_SUPABASE_URL
  const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY
  const res = await fetch(`${url}/functions/v1/admin-akun`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      apikey: anonKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ aksi, ...muatan }),
  })
  const body = await res.json().catch(() => ({}) as Record<string, unknown>)
  return { res, body: body as Record<string, unknown> }
}

/**
 * Panggil Edge Function `admin-akun` (backend Fase 1, sudah jadi) — token
 * diambil dari sesi Supabase aktif, otorisasi superadmin diperiksa di server
 * (non-superadmin dapat 403). Galat server (field `galat`) dilempar sebagai
 * Error biasa supaya pemanggil bisa tampilkan `err.message` apa adanya.
 *
 * Token kedaluwarsa (#bug tab lama, 15 Agu 2026): server balas 401 +
 * `sesi_kedaluwarsa: true` alih-alih 403 biasa — di sini di-refresh lalu
 * request diulang SEKALI dengan token baru. Gagal lagi → lempar pesan server
 * apa adanya, jangan ulang lebih dari sekali (hindari loop).
 */
export async function panggilAdminAkun<T>(aksi: Aksi, muatan: Record<string, unknown> = {}): Promise<T> {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) throw new Error('Sesi tidak ditemukan — masuk ulang.')

  let { res, body } = await panggilSekali(aksi, muatan, session.access_token)

  if (perluUlangSesi(res.status, body)) {
    const { data: disegarkan, error: errSegar } = await supabase.auth.refreshSession()
    if (!errSegar && disegarkan.session) {
      ;({ res, body } = await panggilSekali(aksi, muatan, disegarkan.session.access_token))
    }
  }

  if (!res.ok || body.galat) {
    throw new Error((body.galat as string | undefined) || `Gagal memanggil admin-akun (${res.status}).`)
  }
  return body as T
}

export async function daftarAkun(): Promise<AkunRow[]> {
  const r = await panggilAdminAkun<{ ok: true; akun: AkunRow[] }>('daftar')
  return r.akun
}

export function buatAkun(data: { email: string; sandi: string; alias?: string; kuota_harian?: number; boleh_bedah?: boolean }) {
  return panggilAdminAkun<{ ok: true; id: string; email: string }>('buat', data)
}

export function resetSandi(id: string, sandi: string) {
  return panggilAdminAkun<{ ok: true }>('reset_sandi', { id, sandi })
}

export function setProfil(
  id: string,
  patch: Partial<{
    peran: string
    kuota_harian: number
    boleh_bedah: boolean
    aktif: boolean
    alias: string
    /** Fase 6 — TAMBAHKAN ke muatan Edge Function admin-akun (backend sudah
     *  jadi, tidak diubah dari sini). `kuota_manual: null` = ikut jenjang. */
    kuota_manual: number | null
    beku_otomatis: boolean
    /** Jenjang (tier 0–5). Superadmin boleh menyetelnya langsung — misalnya
     *  memberi kontributor titik awal yang pantas tanpa menunggu perhitungan
     *  otomatis mengejar. Kuota tetap ditegakkan server lewat kuota_saya(). */
    tier: number
    /** Reset akurasi — string ISO = mulai hitung ulang dari sekarang, `null` =
     *  batalkan reset (kembali ke seluruh riwayat). `null` di sini BERMAKNA,
     *  sama seperti kuota_manual di atas. */
    akurasi_sejak: string | null
  }>
) {
  return panggilAdminAkun<{ ok: true }>('set_profil', { id, ...patch })
}

/** Ubah alamat email akun (aksi `set_email`, backend sudah dideploy) —
 *  alamat lama langsung tidak bisa dipakai masuk lagi setelah ini. */
export function ubahEmail(id: string, email: string) {
  return panggilAdminAkun<{ ok: true; email: string }>('set_email', { id, email })
}

/** Hapus akun permanen (backend Fase 6-adjacent, aksi `hapus` sudah dideploy
 *  di admin-akun) — server menolak kalau menghapus diri sendiri, akun
 *  superadmin (turunkan dulu perannya), atau akun yang punya setoran
 *  `disetujui` (saran server: nonaktifkan saja). */
export function hapusAkun(id: string) {
  return panggilAdminAkun<{ ok: true; email: string }>('hapus', { id })
}
