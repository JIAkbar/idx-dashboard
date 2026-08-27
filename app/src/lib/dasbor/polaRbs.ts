/**
 * Mesin murni Pola RBS — Resistance → Breakout → Support
 * (`docs/spek-dev-papan/spek_rbs_gap_intraday.md` §1, algoritme v1 teruji).
 * Berdiri sendiri — JANGAN dicampur dengan pola Gap (§2, belum dikerjakan).
 *
 * `cariRbs(bars)` murni (tanpa DOM/chart/fetch), bisa jalan di bar kerangka
 * apa pun (pemanggil di halaman membatasinya ke harian — lihat komentar di
 * `GrafikEmiten.tsx`). Penggambarnya ada di `polaRbsChart.ts`.
 *
 * ## Algoritme, tahap demi tahap
 *
 * 1. **Pivot high** — bar `i` valid kalau tinggi-nya adalah puncak lokal
 *    dalam jendela `N=5` bar kiri-kanan. Perbandingannya SENGAJA asimetris
 *    (`<` ke kiri, `<=` ke kanan) — persis konvensi `cariSwing` di
 *    `strukturPasar.ts`: pada deret DATAR (umum di papan tipis, atau hari
 *    tanpa transaksi ber-OHLC identik), perbandingan simetris menandai
 *    SETIAP bar dalam datarnya sebagai "pivot" — meledak jadi ratusan pivot
 *    palsu. Asimetris menandai tepat satu bar: yang terakhir dari deretan
 *    datar (dan hanya kalau bar sesudahnya benar-benar lebih rendah).
 * 2. **Klaster jadi level** — pivot berikutnya bergabung ke klaster TERBUKA
 *    (sentuhan pertamanya masih ≤120 bar dari pivot ini) kalau harganya
 *    ±1,5% dari harga acuan klaster (rata-rata berjalan seluruh sentuhannya);
 *    kalau tidak cocok satu pun, klaster baru. Klaster dengan <2 sentuhan
 *    dibuang — bukan level, cuma pivot tunggal.
 * 3. **Validitas "belum pernah ditutup di atasnya"** — dari sentuhan pertama
 *    sampai sentuhan KEDUA (titik level resmi terbentuk), kalau ada satu
 *    saja bar yang TUTUP di atas level, klasternya bukan resistance yang
 *    genuin lagi (sudah tertembus sebelum sempat "resmi") — dibuang, bukan
 *    dipaksa masuk status lain yang tak diminta spek.
 * 4. **Breakout** — bar TUTUP pertama sesudah level resmi yang > level+1%.
 * 5. **Retest** — bar RENDAH pertama sesudah breakout (≤40 bar) yang turun
 *    ke pita ±1,5% (dicek lewat batas ATAS pita saja: `low <= level×1,015` —
 *    kalau harga sudah jatuh SAMPAI/MELEWATI pita, itu tetap "menyentuh"
 *    pita dari atas, termasuk kalau overshoot ke bawah pita).
 * 6. **Bertahan** — TUTUP bar retest itu sendiri wajib ≥ level. Kalau tidak,
 *    `gagal` (support palsu / bull trap) — dicek SEKALI, di bar retest
 *    sendiri, sesuai kalimat spek "gagal (close < level saat retest)".
 * 7. **Konfirmasi** — bar TUTUP ≥ level+2% dalam ≤3 bar SEJAK bar retest
 *    (bar retest sendiri ikut dihitung sebagai bar ke-0 — pantulan V bisa
 *    langsung konfirmasi di bar yang sama).
 *
 * Status maju SATU ARAH dan berhenti di tahap terakhir yang tercapai kalau
 * jendela tahap berikutnya habis — TIDAK ada status "kadaluarsa" terpisah,
 * cuma lima yang tertulis di `StatusRbs`. Breakout tanpa retest ≤40 bar
 * TETAP `breakout` selamanya; retest yang bertahan tapi tak terkonfirmasi
 * ≤3 bar TETAP `retest` selamanya.
 */
import type { LilinData } from './grafikEmiten'

export type StatusRbs = 'resistance' | 'breakout' | 'retest' | 'sah' | 'gagal'

export interface LevelRbs {
  level: number
  status: StatusRbs
  /** Seluruh tanggal pivot yang berklaster ke level ini (≥2, urut naik). */
  tanggalPivot: string[]
  tanggalBreakout?: string
  tanggalRetest?: string
  tanggalKonfirmasi?: string
  /** = `tanggalPivot.length`, disimpan terpisah supaya pemakai tak perlu
   *  menghitung ulang. */
  sentuhan: number
}

// Parameter algoritme v1 (spek §1) — JANGAN diubah tanpa entri Metodologi +
// referensi (CLAUDE.md "Ukur definisinya dulu sebelum menurunkan satu ruas").
const PIVOT_N = 5
const KLASTER_PCT = 0.015
const JENDELA_KLASTER_BAR = 120
const BREAKOUT_PCT = 0.01
const RETEST_MAKS_BAR = 40
const PITA_RETEST_PCT = 0.015
const KONFIRMASI_PCT = 0.02
const KONFIRMASI_MAKS_BAR = 3

/** Angka backtest v1 (spek §1) — SATU rumah, dipakai title toggle chart,
 *  hover badge, dan halaman Metodologi sekaligus, supaya tak ada dua salinan
 *  yang bisa diam-diam berbeda. */
export const RINGKAS_BACKTEST_RBS =
  '617 breakout → 79% retest → 71% bertahan · H+20 pasca-retest ±0% · '
  + 'SL level−3%: 52% kena SL, yang lolos median +3,89% (72% menang) · '
  + 'pola deskriptif teruji — bukan sinyal beli'

function pivotHighIdx(bars: LilinData[], n: number): number[] {
  const idx: number[] = []
  for (let i = n; i < bars.length - n; i++) {
    let ok = true
    for (let k = 1; k <= n; k++) {
      if (bars[i].high < bars[i - k].high) { ok = false; break }
      if (bars[i].high <= bars[i + k].high) { ok = false; break }
    }
    if (ok) idx.push(i)
  }
  return idx
}

interface KlasterSementara { hargaAcuan: number; idx: number[] }

function klasterPivot(bars: LilinData[], pivotIdx: number[]): KlasterSementara[] {
  const klaster: KlasterSementara[] = []
  for (const i of pivotIdx) {
    const h = bars[i].high
    const cocok = klaster.find((kl) => (
      i - kl.idx[0] <= JENDELA_KLASTER_BAR
      && Math.abs(h - kl.hargaAcuan) / kl.hargaAcuan <= KLASTER_PCT
    ))
    if (cocok) {
      cocok.idx.push(i)
      cocok.hargaAcuan = cocok.idx.reduce((s, j) => s + bars[j].high, 0) / cocok.idx.length
    } else {
      klaster.push({ hargaAcuan: h, idx: [i] })
    }
  }
  return klaster.filter((kl) => kl.idx.length >= 2)
}

export function cariRbs(bars: LilinData[]): LevelRbs[] {
  if (bars.length < PIVOT_N * 2 + 1) return []
  const klaster = klasterPivot(bars, pivotHighIdx(bars, PIVOT_N))
  const keluar: LevelRbs[] = []

  for (const kl of klaster) {
    const idxUrut = [...kl.idx].sort((a, b) => a - b)
    const iAwal = idxUrut[0]
    const iBentuk = idxUrut[1]
    const level = kl.hargaAcuan

    let sudahTertembus = false
    for (let j = iAwal; j <= iBentuk; j++) {
      if (bars[j].close > level) { sudahTertembus = true; break }
    }
    if (sudahTertembus) continue

    let status: StatusRbs = 'resistance'
    let tanggalBreakout: string | undefined
    let tanggalRetest: string | undefined
    let tanggalKonfirmasi: string | undefined

    let iBreakout = -1
    for (let j = iBentuk + 1; j < bars.length; j++) {
      if (bars[j].close > level * (1 + BREAKOUT_PCT)) { iBreakout = j; break }
    }

    if (iBreakout !== -1) {
      status = 'breakout'
      tanggalBreakout = bars[iBreakout].time

      let iRetest = -1
      const batasRetest = Math.min(bars.length - 1, iBreakout + RETEST_MAKS_BAR)
      for (let j = iBreakout + 1; j <= batasRetest; j++) {
        if (bars[j].low <= level * (1 + PITA_RETEST_PCT)) { iRetest = j; break }
      }

      if (iRetest !== -1) {
        status = 'retest'
        tanggalRetest = bars[iRetest].time

        if (bars[iRetest].close < level) {
          status = 'gagal'
        } else {
          const batasKonfirmasi = Math.min(bars.length - 1, iRetest + KONFIRMASI_MAKS_BAR)
          for (let j = iRetest; j <= batasKonfirmasi; j++) {
            if (bars[j].close >= level * (1 + KONFIRMASI_PCT)) {
              status = 'sah'
              tanggalKonfirmasi = bars[j].time
              break
            }
          }
        }
      }
    }

    keluar.push({
      level,
      status,
      tanggalPivot: idxUrut.map((i) => bars[i].time),
      tanggalBreakout,
      tanggalRetest,
      tanggalKonfirmasi,
      sentuhan: idxUrut.length,
    })
  }

  return keluar.sort((a, b) => a.level - b.level)
}
