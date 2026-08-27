/**
 * Mesin murni Pola Gap — celah harga naik/turun antar bar
 * (`docs/spek-dev-papan/spek_rbs_gap_intraday.md` §2, algoritme v1 teruji).
 * Berdiri sendiri — JANGAN dicampur dengan pola RBS (§1, `polaRbs.ts`).
 *
 * `cariGap(bars)` murni (tanpa DOM/chart/fetch), bisa jalan di bar kerangka
 * apa pun (pemanggil di halaman membatasinya ke harian — lihat komentar di
 * `GrafikEmiten.tsx`). Penggambarnya ada di `polaGapChart.ts`.
 *
 * ## Algoritme, tahap demi tahap
 *
 * 1. **Ambang** — dihitung dari harga ACUAN bar sebelumnya (`high(t-1)` untuk
 *    gap naik, `low(t-1)` untuk gap turun): `max(2×fraksi(acuan), 1%×acuan)`.
 *    Dua tick — bukan persen tetap — supaya saham murah (fraksi Rp1-2) tak
 *    dibanjiri gap palsu: 1 tick di Rp50 sudah 2%, dan tanpa lantai tick itu
 *    gerakan sewajarnya kena tandai gap.
 * 2. **Gap naik** — `open(t) ≥ high(t-1) + ambang`.
 * 3. **Gap turun** — cermin: `open(t) ≤ low(t-1) - ambang`.
 * 4. **Terisi** — gap naik: bar PERTAMA (dihitung MULAI dari bar gap itu
 *    sendiri, bar ke-0) yang `low ≤ high(t-1)`. Gap turun cermin: `high ≥
 *    low(t-1)`. Bar gap sendiri ikut diperiksa — pembalikan intrahari yang
 *    langsung menutup gap di hari yang sama itu sah, bukan kasus tepi yang
 *    harus dilewati.
 *
 * Satu bar cuma bisa satu arah (naik XOR turun, tak pernah dua-duanya —
 * `high(t-1) >= low(t-1)` membuat kedua ambang tak mungkin terlampaui
 * bersamaan oleh satu `open`).
 */
import type { LilinData } from './grafikEmiten'
import { fraksi } from '../fraksiHarga'

export type ArahGap = 'naik' | 'turun'

export interface GapEvent {
  arah: ArahGap
  /** Tanggal bar gap (hari `t`, tempat `open` melompat). */
  waktuGap: string
  /** Tanggal bar acuan (hari `t-1`, sumber `high`/`low` acuan). */
  waktuAcuan: string
  /** `high(t-1)` untuk gap naik, `low(t-1)` untuk gap turun. */
  hargaAcuan: number
  open: number
  /** `(open - hargaAcuan) / hargaAcuan × 100` — positif untuk gap naik,
   *  negatif untuk gap turun (satu rumus, tandanya sudah membawa arah). */
  gapPct: number
  terisi: boolean
  waktuTerisi?: string
  /** Bar ke berapa sejak bar gap (0 = terisi di hari yang sama). */
  hariTerisi?: number
}

// Parameter algoritme v1 (spek §2) — JANGAN diubah tanpa entri Metodologi +
// referensi (CLAUDE.md "Ukur definisinya dulu sebelum menurunkan satu ruas").
const TICK_KALI = 2
const BUFFER_PCT = 0.01

/** Angka backtest v1 (spek §2) — SATU rumah, dipakai keterangan toggle chart
 *  dan halaman Metodologi sekaligus, supaya tak ada dua salinan yang bisa
 *  diam-diam berbeda. */
export const RINGKAS_BACKTEST_GAP =
  '3.897 gap naik · 80% terisi ≤5 hari, 88% ≤20 hari · '
  + 'beli di open hari gap median −0,71% (29% hijau) · konfirmasi volume tidak menolong · '
  + 'bukan sinyal beli — zona level & target gap-fill'

function ambang(hargaAcuan: number): number {
  return Math.max(TICK_KALI * fraksi(hargaAcuan), hargaAcuan * BUFFER_PCT)
}

function cariTerisi(
  bars: LilinData[],
  iGap: number,
  hargaAcuan: number,
  arah: ArahGap,
): { terisi: boolean; waktuTerisi?: string; hariTerisi?: number } {
  for (let j = iGap; j < bars.length; j++) {
    const tertutup = arah === 'naik' ? bars[j].low <= hargaAcuan : bars[j].high >= hargaAcuan
    if (tertutup) return { terisi: true, waktuTerisi: bars[j].time, hariTerisi: j - iGap }
  }
  return { terisi: false }
}

export function cariGap(bars: LilinData[]): GapEvent[] {
  const keluar: GapEvent[] = []
  for (let i = 1; i < bars.length; i++) {
    const prev = bars[i - 1]
    const cur = bars[i]

    if (cur.open >= prev.high + ambang(prev.high)) {
      keluar.push({
        arah: 'naik',
        waktuGap: cur.time,
        waktuAcuan: prev.time,
        hargaAcuan: prev.high,
        open: cur.open,
        gapPct: (cur.open - prev.high) / prev.high * 100,
        ...cariTerisi(bars, i, prev.high, 'naik'),
      })
      continue
    }
    if (cur.open <= prev.low - ambang(prev.low)) {
      keluar.push({
        arah: 'turun',
        waktuGap: cur.time,
        waktuAcuan: prev.time,
        hargaAcuan: prev.low,
        open: cur.open,
        gapPct: (cur.open - prev.low) / prev.low * 100,
        ...cariTerisi(bars, i, prev.low, 'turun'),
      })
    }
  }
  return keluar
}
