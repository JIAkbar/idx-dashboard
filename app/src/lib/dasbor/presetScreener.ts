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
  /** Label arus broker — belum tersedia sampai tahap ruas bandar selesai. */
  label_accdist: string | null
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
