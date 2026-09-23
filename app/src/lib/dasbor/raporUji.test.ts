import { describe, it, expect } from 'vitest'
import { vonis, layakPersen, type SumberRapor, type HorizonStat } from './raporUji'
import { MIN_SAMPEL_PERSEN } from './berkasRekam'

const stat = (over: Partial<HorizonStat> = {}): HorizonStat => ({
  win_rate: 0.5, pf: 1.0, rata: 0.01, median: 0.01,
  acak_p50_pf: 1.0, acak_p95_pf: 1.5, acak_rata: 0.005, ihsg_rata: 0.002,
  ...over,
})

const kelompok = (nSelesai: number, h5: Partial<HorizonStat> = {}): SumberRapor => ({
  n_total: nSelesai, n_selesai_h5: nSelesai, n_selesai_h20: nSelesai,
  h5: stat(h5), h20: stat(h5),
})

describe('vonis', () => {
  it('n < 30 -> belum bisa disimpulkan, menyebut n apa adanya', () => {
    expect(vonis(kelompok(5), 'h5')).toBe('Belum bisa disimpulkan: baru 5 pilihan selesai.')
    expect(vonis(kelompok(29), 'h5')).toContain('29 pilihan')
  })

  it('n >= 30 tepat di ambang sudah dinilai, bukan lagi "belum bisa"', () => {
    expect(vonis(kelompok(30, { pf: 1.0, acak_p50_pf: 1.0, acak_p95_pf: 1.5 }), 'h5'))
      .not.toContain('Belum bisa')
  })

  it('pf melampaui persentil-95 acak -> lebih baik dari 95%', () => {
    const k = kelompok(50, { pf: 2.0, acak_p50_pf: 1.2, acak_p95_pf: 1.8 })
    expect(vonis(k, 'h5')).toBe('Lebih baik dari 95% pilihan acak di tanggal yang sama.')
  })

  it('pf di atas median acak tapi di bawah p95 -> "di atas rata-rata", bukan "batas keberuntungan"', () => {
    const k = kelompok(50, { pf: 1.4, acak_p50_pf: 1.2, acak_p95_pf: 1.8 })
    expect(vonis(k, 'h5')).toBe('Di atas rata-rata acak, tapi belum melewati batas keberuntungan.')
  })

  it('pf di bawah median acak -> tidak lebih baik dari acak', () => {
    const k = kelompok(50, { pf: 0.9, acak_p50_pf: 1.2, acak_p95_pf: 1.8 })
    expect(vonis(k, 'h5')).toBe('Tidak lebih baik dari pilihan acak.')
  })

  it('pf null (nol kalah, tak bisa dibagi) tak melempar, jatuh ke "tidak lebih baik"', () => {
    const k = kelompok(50, { pf: null, acak_p50_pf: 1.2, acak_p95_pf: 1.8 })
    expect(vonis(k, 'h5')).toBe('Tidak lebih baik dari pilihan acak.')
  })

  it('horizon h20 dibaca dari n_selesai_h20 & stat h20, bukan h5', () => {
    const k: SumberRapor = {
      n_total: 100, n_selesai_h5: 5, n_selesai_h20: 40,
      h5: stat({ pf: 5.0 }), h20: stat({ pf: 2.0, acak_p50_pf: 1.0, acak_p95_pf: 1.8 }),
    }
    expect(vonis(k, 'h5')).toContain('Belum bisa disimpulkan')
    expect(vonis(k, 'h20')).toBe('Lebih baik dari 95% pilihan acak di tanggal yang sama.')
  })
})

describe('layakPersen (ambang sama dengan MIN_SAMPEL_PERSEN berkasRekam.ts)', () => {
  it('sama persis dengan konstanta yang diimpor, bukan angka tersendiri', () => {
    expect(layakPersen(MIN_SAMPEL_PERSEN)).toBe(true)
    expect(layakPersen(MIN_SAMPEL_PERSEN - 1)).toBe(false)
  })

  it('tepat di bawah ambang -> tidak layak', () => {
    expect(layakPersen(19)).toBe(false)
  })

  it('di ambang dan di atasnya -> layak', () => {
    expect(layakPersen(20)).toBe(true)
    expect(layakPersen(200)).toBe(true)
  })
})
