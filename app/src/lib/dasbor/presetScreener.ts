/**
 * Preset Screener — bundel saringan bernama di atas ruas yang sudah ada.
 *
 * Spek dari sesi AI Skill, perintah Johan 25 Agu 2026, meniru-memperbaiki
 * preset rekomendasi SPLE. Yang ditiru bentuk produknya; datanya milik kita.
 *
 * ## Ambang di sini, bukan di komponen
 *
 * Seluruh angka ambang tinggal di `PRESET` di bawah supaya (a) bisa diubah
 * tanpa menyentuh JSX, dan (b) tiap perubahannya terbaca di git sebagai
 * perubahan aturan — bukan terkubur di tengah render. Ini penting karena
 * ambangnya MASIH TEBAKAN AWAL: tak satu pun dari angka ini lahir dari uji
 * luar sampel. Antarmuka wajib menyebutnya "ambang v1".
 *
 * Pelajaran yang mendahului berkas ini: screener kandidat Deep Dive pernah
 * digoda untuk menaikkan ambang sampai dua kasus favorit muncul di puncak,
 * dan ketika dicoba, keduanya justru terbuang. Preset ini **penyaring**,
 * bukan peringkat kelayakan, dan teks di layar wajib mengatakannya.
 *
 * ## Kriteria yang datanya belum ada TIDAK dianggap gagal
 *
 * Sebagian kriteria (mis. label akumulasi/distribusi dari arus broker) baru
 * tersedia setelah tahap berikutnya. Kalau ruasnya `null`, kriteria itu
 * bernilai `'tak-terukur'` — BUKAN `false`. Bedanya menentukan: memperlakukan
 * data-yang-belum-ada sebagai "tidak memenuhi" akan membuang emiten yang
 * sebenarnya lolos, dan daftarnya menyusut tanpa satu pun keterangan. Skor
 * hanya dibagi dengan kriteria yang benar-benar terukur.
 */

export type HasilKriteria = 'lolos' | 'gagal' | 'tak-terukur'

/** Ruas yang dibutuhkan preset. Semua berasal dari `kartu/ringkas.json`;
 *  `null` berarti belum terhitung untuk emiten itu, bukan nol. */
export interface BarisPreset {
  kode: string
  harga: number | null
  ma5: number | null
  ma20: number | null
  ma50: number | null
  posisi_bb: number | null
  di_atas_kumo: boolean | null
  posisi_regresi: number | null
  freq: number | null
  ukuran_order: number | null
  peringkat_value: number | null
  net_asing_rp: number | null
  /** Label arus broker dari sumber (biner 'Acc'/'Dist'/'' — gradasi
   *  Big/Normal butuh hitungan NET-percent sendiri, belum dibangun). */
  label_accdist: string | null
  // ── Ruas preset Whale (adendum_preset_whale.md) ──────────────────────────
  /** Rata-rata nilai per transaksi hari ini ÷ median 60 harinya. */
  tiket_lonjakan: number | null
  /** Tiket rata-rata terbesar antar broker beli hari itu (Rp/transaksi). */
  tiket_broker_maks: number | null
  /** Nilai beli broker terbesar hari itu (Rp). */
  bval_maks: number | null
  /** Σ nilai beli papan NEGO hari itu (Rp); 0 = hari tanpa blok nego. */
  nego_blok_rp: number | null
  /** Net asing 5 hari (Rp resmi, foreignbuy−foreignsell). */
  asing_net_5h: number | null
  /** Hari beruntun searah net asing, bertanda (+masuk / −keluar). */
  asing_streak: number | null
  /** Konsentrasi top-3 dari sumber — BUKAN persen 0–100 murni (terukur bisa
   *  >100; basis pembilang/penyebutnya milik sumber). Ambang relatif tetap
   *  sah. */
  top3_pct: number | null
  /** Selisih jumlah broker beli vs jual (negatif = pembeli lebih sedikit —
   *  ciri akumulasi terkonsentrasi). */
  number_broker_buysell: number | null
}

export interface Kriteria {
  id: string
  /** Kalimat yang dibaca pengguna. Bukan nama ruas mesin — halaman ini
   *  publik, dan nama ruas mentah tak boleh tayang. */
  label: string
  uji: (b: BarisPreset, k: Konteks) => HasilKriteria
}

/** Angka yang hanya bisa dihitung dari SELURUH populasi hari itu, jadi tak
 *  bisa disimpan per-emiten. */
export interface Konteks {
  /** Persentil 25 ukuran order seluruh emiten hari itu. */
  ukuranOrderP25: number | null
}

const HARGA_MIN = 50

function num(v: number | null | undefined): v is number {
  return typeof v === 'number' && Number.isFinite(v)
}

/** Bantu: ubah boolean jadi hasil, dan `null` jadi 'tak-terukur'. */
function dari(v: boolean | null): HasilKriteria {
  return v === null ? 'tak-terukur' : v ? 'lolos' : 'gagal'
}

export interface Preset {
  id: string
  label: string
  /** Satu kalimat: untuk siapa preset ini, dan apa yang TIDAK dijanjikannya. */
  ringkas: string
  kriteria: Kriteria[]
}

export const PRESET: Preset[] = [
  {
    id: 'scalping',
    label: 'Scalping',
    ringkas:
      'Saham teramai hari ini yang harganya sedang menekan ke atas. Menyaring kandidat untuk ditelaah, bukan mengurutkan mana yang paling layak dibeli.',
    kriteria: [
      {
        id: 'ramai',
        label: '50 besar nilai transaksi hari ini',
        uji: (b) => dari(num(b.peringkat_value) ? b.peringkat_value <= 50 : null),
      },
      {
        id: 'frekuensi',
        label: 'Frekuensi transaksi minimal 10.000 kali',
        uji: (b) => dari(num(b.freq) ? b.freq >= 10_000 : null),
      },
      {
        id: 'order-kecil',
        label: 'Ukuran order termasuk seperempat terkecil pasar',
        uji: (b, k) =>
          dari(num(b.ukuran_order) && num(k.ukuranOrderP25) ? b.ukuran_order <= k.ukuranOrderP25 : null),
      },
      {
        id: 'ma-naik',
        label: 'Rata-rata 5 hari di atas rata-rata 20 hari',
        uji: (b) => dari(num(b.ma5) && num(b.ma20) ? b.ma5 > b.ma20 : null),
      },
      {
        id: 'pita-atas',
        label: 'Harga di paruh atas pita volatilitas',
        uji: (b) => dari(num(b.posisi_bb) ? b.posisi_bb >= 0.5 : null),
      },
      {
        id: 'arus-broker',
        label: 'Arus broker sedang menampung',
        uji: (b) =>
          dari(b.label_accdist === null ? null : /acc/i.test(b.label_accdist)),
      },
      {
        id: 'bukan-gocap',
        label: `Harga di atas Rp${HARGA_MIN}`,
        uji: (b) => dari(num(b.harga) ? b.harga > HARGA_MIN : null),
      },
    ],
  },
  {
    id: 'swing',
    label: 'Swing',
    ringkas:
      'Saham yang trennya sedang tersusun rapi ke atas dan masih didukung aliran dana. Menyaring kandidat untuk ditelaah, bukan mengurutkan mana yang paling layak dibeli.',
    kriteria: [
      {
        id: 'susunan-ma',
        label: 'Harga di atas rata-rata 20 hari, dan 20 hari di atas 50 hari',
        uji: (b) =>
          dari(
            num(b.harga) && num(b.ma20) && num(b.ma50) ? b.harga > b.ma20 && b.ma20 > b.ma50 : null,
          ),
      },
      {
        id: 'di-atas-awan',
        label: 'Harga berada di atas area keseimbangan jangka menengah',
        uji: (b) => dari(b.di_atas_kumo),
      },
      {
        id: 'tren-regresi',
        label: 'Harga di atas garis tengah tren 60 hari',
        uji: (b) => dari(num(b.posisi_regresi) ? b.posisi_regresi >= 0 : null),
      },
      {
        id: 'asing-masuk',
        label: 'Dana asing masuk bersih hari ini',
        uji: (b) => dari(num(b.net_asing_rp) ? b.net_asing_rp > 0 : null),
      },
    ],
  },
  // ── Tiga preset Whale (adendum_preset_whale.md) — TAMBAHAN, penegasan
  //    Johan: "sepertinya ini preset baru jgn di timpa dengan yang tadi".
  //    Ambang = v1 usulan, keputusan akhir Johan. Dua koreksi konsep yang
  //    WAJIB tercermin di teks UI pemakainya:
  //    (1) "lot × harga per transaksi" tak bisa persis — tak ada data tick;
  //        pengganti sahnya rata-rata nilai per transaksi + blok NEGO.
  //    (2) rasio volume beli/jual PASAR selalu 1 (tiap transaksi dua sisi) —
  //        yang diukur ketidakseimbangan per broker/konsentrasi, bukan itu.
  {
    id: 'whale-tiket',
    label: 'Whale · Tiket Besar',
    ringkas:
      'Jejak transaksi bernilai besar hari ini: rata-rata tiket melonjak, satu broker bertiket raksasa, atau blok negosiasi. Menyaring kandidat, bukan mengurutkan kelayakan beli.',
    kriteria: [
      {
        id: 'jejak-tiket',
        label: 'Ada jejak tiket besar (lonjakan ≥2× · broker ≥Rp250 jt/transaksi · nilai broker ≥Rp5 M · blok nego ≥Rp5 M)',
        // Empat pintu ATAU — satu kriteria, sesuai bentuk speknya. Tak
        // terukur hanya bila KEEMPAT ruasnya kosong.
        uji: (b) => {
          const pintu = [
            num(b.tiket_lonjakan) ? b.tiket_lonjakan >= 2 : null,
            num(b.tiket_broker_maks) ? b.tiket_broker_maks >= 250_000_000 : null,
            num(b.bval_maks) ? b.bval_maks >= 5_000_000_000 : null,
            num(b.nego_blok_rp) ? b.nego_blok_rp >= 5_000_000_000 : null,
          ]
          if (pintu.every((x) => x === null)) return 'tak-terukur'
          return pintu.some((x) => x === true) ? 'lolos' : 'gagal'
        },
      },
      {
        id: 'ramai',
        label: '200 besar nilai transaksi hari ini',
        uji: (b) => dari(num(b.peringkat_value) ? b.peringkat_value <= 200 : null),
      },
      {
        id: 'bukan-gocap',
        label: `Harga di atas Rp${HARGA_MIN}`,
        uji: (b) => dari(num(b.harga) ? b.harga > HARGA_MIN : null),
      },
    ],
  },
  {
    id: 'whale-akdis',
    label: 'Whale · Akumulasi',
    ringkas:
      'Akumulasi terkonsentrasi: arus broker menampung, tiga broker teratas mendominasi, pembeli lebih sedikit daripada penjual. Menyaring kandidat, bukan mengurutkan kelayakan beli.',
    kriteria: [
      {
        id: 'arus-akumulasi',
        // v1 memakai label BINER sumber ('Acc'); gradasi "Big Acc" (NET ≥20%)
        // butuh hitungan NET-percent sendiri — belum dibangun, jangan
        // diklaim lebih halus daripada datanya.
        label: 'Arus broker menampung',
        uji: (b) =>
          dari(b.label_accdist === null || b.label_accdist === '' ? null : /acc/i.test(b.label_accdist)),
      },
      {
        id: 'terkonsentrasi',
        label: 'Tiga broker teratas mendominasi (konsentrasi ≥60)',
        uji: (b) => dari(num(b.top3_pct) ? b.top3_pct >= 60 : null),
      },
      {
        id: 'pembeli-sedikit',
        label: 'Pembeli lebih sedikit daripada penjual (akumulasi senyap)',
        uji: (b) =>
          dari(num(b.number_broker_buysell) ? b.number_broker_buysell <= 0 : null),
      },
    ],
  },
  {
    id: 'whale-asing',
    label: 'Whale · Asing',
    ringkas:
      'Dana asing masuk konsisten pada emiten yang asingnya memang pemain berarti. Angka asing resmi harian, bukan taksiran. Menyaring kandidat, bukan mengurutkan kelayakan beli.',
    kriteria: [
      {
        id: 'asing-5h',
        label: 'Net asing 5 hari positif',
        uji: (b) => dari(num(b.asing_net_5h) ? b.asing_net_5h > 0 : null),
      },
      {
        id: 'asing-konsisten',
        label: 'Masuk beruntun minimal 3 hari',
        uji: (b) => dari(num(b.asing_streak) ? b.asing_streak >= 3 : null),
      },
      {
        id: 'asing-berarti',
        label: 'Porsi asing minimal 20% dari transaksi',
        uji: (b) => dari(num(b.porsi_asing) ? b.porsi_asing >= 0.2 : null),
      },
    ],
  },
]

export interface HasilPreset {
  kode: string
  /** Berapa kriteria terpenuhi. */
  lolos: number
  /** Berapa kriteria yang benar-benar bisa diuji (lolos + gagal). */
  terukur: number
  /** Berapa kriteria yang datanya belum ada. */
  takTerukur: number
  /** `lolos / terukur`, 0..1. `null` kalau tak satu pun kriteria terukur —
   *  jangan dibaca sebagai nol; artinya kita belum tahu apa-apa. */
  skor: number | null
  rinci: { id: string; label: string; hasil: HasilKriteria }[]
}

export function nilaiPreset(b: BarisPreset, p: Preset, k: Konteks): HasilPreset {
  const rinci = p.kriteria.map((kr) => ({ id: kr.id, label: kr.label, hasil: kr.uji(b, k) }))
  const lolos = rinci.filter((r) => r.hasil === 'lolos').length
  const gagal = rinci.filter((r) => r.hasil === 'gagal').length
  const terukur = lolos + gagal
  return {
    kode: b.kode,
    lolos,
    terukur,
    takTerukur: rinci.length - terukur,
    skor: terukur ? lolos / terukur : null,
    rinci,
  }
}

/**
 * Persentil 25 ukuran order atas populasi hari itu.
 *
 * Dipisah supaya bisa diuji sendiri, dan supaya jelas bahwa ambang ini
 * RELATIF terhadap pasar hari itu — bukan angka tetap. Ambang lot tetap akan
 * berarti hal yang sangat berbeda di hari sepi dan di hari ramai.
 */
export function hitungUkuranOrderP25(baris: BarisPreset[]): number | null {
  const v = baris.map((b) => b.ukuran_order).filter(num).sort((a, b) => a - b)
  if (v.length === 0) return null
  const i = Math.floor((v.length - 1) * 0.25)
  return v[i]
}

/**
 * Saring + urutkan hasil satu preset.
 *
 * `minLolos` sengaja dihitung terhadap kriteria TERUKUR, bukan terhadap
 * jumlah kriteria total: selama ruas arus broker belum ada, menuntut "6 dari
 * 7" akan mengosongkan seluruh daftar Scalping tanpa sebab yang terlihat di
 * layar.
 */
export function jalankanPreset(
  baris: BarisPreset[],
  p: Preset,
  opsi: { minLolos?: number } = {},
): HasilPreset[] {
  const k: Konteks = { ukuranOrderP25: hitungUkuranOrderP25(baris) }
  const min = opsi.minLolos ?? 0
  return baris
    .map((b) => nilaiPreset(b, p, k))
    .filter((h) => h.terukur > 0 && h.lolos >= min)
    .sort((a, b) => (b.skor ?? 0) - (a.skor ?? 0) || b.lolos - a.lolos || a.kode.localeCompare(b.kode))
}
