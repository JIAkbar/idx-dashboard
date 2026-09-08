import { describe, expect, it } from 'vitest'
import type { LilinData } from './grafikEmiten'
import {
  LEBAR_PRZ_MAKS, arahStruktur, cariFvg, cariOrderBlock, cariPatahan, cariSwing, hitungPrz,
  type Patahan,
} from './strukturPasar'

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

/* ── FVG & order block (#53) ─────────────────────────────────────────────── */

/** Lilin dengan badan eksplisit — arah badan yang menentukan order block. */
function lilin(o: number, h: number, l: number, c: number, hari: number): LilinData {
  return { time: `2026-02-${String(hari).padStart(2, '0')}`, open: o, high: h, low: l, close: c }
}

describe('cariFvg', () => {
  it('celah naik: rendah lilin ke-3 di atas tinggi lilin ke-1', () => {
    const d = [lilin(100, 101, 99, 100, 1), lilin(101, 112, 100, 111, 2), lilin(111, 115, 110, 114, 3)]
    expect(cariFvg(d)).toEqual([{
      i: 1, waktu: '2026-02-02', arah: 'naik', atas: 110, bawah: 101, ditutupPada: null,
    }])
  })

  it('celah turun terbaca dengan batas yang benar, bukan terbalik', () => {
    const d = [lilin(100, 101, 99, 100, 1), lilin(99, 100, 88, 89, 2), lilin(89, 90, 85, 86, 3)]
    const [z] = cariFvg(d)
    expect(z.arah).toBe('turun')
    expect([z.bawah, z.atas]).toEqual([90, 99])
  })

  it('tiga lilin yang saling tumpang tindih = tak ada celah', () => {
    const d = [lilin(100, 105, 95, 104, 1), lilin(104, 110, 100, 109, 2), lilin(109, 112, 103, 111, 3)]
    expect(cariFvg(d)).toEqual([])
  })

  it('celah setipis satu tick dibuang — kalau tidak, papan tipis penuh pita', () => {
    // 0,04% dari harga tengah: nyata, tapi di bawah ambang bawaan 0,1%.
    const d = [lilin(100, 100, 99, 100, 1), lilin(100, 105, 100, 104, 2), lilin(104, 106, 100.04, 105, 3)]
    expect(cariFvg(d)).toEqual([])
    expect(cariFvg(d, 0.0001)).toHaveLength(1)
  })

  it('zona yang harganya kembali masuk ditandai waktunya, bukan dihapus', () => {
    const d = [
      lilin(100, 101, 99, 100, 1), lilin(101, 112, 100, 111, 2), lilin(111, 115, 110, 114, 3),
      lilin(114, 116, 113, 115, 4), lilin(115, 116, 105, 106, 5),
    ]
    expect(cariFvg(d)[0].ditutupPada).toBe('2026-02-05')
  })
})

describe('cariOrderBlock', () => {
  const patahan = (i: number, arah: 'naik' | 'turun'): Patahan =>
    ({ i, waktu: `2026-02-${String(i + 1).padStart(2, '0')}`, harga: 0, jenis: 'BOS', arah })

  it('blok naik = lilin MERAH terakhir sebelum tembusan ke atas', () => {
    const d = [
      lilin(100, 101, 99, 100.5, 1),   // hijau
      lilin(100, 101, 97, 98, 2),      // merah — inilah bloknya
      lilin(98, 110, 98, 109, 3),      // tembusan
    ]
    expect(cariOrderBlock(d, [patahan(2, 'naik')])).toEqual([{
      i: 1, waktu: '2026-02-02', arah: 'naik', atas: 101, bawah: 97, ditutupPada: null,
    }])
  })

  it('blok turun = lilin HIJAU terakhir sebelum tembusan ke bawah', () => {
    const d = [lilin(100, 101, 99, 99, 1), lilin(99, 106, 99, 105, 2), lilin(105, 105, 90, 91, 3)]
    const [z] = cariOrderBlock(d, [patahan(2, 'turun')])
    expect([z.i, z.arah, z.atas, z.bawah]).toEqual([1, 'turun', 106, 99])
  })

  it('tak ada lilin berlawanan dalam jangkauan = tak ada blok karangan', () => {
    const naikTerus = Array.from({ length: 6 }, (_, i) => lilin(100 + i, 102 + i, 99 + i, 101 + i, i + 1))
    expect(cariOrderBlock(naikTerus, [patahan(5, 'naik')], 4)).toEqual([])
  })

  it('batas mundur dipatuhi — blok tak boleh diambil dari berbulan lalu', () => {
    const d = [
      lilin(100, 101, 97, 98, 1),                                            // merah, jauh di belakang
      ...Array.from({ length: 5 }, (_, i) => lilin(100 + i, 102 + i, 99 + i, 101 + i, i + 2)),
    ]
    expect(cariOrderBlock(d, [patahan(5, 'naik')], 3)).toEqual([])
    expect(cariOrderBlock(d, [patahan(5, 'naik')], 5)).toHaveLength(1)
  })

  it('satu lilin tidak dipakai dua kali oleh dua patahan berurutan', () => {
    const d = [
      lilin(100, 101, 99, 100.5, 1), lilin(100, 101, 97, 98, 2),
      lilin(98, 110, 98, 109, 3), lilin(109, 118, 108, 117, 4),
    ]
    expect(cariOrderBlock(d, [patahan(2, 'naik'), patahan(3, 'naik')])).toHaveLength(1)
  })
})
