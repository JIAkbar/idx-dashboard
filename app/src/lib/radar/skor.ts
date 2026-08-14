/**
 * Mesin skor Radar WDWL — model TERBUKA: skor 0–100 dari kombinasi sinyal,
 * dikalibrasi dari arsip sendiri (hit-rate forward return close antar-edisi),
 * dan setiap komponen dikembalikan supaya bisa ditampilkan apa adanya.
 *
 * Kalibrasi: untuk tiap jenis kombinasi (greens+whites, streak≥3, osc+greens,
 * reds+blacks) dihitung berapa kali kombinasi itu diikuti kenaikan (atau,
 * untuk reds+blacks, penurunan) close pada EDISI BERIKUTNYA di arsip. Sampel
 * kecil di-shrink ke prior netral 50% dengan bobot K_PRIOR — makin sedikit
 * sampel makin dekat ke netral; jumlah sampel ikut dilaporkan, tidak
 * disembunyikan.
 */
import { type ArsipRadar, type BarisRadar, closeDi, semuaBaris } from './arsip'

export type JenisSinyal = 'greens_whites' | 'streak3' | 'osc_greens' | 'reds_blacks'

export const LABEL_SINYAL: Record<JenisSinyal, string> = {
  greens_whites: 'Greens + Whites',
  streak3: 'Streak ≥3 hari di daftar',
  osc_greens: 'Oscillator + Greens',
  reds_blacks: 'Reds + Blacks (sinyal turun)',
}

/** Bobot prior netral (setara "K_PRIOR sampel imajiner 50%"). */
const K_PRIOR = 6

const adaGreens = (r: BarisRadar) => /Greens$/.test(r.colors ?? '')
const adaWhites = (r: BarisRadar) => /Whites$/.test(r.bodies ?? '')
const adaReds = (r: BarisRadar) => /Reds$/.test(r.colors ?? '')
const adaBlacks = (r: BarisRadar) => /Blacks$/.test(r.bodies ?? '')

/** Sinyal-sinyal terkalibrasi yang aktif pada satu baris. */
export function sinyalBaris(r: BarisRadar): JenisSinyal[] {
  const out: JenisSinyal[] = []
  if (adaGreens(r) && adaWhites(r)) out.push('greens_whites')
  if ((r.hari_ke ?? 0) >= 3) out.push('streak3')
  if (r.osc !== null && adaGreens(r)) out.push('osc_greens')
  if (adaReds(r) && adaBlacks(r)) out.push('reds_blacks')
  return out
}

export interface StatSinyal {
  jenis: JenisSinyal
  /** Jumlah kejadian yang punya forward return (edisi berikutnya memuat saham itu). */
  n: number
  /** Berapa kali arah yang "diramalkan" sinyal benar terjadi. */
  hit: number
  /** Rerata forward return (desimal, mis. 0.031 = +3,1%). */
  rerataRet: number
  /** Hit-rate mentah 0..1 (hit/n); 0.5 kalau n = 0. */
  rate: number
  /** Hit-rate setelah shrink ke prior netral 0.5 dgn bobot K_PRIOR. */
  rateShrunk: number
}

/** Forward return baris pada edisi i → edisi i+1 (null bila tak ada data). */
function forwardRet(arsip: ArsipRadar, i: number, r: BarisRadar): number | null {
  if (r.close === null || r.close === 0 || i + 1 >= arsip.length) return null
  const next = closeDi(arsip[i + 1], r.tik)
  if (next === null) return null
  return (next - r.close) / r.close
}

/** Kalibrasi hit-rate per jenis sinyal dari seluruh arsip. */
export function kalibrasiSinyal(arsip: ArsipRadar): Record<JenisSinyal, StatSinyal> {
  const acc: Record<JenisSinyal, { n: number; hit: number; sum: number }> = {
    greens_whites: { n: 0, hit: 0, sum: 0 },
    streak3: { n: 0, hit: 0, sum: 0 },
    osc_greens: { n: 0, hit: 0, sum: 0 },
    reds_blacks: { n: 0, hit: 0, sum: 0 },
  }
  arsip.forEach((edisi, i) => {
    for (const { row } of semuaBaris(edisi)) {
      const sinyal = sinyalBaris(row)
      if (sinyal.length === 0) continue
      const ret = forwardRet(arsip, i, row)
      if (ret === null) continue
      for (const j of sinyal) {
        acc[j].n += 1
        acc[j].sum += ret
        // reds_blacks meramal TURUN — hit bila ret negatif; sisanya naik.
        if (j === 'reds_blacks' ? ret < 0 : ret > 0) acc[j].hit += 1
      }
    }
  })
  const out = {} as Record<JenisSinyal, StatSinyal>
  for (const j of Object.keys(acc) as JenisSinyal[]) {
    const { n, hit, sum } = acc[j]
    const rate = n > 0 ? hit / n : 0.5
    out[j] = {
      jenis: j,
      n,
      hit,
      rerataRet: n > 0 ? sum / n : 0,
      rate,
      rateShrunk: (hit + 0.5 * K_PRIOR) / (n + K_PRIOR),
    }
  }
  return out
}

export interface KomponenSkor {
  label: string
  /** Poin yang ditambahkan/dikurangkan ke skor. */
  delta: number
  /** Keterangan terbuka, mis. "hit 4/5 arsip, shrink → 68%". */
  detail: string
}

export interface HasilSkor {
  skor: number
  komponen: KomponenSkor[]
}

/**
 * Skor satu baris: prior netral 50, tiap sinyal terkalibrasi menggeser skor
 * sebesar (rateShrunk − 0.5) × 100 (negatif untuk sinyal turun yang terbukti),
 * plus dua dorongan kecil TETAP (tak dikalibrasi, disebut jujur di komponen):
 * arah MACD ±4 dan V Ratio ≥ 1.5 (+4).
 */
export function skorRadar(row: BarisRadar, arsip: ArsipRadar): HasilSkor {
  const stat = kalibrasiSinyal(arsip)
  const komponen: KomponenSkor[] = [{ label: 'Prior netral', delta: 50, detail: 'titik awal 50 — bukti menggesernya' }]
  let skor = 50
  for (const j of sinyalBaris(row)) {
    const s = stat[j]
    const arahTurun = j === 'reds_blacks'
    const geser = (s.rateShrunk - 0.5) * 100
    const delta = Math.round(arahTurun ? -geser : geser)
    skor += delta
    komponen.push({
      label: LABEL_SINYAL[j],
      delta,
      detail: `hit ${s.hit}/${s.n} di arsip (shrink → ${Math.round(s.rateShrunk * 100)}%${arahTurun ? ', arah turun' : ''})`,
    })
  }
  if (row.macd?.arah === 'up' || row.macd?.arah === 'down') {
    const delta = row.macd.arah === 'up' ? 4 : -4
    skor += delta
    komponen.push({ label: `MACD ${row.macd.arah === 'up' ? 'naik' : 'turun'}`, delta, detail: 'dorongan tetap ±4, tidak dikalibrasi' })
  }
  if ((row.vr ?? 0) >= 1.5) {
    skor += 4
    komponen.push({ label: `V Ratio ${row.vr}`, delta: 4, detail: 'volume ramai (≥1,5) — dorongan tetap +4' })
  }
  return { skor: Math.max(0, Math.min(100, Math.round(skor))), komponen }
}
