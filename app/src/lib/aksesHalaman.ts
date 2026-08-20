/**
 * Logika murni kontrol akses halaman (Fase 6 sisi UI) — dipisah dari
 * context/AksesHalamanContext.tsx (yang urus fetch RPC + React state) supaya
 * gampang diuji tanpa perlu mock Supabase/React.
 *
 * PENTING: ini lapisan KENYAMANAN, BUKAN keamanan — data sensitif tetap
 * dijaga RLS di server (`boleh_buka()`, policy tabel). Halaman yang terkunci
 * TIDAK disembunyikan dari menu (tetap tampil + bisa diklik, cuma diberi
 * badge gembok) — komponen PenjagaHalaman-lah yang menahan RENDER isi
 * halamannya (jadi efek fetch data di dalamnya tak pernah jalan), bukan
 * navigasinya yang dicegah.
 */

/** Satu baris hasil `public.halaman_saya()` — lihat definisi fungsi di database.
 *  `induk`: kunci halaman induk (mis. 'probvv' induknya 'bulletin'). Aturan
 *  ANAK TAK PERNAH LEBIH TERBUKA DARIPADA INDUKNYA sudah ditegakkan di server
 *  (`boleh_buka()` meng-AND-kan hasil baris dgn hasil induknya) — `boleh` di
 *  sini SUDAH final, tak perlu dihitung ulang di klien. `induk` dikirim cuma
 *  supaya UI (tab Akses) bisa menampilkan hierarkinya. */
export interface HalamanSaya {
  kunci: string
  label: string
  tingkat: 'publik' | 'login' | 'superadmin'
  min_tier: number | null
  urutan: number
  boleh: boolean
  induk: string | null
}

/** `daftar === null` berarti belum selesai dimuat (atau RPC gagal) — fail-open. */
export function bolehBukaKunci(daftar: HalamanSaya[] | null, kunci: string): boolean {
  if (!daftar) return true
  const baris = daftar.find((d) => d.kunci === kunci)
  // Kunci yang belum terdaftar di `akses_halaman` (mis. salah ketik) juga fail-open
  // — jangan sampai typo kunci diam-diam mengunci halaman publik.
  return baris ? baris.boleh : true
}

export interface AlasanKunci {
  judul: string
  kalimat: string
  /** Tujuan tombol CTA di kartu kerangka terkunci: 'login' -> buka modal Masuk,
   *  'jenjang'/'superadmin' -> tautan ke halaman yang menjelaskan jenjang. */
  sasaran: 'login' | 'jenjang' | 'superadmin'
}

/** Alasan lengkap (kartu kerangka terkunci, PenjagaHalaman). `namaTier` ambil
 *  nama jenjang dari nomor tier (mis. 2 -> "Perak") — dilempar dari luar
 *  supaya fungsi ini tetap murni, tak perlu tahu cara ambil tabel `jenjang`. */
export function alasanKunci(
  daftar: HalamanSaya[] | null,
  kunci: string,
  adaSesi: boolean,
  namaTier: (tier: number) => string,
  /** Tier paling tinggi yang ada di tabel `jenjang`. Dipakai cuma untuk
   *  memilih kalimat: "Diamond atau lebih tinggi" menjanjikan jenjang yang
   *  tidak ada. `null` = daftar jenjang belum termuat, pakai kalimat aman. */
  tierTertinggi: number | null = null
): AlasanKunci {
  if (!adaSesi) {
    return { judul: 'Masuk dulu', kalimat: 'Halaman ini perlu akun untuk dibuka.', sasaran: 'login' }
  }
  const baris = daftar?.find((d) => d.kunci === kunci)
  if (baris?.tingkat === 'superadmin') {
    return { judul: 'Khusus superadmin', kalimat: 'Halaman ini cuma bisa dibuka superadmin.', sasaran: 'superadmin' }
  }
  const namaMin = baris?.min_tier != null ? namaTier(baris.min_tier) : null
  const puncak = tierTertinggi != null && baris?.min_tier === tierTertinggi
  return {
    judul: 'Jenjang belum cukup',
    kalimat: namaMin
      ? puncak
        ? `Perlu jenjang kontributor ${namaMin} — jenjang tertinggi — untuk membuka halaman ini.`
        : `Perlu jenjang kontributor ${namaMin} atau lebih tinggi untuk membuka halaman ini.`
      : 'Akun ini belum bisa membuka halaman ini.',
    sasaran: 'jenjang',
  }
}

/** Versi ringkas — tooltip badge gembok di rail/laci menu. */
export function alasanSingkat(
  daftar: HalamanSaya[] | null,
  kunci: string,
  adaSesi: boolean,
  namaTier: (tier: number) => string
): string {
  if (!adaSesi) return 'Perlu masuk'
  const baris = daftar?.find((d) => d.kunci === kunci)
  if (baris?.tingkat === 'superadmin') return 'Perlu superadmin'
  return baris?.min_tier != null ? `Perlu jenjang ${namaTier(baris.min_tier)}` : 'Terkunci'
}

/**
 * Peta id item menu dasbor (lib/dasbor/menu.ts, `MenuItem.id`) → kunci
 * `akses_halaman`. DIVERIFIKASI LANGSUNG ke isi tabel sungguhan (14 baris,
 * lewat `halaman_saya()`) — bukan tebakan dari nama kunci semata, sebab
 * beberapa nama kunci menyesatkan:
 *  - 'radar' labelnya "Radar WDWL" — itu tab admin /admin/radar (unggah data
 *    WDWL, superadmin), BUKAN halaman publik /radar "Radar Watchlist". Jadi
 *    /radar publik TIDAK dipetakan ke kunci mana pun di sini.
 *  - 'broker' labelnya persis "Broker Summary" — cuma /broker-summary. /broker
 *    (Top Broker) TIDAK dipetakan (server belum punya aturan akses utknya).
 *  - 'kalender' labelnya "Kalender Bursa" — itu panel kalender YANG ADA DI
 *    DALAM halaman Indeks Dunia (bukan rute/halaman sendiri, juga bukan Top
 *    Stocks). Karena PenjagaHalaman bekerja di level RUTE, kunci ini belum
 *    ada padanan guard-nya di sisi UI (di luar cakupan — panel di dalam
 *    halaman, bukan halaman utuh). 'stocks' (Top Stocks) sengaja TIDAK
 *    dipetakan ke 'kalender' (pemetaan awal yang salah, sudah dikoreksi).
 * Kalau pemetaan ini meleset dari maksud sesungguhnya, gampang diperbaiki di
 * sini saja (satu sumber).
 */
export const PETA_MENU_KUNCI: Record<string, string> = {
  world: 'dasbor',
  sector: 'sektor',
  chart: 'chart',
  'stock-detail': 'detail',
  'peta-investor': 'peta',
  'broker-summary': 'broker',
  // Halaman publik Radar Watchlist — PRODUK-nya yang dijaga. Tab admin
  // /admin/radar (tempat sumber WDWL diunggah) punya gerbang superadmin
  // sendiri, jadi keduanya tidak bertabrakan. Sempat salah tafsir sehingga
  // halaman ini terbuka untuk siapa saja padahal setelannya "perlu login".
  radar: 'radar',
  stocks: 'stocks',
  broker: 'topbroker',
  kalkulator: 'kalkulator',
  // Seasonality perlu masuk (keputusan 15 Agu 2026). Kuncinya tetap lewat tab
  // Akses supaya bisa dibuka untuk publik nanti tanpa menyentuh kode.
  seasonality: 'seasonality',
  bulletin: 'bulletin',
  feedback: 'saran',
  // Grafik Emiten (tahap 3 chart PAPAN, 17 Agu 2026) — perlu login, baris
  // `akses_halaman` ditambahkan bareng rutenya, bukan menyusul.
  grafik: 'grafik',
  // Kartu Analisa Emiten (18 Agu 2026). Baris `akses_halaman` BELUM ada di
  // database sesi ini (pola sama 'statistik' di bawah) -> kunci tak dikenal
  // fail-open, jadi halamannya publik sampai tingkatnya diatur dari tab
  // Akses. Yang penting kuncinya sudah terpasang di sini, supaya halaman ini
  // tak jadi celah yang tak kelihatan dari panel (persis yang dulu terjadi
  // pada Top Stocks & Top Broker).
  kartu: 'kta',
  // Statistik Berkala (18 Agu 2026). Barisnya BELUM ada di `akses_halaman` —
  // sengaja: kunci tak dikenal fail-open, jadi halamannya publik sampai
  // tingkatnya diatur dari tab Akses. Yang penting kuncinya sudah terpasang,
  // supaya halaman ini tak jadi celah yang tak kelihatan dari panel (persis
  // yang dulu terjadi pada Top Stocks & Top Broker).
  statistik: 'statistik',
  // Watchlist dinamis (backlog C8, 19 Agu 2026) — daftar pantau milik
  // pembaca sendiri (localStorage), BEDA dari 'radar' (arsip WDWL berbasis
  // aturan). Baris `akses_halaman` BELUM ada di database sesi ini (pola sama
  // 'kta'/'statistik') -> kunci tak dikenal fail-open, publik sampai
  // tingkatnya diatur dari tab Akses.
  watchlist: 'watchlist',
  // Bedah Emiten (backlog A2 / #153, 20 Agu 2026). Kuncinya SENGAJA
  // 'bedah-emiten', bukan 'bedah': kunci 'bedah' sudah menjaga tab admin
  // /admin/bedah (perakit edisi PDF, superadmin). Memakai ulang nama itu
  // membuat satu setelan menjaga dua hal yang tak berhubungan — membuka
  // halaman publik ini berarti membuka perakit edisi, dan menguncinya
  // berarti mengunci halaman analisa untuk semua orang. Barisnya BELUM ada
  // di `akses_halaman` (pola sama 'kta'/'statistik'/'watchlist') -> kunci
  // tak dikenal fail-open, publik sampai tingkatnya diatur dari tab Akses.
  'bedah-emiten': 'bedah-emiten',
}
