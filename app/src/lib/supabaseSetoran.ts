/**
 * Supabase: SETORAN kontributor + bucket "screenshots" (orderbook, chart,
 * bedah, radar). Dulu bernama `supabaseEdisi.ts` — namanya diganti karena
 * berkas ini tak lagi menyentuh edisi sama sekali, dan nama lamalah yang
 * membuat pertanyaan "siapa pemilik edisi?" terbuka berbulan-bulan.
 *
 * BATAS YANG SENGAJA DITARIK (A3, 20 Agu 2026) — **edisi Arus Pasar tidak
 * tinggal di Supabase.** Sampai hari ini repo punya dua jalur untuk hal yang
 * sama: perakitan berbasis berkas (`arus-pasar/build*.py` -> `keluaran/*.pdf`
 * + `keluaran/index.json`, dibaca `/bulletin` dan Rak Terbitan) dan tabel
 * Supabase `edisi` yang dibaca modul ini. Yang kedua **tidak pernah diisi**:
 * nol baris sejak dibuat, tak satu pun penulis di seluruh repo (`simpanEdisi`
 * nol pemanggil), dan RLS-nya memberi akses PENUH ke setiap akun login —
 * itulah alasan agen Bulletin dulu menolak memakainya untuk halaman publik
 * (`docs/BACKLOG-SWEEP-VISUAL.md` #37). Tabelnya sudah di-DROP dan
 * `EdisiRow`/`daftarEdisi`/`ambilEdisi`/`simpanEdisi` dibuang dari sini.
 *
 * Konsekuensinya, dan inilah yang membuat batas ini terbaca dari kode:
 * **jangan menambah fungsi edisi ke berkas ini.** Sumber kebenaran edisi =
 * berkas di `arus-pasar/` (manifest dibuat HANYA oleh `generate_index.py`,
 * yang menghormati `edisi/_tahan.json`); pembacanya `lib/dasbor/bulletin.ts`.
 * Supabase mengurus setoran & berkasnya, berhenti di situ.
 */
import { supabase } from './supabase'

/** Status kurasi & jenis baris tabel `setoran` (backend Fase 3, sudah jadi —
 *  lihat trigger & policy storage yang menegakkan aturan ini di server). */
export type StatusSetoran = 'menunggu' | 'revisi' | 'disetujui' | 'dihapus'
/** Jenis setoran kontributor.
 *
 * `'broksum'` = BROKER SUMMARY (rekap transaksi per kode broker). Sampai
 * 25 Agu 2026 nilainya bernama `'orderbook'` — salah sebut sejak awal;
 * isinya tak pernah antrean bid/offer, dan layar kurasi pun sudah lama
 * melabelinya "Broker Summary".
 *
 * Nama BERKAS di bucket tidak ikut dipindah: unggahan lama tetap bernama
 * `{tanggal}/{TICKER}-orderbook.ext`, unggahan baru `-broksum`, dan
 * `rangkumBerkas()` menerima keduanya. Memindahkan 106 objek storage demi
 * keseragaman nama berarti menukar risiko kehilangan gambar dengan
 * kerapian. */
export type JenisSetoran = 'broksum' | 'chart' | 'bedah'

/** Satu baris `setoran`, dengan embed profil penyetor (email/alias) — dasar
 *  kartu halaman Kurasi & badge status di AdminHome. */
export interface SetoranRow {
  id: string
  path: string
  tanggal: string
  ticker: string
  jenis: JenisSetoran
  penyetor: string
  alasan: string | null
  status: StatusSetoran
  catatan_kurator: string | null
  kurator: string | null
  dikurasi_pada: string | null
  dibuat_pada: string
  /** #138 — ikut dirakit ke PDF edisi? Keputusan REDAKSI, bukan kurasi.
   *  Kredit & jenjang kontributor tetap ikut `status`, bukan kolom ini. */
  dimuat: boolean
  profil: { email: string; alias: string | null } | null
}

/** Upsert baris `setoran` (path = kunci unik) SEBELUM unggah berkas — status
 *  akhir ditentukan trigger server (superadmin langsung disetujui, kontributor
 *  selalu menunggu); kolom kurasi tidak disentuh dari sini. */
async function upsertBarisSetoran(path: string, tanggal: string, ticker: string, jenis: JenisSetoran, alasan: string): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Sesi tidak ditemukan — masuk ulang.')
  const { error } = await supabase
    .from('setoran')
    .upsert({ path, tanggal, ticker, jenis, penyetor: user.id, alasan }, { onConflict: 'path' })
  if (error) throw error
}

/** Path companion thumbnail dari path berkas asli — {tanggal}/{ticker}-{jenis}.thumb.webp.
 *  Satu sumber dipakai baik saat unggah (buatDanUnggahThumbnail) maupun saat baca
 *  (urlScreenshotsThumb), supaya keduanya tak pernah beda ejaan. */
function pathThumb(path: string): string {
  return path.replace(/\.[^./]+$/, '.thumb.webp')
}

const MAKS_SISI_THUMB = 160

/** Resize gambar ke kotak maks 160px lewat <canvas>, encode WebP. `null` kalau
 *  peramban tak mendukung `toBlob('image/webp', …)` (fallback diam-diam ke PNG
 *  di beberapa peramban lama) — thumbnail dilewati, bukan diunggah dgn MIME
 *  yang salah. */
function buatThumbnailBlob(file: File): Promise<Blob | null> {
  return new Promise((resolve) => {
    const img = new Image()
    const urlObjek = URL.createObjectURL(file)
    img.onload = () => {
      URL.revokeObjectURL(urlObjek)
      const skala = Math.min(1, MAKS_SISI_THUMB / Math.max(img.width, img.height))
      const w = Math.max(1, Math.round(img.width * skala))
      const h = Math.max(1, Math.round(img.height * skala))
      const kanvas = document.createElement('canvas')
      kanvas.width = w
      kanvas.height = h
      const ctx = kanvas.getContext('2d')
      if (!ctx) { resolve(null); return }
      ctx.drawImage(img, 0, 0, w, h)
      kanvas.toBlob((b) => resolve(b && b.type === 'image/webp' ? b : null), 'image/webp', 0.75)
    }
    img.onerror = () => { URL.revokeObjectURL(urlObjek); resolve(null) }
    img.src = urlObjek
  })
}

/** Bikin & unggah thumbnail SETELAH berkas asli sukses (#165) — dipanggil
 *  tanpa await di pemanggil (fire-and-forget): thumbnail cuma optimasi
 *  tampilan kotak 40px, bukan data wajib, jadi kegagalannya TIDAK BOLEH
 *  menggagalkan unggahan utama. UI lama (urlScreenshots ke path asli) sudah
 *  jadi fallback otomatis kalau baris ini tak punya thumbnail. */
async function buatDanUnggahThumbnail(file: File, path: string): Promise<void> {
  try {
    const blob = await buatThumbnailBlob(file)
    if (!blob) return
    await supabase.storage.from('screenshots').upload(pathThumb(path), blob, { upsert: true, contentType: 'image/webp' })
  } catch {
    // ponytail: diam-diam gagal — thumbnail optimasi, bukan data wajib.
    // Upgrade ke retry/telemetri kalau kegagalannya ternyata sering di lapangan.
  }
}

/** Unggah screenshot ke bucket privat "screenshots", path {tanggal}/{ticker}-{jenis}.{ext}.
 *  Alur Fase 3: baris `setoran` dibuat DULU (policy storage menuntutnya sudah
 *  ada), baru berkas diunggah — kalau upload gagal, baris yang baru dibuat
 *  dihapus lagi supaya tidak meninggalkan baris yatim tanpa berkas.
 *  ponytail: hapus dilakukan tanpa cek "baru dibuat vs upsert baris lama" —
 *  pada upsert path yang sama (re-unggah), kegagalan upload akan ikut
 *  menghapus baris lama juga; upgrade ke cek keberadaan-sebelum-upsert kalau
 *  re-unggah-gagal ternyata sering terjadi di lapangan. */
export async function unggahScreenshot(
  file: File,
  tanggal: string,
  ticker: string,
  jenis: 'broksum' | 'chart',
  alasan: string
): Promise<string> {
  const ext = file.name.split('.').pop() || 'png'
  const path = `${tanggal}/${ticker}-${jenis}.${ext}`

  // Tiap galat DITANDAI TAHAPNYA. Dua tahap ini ditolak server dengan kalimat
  // yang mirip ("row-level security"), padahal penyebabnya berbeda jauh:
  // tahap baris = alasan/penyetor/status, tahap berkas = kuota, emiten
  // bentrok, tanggal, atau bentuk nama berkas. Tanpa penanda ini, penyelidikan
  // penolakan 14 & 16 Agu berputar di tempat karena tak ada yang tahu bagian
  // mana yang sebenarnya menolak.
  try {
    await upsertBarisSetoran(path, tanggal, ticker, jenis, alasan)
  } catch (e) {
    throw new Error(`[tahap: baris setoran] ${e instanceof Error ? e.message : String(e)}`)
  }

  const { error } = await supabase.storage.from('screenshots').upload(path, file, { upsert: true })
  if (error) {
    await supabase.from('setoran').delete().eq('path', path)
    throw new Error(`[tahap: unggah berkas] ${error.message}`)
  }
  void buatDanUnggahThumbnail(file, path)
  return path
}

/**
 * Hapus screenshot dari bucket "screenshots" berdasarkan path lengkap
 * ({tanggal}/{nama}) — berikut baris `setoran` yang menunjuk ke situ.
 *
 * URUTANNYA PENTING: **baris dulu, berkas belakangan.** Versi pertama
 * melakukan sebaliknya dan menelan galat hapus baris dengan alasan "storage
 * sudah terhapus duluan, jadi bukan kegagalan di mata pengguna" — dan itulah
 * yang menghasilkan baris yatim: RLS menolak menghapus baris yang sudah
 * dikurasi, tapi berkasnya sudah telanjur hilang. Yang tersisa: kartu setoran
 * dengan gambar rusak, selamanya, tanpa satu pun galat tercatat. (Bukti masih
 * ada di basis data: `2026-08-14/INDY-orderbook.jpg`.)
 *
 * Baris `setoran` adalah catatan otoritatifnya — kalau ia menolak dihapus,
 * berkasnya memang belum boleh hilang. Storage yang tertinggal tanpa baris
 * masih bisa disapu belakangan; baris tanpa berkas tidak bisa dipulihkan.
 */
export async function hapusScreenshot(paths: string[]): Promise<void> {
  if (paths.length === 0) return

  const { error: galatBaris } = await supabase.from('setoran').delete().in('path', paths)
  if (galatBaris) throw galatBaris

  // RLS yang menolak DELETE **tidak melempar galat** — ia cuma menyaring
  // barisnya, dan hasilnya "sukses" tanpa satu baris pun terhapus. Jadi
  // keberhasilannya harus DIPERIKSA, bukan dipercaya: baris yang masih ada
  // setelah delete berarti tak boleh dihapus, dan berkasnya ikut tidak boleh
  // hilang. (Baris tak ada sejak awal — contoh/, bedah/, radar/ — memang wajar
  // dan tak menghalangi apa pun.)
  const { data: tersisa, error: galatCek } = await supabase
    .from('setoran').select('path').in('path', paths)
  if (galatCek) throw galatCek
  const tertahan = (tersisa ?? []).map((r) => r.path as string)
  if (tertahan.length > 0) {
    throw new Error(
      tertahan.length === paths.length
        ? 'Berkas ini tak bisa dihapus — setorannya sudah dikurasi atau bukan milikmu.'
        : `${tertahan.length} berkas tak bisa dihapus (sudah dikurasi atau bukan milikmu): ${tertahan.join(', ')}.`,
    )
  }

  const { error } = await supabase.storage.from('screenshots').remove(paths)
  if (error) throw error
}

/** Jalur yang sama, tapi di tanggal lain. Bentuk jalur setoran cuma dua:
 *  `{tanggal}/{TICKER}-{jenis}.{ext}` (harian) dan
 *  `bedah/{TICKER}/{tanggal}/{jenis}.{ext}`. Bentuk lain (mis. `radar/`) tidak
 *  punya baris `setoran`, jadi melemparnya lebih jujur daripada menebak. */
export function jalurDiTanggal(path: string, tanggalBaru: string): string {
  const p = path.split('/')
  const iso = /^\d{4}-\d{2}-\d{2}$/
  if (iso.test(p[0])) return [tanggalBaru, ...p.slice(1)].join('/')
  if (p[0] === 'bedah' && iso.test(p[2] ?? '')) return [p[0], p[1], tanggalBaru, ...p.slice(3)].join('/')
  throw new Error(`Jalur "${path}" tidak berpola tanggal — tak bisa dipindahkan.`)
}

/**
 * Pindahkan satu setoran ke tanggal lain (superadmin) — untuk setoran yang
 * masuk di tanggal keliru, mis. hari bursa libur.
 *
 * TANGGALNYA IKUT TERTANAM DI JALUR BERKAS, jadi ini bukan sekadar `UPDATE
 * setoran SET tanggal`. Kalau cuma barisnya yang diubah, `path`-nya masih
 * menunjuk folder tanggal lama dan kartunya jadi bergambar rusak — kelas cacat
 * yang sudah pernah terjadi di proyek ini (lihat `hapusScreenshot`).
 *
 * Urutannya, dan alasan tiap langkah:
 *   1. Bentrok diperiksa DULU, sebelum apa pun disentuh. Menimpa setoran orang
 *      lain berarti menghapus kerjanya tanpa dia tahu.
 *   2. Berkas dipindah lebih dulu — inilah satu-satunya langkah yang BISA
 *      DIBATALKAN. Baris yang sudah berubah tak punya jalan pulang yang aman
 *      kalau berkasnya ternyata tak bisa ikut.
 *   3. Baris menyusul, dan hasilnya DIPERIKSA: RLS yang menolak UPDATE tidak
 *      melempar galat, ia menyaring barisnya dan hasilnya "sukses" dengan nol
 *      baris terpengaruh. Sudah pernah kejadian di proyek ini.
 *   4. Baris gagal → berkas dikembalikan ke jalur lama. Tanpa ini, berkas dan
 *      baris berpisah dan tak ada yang tahu.
 *
 * `penyetor` sengaja tidak disentuh: yang berpindah tanggalnya, bukan
 * kepemilikannya. Begitu juga `status`/`dimuat` — memindahkan tanggal bukan
 * tindakan kurasi.
 */
export async function pindahTanggalSetoran(path: string, tanggalBaru: string): Promise<string> {
  const pathBaru = jalurDiTanggal(path, tanggalBaru)
  if (pathBaru === path) throw new Error('Setoran ini sudah ada di tanggal itu.')

  const { data: bentrok, error: galatCek } = await supabase
    .from('setoran').select('ticker,jenis').eq('path', pathBaru).maybeSingle()
  if (galatCek) throw galatCek
  if (bentrok) {
    const b = bentrok as { ticker: string; jenis: JenisSetoran }
    throw new Error(`${b.ticker} (${b.jenis}) sudah punya setoran di ${tanggalBaru} — pindahkan atau hapus yang di sana dulu.`)
  }

  const { error: galatPindah } = await supabase.storage.from('screenshots').move(path, pathBaru)
  if (galatPindah) throw new Error(`[tahap: pindah berkas] ${galatPindah.message}`)

  const { data: terubah, error: galatBaris } = await supabase
    .from('setoran')
    .update({ tanggal: tanggalBaru, path: pathBaru })
    .eq('path', path)
    .select('path')

  const gagal = galatBaris
    ?? ((terubah ?? []).length === 0
      ? new Error('Barisnya tidak berubah — setoran ini tak ada lagi, atau kamu tidak berhak mengubahnya.')
      : null)
  if (gagal) {
    // Kembalikan berkasnya. Kalau pengembalian ini pun gagal, katakan
    // jalurnya: berkas yang berpindah sendirian tak akan ketahuan dari layar
    // mana pun, dan orang yang membereskannya butuh tahu ia ada di mana.
    const { error: galatPulang } = await supabase.storage.from('screenshots').move(pathBaru, path)
    if (galatPulang) {
      throw new Error(`${gagal.message} Berkasnya TIDAK bisa dikembalikan dan sekarang ada di "${pathBaru}" — pindahkan manual ke "${path}".`)
    }
    throw gagal
  }
  return pathBaru
}

/** Baris `setoran` untuk satu tanggal (semua jenis/status) — dasar badge
 *  status di AdminHome & daftar kartu halaman Kurasi. */
export async function daftarSetoran(tanggal: string): Promise<SetoranRow[]> {
  const { data, error } = await supabase
    .from('setoran')
    .select('*, profil!setoran_penyetor_profil_fkey(email,alias)')
    .eq('tanggal', tanggal)
    .order('dibuat_pada', { ascending: false })
  if (error) throw error
  return (data ?? []) as unknown as SetoranRow[]
}

/** Ubah alasan baris sendiri — server (RLS) yang menegakkan "hanya selagi
 *  status masih menunggu"; UI cuma menyembunyikan kontrolnya di luar itu. */
export async function ubahAlasanSetoran(path: string, alasan: string): Promise<void> {
  const { error } = await supabase.from('setoran').update({ alasan }).eq('path', path)
  if (error) throw error
}

/** Kurasi massal (superadmin) — setujui/hapus sekumpulan path sekaligus.
 *  Server menolak kolom kurasi utk non-superadmin; validasi "catatan wajib
 *  saat menghapus" ada di pemanggil (UI), bukan di sini.
 *
 *  Status 'ditolak' DIBUANG di #142: dia tak menjawab apa pun — berkasnya
 *  tinggal, penyetor tak bisa memperbaiki, akurasinya turun. Yang tersisa tiga
 *  aksi dengan tiga makna jelas: setujui, revisi, hapus. */
export async function kurasiSetoran(paths: string[], status: 'disetujui' | 'dihapus', catatanKurator?: string): Promise<void> {
  if (paths.length === 0) return
  const { data: { user } } = await supabase.auth.getUser()
  const { error } = await supabase
    .from('setoran')
    .update({
      status,
      catatan_kurator: catatanKurator?.trim() || null,
      kurator: user?.id ?? null,
      dikurasi_pada: new Date().toISOString(),
    })
    .in('path', paths)
  if (error) throw error
}

/** #138 — masukkan/keluarkan setoran dari edisi hari itu. Terpisah dari
 *  `kurasiSetoran`: menolak data yang benar demi memangkas isi edisi adalah
 *  hukuman untuk kerja yang tak bersalah, dan itu justru yang dihindari kolom
 *  `dimuat`. */
export async function setDimuat(paths: string[], dimuat: boolean): Promise<void> {
  if (paths.length === 0) return
  const { error } = await supabase.from('setoran').update({ dimuat }).in('path', paths)
  if (error) throw error
}

/** Minta revisi (superadmin) — sekumpulan path sekaligus. Pola SAMA dengan
 *  kurasiSetoran(), cuma status selalu 'revisi' dan catatan WAJIB (dilempar
 *  Error kalau kosong/spasi) — beda dari tolak yang validasinya di pemanggil,
 *  di sini wajibnya mutlak karena 'revisi' tanpa catatan bikin penyetor tak
 *  tahu apa yang harus diperbaiki. */
export async function mintaRevisiSetoran(paths: string[], catatanKurator: string): Promise<void> {
  if (paths.length === 0) return
  if (!catatanKurator.trim()) throw new Error('Catatan wajib diisi — penyetor perlu tahu apa yang harus diperbaiki.')
  const { data: { user } } = await supabase.auth.getUser()
  const { error } = await supabase
    .from('setoran')
    .update({
      status: 'revisi',
      catatan_kurator: catatanKurator.trim(),
      kurator: user?.id ?? null,
      dikurasi_pada: new Date().toISOString(),
    })
    .in('path', paths)
  if (error) throw error
}

/** Jumlah baris `setoran` jenis orderbook milik PENGGUNA SENDIRI untuk satu
 *  tanggal — dasar modal "kuota habis" di UnggahHarian, dicek SEBELUM buka
 *  form (server tetap wasit akhir lewat RLS saat submit). head:true supaya
 *  server cuma balas hitungan. */
export async function hitungSetoranSaya(tanggal: string): Promise<number> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return 0
  const { count, error } = await supabase
    .from('setoran')
    .select('*', { count: 'exact', head: true })
    .eq('penyetor', user.id)
    .eq('tanggal', tanggal)
    .eq('jenis', 'broksum')
  if (error) throw error
  return count ?? 0
}

/** Jumlah baris `setoran` berstatus `menunggu` (SEMUA tanggal) — badge tab
 *  Kurasi di AdminLayout. head:true supaya server cuma balas hitungan,
 *  bukan menarik seluruh baris. */
export async function hitungSetoranMenunggu(): Promise<number> {
  const { count, error } = await supabase
    .from('setoran')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'menunggu')
  if (error) throw error
  return count ?? 0
}

/** Jumlah baris `setoran` berstatus `menunggu`, PER TANGGAL, untuk 90 hari
 *  terakhir — dasar badge kalender pemilih tanggal di layar Kurasi. PostgREST
 *  tak punya GROUP BY sisi server; kolom `tanggal` mentah ditarik (jendela
 *  DIBATASI 90 hari, disebut eksplisit di sini supaya tak diam-diam memotong
 *  tanpa jejak — bukan seluruh riwayat) lalu diagregasi di klien. */
export async function hitungMenungguKurasi(): Promise<Map<string, number>> {
  const batas = new Date()
  batas.setDate(batas.getDate() - 90)
  const pad = (n: number) => String(n).padStart(2, '0')
  const batasIso = `${batas.getFullYear()}-${pad(batas.getMonth() + 1)}-${pad(batas.getDate())}`
  const { data, error } = await supabase
    .from('setoran')
    .select('tanggal')
    .eq('status', 'menunggu')
    .gte('tanggal', batasIso)
  if (error) throw error
  const peta = new Map<string, number>()
  for (const r of (data ?? []) as { tanggal: string }[]) {
    peta.set(r.tanggal, (peta.get(r.tanggal) ?? 0) + 1)
  }
  return peta
}

/** True kalau pengguna sudah PERNAH punya baris `setoran` (semua status,
 *  semua tanggal) — dasar default buka/tutup panel panduan screenshot (Fase
 *  5): akun yang belum pernah menyetor lebih butuh panduan terbuka duluan. */
export async function pernahMenyetor(): Promise<boolean> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return false
  const { count, error } = await supabase
    .from('setoran')
    .select('*', { count: 'exact', head: true })
    .eq('penyetor', user.id)
  if (error) throw error
  return (count ?? 0) > 0
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

/** Sama seperti `urlScreenshots`, tapi buat KOTAK THUMBNAIL 40px (#165) — coba
 *  companion `.thumb.webp` (jauh lebih kecil) dulu, jatuh ke berkas ASLI utk
 *  path yang belum punya thumbnail (unggahan sebelum fitur ini ada). Hasilnya
 *  tetap dikunci ke path ASLI supaya pemanggil tak perlu tahu bedanya. */
export async function urlScreenshotsThumb(paths: string[]): Promise<Record<string, string>> {
  if (paths.length === 0) return {}
  const thumbUrls = await urlScreenshots(paths.map(pathThumb))
  const belumAda = paths.filter((p) => !thumbUrls[pathThumb(p)])
  const asli = belumAda.length > 0 ? await urlScreenshots(belumAda) : {}
  const hasil: Record<string, string> = {}
  for (const p of paths) {
    const u = thumbUrls[pathThumb(p)] ?? asli[p]
    if (u) hasil[p] = u
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
  jenis: 'broksum-rentang' | 'done-summary',
  alasan: string
): Promise<string> {
  const ext = file.name.split('.').pop() || 'png'
  const path = `bedah/${ticker}/${tanggal}/${jenis}.${ext}`
  // Baris `setoran` (jenis kolom cuma kenal 'bedah', bukan sub-jenisnya) dibuat
  // dulu — pola sama unggahScreenshot, lihat komentarnya soal upsert+hapus.
  await upsertBarisSetoran(path, tanggal, ticker, 'bedah', alasan)
  const { error } = await supabase.storage.from('screenshots').upload(path, file, { upsert: true })
  if (error) {
    await supabase.from('setoran').delete().eq('path', path)
    throw error
  }
  return path
}

/** Ticker Bedah terakhir yang disetor PENGGUNA SENDIRI (baris `setoran`
 *  jenis 'bedah', terbaru dulu) — dipakai BedahUnggah.tsx sbg fallback saat
 *  kunci emiten (localStorage) kosong, mis. browser baru atau storage
 *  dibersihkan. Cuma kemudahan antarmuka, bukan sumber kebenaran. */
export async function tickerBedahTerakhirSaya(): Promise<string | null> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data, error } = await supabase
    .from('setoran')
    .select('ticker')
    .eq('penyetor', user.id)
    .eq('jenis', 'bedah')
    .order('dibuat_pada', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (error) return null
  return (data as { ticker: string } | null)?.ticker ?? null
}

/** Nama berkas Bedah yang sudah terunggah untuk satu emiten + tanggal. */
export async function daftarBedah(ticker: string, tanggal: string): Promise<string[]> {
  const { data, error } = await supabase.storage.from('screenshots').list(`bedah/${ticker}/${tanggal}`)
  if (error) throw error
  return (data ?? []).map((f) => f.name)
}

/** Satu tanggal di arsip Bedah satu emiten — `paths` = berkas (broksum-rentang
 *  dan/atau done-summary) yang tersimpan untuk tanggal itu. */
export interface BedahArsipTanggal {
  tanggal: string
  paths: string[]
}

export interface BedahArsipBaris {
  ticker: string
  /** Diurutkan tanggal menaik — satu emiten kini wajar punya banyak tanggal
   *  (itu inti "Bedah Arus Saham": satu emiten lintas waktu), jadi arsipnya
   *  tidak lagi diringkas jadi satu "tanggal terakhir". */
  tanggalList: BedahArsipTanggal[]
  jumlahBerkas: number
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
      const tanggalNama = (folderTanggal ?? []).filter((f) => f.id === null).map((f) => f.name).sort()
      const tanggalList = await Promise.all(
        tanggalNama.map(async (tgl): Promise<BedahArsipTanggal> => {
          const { data: berkas } = await supabase.storage.from('screenshots').list(`bedah/${ticker}/${tgl}`)
          return { tanggal: tgl, paths: (berkas ?? []).map((f) => `bedah/${ticker}/${tgl}/${f.name}`) }
        })
      )
      const jumlahBerkas = tanggalList.reduce((n, t) => n + t.paths.length, 0)
      return { ticker, tanggalList, jumlahBerkas }
    })
  )
  return baris.sort((a, b) => a.ticker.localeCompare(b.ticker))
}
