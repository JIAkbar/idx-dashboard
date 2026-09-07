/**
 * Mesin murni Pola Gap — RUANG KOSONG antara rentang dua bar berurutan
 * (`docs/spek-dev-papan/spek_rbs_gap_intraday.md` §2).
 * Berdiri sendiri — JANGAN dicampur dengan pola RBS (§1, `polaRbs.ts`).
 *
 * ## Kenapa definisinya diganti, 7 Sep 2026 (#50)
 *
 * Johan, menunjuk zona yang masih tergambar di layar padahal candle-nya sudah
 * lama menutupinya: *"aneh nya ini di cursor itu gap kecil tapi kenapa masih
 * ada, padahal sudah di tutpu sama depannya … artinya logika berpikir nya
 * salah, lalu gap itu candle yang tidak terisi"*.
 *
 * Ia benar, dan cacatnya ada di dua tempat sekaligus:
 *
 * 1. **Gap dulu didefinisikan dari OPEN**, bukan dari rentang. Candle yang
 *    MEMBUKA di bawah low kemarin tapi sumbunya naik jauh ke dalam ruang itu
 *    tetap dihitung sebagai gap selebar jarak open — padahal ruang kosong yang
 *    sebenarnya jauh lebih kecil, kadang tak ada sama sekali. Terukur: definisi
 *    open memberi 258.327 gap harian dan 51,6% di antaranya "terisi" di bar
 *    ke-0 — angka yang seharusnya jadi tanda bahaya, bukan hasil.
 * 2. **"Terisi" dulu semua-atau-tak-sama-sekali.** Zona tetap digambar penuh
 *    sampai ada satu bar yang menembus SELURUHNYA ke harga acuan. Candle yang
 *    memakan 90% ruangnya tak mengubah apa pun di layar.
 *
 * Sekarang: gap = ruang antara RENTANG dua candle yang tak tumpang tindih, dan
 * tiap bar berikutnya MEMOTONG ruang itu sebesar rentangnya sendiri. Yang
 * digambar cuma sisanya; begitu sisanya habis, zonanya hilang.
 *
 * ## Algoritme
 *
 * 1. **Zona** — turun: `[cur.high, prev.low]` bila `cur.high < prev.low`;
 *    naik: `[prev.high, cur.low]` bila `cur.low > prev.high`. Perhatikan
 *    keduanya memakai HIGH/LOW, tak satu pun memakai `open`.
 * 2. **Ambang** — lebar zona wajib > `max(2×fraksi, 1%)` dari harga acuan.
 *    Dua tick, bukan persen tetap: 1 tick di Rp50 sudah 2%, dan tanpa lantai
 *    tick saham murah kebanjiran gap palsu.
 * 3. **Pengisian progresif** — tiap bar sesudahnya memotong zona sebesar
 *    `[low, high]`-nya. Sisa bisa TERBELAH DUA kalau rentang bar jatuh persis
 *    di tengah zona (1.739 kejadian di kerangka 1 jam), jadi sisanya disimpan
 *    sebagai daftar potongan, bukan satu pasang angka.
 * 4. **Bar bervolume nol tidak membentuk dan tidak mengisi.** Bar tanpa
 *    transaksi bukan bukti harga pernah diperdagangkan di situ. Penyaring lama
 *    cuma membuang bar volume 0 yang OHLC-nya rata; 22.740 bar volume 0 dengan
 *    OHLC tidak rata lolos, dan 3,6% gap tercatat "terisi" oleh bar hantu.
 * 5. **Status** — `utuh` (sisa = lebar awal), `sebagian`, `terisi` (sisa
 *    habis), dan bila data berakhir sebelum terisi ia tetap `utuh`/`sebagian`
 *    dengan `dataHabis: true` — sensor kanan disebut, bukan disembunyikan.
 */
import type { LilinData } from './grafikEmiten'
// Ekstensi .ts eksplisit: skrip statistik gap mengimpor mesin ini lewat Node
// biasa (bukan Vite) supaya angka layar dan zona di layar lahir dari SATU
// mesin, dan di Node impor relatif tanpa ekstensi gagal resolve. Vite dan
// vitest sama-sama menerima bentuk ini.
import { fraksi } from '../fraksiHarga.ts'

export type ArahGap = 'naik' | 'turun'

/** Satu potongan sisa zona, `[bawah, atas]`. */
export type Potongan = readonly [number, number]

export interface GapEvent {
  arah: ArahGap
  /** Waktu bar gap (bar `t`, yang rentangnya melompat). */
  waktuGap: string
  /** Waktu bar acuan (bar `t-1`). */
  waktuAcuan: string
  /** Batas zona AWAL, sebelum ada yang mengisinya. */
  bawah: number
  atas: number
  /** Lebar awal terhadap harga acuan, persen. Positif untuk gap naik,
   *  negatif untuk gap turun — tandanya membawa arah. */
  gapPct: number
  /** Sisa yang BELUM terisi, bisa lebih dari satu potongan (zona terbelah). */
  sisa: Potongan[]
  /** Sisa terhadap lebar awal, 0..100. */
  sisaPct: number
  status: 'utuh' | 'sebagian' | 'terisi'
  waktuTerisi?: string
  /** Bar ke berapa sejak bar gap sampai sisanya habis (0 = di bar gap itu). */
  barTerisi?: number
  /** Berapa bar sudah lewat sejak gap tanpa terisi habis. */
  bertahanBar: number
  /** Data berakhir sebelum zonanya habis — sensor kanan, wajib disebut di
   *  layar dan di statistik. 19,8% gap emiten mati kena ini. */
  dataHabis: boolean
  /** Kedua barnya dipisahkan BATAS SESI, bukan berurutan di dalam satu sesi
   *  perdagangan (§5). Di kerangka intraday inilah mayoritasnya: tutup 15:00
   *  ke buka 09:00 esoknya, dan jeda siang. Ruang kosongnya nyata, tapi
   *  artinya berbeda — tak ada yang bisa memperdagangkannya karena bursanya
   *  tutup, bukan karena harga melompat. Selalu `false` di kerangka harian ke
   *  atas: di sana tiap bar memang satu sesi. */
  antarSesi: boolean
}

// Parameter algoritme (spek §2) — JANGAN diubah tanpa entri Metodologi +
// referensi (CLAUDE.md "Ukur definisinya dulu sebelum menurunkan satu ruas").
const TICK_KALI = 2
const BUFFER_PCT = 0.01

function ambang(hargaAcuan: number): number {
  return Math.max(TICK_KALI * fraksi(hargaAcuan), hargaAcuan * BUFFER_PCT)
}

function lebarTotal(sisa: Potongan[]): number {
  return sisa.reduce((s, [a, b]) => s + (b - a), 0)
}

/**
 * Potong daftar sisa dengan rentang `[l, h]` satu bar.
 *
 * Sebuah potongan `[a, b]` bisa menghasilkan NOL, SATU, atau DUA potongan
 * baru — yang dua itu kasus zona terbelah, dan ia bukan kasus tepi: rentang
 * kecil yang jatuh di tengah zona lebar terjadi 1.739 kali di kerangka 1 jam.
 */
export function potongZona(sisa: Potongan[], l: number, h: number): Potongan[] {
  const keluar: Potongan[] = []
  for (const [a, b] of sisa) {
    if (h <= a || l >= b) { keluar.push([a, b]); continue }   // tak bersinggungan
    if (a < l) keluar.push([a, Math.min(b, l)])
    if (h < b) keluar.push([Math.max(a, h), b])
  }
  return keluar.filter(([a, b]) => b > a)
}

/**
 * `volume` sejajar indeks dengan `bars` — opsional supaya pemanggil lama tak
 * patah, tapi TANPA-nya penyaring bar hantu mati dan hasilnya kembali memuat
 * gap yang "terisi" oleh bar tanpa transaksi.
 */
/**
 * Langkah waktu LAZIM antar bar, milidetik — modus selisih dua bar berurutan.
 *
 * Diukur dari deretnya sendiri, bukan ditebak dari jam bursa: sesi Jumat lebih
 * pendek, ada libur setengah hari, dan bar tanpa transaksi dibuang di emiten
 * tipis. Yang dicari cuma "berapa jarak yang normal di deret ini" supaya
 * lompatan yang JAUH lebih besar bisa dikenali sebagai batas sesi.
 *
 * 0 untuk deret harian/pekanan/bulanan (waktunya cuma tanggal) — di sana
 * konsep batas sesi tak berlaku.
 */
function langkahLazim(bars: LilinData[]): number {
  if (bars.length < 3 || bars[0].time.length <= 10) return 0
  const hitung = new Map<number, number>()
  for (let i = 1; i < bars.length; i++) {
    const d = Date.parse(bars[i].time.replace(' ', 'T') + 'Z') - Date.parse(bars[i - 1].time.replace(' ', 'T') + 'Z')
    if (d > 0) hitung.set(d, (hitung.get(d) ?? 0) + 1)
  }
  let modus = 0
  let terbanyak = 0
  for (const [d, n] of hitung) if (n > terbanyak) { modus = d; terbanyak = n }
  return modus
}

export function cariGap(bars: LilinData[], volume?: number[]): GapEvent[] {
  const adaVolume = (i: number) => (volume ? (volume[i] ?? 0) > 0 : true)
  const langkah = langkahLazim(bars)
  const antarSesiDi = (i: number): boolean => {
    if (langkah === 0) return false
    const a = Date.parse(bars[i - 1].time.replace(' ', 'T') + 'Z')
    const b = Date.parse(bars[i].time.replace(' ', 'T') + 'Z')
    // Ambang 1,5× langkah lazim: cukup longgar untuk satu bar yang dibuang
    // karena nol transaksi, cukup ketat untuk menangkap jeda siang.
    return b - a > langkah * 1.5
  }
  const keluar: GapEvent[] = []

  for (let i = 1; i < bars.length; i++) {
    const prev = bars[i - 1]
    const cur = bars[i]
    // Bar hantu tak boleh MEMBENTUK gap: harga yang tak pernah diperdagangkan
    // bukan bukti ada ruang kosong di sebelahnya.
    if (!adaVolume(i) || !adaVolume(i - 1)) continue

    let arah: ArahGap
    let bawah: number
    let atas: number
    let acuan: number
    if (cur.low > prev.high) {
      arah = 'naik'; bawah = prev.high; atas = cur.low; acuan = prev.high
    } else if (cur.high < prev.low) {
      arah = 'turun'; bawah = cur.high; atas = prev.low; acuan = prev.low
    } else {
      continue
    }
    const lebar = atas - bawah
    if (lebar <= ambang(acuan)) continue

    // Pengisian progresif, mulai dari bar gap SENDIRI: rentangnya sudah
    // membentuk salah satu tepi zona, tapi bar sesudahnya yang memakannya.
    let sisa: Potongan[] = [[bawah, atas]]
    let waktuTerisi: string | undefined
    let barTerisi: number | undefined
    for (let j = i; j < bars.length; j++) {
      if (!adaVolume(j)) continue
      sisa = potongZona(sisa, bars[j].low, bars[j].high)
      if (sisa.length === 0) { waktuTerisi = bars[j].time; barTerisi = j - i; break }
    }

    const sisaLebar = lebarTotal(sisa)
    const sisaPct = (sisaLebar / lebar) * 100
    keluar.push({
      arah,
      waktuGap: cur.time,
      waktuAcuan: prev.time,
      bawah,
      atas,
      gapPct: (arah === 'naik' ? lebar : -lebar) / acuan * 100,
      sisa,
      sisaPct,
      status: sisaLebar <= 0 ? 'terisi' : sisaPct >= 100 ? 'utuh' : 'sebagian',
      waktuTerisi,
      barTerisi,
      bertahanBar: barTerisi ?? (bars.length - 1 - i),
      dataHabis: barTerisi === undefined,
      antarSesi: antarSesiDi(i),
    })
  }
  return keluar
}
