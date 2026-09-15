import type { TanggalIndex } from './dataHarian'

/**
 * Cari tanggal bursa terdekat ≤ (tanggalAktif − hariMundur hari kalender),
 * dari daftar tanggal terurut naik (`index.json`). Dipakai pemilih periode
 * 1 Bulan/3 Bulan di tabel sektor (SektorIndeks.tsx) — mundur lewat kalender
 * lalu ambil hari bursa terakhir yang <= target, karena bursa tidak buka
 * tiap hari kalender ("trading_day − 30" akan salah).
 *
 * null kalau tidak ada tanggal yang cukup lama (mis. tanggal aktif ada di
 * awal riwayat data) — pemanggil wajib menampilkan "—", bukan 0.
 */
export function cariTanggalPembanding(
  tanggal: TanggalIndex[],
  tanggalAktif: string,
  hariMundur: number,
): TanggalIndex | null {
  const target = new Date(tanggalAktif)
  target.setDate(target.getDate() - hariMundur)
  const targetIso = target.toISOString().slice(0, 10)

  let hasil: TanggalIndex | null = null
  for (const t of tanggal) {
    if (t.date_iso <= targetIso) hasil = t
    else break
  }
  return hasil
}

/**
 * Persen perubahan periode: v_sekarang / v_pembanding − 1. null kalau data
 * pembanding tidak ada/nol — pemanggil tampilkan "—", bukan 0 (pola bug
 * berulang di proyek ini, lihat ytd.ts).
 */
export function hitungPeriodePct(sekarang: number, pembanding: number | null | undefined): number | null {
  if (!pembanding) return null
  return (sekarang / pembanding - 1) * 100
}

/** Rentang tanggal terpilih mode Rentang (#75) — kedua ujung selalu hari berdata. */
export interface RentangTanggal {
  mulai: string
  akhir: string
}

/**
 * Kosakata waktu tunggal (#170, prinsip 4 `docs/spek-kendali.md`).
 *
 * Audit `docs/audit-kendali.md` §3.2 menemukan tiga cara menulis hal yang
 * sama — "1 Tahun" di Broker Summary, "1T" di Indeks Dunia, "1 thn" di
 * Seasonality — dan Seasonality memakai "20 thn" sementara Indeks Dunia
 * memakai "10T" untuk maksud yang sama persis.
 *
 * Yang dipilih: kata penuh, mengikuti `PRESET_RENTANG` di bawah — satu-satunya
 * penulisan yang memang sudah dipakai bersama tiga halaman (Kalender Bursa,
 * Top Stocks, Sektor), jadi menyeragamkan ke sana mengubah paling sedikit
 * layar. Singkatan "1T"/"1 thn" dibuang: hemat beberapa piksel, tapi "T" bisa
 * terbaca sebagai triliun di halaman yang di sebelahnya memang menampilkan
 * nilai transaksi dalam triliun.
 *
 * Daftar ini BUKAN daftar pilihan satu halaman — tiap halaman mengambil
 * bagian yang berlaku untuknya. Yang tak berlaku dihilangkan, bukan ditulis
 * dengan gaya lain (prinsip 4).
 */
export const LABEL_RENTANG = {
  // hariIni: preset SATU hari bursa terakhir yang berdata (bukan "1 Hari"
  // duration — h1 di bawah punya makna beda, dipakai pemilih 1D/5D ala RTI).
  hariIni: 'Hari Ini',
  // Dua kunci tingkat HARI, ditambah B36 (panel Aliran Investor meniru
  // pemilih 1D/5D panel RTI). Dieja di sini, bukan di halamannya — itu
  // seluruh alasan tabel ini ada.
  h1: '1 Hari',
  h5: '5 Hari',
  w1: '1 Minggu',
  // w2 lahir di Inventory Neo (#359, disetujui Johan) — dieja di sini sejak
  // migrasi modul rentang bersama, bukan lagi hardcode '2 Pekan' di halaman.
  // Dieja '2 Minggu' sejak #209 (Johan 15 Sep 2026: "1 hari, 5 hari, 2 minggu, ...").
  w2: '2 Minggu',
  b1: '1 Bulan',
  // b2 lahir di Harian Papan (Johan 29 Agu 2026, "berarti ada 2 month dan
  // 3 month yaa") — dieja di sini sejak awal, bukan ditulis di halamannya.
  b2: '2 Bulan',
  b3: '3 Bulan',
  b6: '6 Bulan',
  wtd: 'WTD',
  mtd: 'MTD',
  // KATA UNTUK KOLOM RESMI BURSA, bukan untuk pil (#70). Sejak 7 Sep 2026
  // pembagiannya tegas: pil rentang yang menghitung sendiri memakai
  // `sejakJan` ("Sejak 1 Jan"), dan kunci ini disisakan untuk kolom yang
  // memuat angka YTD resmi bursa - persis pembagian yang diputuskan Johan
  // 5 Sep 2026, tapi dulu cuma tegak di empat halaman berbilah-tanggal
  // sementara sembilan tempat lain memakai kata ini untuk pil.
  ytd: 'YTD',
  // Rentang yang mulai di hari berdata pertama tahun berjalan — HITUNGAN yang
  // sama dengan `ytd`, KATA yang sengaja berbeda (keputusan Johan 5 Sep 2026,
  // artifact "Empat Bilah Kendali PAPAN", opsi A).
  //
  // Sebabnya tabrakan nama, bukan selera: Sektor & Indeks dan Top Stocks
  // sama-sama memajang kolom "YTD" berisi angka RESMI bursa, sementara pil di
  // bilah atasnya menghitung sendiri dari harga di tanggal mulai. Dua angka
  // berbeda dengan satu nama di satu layar — dan itu sudah pernah salah
  // dibaca (lihat kasus khusus YTD yang dijatuhkan tinjauan 2 Sep). Kata
  // "YTD" sekarang milik kolom resmi saja.
  // DIBALIK 9 Sep 2026 (#114 A, Johan lewat pengawas: pil ini dieja "YTD").
  // Keputusan 5 Sep sebelumnya justru sebaliknya — "Sejak 1 Jan" dipilih
  // supaya kata "YTD" tersisa untuk kolom berisi angka YTD RESMI bursa.
  // Yang membuat pembalikan ini aman: kunci/id-nya TIDAK ikut berubah
  // (`sejakJan` tetap `sejakJan`, `ytd` tetap `ytd`), jadi yang bergeser
  // cuma kata di layar — bukan data, bukan state, bukan alamat.
  sejakJan: 'YTD',
  y1: '1 Tahun',
  y2: '2 Tahun',
  y3: '3 Tahun',
  y5: '5 Tahun',
  y10: '10 Tahun',
  y20: '20 Tahun',
  semua: 'Semua',
} as const

export type KunciRentang = keyof typeof LABEL_RENTANG

/**
 * Daftar rentang BAKU untuk seluruh pemilih rentang (#209, Johan 15 Sep 2026:
 * "samakan semua mulai dari 1 hari, 5 hari, 2 minggu, 1 bulan, 3 bulan,
 * 6 bulan, Year to Date, 1 tahun, 2 tahun" · "beri opsi ekstra Semua" ·
 * "jika 5 hari di anggap 1 minggu ya 1 minggu saja").
 * Tiap pemilih menampilkan daftar yang SAMA; yang datanya tak cukup di halaman
 * itu tampil nonaktif, bukan disembunyikan.
 */
export const RENTANG_BAKU = ['h1', 'w1', 'w2', 'b1', 'b3', 'b6', 'sejakJan', 'y1', 'y2'] as const
export type KunciBaku = (typeof RENTANG_BAKU)[number]

/** Hari KALENDER mundur untuk kunci baku berpanjang tetap. */
export const HARI_KALENDER_BAKU: Record<Exclude<KunciBaku, 'h1' | 'sejakJan'>, number> =
  { w1: 7, w2: 14, b1: 30, b3: 91, b6: 182, y1: 365, y2: 730 }

export interface JendelaBaku {
  /** Hari berdata terakhir SEBELUM jendela — dasar return (tutup hari ini ÷ tutup pembanding). null untuk "Semua". */
  pembanding: string | null
  /** Hari berdata pertama DI DALAM jendela — awal penjumlahan dan grafik. */
  mulai: string
  /** Hari berdata terakhir yang ≤ `akhir` yang diminta. */
  akhir: string
}

/**
 * SATU definisi rentang untuk semua halaman (#209 Q1, keputusan Johan 15 Sep
 * 2026: "sesuai rekomendasimu saja"). Mundur N hari KALENDER dari hari aktif;
 * `pembanding` = hari berdata terakhir yang jatuh pada atau sebelum batas itu;
 * jendela = hari berdata sesudah pembanding sampai hari aktif. Jadi "1 Minggu"
 * dari Selasa = pembanding Selasa pekan lalu, jendela Rabu–Selasa (lima hari
 * bursa bila tanpa libur): return memakai tutup pembanding, jumlah dan grafik
 * memakai jendela — keduanya mengukur lima hari pergerakan yang sama.
 *
 * `1 Hari`: pembanding = hari berdata sebelumnya, jendela = hari aktif saja.
 * `YTD`: pembanding = hari berdata terakhir tahun lalu, jendela sejak hari
 * berdata pertama tahun berjalan. `Semua`: tanpa pembanding, sejak hari
 * berdata pertama.
 *
 * `null` = data tidak cukup (tak ada hari berdata pada atau sebelum batas);
 * opsinya ditampilkan nonaktif, bukan dihitung dari riwayat yang lebih pendek.
 *
 * `tanggal` wajib urut naik, format `YYYY-MM-DD`.
 */
export function jendelaBaku(tanggal: readonly string[], akhir: string, kunci: KunciBaku | 'semua'): JendelaBaku | null {
  let iAkhir = -1
  for (let i = tanggal.length - 1; i >= 0; i--) if (tanggal[i] <= akhir) { iAkhir = i; break }
  if (iAkhir < 0) return null
  const akhirEf = tanggal[iAkhir]
  if (kunci === 'semua') return { pembanding: null, mulai: tanggal[0], akhir: akhirEf }
  let batas: string
  if (kunci === 'h1') {
    batas = geserHari(akhirEf, -1)
  } else if (kunci === 'sejakJan') {
    batas = `${Number(akhirEf.slice(0, 4)) - 1}-12-31`
  } else {
    batas = geserHari(akhirEf, -HARI_KALENDER_BAKU[kunci])
  }
  let iPemb = -1
  for (let i = iAkhir - 1; i >= 0; i--) if (tanggal[i] <= batas) { iPemb = i; break }
  if (iPemb < 0) return null
  return { pembanding: tanggal[iPemb], mulai: tanggal[iPemb + 1], akhir: akhirEf }
}

function geserHari(iso: string, hari: number): string {
  const d = new Date(`${iso}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + hari)
  return d.toISOString().slice(0, 10)
}

/**
 * Susun opsi `PemilihRentang` dari daftar baku. `peta` memetakan kunci baku ke
 * id yang dipakai halaman (id lama boleh dipertahankan supaya state tersimpan
 * tak patah). Kunci yang tak dipetakan tetap tampil, nonaktif. "Semua" selalu
 * ada di ujung dan hanya aktif kalau `peta.semua` diisi — halaman beriwayat
 * lebih dari dua tahun.
 */
export function opsiRentangBaku<T extends string>(
  peta: Partial<Record<KunciBaku | 'semua', T>>,
  judul: Partial<Record<KunciBaku | 'semua', string>> = {},
): Array<{ id: T; label: string; judul?: string; nonaktif?: boolean }> {
  return ([...RENTANG_BAKU, 'semua'] as const).map((k) => {
    const id = peta[k]
    // Id pengganti untuk opsi nonaktif: tak pernah bisa dipilih, jadi tak
    // pernah sampai ke state halaman.
    return id
      ? { id, label: LABEL_RENTANG[k], judul: judul[k] }
      : { id: `__${k}` as T, label: LABEL_RENTANG[k], judul: judul[k] ?? 'Data halaman ini tidak cukup untuk rentang ini', nonaktif: true }
  })
}

/**
 * URUTAN kanonis pil rentang — pendek ke panjang (#70).
 *
 * `LABEL_RENTANG` sudah menjamin satu KATA per rentang. Yang belum dijaga
 * adalah URUTAN dan pemilihan subsetnya: tiap halaman menulis lariknya
 * sendiri, jadi tak ada apa pun yang mencegah "3 Bulan" berdiri sebelum
 * "1 Bulan" di halaman berikutnya. Sekarang urutannya milik berkas ini,
 * dan halaman cuma menyebut kunci mana yang berlaku untuknya.
 *
 * Subset yang berbeda antar halaman TETAP sah dan memang perlu — Top
 * Broker punya rollup lima preset, rincian broker tiga, Broker Dominan
 * empat. Yang tidak boleh berbeda hanya kata dan urutannya.
 *
 * `ytd` sengaja TIDAK ada di sini: sebagai PIL ia selalu dieja
 * "Sejak 1 Jan" (`sejakJan`), dan kata "YTD" disisakan untuk kolom resmi
 * bursa. Menaruh keduanya berarti dua kunci berebut satu posisi.
 */
export const URUTAN_PIL: readonly KunciRentang[] = [
  'hariIni', 'h1', 'h5', 'w1', 'w2', 'b1', 'b2', 'b3', 'b6',
  'wtd', 'mtd', 'sejakJan', 'y1', 'y2', 'y3', 'y5', 'y10', 'y20', 'semua',
] as const

/**
 * Susun opsi `PemilihRentang` dari kunci kosakata (#70).
 *
 * `id` dipisah dari `kunci` karena keduanya memang bisa berbeda: Top
 * Broker memakai id `hari` untuk kata "Hari Ini", dan beberapa halaman
 * menyimpan id `ytd` di state-nya sementara katanya "Sejak 1 Jan". Memaksa
 * id mengikuti kunci berarti memindahkan state tersimpan orang — harga
 * yang tak sebanding dengan kerapian nama.
 *
 * Hasilnya SELALU terurut menurut `URUTAN_PIL`, apa pun urutan masukannya.
 * Itu inti penjaganya: halaman tak bisa lagi menyusun urutan sendiri,
 * bahkan kalau penulisnya tak tahu ada aturannya.
 */
export function pilRentang<T extends string>(
  entri: ReadonlyArray<{ id: T; kunci: KunciRentang; judul?: string }>,
): Array<{ id: T; label: string; judul?: string }> {
  return [...entri]
    .sort((a, b) => URUTAN_PIL.indexOf(a.kunci) - URUTAN_PIL.indexOf(b.kunci))
    .map((e) => ({ id: e.id, label: LABEL_RENTANG[e.kunci], judul: e.judul }))
}

/**
 * Bentuk RINGKAS untuk tempat yang tak muat label penuh — kepala kolom tabel
 * lebar, lencana, chip sempit.
 *
 * Ada karena ketegangan yang nyata: kepala kolom yang baru dirapatkan tak
 * muat "1 Bulan", tapi halaman juga tak boleh mengeja sendiri (aturan proyek:
 * kata rentang waktu cuma dieja di berkas ini). Jadi bentuk pendeknya ikut
 * tinggal di sini — satu tempat, dua bentuk, bukan dua tempat.
 *
 * Hanya kunci yang benar-benar dipakai di ruang sempit yang punya bentuk ini;
 * sisanya memakai LABEL_RENTANG apa adanya.
 *
 * Perhatikan `wtd` dan `mtd` TANPA awalan angka, sama seperti label penuhnya.
 * Awalan itu yang membuat "1MTD" terbaca sebagai "1 bulan ke belakang"
 * padahal artinya "sejak awal bulan berjalan" — kesalahpahaman yang
 * benar-benar terjadi (Johan 29 Agu 2026: "kalau 1mtd itu (1 bulan
 * kebelakang ya)"), dan berujung pada perubahan definisi kolomnya.
 */
export const LABEL_RENTANG_RINGKAS: Partial<Record<KunciRentang, string>> = {
  h1: '1D',
  w1: '1M',
  b1: '1B',
  b2: '2B',
  b3: '3B',
  wtd: 'WTD',
  mtd: 'MTD',
  ytd: 'YTD',
  y1: '1T',
}

/**
 * Rentang mulai/akhir dari daftar baku (#209 tahap 2) — bungkus tipis atas
 * `jendelaBaku` yang membuang `pembanding`, untuk pemanggil yang cuma butuh
 * batas tampilan (BilahTanggal, PanelBreadth). Definisi hitungan & syarat
 * null PERSIS `jendelaBaku` — lihat komentarnya di atas.
 *
 * Menggantikan `rentangPreset`/`PRESET_RENTANG`/`HARI_PRESET`/`PresetRentang`
 * lama (#75/#34): tujuh preset ketikan sendiri per halaman, kata & hitungan
 * bisa menyimpang tanpa ada yang menyadarinya. Sekarang satu daftar
 * (`RENTANG_BAKU`), satu fungsi hitung (`jendelaBaku`), satu pembungkus
 * bentuk tampilan (fungsi ini).
 *
 * Bedanya dari `rentangPreset`: TIDAK menjepit ke tanggal berdata pertama
 * saat riwayat lebih pendek dari preset — `jendelaBaku` mengembalikan `null`,
 * dan pemanggil (lewat `opsiRentangBaku`) menampilkannya nonaktif, bukan
 * mendiam-diamkan potongan riwayat sebagai rentang penuh (#209 Q1, Johan 15
 * Sep 2026: "opsi yang datanya tidak cukup tampil nonaktif").
 */
export function rentangBaku(
  tanggal: readonly string[],
  akhir: string,
  kunci: KunciBaku | 'semua',
): RentangTanggal | null {
  const j = jendelaBaku(tanggal, akhir, kunci)
  return j ? { mulai: j.mulai, akhir: j.akhir } : null
}
