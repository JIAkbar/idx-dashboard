/**
 * Rezim pasar — perilaku emiten saat IHSG naik vs saat IHSG turun.
 *
 * Dibangun `scripts/bangun_rezim_pasar.py` (blok A Berkas Emiten, permintaan
 * Johan 28 Agu 2026: "potensi dia naik atau turun di saat market bearish or
 * bullish"). Satu berkas untuk semua emiten — halaman memuatnya sekali lalu
 * membaca satu kunci; ukurannya ±1,3 MB dan disinggahkan modul ini.
 *
 * ANGKANYA BUKAN RAMALAN. `tangkap_naik` 1,45 berarti "pada 3.009 hari IHSG
 * naik, emiten ini rata-rata bergerak 1,45× gerak pasar" — frekuensi historis,
 * bukan janji untuk hari besok. Komponen WAJIB mencetak batas itu, bukan
 * menyembunyikannya di tooltip.
 */

export interface RezimTahun {
  tangkap_naik: number
  tangkap_turun: number
  n_naik: number
  n_turun: number
}

export interface HariMerah {
  tanggal: string
  /** Persen, sudah dikali 100. */
  ihsg: number
  emiten: number
}

export type Watak = 'ideal' | 'pengungkit' | 'defensif' | 'perangkap' | 'berlawanan'

export interface RezimEmiten {
  tangkap_naik: number | null
  tangkap_turun: number | null
  asimetri: number | null
  /** Kenapa angkanya null — dicetak apa adanya, bukan diganti "—" sunyi. */
  alasan: string | null
  n_naik: number
  n_turun: number
  watak: Watak | null
  /** Label di dekat ambang median — baca angkanya, bukan labelnya. */
  batas_tipis: boolean
  /** Porsi hari bervolume yang harganya tak bergerak — penanda "terbaca
   *  defensif karena tak likuid" (audit 28 Agu #6). */
  porsi_nol: number | null
  per_tahun: Record<string, RezimTahun>
  hari_terburuk: HariMerah[]
}

export interface UjiLuarSampel {
  n: number
  batas?: string
  bertahan_pct: number | null
  tebakan_buta_pct: number | null
  modus?: string
  /** false = label KALAH dari tebakan buta di luar sampel — halaman DILARANG
   *  merender label watak sebagai kategori; cukup dua angka + kalimat uji. */
  label_tayang: boolean
}

export interface BerkasRezim {
  dibangun: string
  acuan: string
  estimator: string
  ambang_label: { naik: number; turun: number; dasar: string }
  uji_luar_sampel: UjiLuarSampel
  min_sampel: number
  catatan: string
  n_emiten: number
  emiten: Record<string, RezimEmiten>
}

let singgahan: Promise<BerkasRezim | null> | null = null

export function muatRezim(): Promise<BerkasRezim | null> {
  if (!singgahan) {
    singgahan = fetch('/data-idx/json/rezim_pasar.json')
      .then((r) => (r.ok ? (r.json() as Promise<BerkasRezim>) : null))
      .catch(() => null)
  }
  return singgahan
}

/** Kalimat manusia untuk tiap watak — dipakai di kartu vonis. */
export const ARTI_WATAK: Record<Watak, { judul: string; kalimat: string }> = {
  ideal: {
    judul: 'Ideal',
    kalimat: 'Ikut naik seiring pasar, tapi jatuhnya lebih tertahan. Watak yang paling dicari — dan paling jarang.',
  },
  pengungkit: {
    judul: 'Pengungkit',
    kalimat: 'Kencang ke dua arah. Menguntungkan saat arah pasar ditebak benar, mahal saat salah.',
  },
  defensif: {
    judul: 'Defensif',
    kalimat: 'Bergerak lebih pelan daripada pasar di kedua arah. Periksa likuiditasnya — saham yang jarang bergerak juga terbaca begini.',
  },
  perangkap: {
    judul: 'Perangkap',
    kalimat: 'Tidak ikut naik saat pasar menguat, tapi ikut jatuh saat pasar melemah. Watak paling merugikan.',
  },
  berlawanan: {
    judul: 'Berlawanan',
    kalimat: 'Rata-rata bergerak MELAWAN arah pasar di salah satu rezim. Sangat jarang — periksa likuiditas dan riwayatnya sebelum percaya.',
  },
}

/** Bacaan satu baris untuk selisih emiten − IHSG pada hari merah. */
export function bacaHariMerah(h: HariMerah): string {
  const selisih = h.emiten - h.ihsg
  if (selisih > 1) return 'lebih tertahan'
  if (selisih < -1) return 'jatuh lebih dalam'
  return 'ikut jatuh penuh'
}

/** Tahun-tahun yang ada, terbaru dulu. */
export function tahunTerbaru(r: RezimEmiten, n = 6): Array<[string, RezimTahun]> {
  return Object.entries(r.per_tahun).sort((a, b) => (a[0] < b[0] ? 1 : -1)).slice(0, n)
}
