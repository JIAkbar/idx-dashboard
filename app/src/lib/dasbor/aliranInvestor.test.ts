import { describe, expect, it } from 'vitest'
import {
  irisPeriode, ringkasAliran, type BarisAliran,
} from './aliranInvestor'

/** Satu baris ringkas — ruasnya urut seperti berkas aslinya. */
const bar = (
  tanggal: string, rgVol: number, fBeli: number, fJual: number,
  { rgVal = rgVol * 100, rgFrek = 1000, nrVol = 0, fBeliRp = fBeli * 100, fJualRp = fJual * 100,
    nfResmi = null as number | null } = {},
): BarisAliran =>
  [tanggal, 900, rgVol, rgVal, rgFrek, nrVol, 0, 0, fBeli, fJual, fBeliRp, fJualRp, nfResmi]

describe('ringkasAliran', () => {
  it('domestik = sisa pasar reguler, dan tiap sisi menjumlah 50%', () => {
    const r = ringkasAliran([bar('2026-08-20', 1000, 300, 200)])!
    expect(r.volume.dBeli.nilai).toBe(700)
    expect(r.volume.dJual.nilai).toBe(800)
    // Penyebutnya 2x total — konvensi panel RTI: tiap transaksi punya
    // pembeli DAN penjual.
    expect(r.volume.fBeli.persen + r.volume.dBeli.persen).toBeCloseTo(50, 6)
    expect(r.volume.fJual.persen + r.volume.dJual.persen).toBeCloseTo(50, 6)
    const semua = r.volume.fBeli.persen + r.volume.fJual.persen
      + r.volume.dBeli.persen + r.volume.dJual.persen
    expect(semua).toBeCloseTo(100, 6)
  })

  it('net asing = beli − jual, dan tandanya ikut arahnya', () => {
    expect(ringkasAliran([bar('2026-08-20', 1000, 300, 200)])!.volume.net).toBe(100)
    expect(ringkasAliran([bar('2026-08-20', 1000, 150, 400)])!.volume.net).toBe(-250)
  })

  it('menjumlah lintas hari, bukan merata-ratakan', () => {
    const r = ringkasAliran([
      bar('2026-08-19', 1000, 300, 200),
      bar('2026-08-20', 500, 100, 50),
    ])!
    expect(r.volume.total).toBe(1500)
    expect(r.volume.fBeli.nilai).toBe(400)
    expect(r.hari).toBe(2)
    expect(r.mulai).toBe('2026-08-19')
    expect(r.akhir).toBe('2026-08-20')
  })

  it('porsi non-reguler dihitung terhadap SELURUH papan, bukan pasar reguler', () => {
    // Kasus GOTO 20 Agu 2026: non-reguler jauh melampaui regulernya sendiri.
    const r = ringkasAliran([bar('2026-08-20', 35, 6, 5, { nrVol: 42 })])!
    expect(r.nonRegulerPersen).toBeCloseTo((42 / 77) * 100, 6)
    // Belahan asing TETAP berbasis pasar reguler — non-reguler tak punya
    // keterangan siapa pembelinya, dan menebaknya berarti mengarang.
    expect(r.volume.total).toBe(35)
  })

  it('deret kosong & volume nol = null, bukan angka yang menyesatkan', () => {
    expect(ringkasAliran([])).toBeNull()
    expect(ringkasAliran([bar('2026-08-20', 0, 0, 0)])).toBeNull()
  })

  it('asing tak pernah melebihi pasarnya — domestik dijepit di nol, bukan negatif', () => {
    const r = ringkasAliran([bar('2026-08-20', 100, 150, 0)])!
    expect(r.volume.dBeli.nilai).toBe(0)
  })
})

describe('net resmi vs taksiran', () => {
  it('netResmi dijumlah dari angka RESMI, dan naik satuan dari miliar ke rupiah', () => {
    const r = ringkasAliran([
      bar('2026-08-19', 1000, 300, 200, { nfResmi: 500 }),
      bar('2026-08-20', 1000, 300, 200, { nfResmi: -200 }),
    ])!
    expect(r.netResmi).toBeCloseTo(300e9, 0)
    expect(r.hariTanpaResmi).toBe(0)
  })

  it('SATU hari tanpa angka resmi membuat netResmi null — bukan jumlah separuh', () => {
    // Jumlah setengah-resmi lebih menyesatkan daripada tak ada: pembaca tak
    // punya cara tahu bahwa sebagian periodenya diam-diam hilang.
    const r = ringkasAliran([
      bar('2026-08-19', 1000, 300, 200, { nfResmi: 500 }),
      bar('2026-08-20', 1000, 300, 200),
    ])!
    expect(r.netResmi).toBeNull()
    expect(r.hariTanpaResmi).toBe(1)
  })

  it('taksiran tetap dihitung walau angka resmi tak ada — belahannya tak tergantikan', () => {
    const r = ringkasAliran([bar('2021-05-04', 1000, 300, 200)])!
    expect(r.netResmi).toBeNull()
    expect(r.nilai.fBeli.nilai).toBe(30000)
    expect(r.nilai.net).toBe(10000)
  })
})

describe('irisPeriode', () => {
  const deret: BarisAliran[] = []
  for (let i = 0; i < 400; i++) {
    const d = new Date(Date.UTC(2025, 6, 1))
    d.setUTCDate(d.getUTCDate() + i)
    deret.push(bar(d.toISOString().slice(0, 10), 1000, 300, 200))
  }
  const akhir = deret[deret.length - 1][0]

  it('1D & 5D dihitung dalam hari BURSA', () => {
    expect(irisPeriode(deret, 'h1')).toHaveLength(1)
    expect(irisPeriode(deret, 'h5')).toHaveLength(5)
    expect(irisPeriode(deret, 'h1')[0][0]).toBe(akhir)
  })

  it('periode bulanan dihitung dalam bulan KALENDER', () => {
    const t = new Date(`${akhir}T00:00:00Z`)
    t.setUTCMonth(t.getUTCMonth() - 3)
    const batas = t.toISOString().slice(0, 10)
    const iris = irisPeriode(deret, 'b3')
    expect(iris[0][0] >= batas).toBe(true)
    // Baris tepat sebelum batas TIDAK ikut.
    const sebelum = deret[deret.indexOf(iris[0]) - 1]
    expect(sebelum[0] < batas).toBe(true)
  })

  it('YTD berjangkar ke 1 Januari tahun baris terakhir', () => {
    const iris = irisPeriode(deret, 'ytd')
    expect(iris.every((r) => r[0].slice(0, 4) === akhir.slice(0, 4))).toBe(true)
  })

  it('periode yang melampaui panjang deret memakai apa yang ada', () => {
    expect(irisPeriode(deret, 'y5')).toHaveLength(deret.length)
  })

  it('deret kosong tak melempar', () => {
    expect(irisPeriode([], 'y1')).toEqual([])
  })
})
