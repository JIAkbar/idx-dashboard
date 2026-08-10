/**
 * Port 1:1 dari arus-pasar/build.py (§ Skor model, METODOLOGI-ANALISA.md §7).
 * Bobot: Technical 35 / Big Money Flow 30 / Risk-reward 20 / Liquidity 10 / IHSG sensitivity 5.
 * Setiap fungsi di sini punya padanan nama Python persis — jaga tetap sinkron kalau build.py berubah.
 */
import type { Edisi, Emiten, OhlcMap, PeranBroker, Skor } from './types'

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v))
}

export function skorTeknikal(em: Emiten): number {
  const c = em.ohlc_hari.c
  const p = em.pivot
  const ema = em.ema50
  let s = 0
  if (c > ema) s += 12
  if (c > p.P) s += 12
  if (p.R1 > p.P) s += 8 * clamp((c - p.P) / (p.R1 - p.P), 0, 1)
  const rentang = (c - ema) / ema
  if (rentang > 0.15) s -= Math.min(7, (rentang - 0.15) * 60)
  return clamp(s, 0, 35)
}

export function skorFlow(em: Emiten, peran: PeranBroker): number {
  const b = em.beli.reduce((acc, r) => acc + r[1], 0)
  const j = em.jual.reduce((acc, r) => acc + r[1], 0)
  const rasio = b + j ? (b - j) / (b + j) : 0
  let s = 15 + 15 * rasio
  const b1 = em.beli[0][0]
  const j1 = em.jual[0][0]
  if (peran.scalper.includes(b1)) s -= 5
  if (peran.ritel.includes(b1)) s -= 5
  if (peran.ritel.includes(j1)) s += 3
  if (em.jual[0][1] + em.jual[1][1] > em.beli[0][1] + em.beli[1][1]) s -= 5
  return clamp(s, 0, 30)
}

export function skorRr(em: Emiten): number {
  const c = em.ohlc_hari.c
  const p = em.pivot
  const inval = Number(em.invalidation.replace('Close <', '').replaceAll('.', ''))
  const risiko = c - inval
  if (risiko <= 0) return 0
  return clamp(((p.R2 - c) / risiko) * 9, 0, 20)
}

export function skorLikuiditas(em: Emiten): number {
  const nilaiB = (em.ohlc_hari.c * em.ohlc_hari.vol_juta) / 1000
  const tangga: [number, number][] = [
    [50, 10],
    [20, 8],
    [5, 6],
    [1, 4],
  ]
  for (const [ambang, sk] of tangga) {
    if (nilaiB >= ambang) return sk
  }
  return 2
}

function ret(seri: { c: number }[]): number[] {
  const out: number[] = []
  for (let i = 1; i < seri.length; i++) {
    out.push((seri[i].c - seri[i - 1].c) / seri[i - 1].c)
  }
  return out
}

/** Korelasi Pearson — padanan statistics.correlation Python. 0 kalau n<2 atau varians nol. */
function pearson(a: number[], b: number[]): number {
  const n = a.length
  if (n < 2) return 0
  const ma = a.reduce((s, v) => s + v, 0) / n
  const mb = b.reduce((s, v) => s + v, 0) / n
  let cov = 0
  let va = 0
  let vb = 0
  for (let i = 0; i < n; i++) {
    const da = a[i] - ma
    const db = b[i] - mb
    cov += da * db
    va += da * da
    vb += db * db
  }
  const denom = Math.sqrt(va * vb)
  return denom === 0 ? 0 : cov / denom
}

export function skorIhsg(tk: string, ohlc: OhlcMap): { skor: number; korr: number } {
  const a0 = ret(ohlc[tk].slice(-61))
  const b0 = ret(ohlc.JKSE.slice(-61))
  const n = Math.min(a0.length, b0.length)
  const a = a0.slice(-n)
  const b = b0.slice(-n)
  const korr = pearson(a, b)
  return { skor: Math.max(0, 5 - 4 * Math.abs(korr - 0.3)), korr }
}

export function tingkatRisiko(total: number): Skor['risiko'] {
  if (total >= 80) return 'MENENGAH'
  if (total >= 55) return 'TINGGI'
  return 'EKSTREM'
}

export function hitungSkor(em: Emiten, ed: Edisi, ohlc: OhlcMap): Skor {
  const teknikal = skorTeknikal(em)
  const flow = skorFlow(em, ed.peran_broker)
  const rr = skorRr(em)
  const lik = skorLikuiditas(em)
  const { skor: ihsg, korr } = skorIhsg(em.ticker, ohlc)
  const total = teknikal + flow + rr + lik + ihsg
  return { teknikal, flow, rr, lik, ihsg, korr, total, risiko: tingkatRisiko(total) }
}
