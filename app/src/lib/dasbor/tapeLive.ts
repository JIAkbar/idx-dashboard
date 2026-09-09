/**
 * Selisih antar tarikan angka live — "tape" transaksi hari berjalan (#152 A).
 *
 * Yang tersedia dari proxy hanya AKUMULASI hari ini (volume, nilai, frekuensi
 * sejak pembukaan), bukan daftar transaksi. Jadi yang bisa disusun di sini
 * adalah selisih antara dua tarikan berurutan — "sejak 45 detik lalu, bertambah
 * 12.400 lot senilai Rp 1,2 M dalam 87 transaksi".
 *
 * Itu BUKAN catatan per transaksi, dan bedanya penting: satu baris di sini bisa
 * memuat puluhan transaksi yang benar-benar terjadi, dan tak ada cara memisahkan
 * mereka dari data ini. Layar wajib mengatakannya; lihat label di
 * `WhalesPapan.tsx`.
 *
 * Dua keadaan yang sengaja TIDAK dihaluskan:
 *
 *  1. **Tarikan yang gagal.** Kalau satu jendela hilang, selisih berikutnya
 *     mencakup dua jendela sekaligus. Barisnya diberi `jendela: 2` supaya
 *     terbaca apa adanya — merata-ratakannya jadi dua baris palsu berarti
 *     mengarang transaksi yang tak pernah dilaporkan.
 *  2. **Akumulasi yang MUNDUR.** Kalau angka baru lebih kecil daripada yang
 *     lama (sumber menyegarkan hari, atau emiten berganti), itu bukan selisih
 *     negatif melainkan awal deret baru: barisnya dibuang, bukan dicatat
 *     sebagai transaksi bertanda minus.
 */

export interface TitikLive {
  /** Epoch ms saat angkanya sampai di peramban. */
  pada: number
  volume: number | null | undefined
  value: number | null | undefined
  frequency: number | null | undefined
}

export interface BarisTape {
  /** Epoch ms tarikan yang MENGAKHIRI jendela ini. */
  pada: number
  /** Tambahan sejak tarikan sebelumnya. Lembar, rupiah, dan kali. */
  volume: number
  value: number
  frequency: number
  /** Berapa jendela tarikan yang tergabung di baris ini; >1 = ada yang gagal. */
  jendela: number
}

/** Jarak tarikan normal (detik). Dipakai untuk menaksir berapa jendela yang
 *  tergabung saat satu tarikan hilang — bukan untuk menebak isinya. */
export const JEDA_TARIKAN_DETIK = 45

const angka = (v: number | null | undefined): number | null =>
  typeof v === 'number' && Number.isFinite(v) ? v : null

/**
 * Satu baris tape dari dua tarikan berurutan; `null` kalau tak ada yang bisa
 * dinyatakan (ruas kosong, atau akumulasi mundur = deret baru).
 */
export function barisTape(lama: TitikLive, baru: TitikLive): BarisTape | null {
  const vL = angka(lama.volume), vB = angka(baru.volume)
  const nL = angka(lama.value), nB = angka(baru.value)
  const fL = angka(lama.frequency), fB = angka(baru.frequency)
  if (vL == null || vB == null || nL == null || nB == null || fL == null || fB == null) return null
  // Mundur = sumber memulai deret baru, bukan transaksi negatif.
  if (vB < vL || nB < nL || fB < fL) return null
  const dv = vB - vL, dn = nB - nL, df = fB - fL
  if (dv === 0 && dn === 0 && df === 0) return null   // tak ada transaksi baru
  const jarak = Math.max(0, (baru.pada - lama.pada) / 1000)
  return {
    pada: baru.pada,
    volume: dv,
    value: dn,
    frequency: df,
    // Dibulatkan ke bawah lalu dijepit minimal 1: jendela 46 detik masih satu
    // tarikan, 95 detik berarti satu tarikan hilang di tengah.
    jendela: Math.max(1, Math.round(jarak / JEDA_TARIKAN_DETIK)),
  }
}

/**
 * Tambahkan satu tarikan ke tape yang sedang berjalan.
 *
 * Menyimpan `maks` baris terakhir saja — tape ini hidup di memori halaman dan
 * tak pernah ditulis ke arsip, jadi ia tak boleh tumbuh sepanjang sesi bursa.
 */
export function tambahTape(
  tape: BarisTape[],
  sebelum: TitikLive | null,
  kini: TitikLive,
  maks = 30,
): BarisTape[] {
  if (!sebelum) return tape
  const b = barisTape(sebelum, kini)
  if (!b) return tape
  // Tarikan yang sama (stempel sama) tak menambah baris.
  if (tape.length && tape[0].pada === b.pada) return tape
  return [b, ...tape].slice(0, maks)
}

/** Harga rata-rata hari berjalan = nilai ÷ lembar. TAKSIRAN — sebutkan begitu
 *  di layar: pembilang dan penyebutnya dilaporkan bursa untuk seluruh papan
 *  yang ikut, dan pembulatannya tak pernah persis harga transaksi mana pun. */
export function vwapTaksiran(value: number | null | undefined, volume: number | null | undefined): number | null {
  const n = angka(value), v = angka(volume)
  return n != null && v != null && v > 0 ? n / v : null
}

/** Rata-rata nilai per transaksi = nilai ÷ frekuensi. */
export function nilaiPerTransaksi(value: number | null | undefined, frequency: number | null | undefined): number | null {
  const n = angka(value), f = angka(frequency)
  return n != null && f != null && f > 0 ? n / f : null
}
