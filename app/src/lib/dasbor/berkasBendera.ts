/**
 * Blok G — bendera risiko: hal yang membuat semua angka di blok lain patut
 * diragukan.
 *
 * Rancangan (artifact "Berkas Emiten", blok G): *"satu blok, DI ATAS, merah"*.
 * Letaknya itu bagian dari isinya. Penanda kualitas yang sama sudah dipakai
 * Kartu Analisa, tapi di sana ia catatan kaki — pembaca sudah selesai
 * menyimpulkan sebelum sampai ke situ. Di halaman ini ia dinaikkan ke atas
 * karena fungsinya justru mengubah cara membaca yang di bawahnya.
 *
 * ## Nol permintaan jaringan tambahan
 *
 * Enam dari tujuh bendera dihitung dari data yang SUDAH dimuat blok A–D:
 * kartu analisa (riwayat, likuiditas, beku), arsip broker (konsentrasi),
 * dan candle (porsi negosiasi). Yang benar-benar baru cuma pembacaan notasi
 * khusus dan UMA dari info emiten — satu berkas yang juga sudah dimuat blok
 * F. Blok yang paling berhak tampil duluan tak boleh jadi blok yang paling
 * lambat muncul.
 *
 * ## Ambangnya terukur, bukan dikarang
 *
 * Tiap ambang di sini punya alasan yang bisa diperiksa, dan disebutkan di
 * layar bersama angkanya — supaya pembaca bisa tak setuju dengan ambangnya
 * tanpa harus membaca kode.
 */

/** Seberapa gawat, dan itu menentukan urutan tampilnya. */
export type BobotBendera = 'tinggi' | 'sedang' | 'rendah'

export interface Bendera {
  kode: string
  judul: string
  /** Kalimat yang menyebut ANGKANYA, bukan cuma menyatakan ada masalah. */
  isi: string
  bobot: BobotBendera
}

/** Bahan yang sudah dihitung blok lain — sengaja bentuk datar, supaya modul
 *  ini bisa diuji tanpa menyentuh satu pun berkas. */
export interface BahanBendera {
  /** `kualitas.riwayat` dari kartu analisa: 'cukup' | 'pendek' | … */
  riwayat?: string | null
  /** `kualitas.likuiditas` dari kartu analisa. */
  likuiditas?: string | null
  /** Jumlah lilin di arsip — dipakai menyebut angkanya, bukan cuma labelnya. */
  nLilin?: number | null
  /** Hari beruntun tanpa transaksi (0 = diperdagangkan hari terakhir). */
  bekuHari?: number | null
  /** Porsi net-beli yang dikuasai 3 broker teratas (0–1). */
  konsentrasi3?: number | null
  /** Porsi lot negosiasi terhadap total (0–1). */
  porsiNego?: number | null
  /** Notasi khusus bursa, apa adanya dari sumber. */
  notasi?: string[] | null
  /** Sedang dalam Unusual Market Activity. */
  uma?: boolean | null
  /** Aksi korporasi yang terdeteksi di riwayat, mis. pecah saham. */
  aksiKorporasi?: Array<{ tanggal: string; jenis: string }> | null
}

/** Riwayat di bawah ini terlalu pendek untuk statistik apa pun yang dipakai
 *  halaman ini: rezim pasar butuh 60 sampel per rezim, dan setahun bursa
 *  hanya ±245 hari. */
export const MIN_LILIN = 250

/** Di atas ambang ini, "harga bergerak" lebih tepat dibaca sebagai "beberapa
 *  pihak menggerakkan harga". Bukan tuduhan — pembacaannya yang berbeda. */
export const AMBANG_KONSENTRASI = 0.6

/** Negosiasi terjadi di luar mekanisme pasar reguler; porsinya besar berarti
 *  harga layar tak mewakili sebagian besar lot yang berpindah. */
export const AMBANG_NEGO = 0.3

/** Hari beruntun tanpa transaksi yang membuat harga terakhir tak lagi harga
 *  sekarang — satu pekan bursa. */
export const AMBANG_BEKU = 5

const persen = (v: number) => `${(v * 100).toFixed(0)}%`

/**
 * Susun bendera dari bahan yang sudah dihitung.
 *
 * Urut dari yang paling gawat. Larik kosong berarti tak ada yang perlu
 * diragukan — dan itu keadaan yang sah, bukan berarti pemeriksaannya gagal.
 */
export function susunBendera(b: BahanBendera): Bendera[] {
  const out: Bendera[] = []

  // Notasi khusus & UMA lebih dulu: keduanya penilaian BURSA atas emiten itu,
  // bukan pembacaan kita. Yang datang dari otoritas berdiri di depan yang
  // datang dari hitungan sendiri.
  const notasi = (b.notasi ?? []).filter((x) => typeof x === 'string' && x.trim())
  if (notasi.length > 0) {
    out.push({
      kode: 'notasi',
      judul: 'Notasi khusus bursa',
      isi: `Bursa menandai emiten ini: ${notasi.join(', ')}. Notasi khusus jarang terlihat di layar mana pun, dan artinya berbeda-beda — periksa ke pengumuman bursa sebelum menyimpulkan.`,
      bobot: 'tinggi',
    })
  }
  if (b.uma) {
    out.push({
      kode: 'uma',
      judul: 'Aktivitas pasar tidak wajar',
      isi: 'Bursa sedang menandai emiten ini dengan peringatan aktivitas tidak wajar. Pergerakan harga pada periode ini patut dibaca dengan hati-hati.',
      bobot: 'tinggi',
    })
  }

  if (b.bekuHari != null && b.bekuHari >= AMBANG_BEKU) {
    out.push({
      kode: 'beku',
      judul: 'Tidak diperdagangkan',
      isi: `Tidak ada transaksi selama ${b.bekuHari} hari bursa berturut-turut. Harga terakhir bukan harga sekarang, dan seluruh hitungan yang memakainya ikut tertinggal.`,
      bobot: 'tinggi',
    })
  }

  if (b.riwayat === 'pendek' || (b.nLilin != null && b.nLilin < MIN_LILIN)) {
    const n = b.nLilin != null ? `${b.nLilin.toLocaleString('id-ID')} hari` : 'kurang dari setahun'
    out.push({
      kode: 'riwayat',
      judul: 'Riwayat pendek',
      isi: `Arsip harga emiten ini baru ${n}. Angka yang butuh banyak sampel — perilaku saat pasar naik/turun, probabilitas, pola musiman — belum punya cukup bahan di sini.`,
      bobot: 'tinggi',
    })
  }

  if (b.likuiditas === 'tipis' || b.likuiditas === 'tidur') {
    out.push({
      kode: 'likuiditas',
      judul: b.likuiditas === 'tidur' ? 'Nyaris tak diperdagangkan' : 'Likuiditas tipis',
      isi:
        b.likuiditas === 'tidur'
          ? 'Nilai transaksi hariannya sangat kecil. Harga di layar bisa berubah drastis oleh satu order, dan angka rata-rata apa pun mudah menyesatkan.'
          : 'Nilai transaksi hariannya kecil. Selisih beli-jual bisa lebar, dan harga penutupan tak selalu harga yang benar-benar bisa didapat.',
      bobot: 'sedang',
    })
  }

  if (b.konsentrasi3 != null && b.konsentrasi3 >= AMBANG_KONSENTRASI) {
    out.push({
      kode: 'konsentrasi',
      judul: 'Pembelian terpusat di sedikit pihak',
      isi: `Tiga broker terbesar menguasai ${persen(b.konsentrasi3)} net pembelian pada periode yang ditampilkan. Arah harga di sini lebih tepat dibaca sebagai keputusan beberapa pihak, bukan kesimpulan banyak pelaku.`,
      bobot: 'sedang',
    })
  }

  if (b.porsiNego != null && b.porsiNego >= AMBANG_NEGO) {
    out.push({
      kode: 'nego',
      judul: 'Porsi negosiasi tinggi',
      isi: `${persen(b.porsiNego)} lot berpindah lewat pasar negosiasi, bukan pasar reguler. Harga negosiasi disepakati dua pihak dan bisa jauh dari harga layar, jadi volume dan harga di sini bercerita hal yang berbeda.`,
      bobot: 'sedang',
    })
  }

  const aksi = b.aksiKorporasi ?? []
  if (aksi.length > 0) {
    const daftar = aksi.slice(0, 3).map((a) => `${a.jenis} ${a.tanggal}`).join(', ')
    out.push({
      kode: 'aksi',
      judul: 'Aksi korporasi di riwayat',
      isi: `Terdeteksi ${daftar}${aksi.length > 3 ? `, dan ${aksi.length - 3} lainnya` : ''}. Harga riwayat sudah disesuaikan ke aksi ini, sementara volume broker dicatat apa adanya saat itu — dua konvensi berbeda yang tak boleh dibandingkan langsung.`,
      bobot: 'rendah',
    })
  }

  const urut: Record<BobotBendera, number> = { tinggi: 0, sedang: 1, rendah: 2 }
  return out.sort((x, y) => urut[x.bobot] - urut[y.bobot])
}

/** Kalimat pengganti saat tak ada satu pun bendera — sengaja TIDAK berbunyi
 *  "aman". Tak ada bendera berarti pemeriksaan ini tak menemukan apa-apa,
 *  bukan bahwa emitennya baik. */
export const TANPA_BENDERA =
  'Pemeriksaan ini tak menemukan hal yang membuat angka di bawah patut diragukan. Itu bukan penilaian atas emitennya — hanya berarti tujuh pemeriksaan di sini lewat.'
