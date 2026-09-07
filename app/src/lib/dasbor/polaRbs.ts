/**
 * Mesin murni Pola RBS — Resistance → Breakout → Support
 * (`docs/spek-dev-papan/spek_rbs_gap_intraday.md` §1).
 * Berdiri sendiri — JANGAN dicampur dengan pola Gap (§2).
 *
 * `cariRbs(bars, param)` murni (tanpa DOM/chart/fetch) dan berlaku di kerangka
 * mana pun; parameternya yang berbeda per kerangka (`PARAM_RBS`). Penggambarnya
 * `polaRbsChart.ts`, padanan Python-nya `scripts/riset/rbs_mesin.py` — dan
 * keduanya WAJIB memberi hasil yang sama atas fixture yang sama
 * (`__fixtures__/rbs-mesin.json`, diuji di kedua bahasa).
 *
 * ## Kenapa mesinnya ditulis ulang, 7 Sep 2026 (#49)
 *
 * Sebelumnya ada DUA mesin yang berbeda diam-diam: yang ini untuk chart dan
 * `deteksi_rbs` di `bt_papan.py` untuk backtest. Enam titik berbeda, dan yang
 * paling mahal: **level klaster di sini dihitung dari SELURUH sentuhan,
 * termasuk pivot yang baru terjadi SESUDAH breakout**. Jadi harga level yang
 * dipakai memutuskan breakout dan retest sebagian ditentukan oleh bar yang
 * belum ada saat keputusan itu diambil — kebocoran masa depan yang menyentuh
 * 10,9% sinyal harian. Backtest-nya sendiri sudah kausal, jadi angka backtest
 * dan garis di layar memang tak pernah benar-benar sepadan.
 *
 * Sekarang satu aturan, dipakai dua bahasa.
 *
 * ## Algoritme, tahap demi tahap
 *
 * 1. **Pivot high** — bar `i` puncak lokal dalam jendela `pivotN` kiri-kanan.
 *    Perbandingannya SENGAJA asimetris (`<` ke kiri, `<=` ke kanan) — persis
 *    konvensi `cariSwing` di `strukturPasar.ts`: pada deret DATAR (umum di
 *    papan tipis) perbandingan simetris menandai SETIAP bar dalam datarnya
 *    sebagai pivot, meledak jadi ratusan pivot palsu. Asimetris menandai tepat
 *    satu: yang terakhir dari deretan datar.
 * 2. **Pivot baru DIKETAHUI `pivotN` bar kemudian.** Ini yang membuat
 *    seluruhnya kausal: pivot di bar `i` butuh `i+pivotN` bar untuk dipastikan
 *    puncak, jadi ia tak boleh dipakai memutuskan apa pun sebelum bar itu.
 * 3. **Klaster jadi level** — pivot bergabung ke klaster terbuka (sentuhan
 *    pertamanya masih ≤`jendelaKlaster` bar) kalau harganya ±`klasterPct` dari
 *    acuan klaster. Klaster <2 sentuhan bukan level.
 * 4. **Level LAHIR di bar konfirmasi sentuhan kedua**, dan harganya
 *    **DIBEKUKAN di situ** = rata-rata tinggi sentuhan yang sudah diketahui.
 *    Sentuhan berikutnya tetap dicatat di `tanggalPivot` (itu memang sentuhan
 *    yang sama) tapi TIDAK lagi menggeser harganya — menggesernya berarti
 *    menulis ulang masa lalu.
 * 5. **Validitas "belum pernah ditutup di atasnya"** — dari sentuhan pertama
 *    sampai bar lahir; ada satu bar tutup di atas level, klasternya bukan
 *    resistance genuin dan dibuang.
 * 6. **Breakout** — bar TUTUP pertama SESUDAH lahir yang > level+`breakoutPct`.
 * 7. **Retest** — bar RENDAH pertama sesudah breakout (≤`retestBar`) yang
 *    turun ke pita: dicek lewat batas ATAS pita saja (`low ≤ level×(1+tol)`) —
 *    harga yang jatuh melewati pita tetap menyentuhnya dari atas.
 * 8. **Bertahan** — TUTUP bar retest itu sendiri ≥ level; kalau tidak `gagal`.
 * 9. **Konfirmasi** — TUTUP ≥ level+`konfirmasiPct` dalam ≤`konfirmasiBar` bar
 *    sejak bar retest (bar retest sendiri bar ke-0).
 *
 * Status maju SATU ARAH dan berhenti di tahap terakhir yang tercapai — tak ada
 * status "kadaluarsa" terpisah.
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

export interface ParamRbs {
  pivotN: number
  klasterPct: number
  jendelaKlaster: number
  breakoutPct: number
  retestTolPct: number
  retestBar: number
  konfirmasiPct: number
  konfirmasiBar: number
}

/**
 * Parameter per kerangka. Yang berbeda cuma JENDELA RETEST, dan itu bukan
 * selera: 20 bar harian ≈ sebulan, dan menuntut sebuah level pekanan menunggu
 * retest 20 PEKAN (hampir setengah tahun) berarti hampir tak ada yang pernah
 * berstatus selain `breakout`.
 *
 * Toleransi retest 1% (dulu 1,5%) dan jendela 20 bar (dulu 40) datang dari
 * riset 7 Sep 2026 atas 19.290 breakout / 934 emiten.
 */
export const PARAM_RBS_DASAR: ParamRbs = {
  pivotN: 5,
  klasterPct: 0.015,
  jendelaKlaster: 120,
  breakoutPct: 0.01,
  retestTolPct: 0.01,
  retestBar: 20,
  konfirmasiPct: 0.02,
  konfirmasiBar: 3,
}

export const PARAM_RBS: Record<string, ParamRbs> = {
  '1h': { ...PARAM_RBS_DASAR, retestBar: 20 },
  '4h': { ...PARAM_RBS_DASAR, retestBar: 20 },
  D: PARAM_RBS_DASAR,
  W: { ...PARAM_RBS_DASAR, retestBar: 10 },
  M: { ...PARAM_RBS_DASAR, retestBar: 10 },
}

export function paramRbs(kerangka: string): ParamRbs {
  return PARAM_RBS[kerangka] ?? PARAM_RBS_DASAR
}

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

interface KlasterSementara {
  /** Harga acuan pencocokan. Bergerak sampai lahir, lalu BEKU. */
  hargaAcuan: number
  idx: number[]
  /** Indeks bar saat level resmi lahir (konfirmasi sentuhan kedua), -1 sebelum itu. */
  iLahir: number
}

function klasterPivot(bars: LilinData[], pivotIdx: number[], p: ParamRbs): KlasterSementara[] {
  const klaster: KlasterSementara[] = []
  for (const i of pivotIdx) {
    const h = bars[i].high
    const cocok = klaster.find((kl) => (
      i - kl.idx[0] <= p.jendelaKlaster
      && Math.abs(h - kl.hargaAcuan) / kl.hargaAcuan <= p.klasterPct
    ))
    if (!cocok) {
      klaster.push({ hargaAcuan: h, idx: [i], iLahir: -1 })
      continue
    }
    cocok.idx.push(i)
    if (cocok.iLahir === -1) {
      // Belum lahir: acuannya masih boleh bergerak — seluruh sentuhannya sudah
      // diketahui pada titik ini.
      cocok.hargaAcuan = cocok.idx.reduce((s, j) => s + bars[j].high, 0) / cocok.idx.length
      if (cocok.idx.length >= 2) cocok.iLahir = i + p.pivotN
    }
    // Sesudah lahir: sentuhan tetap dicatat, harga TIDAK digeser.
  }
  return klaster.filter((kl) => kl.idx.length >= 2 && kl.iLahir >= 0)
}

export function cariRbs(bars: LilinData[], p: ParamRbs = PARAM_RBS_DASAR): LevelRbs[] {
  if (bars.length < p.pivotN * 2 + 1) return []
  const klaster = klasterPivot(bars, pivotHighIdx(bars, p.pivotN), p)
  const keluar: LevelRbs[] = []

  for (const kl of klaster) {
    const idxUrut = [...kl.idx].sort((a, b) => a - b)
    const level = kl.hargaAcuan
    // Bar lahir bisa melewati ujung data — levelnya belum "resmi" di layar.
    const iLahir = kl.iLahir
    if (iLahir >= bars.length) continue

    let sudahTertembus = false
    for (let j = idxUrut[0]; j <= iLahir; j++) {
      if (bars[j].close > level) { sudahTertembus = true; break }
    }
    if (sudahTertembus) continue

    let status: StatusRbs = 'resistance'
    let tanggalBreakout: string | undefined
    let tanggalRetest: string | undefined
    let tanggalKonfirmasi: string | undefined

    let iBreakout = -1
    for (let j = iLahir + 1; j < bars.length; j++) {
      if (bars[j].close > level * (1 + p.breakoutPct)) { iBreakout = j; break }
    }

    if (iBreakout !== -1) {
      status = 'breakout'
      tanggalBreakout = bars[iBreakout].time

      let iRetest = -1
      const batasRetest = Math.min(bars.length - 1, iBreakout + p.retestBar)
      for (let j = iBreakout + 1; j <= batasRetest; j++) {
        if (bars[j].low <= level * (1 + p.retestTolPct)) { iRetest = j; break }
      }

      if (iRetest !== -1) {
        status = 'retest'
        tanggalRetest = bars[iRetest].time

        if (bars[iRetest].close < level) {
          status = 'gagal'
        } else {
          const batasKonfirmasi = Math.min(bars.length - 1, iRetest + p.konfirmasiBar)
          for (let j = iRetest; j <= batasKonfirmasi; j++) {
            if (bars[j].close >= level * (1 + p.konfirmasiPct)) {
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
