import { describe, expect, it } from 'vitest'
import type { LilinData } from './grafikEmiten'
import { LEBAR_PRZ_MAKS, arahStruktur, cariPatahan, cariSwing, hitungPrz } from './strukturPasar'

/** Lilin dari deret tinggi/rendah eksplisit — bentuk paling jujur untuk
 *  menguji deteksi swing, karena swing memang dibaca dari high/low. */
function lilinDari(hi: number[], lo: number[]): LilinData[] {
  return hi.map((h, i) => ({
    time: `2026-01-${String(i + 1).padStart(2, '0')}`,
    open: (h + lo[i]) / 2, high: h, low: lo[i], close: (h + lo[i]) / 2,
  }))
}
const datar = (n: number, h: number, l: number) => lilinDari(new Array(n).fill(h), new Array(n).fill(l))

describe('cariSwing', () => {
  it('deret lebih pendek dari 2N+1 = kosong, bukan swing paksaan', () => {
    expect(cariSwing(datar(5, 10, 5), 5)).toEqual([])
  })

  it('N tidak sah = kosong', () => {
    expect(cariSwing(datar(50, 10, 5), 0)).toEqual([])
  })

  it('satu puncak jelas dikenali sebagai swing high', () => {
    const hi = [10, 11, 12, 20, 12, 11, 10]
    const lo = hi.map((h) => h - 3)
    const s = cariSwing(lilinDari(hi, lo), 3)
    expect(s.filter((x) => x.jenis === 'high')).toHaveLength(1)
    expect(s.find((x) => x.jenis === 'high')!.harga).toBe(20)
  })

  it('N lilin TERAKHIR tak pernah dilabeli — swing butuh konfirmasi kanan', () => {
    // Puncak tertinggi ditaruh di lilin paling akhir. Kalau ia terdeteksi,
    // berarti ada kebocoran masa depan: di hari itu belum ada N lilin kanan.
    const hi = [10, 11, 12, 13, 14, 15, 30]
    const s = cariSwing(lilinDari(hi, hi.map((h) => h - 3)), 2)
    expect(s.some((x) => x.i === hi.length - 1)).toBe(false)
  })

  it('deret DATAR tidak menandai setiap lilin, dan tidak membuang semuanya', () => {
    // Ini kasus nyata di emiten tipis IDX. Perbandingan simetris akan salah
    // ke salah satu arah; yang benar menandai tepat satu lilin per datar.
    const s = cariSwing(datar(41, 10, 5), 5)
    expect(s.length).toBeLessThan(41)
  })

  it('label HH/LH/HL/LL diberikan relatif terhadap swing SEJENIS sebelumnya', () => {
    const hi = [10, 12, 20, 12, 10, 12, 25, 12, 10, 12, 18, 12, 10]
    const lo = hi.map((h) => h - 5)
    const s = cariSwing(lilinDari(hi, lo), 2)
    const high = s.filter((x) => x.jenis === 'high')
    expect(high[0].label).toBeNull()
    expect(high[1].label).toBe('HH')
    expect(high[2].label).toBe('LH')
  })

  it('swing pertama tiap jenis berlabel null — tak ada pembandingnya', () => {
    const s = cariSwing(lilinDari([10, 12, 20, 12, 10], [5, 7, 15, 7, 5]), 2)
    expect(s.every((x) => x.label === null)).toBe(true)
  })
})

describe('arahStruktur', () => {
  it('HH + HL = naik', () => {
    expect(arahStruktur([
      { i: 1, waktu: 'a', harga: 20, jenis: 'high', label: 'HH' },
      { i: 2, waktu: 'b', harga: 10, jenis: 'low', label: 'HL' },
    ])).toBe('naik')
  })

  it('LH + LL = turun', () => {
    expect(arahStruktur([
      { i: 1, waktu: 'a', harga: 20, jenis: 'high', label: 'LH' },
      { i: 2, waktu: 'b', harga: 10, jenis: 'low', label: 'LL' },
    ])).toBe('turun')
  })

  it('HH + LL (rentang melebar) = sisi, BUKAN memilih salah satu', () => {
    expect(arahStruktur([
      { i: 1, waktu: 'a', harga: 20, jenis: 'high', label: 'HH' },
      { i: 2, waktu: 'b', harga: 10, jenis: 'low', label: 'LL' },
    ])).toBe('sisi')
  })

  it('tanpa swing = sisi', () => {
    expect(arahStruktur([])).toBe('sisi')
  })
})

describe('cariPatahan', () => {
  it('sumbu yang menembus tapi ditutup kembali BUKAN patahan', () => {
    // high menembus swing high, tapi close tetap di bawahnya.
    const hi = [10, 12, 20, 12, 10, 12, 25]
    const lo = hi.map((h) => h - 5)
    const lilin = lilinDari(hi, lo).map((l, i) =>
      (i === 6 ? { ...l, close: 15 } : l))
    const s = cariSwing(lilin, 2)
    const p = cariPatahan(lilin, s)
    expect(p.every((x) => x.arah !== 'naik' || x.i !== 6)).toBe(true)
  })

  it('penutupan di atas swing high tercatat sebagai patahan naik', () => {
    const hi = [10, 12, 20, 12, 10, 11, 12, 13, 30, 30]
    const lo = hi.map((h) => h - 5)
    const lilin = lilinDari(hi, lo).map((l, i) => (i >= 8 ? { ...l, close: 28 } : l))
    const p = cariPatahan(lilin, cariSwing(lilin, 2))
    expect(p.some((x) => x.arah === 'naik')).toBe(true)
  })

  it('deret datar tak menghasilkan patahan apa pun', () => {
    const lilin = datar(60, 10, 5)
    expect(cariPatahan(lilin, cariSwing(lilin, 5))).toEqual([])
  })
})

describe('hitungPrz', () => {
  it('mengumpulkan minimal tiga proyeksi dan melaporkan lebar zonanya', () => {
    // Gartley bullish sederhana: X 100 -> A 200 -> B 138 -> C 180
    const z = hitungPrz(100, 200, 138, 180, 0.786)!
    expect(z.proyeksi.length).toBeGreaterThanOrEqual(3)
    expect(z.bawah).toBeLessThan(z.atas)
    expect(z.tengah).toBeCloseTo((z.bawah + z.atas) / 2, 9)
    expect(z.lebarPersen).toBeGreaterThan(0)
  })

  it('kaki XA nol = null, bukan pembagian yang menghasilkan zona palsu', () => {
    expect(hitungPrz(100, 100, 90, 95, 0.786)).toBeNull()
  })

  it('masukan tak berhingga ditolak', () => {
    expect(hitungPrz(NaN, 200, 138, 180, 0.786)).toBeNull()
    expect(hitungPrz(100, Infinity, 138, 180, 0.786)).toBeNull()
  })

  it('zona yang lebih rapat memberi lebarPersen lebih kecil — itu yang membedakan PRZ dari tiga angka berdekatan', () => {
    const rapat = hitungPrz(100, 200, 138, 180, 0.786)!
    const agakLonggar = hitungPrz(100, 200, 130, 182, 0.786)!
    expect(rapat.lebarPersen).toBeLessThan(agakLonggar.lebarPersen)
  })

  it(`zona selebar >${LEBAR_PRZ_MAKS}% ditolak — tiga angka yang tersebar sejauh itu bukan lagi "zona"`, () => {
    // XABC ini memberi proyeksi yang tersebar ~90% dari harganya sendiri.
    // Sebelum ambangnya ada, zona seperti ini tetap digambar dan praktis
    // MUSTAHIL meleset: apa pun yang terjadi berikutnya jatuh di dalamnya,
    // jadi angka keberhasilannya benar tapi tak berarti apa-apa.
    expect(hitungPrz(100, 200, 105, 195, 0.786)).toBeNull()
  })
})
