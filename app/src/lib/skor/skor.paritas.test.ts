/**
 * Test paritas — bukti selesai Fase 1 (RENCANA-REFACTOR-REACT.md).
 * Angka referensi diambil LANGSUNG dari fungsi Python arus-pasar/build.py
 * (bukan ditulis ulang manual) terhadap edisi nyata AP-100826-E01.
 * Toleransi 1e-9 hanya untuk beda urutan operasi floating-point, bukan celah logika.
 */
import { describe, expect, it } from 'vitest'
import { hitungSkor } from './skor'
import type { Edisi, OhlcMap } from './types'
import edisiJson from './__fixtures__/edisi-2026-08-10.json'
import ohlcJson from './__fixtures__/ohlc-2026-08-10.json'

const edisi = edisiJson as unknown as Edisi
const ohlc = ohlcJson as unknown as OhlcMap

// Dihasilkan oleh: python -c "..." memanggil skor_teknikal/skor_flow/skor_rr/
// skor_likuiditas/skor_ihsg/tingkat_risiko dari build.py langsung — lihat commit.
const REFERENSI_PYTHON: Record<string, {
  teknikal: number; flow: number; rr: number; lik: number; ihsg: number
  korr: number; total: number; risiko: string
}> = {
  ARCI: { teknikal: 30.76923076923077, flow: 18.587375376873723, rr: 3.96, lik: 10,
    ihsg: 3.9563743752297675, korr: 0.5609064061925582, total: 67.27298052133426, risiko: 'TINGGI' },
  MBMA: { teknikal: 27.2, flow: 10.31541968053044, rr: 6.428571428571429, lik: 10,
    ihsg: 4.343140313596315, korr: 0.4642149216009213, total: 58.28713142269819, risiko: 'TINGGI' },
  VKTR: { teknikal: 23.14742698191933, flow: 13.524133377949408, rr: 20.0, lik: 10,
    ihsg: 3.8565742859226937, korr: 0.5858564285193266, total: 70.52813464579143, risiko: 'TINGGI' },
}

describe('paritas skor TS vs build.py (edisi AP-100826-E01)', () => {
  for (const em of edisi.emiten) {
    const ref = REFERENSI_PYTHON[em.ticker]

    it(`${em.ticker}: setiap komponen skor identik dengan Python`, () => {
      const sk = hitungSkor(em, edisi, ohlc)
      expect(sk.teknikal).toBeCloseTo(ref.teknikal, 9)
      expect(sk.flow).toBeCloseTo(ref.flow, 9)
      expect(sk.rr).toBeCloseTo(ref.rr, 9)
      expect(sk.lik).toBe(ref.lik)
      expect(sk.ihsg).toBeCloseTo(ref.ihsg, 9)
      expect(sk.korr).toBeCloseTo(ref.korr, 9)
      expect(sk.total).toBeCloseTo(ref.total, 9)
      expect(sk.risiko).toBe(ref.risiko)
    })
  }
})
