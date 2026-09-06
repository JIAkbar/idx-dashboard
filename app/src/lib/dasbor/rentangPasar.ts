import type { DataHarian } from './dataHarian'

/**
 * Ringkasan pasar untuk SEBUAH RENTANG hari bursa — jumlah, rata-rata, dan
 * ujung-ke-ujung IHSG.
 *
 * Lahir 7 Sep 2026 (#34, Johan: *"page ini jika datanya bisa rentang waktu
 * lebih baik lagi"*). Dipisah dari halamannya supaya bisa diuji dengan angka
 * yang dihitung tangan dari berkas hariannya — dan itu bukan formalitas:
 * SELURUH cacat terbesar hari ini berbentuk sama, yaitu angka yang dijumlahkan
 * lintas hari lalu terlihat lengkap padahal tidak (net asing hilang di 9 hari,
 * grafik 20 hari yang digambar dari 16, 31 Agustus yang tersimpan sebagai
 * potret cadangan seminggu). Menjumlahkan tanpa menghitung apa yang TIDAK ikut
 * adalah cara paling rapi untuk berbohong dengan angka benar.
 *
 * Karena itu tiap ruas membawa cacahnya sendiri: `n_vol` bukan sama dengan
 * `n_hari` kalau ada hari yang tak punya ruas volume. Pemanggil WAJIB mencetak
 * cacah itu saat ia lebih kecil daripada jumlah hari — halaman yang menampilkan
 * total tanpa cakupan sedang menyampaikan tebakan sebagai fakta.
 */
export interface RingkasRentang {
  /** Hari bursa di dalam rentang, apa pun isinya. */
  n_hari: number
  /** Hari yang benar-benar punya ruasnya. Lebih kecil = ada yang tak ikut. */
  n_vol: number
  n_val: number
  n_frek: number
  n_nf: number
  /** Jumlah lintas rentang. null kalau tak ada satu pun hari yang punya ruasnya. */
  vol: number | null
  val: number | null
  frek: number | null
  /** Net asing rupiah, dijumlahkan dari nilai HARIAN — bukan diambil dari YTD. */
  nf: number | null
  /** Rata-rata per hari BERDATA (pembaginya n_*, bukan n_hari). */
  vol_rerata: number | null
  val_rerata: number | null
  frek_rerata: number | null
  /** IHSG: penutupan hari sebelum rentang → penutupan hari terakhir. */
  ihsg_awal: number | null
  ihsg_akhir: number | null
  ihsg_pct: number | null
  /** Ekstrem intraday di dalam rentang; jatuh ke penutupan kalau ruasnya kosong. */
  ihsg_tertinggi: number | null
  ihsg_terendah: number | null
  /** Label hari terakhir — untuk melabeli ruas yang bersifat TITIK, bukan jumlah.
   *  Dipakai `date_id` ("4 Sep 2026"), BUKAN `date_iso`: DataHarian tak punya
   *  ruas itu sama sekali - tanggalnya hidup di TanggalIndex yang terpisah, dan
   *  tanda tangan indeks `[key: string]: unknown` membuat `d.date_iso` lolos
   *  penulisan tapi bertipe unknown. Ketahuan dari tsc, bukan dari membaca. */
  akhir_id: string | null
}

function jumlah(hari: DataHarian[], ambil: (d: DataHarian) => number | undefined | null) {
  let total = 0
  let n = 0
  for (const d of hari) {
    const v = ambil(d)
    if (typeof v === 'number' && Number.isFinite(v)) {
      total += v
      n += 1
    }
  }
  return { total: n ? total : null, n }
}

/**
 * Diurutkan menurut `trading_day` — nomor hari bursa yang memang bertipe angka
 * di DataHarian. Mengurutkan di sini, bukan mempercayai pemanggil, supaya salah
 * urut tidak diam-diam membalik arah persentase.
 */
export function ringkasRentang(hariMasuk: DataHarian[]): RingkasRentang | null {
  const hari = [...hariMasuk].sort((a, b) => a.trading_day - b.trading_day)
  if (!hari.length) return null

  const v = jumlah(hari, (d) => d.vol_today)
  const n = jumlah(hari, (d) => d.val_idr_today)
  const f = jumlah(hari, (d) => d.freq_today)
  const nf = jumlah(hari, (d) => d.nf_today_idr)

  const pertama = hari[0]
  const terakhir = hari[hari.length - 1]

  // Titik AWAL = penutupan hari SEBELUM rentang (`ihsg_prev` hari pertama).
  // Memakai penutupan hari pertama sebagai awal akan membuang pergerakan hari
  // itu sendiri — rentang 1 hari lalu selalu terbaca 0%.
  const awal = typeof pertama.ihsg_prev === 'number' ? pertama.ihsg_prev : null
  const akhir = typeof terakhir.ihsg_value === 'number' ? terakhir.ihsg_value : null

  const tinggi = hari
    .map((d) => (typeof d.ihsg_high === 'number' ? d.ihsg_high : d.ihsg_value))
    .filter((x): x is number => typeof x === 'number' && Number.isFinite(x))
  const rendah = hari
    .map((d) => (typeof d.ihsg_low === 'number' ? d.ihsg_low : d.ihsg_value))
    .filter((x): x is number => typeof x === 'number' && Number.isFinite(x))

  return {
    n_hari: hari.length,
    n_vol: v.n, n_val: n.n, n_frek: f.n, n_nf: nf.n,
    vol: v.total, val: n.total, frek: f.total, nf: nf.total,
    vol_rerata: v.n ? (v.total as number) / v.n : null,
    val_rerata: n.n ? (n.total as number) / n.n : null,
    frek_rerata: f.n ? (f.total as number) / f.n : null,
    ihsg_awal: awal,
    ihsg_akhir: akhir,
    ihsg_pct: awal && akhir ? (akhir / awal - 1) * 100 : null,
    ihsg_tertinggi: tinggi.length ? Math.max(...tinggi) : null,
    ihsg_terendah: rendah.length ? Math.min(...rendah) : null,
    akhir_id: typeof terakhir.date_id === 'string' ? terakhir.date_id : null,
  }
}
