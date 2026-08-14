import { describe, expect, it } from 'vitest'
import type { ArsipRadar, BarisRadar, EdisiRadar } from './arsip'
import { namaBerkas } from './arsip'
import { kalibrasiSinyal, skorRadar } from './skor'
import { rollupBulanan, rollupMingguan } from './rollup'
// Arsip nyata di-impor langsung sebagai modul JSON (resolveJsonModule) —
// pola test repo ini tanpa node:fs (tsconfig.app types: ["vite/client"]).
import j0803 from '../../../../data-idx/radar/r_260803.json'
import j0806 from '../../../../data-idx/radar/r_260806.json'
import j0810 from '../../../../data-idx/radar/r_260810.json'
import j0812 from '../../../../data-idx/radar/r_260812.json'
import j0813 from '../../../../data-idx/radar/r_260813.json'

const baris = (tik: string, close: number | null, over: Partial<BarisRadar> = {}): BarisRadar => ({
  tik, hari_ke: null, zona: null, chg: null, pct: null, trx: null, s: null, close, r: null,
  colors: null, bodies: null, osc: null, candle: null, vr: null, macd: null, ...over,
})

/** Arsip fixture 2 edisi: tiap jenis sinyal tepat satu kejadian ber-forward-return. */
const e1: EdisiRadar = {
  date_iso: '2026-08-03',
  watch: [
    baris('AAA', 100, { colors: '2-Greens', bodies: '2-Whites' }),
    baris('BBB', 200, { colors: '3-Reds', bodies: '3-Blacks' }),
    baris('CCC', 50, { hari_ke: 3 }),
    // IHSG wajib DIKECUALIKAN dari kalibrasi & rollup (baris indeks, bukan saham).
    baris('IHSG', 1000, { colors: '2-Greens', bodies: '2-Whites' }),
  ],
  penny: [baris('PPP', 10, { osc: 'RSI+BB', colors: '3-Greens' })],
  rbu: [],
}
const e2: EdisiRadar = {
  date_iso: '2026-08-04',
  watch: [baris('AAA', 110), baris('BBB', 180), baris('CCC', 45), baris('IHSG', 1010)],
  penny: [baris('PPP', 12)],
  rbu: [],
}
const arsip: ArsipRadar = [e1, e2]

describe('kalibrasiSinyal', () => {
  const stat = kalibrasiSinyal(arsip)
  it('menghitung hit-rate forward return per jenis sinyal', () => {
    expect(stat.greens_whites).toMatchObject({ n: 1, hit: 1 }) // AAA +10%
    expect(stat.streak3).toMatchObject({ n: 1, hit: 0 }) // CCC -10%
    expect(stat.osc_greens).toMatchObject({ n: 1, hit: 1 }) // PPP +20%
    expect(stat.reds_blacks).toMatchObject({ n: 1, hit: 1 }) // BBB -10% = hit arah turun
    expect(stat.greens_whites.rerataRet).toBeCloseTo(0.1)
  })
  it('shrink ke prior netral: n=1 hit=1 → (1+3)/(1+6)', () => {
    expect(stat.greens_whites.rateShrunk).toBeCloseTo(4 / 7)
    expect(stat.streak3.rateShrunk).toBeCloseTo(3 / 7)
  })
  it('IHSG tidak ikut dihitung (greens_whites cuma 1 sampel walau IHSG bersinyal sama)', () => {
    expect(stat.greens_whites.n).toBe(1)
  })
})

describe('skorRadar', () => {
  it('sinyal terbukti naik menggeser dari prior 50 (greens+whites → 57)', () => {
    const { skor, komponen } = skorRadar(e1.watch[0], arsip)
    expect(skor).toBe(57) // 50 + round((4/7 - 0.5) * 100) = 50 + 7
    expect(komponen.map((k) => k.label)).toEqual(['Prior netral', 'Greens + Whites'])
  })
  it('reds+blacks yang terbukti turun MENURUNKAN skor', () => {
    expect(skorRadar(e1.watch[1], arsip).skor).toBe(43)
  })
  it('dorongan tetap MACD & V Ratio ikut dan dilaporkan sebagai komponen', () => {
    const r = baris('DDD', 100, { macd: { arah: 'up', n: 10, kode: null }, vr: 2 })
    const { skor, komponen } = skorRadar(r, arsip)
    expect(skor).toBe(58) // 50 + 4 (MACD up) + 4 (VR ≥ 1.5)
    expect(komponen).toHaveLength(3)
  })
  it('skor terkunci 0..100', () => {
    const r = baris('EEE', 100)
    expect(skorRadar(r, arsip).skor).toBe(50)
  })
})

describe('rollupMingguan', () => {
  const rows = rollupMingguan(arsip)
  it('menghitung kehadiran & return selama hadir per saham (tanpa IHSG)', () => {
    expect(rows.find((r) => r.tik === 'IHSG')).toBeUndefined()
    const aaa = rows.find((r) => r.tik === 'AAA')!
    expect(aaa.edisi).toBe(2)
    expect(aaa.ret).toBeCloseTo(0.1)
  })
  it('urut: paling bertahan lalu return terbesar', () => {
    expect(rows[0].tik).toBe('PPP') // semua 2 edisi; PPP +20% terbesar
  })
})

describe('rollupBulanan', () => {
  it('leaderboard sinyal + benchmark IHSG antar edisi', () => {
    const rows = rollupBulanan(arsip, new Map([['2026-08-03', 1000], ['2026-08-04', 1010]]))
    const gw = rows.find((r) => r.jenis === 'greens_whites')!
    expect(gw.hit).toBe(1)
    expect(gw.rerataRet).toBeCloseTo(0.1)
    expect(gw.ihsgRet).toBeCloseTo(0.01)
  })
  it('tanpa peta IHSG → ihsgRet null', () => {
    expect(rollupBulanan(arsip)[0].ihsgRet).toBeNull()
  })
})

/** Validasi angka terhadap ARSIP NYATA data-idx/radar (bukan fixture):
 *  tiga titik dihitung manual dari JSON — KOTA & DSSA & ISAT 03→13 Agu. */
describe('validasi arsip nyata (data-idx/radar)', () => {
  const nyata = [j0803, j0806, j0810, j0812, j0813] as unknown as ArsipRadar
  const rows = rollupMingguan(nyata)

  it('nama berkas edisi mengikuti pola r_YYMMDD', () => {
    expect(namaBerkas('2026-08-13')).toBe('r_260813')
  })

  it('KOTA hadir 5 edisi, 152 → 183 = +20,4%', () => {
    const r = rows.find((x) => x.tik === 'KOTA')!
    expect(r.edisi).toBe(5)
    expect(r.ret).toBeCloseTo((183 - 152) / 152, 5)
  })
  it('DSSA hadir 5 edisi, 835 → 990 = +18,6%', () => {
    const r = rows.find((x) => x.tik === 'DSSA')!
    expect(r.edisi).toBe(5)
    expect(r.ret).toBeCloseTo((990 - 835) / 835, 5)
  })
  it('ISAT hadir 5 edisi, 1.905 → 2.470 = +29,7%, naik kelas ke breakout', () => {
    const r = rows.find((x) => x.tik === 'ISAT')!
    expect(r.edisi).toBe(5)
    expect(r.ret).toBeCloseTo((2470 - 1905) / 1905, 5)
    expect(r.zonaAkhir).toBe('breakout')
  })
})
