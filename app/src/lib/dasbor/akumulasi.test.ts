import { describe, expect, it } from 'vitest'
import type { BarisOhlc } from './ihsgOhlc'
import type { AsingHarian } from './stockDetailData'
import { AMBANG_AD, JENDELA, garisAd, ringkasAd, ringkasAsing } from './akumulasi'

function bar(tutup: number, tinggi: number, rendah: number, volume = 1000, i = 0): BarisOhlc {
  return [`2026-01-${String((i % 28) + 1).padStart(2, '0')}`, tutup, tinggi, rendah, tutup, volume]
}
/** Deret n lilin; `posisi` 1 = tutup di puncak rentang, 0 = di dasar. */
function deret(n: number, posisi: number, hargaAwal = 100, langkah = 0): BarisOhlc[] {
  return Array.from({ length: n }, (_, i) => {
    const dasar = hargaAwal + langkah * i
    return bar(dasar + posisi * 10, dasar + 10, dasar, 1000, i)
  })
}

function asing(net: number[], volume = 1000): AsingHarian[] {
  return net.map((x, i) => ({
    tanggal: `2026-01-${String(i + 1).padStart(2, '0')}`,
    beli: x > 0 ? x : 0, jual: x < 0 ? -x : 0, volume, value: 0, frekuensi: 0,
  }))
}

describe('ringkasAsing', () => {
  it('deret kosong = null, bukan nol (nol berarti "seimbang", bukan "tak diketahui")', () => {
    expect(ringkasAsing([])).toBeNull()
  })

  it('net = beli - jual, dijumlahkan sepanjang jendela', () => {
    const r = ringkasAsing(asing([100, -30, 50]))!
    expect(r.netLembar).toBe(120)
    expect(r.hari).toBe(3)
  })

  it('hanya jendela terakhir yang dihitung', () => {
    const r = ringkasAsing(asing([9999, ...new Array(JENDELA).fill(10)]))!
    expect(r.hari).toBe(JENDELA)
    expect(r.netLembar).toBe(10 * JENDELA)
  })

  it('porsi terhadap volume: net 100 dari volume 1000/hari selama 2 hari = 5%', () => {
    const r = ringkasAsing(asing([50, 50]))!
    expect(r.porsiPersen).toBeCloseTo(5, 6)
  })

  it('volume nol tak membagi nol', () => {
    expect(ringkasAsing(asing([10], 0))!.porsiPersen).toBeNull()
  })
})

describe('garisAd', () => {
  it('tutup di puncak rentang menambah penuh volumenya', () => {
    expect(garisAd([bar(110, 110, 100, 500)])).toEqual([500])
  })

  it('tutup di dasar rentang mengurangi penuh volumenya', () => {
    expect(garisAd([bar(100, 110, 100, 500)])).toEqual([-500])
  })

  it('tutup tepat di tengah menyumbang nol', () => {
    expect(garisAd([bar(105, 110, 100, 500)])[0]).toBeCloseTo(0, 9)
  })

  it('tinggi = rendah menyumbang NOL, bukan NaN — hari tanpa rentang tak mengandung informasi', () => {
    const g = garisAd([bar(100, 100, 100, 500)])
    expect(g[0]).toBe(0)
    expect(Number.isNaN(g[0])).toBe(false)
  })

  it('kumulatif, bukan per lilin', () => {
    expect(garisAd([bar(110, 110, 100, 500), bar(110, 110, 100, 500)])).toEqual([500, 1000])
  })
})

describe('ringkasAd', () => {
  it('deret lebih pendek dari jendela = null', () => {
    expect(ringkasAd(deret(JENDELA, 1))).toBeNull()
  })

  it('harga naik + tutup selalu di puncak = akumulasi', () => {
    const r = ringkasAd(deret(JENDELA + 1, 1, 100, 2))!
    expect(r.vonis).toBe('akumulasi')
    expect(r.hargaPersen).toBeGreaterThan(0)
  })

  it('harga turun + tutup selalu di dasar = distribusi', () => {
    const r = ringkasAd(deret(JENDELA + 1, 0, 200, -2))!
    expect(r.vonis).toBe('distribusi')
  })

  it('harga TURUN tapi tutup selalu di puncak = akumulasi diam-diam', () => {
    const r = ringkasAd(deret(JENDELA + 1, 1, 200, -2))!
    expect(r.vonis).toBe('akumulasi-diam')
    expect(r.hargaPersen).toBeLessThan(0)
    expect(r.kekuatan).toBeGreaterThan(AMBANG_AD)
  })

  it('harga NAIK tapi tutup selalu di dasar = distribusi diam-diam', () => {
    const r = ringkasAd(deret(JENDELA + 1, 0, 100, 2))!
    expect(r.vonis).toBe('distribusi-diam')
  })

  it('tutup selalu di tengah dan harga rata = datar', () => {
    expect(ringkasAd(deret(JENDELA + 1, 0.5, 100, 0))!.vonis).toBe('datar')
  })

  it('volume nol sepanjang jendela = null, bukan pembagian nol', () => {
    const b = Array.from({ length: JENDELA + 1 }, (_, i) => bar(105, 110, 100, 0, i))
    expect(ringkasAd(b)).toBeNull()
  })

  it('harga awal nol tak membuat persen tak berhingga', () => {
    const b = Array.from({ length: JENDELA + 1 }, (_, i) => bar(i === 0 ? 0 : 100, 110, 0, 1000, i))
    expect(ringkasAd(b)).toBeNull()
  })
})
