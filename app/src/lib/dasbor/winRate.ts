/**
 * Win Rate — tiga definisi menang atas jejak rekomendasi preset (tab
 * "Riwayat & Win Rate", `docs/spek-dev-papan/spek_preset_winrate_rekap.md`
 * §Tugas C.2). Fungsi MURNI, tanpa fetch — bahan datangnya dari
 * `data-idx/json/rekomendasi/<tgl>.json` (skor/entry/TP/SL) + `ohlc/<KODE>.json`
 * (harga hari-hari SESUDAHNYA), digabung oleh pemanggil.
 *
 * Definisi kompatibel SPLE (spek §Tugas C.2) supaya bisa dibandingkan
 * head-to-head — bukan rumus baru:
 *
 * 1. Open-vs-High H+1  — longgar, persis "review win rate" SPLE.
 * 2. Close-to-Close H+1 — ketat, plus rata-rata %.
 * 3. TP/SL H+5         — realistis (pakai target preset sendiri), dengan
 *    kasus "tak-tentu" saat TP & SL SAMA-SAMA tersentuh di hari yang sama —
 *    data harian tak tahu urutan intraday-nya, jadi TIDAK boleh diklaim
 *    menang (lihat komentar `first_passage` di kartu_analisa.py — aturan
 *    "kalau bersamaan, jangan klaim menang" sama persis di sana).
 */

export type HasilMenang = 'menang' | 'kalah' | 'tak-tentu' | 'tak-terukur'

/** Baris OHLC harian — sama urutan `BarisOhlc` (`ihsgOhlc.ts`):
 *  [tanggal, open, high, low, close, volume]. Diterima sebagai objek di sini
 *  supaya nama ruasnya kebaca tanpa indeks ajaib di kode uji/pemanggil. */
export interface BarWinRate {
  tanggal: string
  open: number
  high: number
  low: number
  close: number
}

/** Indeks bar yang tanggalnya PERSIS `tanggal` (rekomendasi ditulis pada
 *  tanggal ini) — `-1` kalau tak ditemukan (emiten tak dagang hari itu, atau
 *  riwayat OHLC belum sampai situ). Pemanggil memakai indeks ini sebagai
 *  H untuk ketiga fungsi di bawah (H+1 = `idxH + 1`, dst). */
export function cariIndeksHari(bars: readonly BarWinRate[], tanggal: string): number {
  return bars.findIndex((b) => b.tanggal === tanggal)
}

/** 1) Open-vs-High H+1 — menang bila `high(H+1) > open(H+1)`. Longgar: tak
 *  peduli entry beneran kena, cuma "apakah hari itu ada dorongan ke atas
 *  dari open-nya sendiri". `idxH` = indeks hari REKOMENDASI (H), bukan H+1. */
export function menangOpenHigh(bars: readonly BarWinRate[], idxH: number): HasilMenang {
  const b1 = bars[idxH + 1]
  if (idxH < 0 || !b1) return 'tak-terukur'
  return b1.high > b1.open ? 'menang' : 'kalah'
}

/** 2) Close-to-Close H+1 — menang bila `close(H+1) > close(H)`. Ketat: satu
 *  hari penuh, dari penutupan ke penutupan. `persen` = `null` kalau tak
 *  terukur, dipakai pemanggil untuk rata-rata (spek §C.2 "tampilkan juga
 *  rata-rata %"). */
export function menangCloseToClose(
  bars: readonly BarWinRate[],
  idxH: number,
): { hasil: HasilMenang; persen: number | null } {
  const b0 = bars[idxH]
  const b1 = bars[idxH + 1]
  if (idxH < 0 || !b0 || !b1 || !b0.close) return { hasil: 'tak-terukur', persen: null }
  const persen = ((b1.close - b0.close) / b0.close) * 100
  return { hasil: b1.close > b0.close ? 'menang' : 'kalah', persen }
}

/** 3) TP/SL H+5 — urutan kejadian dari data HARIAN (bukan intraday): pada
 *  tiap hari H+1..H+5, `high ≥ tp1` DAN `low ≤ sl` diperiksa BERSAMAAN.
 *  Kena tp1 saja hari itu = menang. Kena sl saja = kalah. Kena DUA-DUANYA di
 *  hari yang sama = 'tak-tentu' (spek: "jangan diklaim menang" — data harian
 *  tak bisa membuktikan tp1 tersentuh sebelum sl pada hari itu). Sampai H+5
 *  tak satu pun tersentuh = 'tak-tentu' juga (bukan menang, bukan kalah) —
 *  BEDA dari 'tak-terukur' (itu untuk riwayat yang memang belum ada, bukan
 *  hasil yang genuinely belum jelas). */
export function menangTpSlH5(
  bars: readonly BarWinRate[],
  idxH: number,
  tp1: number,
  sl: number,
): HasilMenang {
  if (idxH < 0 || !bars[idxH + 1]) return 'tak-terukur'
  for (let h = 1; h <= 5; h++) {
    const b = bars[idxH + h]
    if (!b) break
    const kenaTp = b.high >= tp1
    const kenaSl = b.low <= sl
    if (kenaTp && kenaSl) return 'tak-tentu'
    if (kenaTp) return 'menang'
    if (kenaSl) return 'kalah'
  }
  return 'tak-tentu'
}

/** Agregat satu definisi atas sekumpulan hasil — dipakai untuk baris per
 *  tanggal DAN untuk agregat per preset (7/30/90 hari, spek §C.2). Win rate
 *  dibagi terhadap `menang+kalah` saja ('tak-tentu'/'tak-terukur' dikeluarkan
 *  dari penyebut — sama prinsip dengan `skor` di presetScreener.ts: yang
 *  belum jelas tak boleh ikut menyeret rata-rata ke bawah). */
export interface AgregatWinRate {
  menang: number
  kalah: number
  takTentu: number
  takTerukur: number
  /** menang / (menang+kalah), 0..1. `null` kalau tak ada satu pun yang
   *  terukur — JANGAN dibaca sebagai 0%. */
  winRatePct: number | null
}

export function agregatWinRate(hasil: readonly HasilMenang[]): AgregatWinRate {
  const menang = hasil.filter((h) => h === 'menang').length
  const kalah = hasil.filter((h) => h === 'kalah').length
  const takTentu = hasil.filter((h) => h === 'tak-tentu').length
  const takTerukur = hasil.filter((h) => h === 'tak-terukur').length
  const dasar = menang + kalah
  return { menang, kalah, takTentu, takTerukur, winRatePct: dasar ? (menang / dasar) * 100 : null }
}

/** Rata-rata % dari daftar `persen` (Close-to-Close) — `null` diabaikan
 *  (tak terukur), bukan dihitung sebagai 0. `null` kalau tak ada satu pun
 *  angka. */
export function rataPersen(daftar: readonly (number | null)[]): number | null {
  const v = daftar.filter((x): x is number => x != null)
  return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null
}
