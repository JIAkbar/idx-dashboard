import { describe, expect, it } from 'vitest'
import { MIN_TAHUN, persentil, rasioKini, ringkasRasio } from './valuasiHistoris'

describe('persentil', () => {
  it('interpolasi linear sama dengan numpy/PERCENTILE.INC', () => {
    const d = [1, 2, 3, 4]
    // indeks = (n-1)*p → 0.75 ⇒ antara 1 dan 2, 75% jalan
    expect(persentil(d, 0.25)).toBeCloseTo(1.75, 10)
    expect(persentil(d, 0.5)).toBeCloseTo(2.5, 10)
    expect(persentil(d, 0.75)).toBeCloseTo(3.25, 10)
  })

  it('jatuh tepat di titik data ketika indeksnya bulat', () => {
    expect(persentil([10, 20, 30, 40, 50], 0.5)).toBe(30)
    expect(persentil([10, 20, 30, 40, 50], 0.25)).toBe(20)
  })

  it('deret kosong → null, satu titik → titik itu', () => {
    expect(persentil([], 0.5)).toBeNull()
    expect(persentil([7], 0.25)).toBe(7)
  })
})

describe('rasioKini', () => {
  it('harga ÷ ruas per-saham', () => {
    expect(rasioKini(6350, 471.45)).toBeCloseTo(13.469, 3)
  })

  it('penyebut nol/negatif tak menghasilkan rasio — bukan Infinity, bukan angka negatif', () => {
    expect(rasioKini(1000, 0)).toBeNull()
    expect(rasioKini(1000, -50)).toBeNull()
  })

  it('nilai hilang → null, tak pernah 0', () => {
    expect(rasioKini(null, 100)).toBeNull()
    expect(rasioKini(1000, undefined)).toBeNull()
  })
})

/** Deret P/E BBCA hasil `scripts/hitung_valuasi_historis.py` (20 Agu 2026) —
 *  dipakai apa adanya supaya uji ini ikut menjaga bentuk berkasnya. */
const PE_BBCA = {
  '2019': 28.561, '2020': 30.453, '2021': 28.352, '2022': 25.615,
  '2023': 23.586, '2024': 21.532, '2025': 17.128,
}

describe('ringkasRasio', () => {
  it('median dipakai sebagai jangkar, rerata tetap dihitung', () => {
    const r = ringkasRasio(PE_BBCA, 13.47)
    expect(r.n).toBe(7)
    expect(r.median).toBeCloseTo(25.615, 3) // titik tengah dari 7 angka
    expect(r.rerata).toBeCloseTo(25.032, 3)
    expect(r.min).toBeCloseTo(17.128, 3)
    expect(r.max).toBeCloseTo(30.453, 3)
    expect(r.tahunAwal).toBe('2019')
    expect(r.tahunAkhir).toBe('2025')
  })

  it('vonis murah ketika rasio kini di bawah kuartil 25', () => {
    const r = ringkasRasio(PE_BBCA, 13.47)
    expect(r.q1).toBeCloseTo(22.559, 3)
    expect(r.vonis).toBe('murah')
    expect(r.alasan).toBeNull()
  })

  it('vonis mahal ketika di atas kuartil 75, wajar ketika di antaranya', () => {
    expect(ringkasRasio(PE_BBCA, 35).q3).toBeCloseTo(28.4565, 3)
    expect(ringkasRasio(PE_BBCA, 35).vonis).toBe('mahal')
    expect(ringkasRasio(PE_BBCA, 25).vonis).toBe('wajar')
  })

  it('tepat DI ambang dihitung wajar — batasnya eksklusif di kedua sisi', () => {
    const q1 = ringkasRasio(PE_BBCA, 1).q1!
    const q3 = ringkasRasio(PE_BBCA, 1).q3!
    expect(ringkasRasio(PE_BBCA, q1).vonis).toBe('wajar')
    expect(ringkasRasio(PE_BBCA, q3).vonis).toBe('wajar')
  })

  it(`riwayat < ${MIN_TAHUN} tahun tidak diberi vonis, dan alasannya disebut`, () => {
    const r = ringkasRasio({ '2023': 10, '2024': 12, '2025': 14 }, 5)
    expect(r.n).toBe(3)
    expect(r.vonis).toBeNull()
    expect(r.alasan).toContain('3 tahun')
    // Statistiknya tetap dihitung — yang ditahan cuma vonisnya.
    expect(r.median).toBe(12)
  })

  it('riwayat pas 5 tahun sudah cukup — ambangnya inklusif di MIN_TAHUN', () => {
    const r = ringkasRasio({ '2021': 10, '2022': 12, '2023': 14, '2024': 16, '2025': 18 }, 9)
    expect(r.n).toBe(MIN_TAHUN)
    expect(r.vonis).toBe('murah')
  })

  it('rasio kini tak tersedia → tanpa vonis, bukan vonis wajar', () => {
    const r = ringkasRasio(PE_BBCA, null)
    expect(r.vonis).toBeNull()
    expect(r.alasan).toContain('belum tersedia')
  })

  it('deret kosong aman: nol, bukan NaN atau lemparan', () => {
    const r = ringkasRasio(undefined, 12)
    expect(r.n).toBe(0)
    expect(r.median).toBeNull()
    expect(r.rerata).toBeNull()
    expect(r.vonis).toBeNull()
  })

  it('urutan kunci tahun tak mengubah hasil — deret diurutkan sendiri', () => {
    const acak = { '2025': 17.128, '2019': 28.561, '2022': 25.615 }
    const r = ringkasRasio(acak, 20)
    expect(r.tahunAwal).toBe('2019')
    expect(r.tahunAkhir).toBe('2025')
    expect(r.median).toBeCloseTo(25.615, 3)
  })
})
