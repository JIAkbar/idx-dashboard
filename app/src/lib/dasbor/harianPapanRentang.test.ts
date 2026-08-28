import { describe, it, expect } from 'vitest'
import { akumulasiRentang, catatanRentang } from './harianPapanRentang'
import type { BarisHarianPapan } from './harianPapan'

function b(kode: string, o: Partial<BarisHarianPapan> = {}): BarisHarianPapan {
  return {
    kode, nama: `${kode} Tbk`, sektor: 'Energy', harga: 100, tdm_persen: 1,
    volume: 1000, rvol10: 1, nilai: 5000, nbsf_000: 10, free_float: 50,
    ma20_arah: 'naik', close_gap: 0, chg_1d: 0, chg_wtd: 0, chg_mtd: 0,
    posisi_ema5: 'atas', posisi_ma10: 'atas', posisi_ma20: 'atas',
    skor_d: null, skor_w: null, ...o,
  } as BarisHarianPapan
}

describe('akumulasiRentang', () => {
  it('menjumlahkan volume, nilai, dan net asing', () => {
    const r = akumulasiRentang(new Map([
      ['2026-08-26', [b('BBCA', { volume: 100, nilai: 500, nbsf_000: 5 })]],
      ['2026-08-27', [b('BBCA', { volume: 300, nilai: 900, nbsf_000: -2 })]],
    ]))
    const x = r.baris[0]
    expect(x.volume).toBe(400)
    expect(x.nilai).toBe(1400)
    expect(x.nbsf_000).toBe(3)
    expect(x.nHari).toBe(2)
  })

  it('harga_akhir diambil dari hari TERBARU, bukan dijumlahkan', () => {
    const r = akumulasiRentang(new Map([
      ['2026-08-26', [b('BBCA', { harga: 6000 })]],
      ['2026-08-27', [b('BBCA', { harga: 6400 })]],
    ]))
    expect(r.baris[0].harga_akhir).toBe(6400)
  })

  it('urutan Map tak menentukan — tanggal diurut sendiri', () => {
    const r = akumulasiRentang(new Map([
      ['2026-08-27', [b('BBCA', { harga: 6400 })]],
      ['2026-08-26', [b('BBCA', { harga: 6000 })]],
    ]))
    expect(r.baris[0].harga_akhir).toBe(6400)
    expect(r.tanggalDipakai).toEqual(['2026-08-26', '2026-08-27'])
  })

  it('emiten yang cuma ada sebagian hari tetap dihitung apa adanya', () => {
    const r = akumulasiRentang(new Map([
      ['2026-08-26', [b('BBCA'), b('GOTO')]],
      ['2026-08-27', [b('BBCA')]],
    ]))
    const goto = r.baris.find((x) => x.kode === 'GOTO')!
    expect(goto.nHari).toBe(1)
    expect(r.baris.find((x) => x.kode === 'BBCA')!.nHari).toBe(2)
  })

  it('ruas kosong dihitung nol, bukan melempar', () => {
    const r = akumulasiRentang(new Map([
      ['2026-08-26', [b('X', { volume: null, nilai: null, nbsf_000: null, harga: null })]],
    ]))
    expect(r.baris[0]).toMatchObject({ volume: 0, nilai: 0, nbsf_000: 0, harga_akhir: null })
  })

  it('rentang kosong tak melempar', () => {
    const r = akumulasiRentang(new Map())
    expect(r.baris).toEqual([])
    expect(catatanRentang(r)).toContain('Tak ada hari bursa')
  })

  it('catatan menyebut apa yang TIDAK dijumlahkan', () => {
    const r = akumulasiRentang(new Map([['2026-08-26', [b('BBCA')]]]))
    const c = catatanRentang(r)
    expect(c).toContain('1 hari bursa berdata')
    expect(c).toContain('tak bisa ditambahkan')
  })
})
