import { describe, expect, it } from 'vitest'
import { captionRentang, HARI_BURSA, opsiRentang, potongRentang } from './rentang'

const hari = (n: number, mulai = 2020): { tanggal: string }[] => {
  const keluar: { tanggal: string }[] = []
  const d = new Date(Date.UTC(mulai, 0, 1))
  while (keluar.length < n) {
    const day = d.getUTCDay()
    if (day !== 0 && day !== 6) keluar.push({ tanggal: d.toISOString().slice(0, 10) })
    d.setUTCDate(d.getUTCDate() + 1)
  }
  return keluar
}

describe('opsiRentang', () => {
  it('preset panjang HILANG saat data pendek (bawaan)', () => {
    const ids = opsiRentang(300).map((o) => o.id)
    expect(ids).toContain('y1')
    expect(ids).toContain('ytd')
    expect(ids).toContain('semua')
    expect(ids).not.toContain('y3')
    expect(ids).not.toContain('y10')
  })
  it('data 11 tahun membuka sampai y10', () => {
    const ids = opsiRentang(11 * 252).map((o) => o.id)
    expect(ids).toContain('y10')
  })
  it('tampilkanNonaktif memberi alasan, bukan menghilangkan', () => {
    const y5 = opsiRentang(300, ['y5'], true).find((o) => o.id === 'y5')
    expect(y5?.nonaktif).toBe(true)
    expect(y5?.alasan).toMatch(/tahun/)
  })
  it('subset halaman dihormati, urutan tetap baku', () => {
    const ids = opsiRentang(5000, ['semua', 'b3', 'w1']).map((o) => o.id)
    expect(ids).toEqual(['w1', 'b3', 'semua'])
  })
})

describe('potongRentang', () => {
  it('b3 = 63 hari bursa terakhir', () => {
    expect(potongRentang(hari(300), 'b3')).toHaveLength(HARI_BURSA.b3)
  })
  it('ytd dari 1 Jan tahun baris TERAKHIR, bukan tahun berjalan', () => {
    const rows = hari(300, 2024) // menyeberang ke 2025
    const potong = potongRentang(rows, 'ytd')
    const thAkhir = rows[rows.length - 1].tanggal.slice(0, 4)
    expect(potong.every((r) => r.tanggal.startsWith(thAkhir))).toBe(true)
    expect(potong.length).toBeGreaterThan(0)
    expect(potong.length).toBeLessThan(rows.length)
  })
  it('semua & data pendek: apa adanya, tanpa melempar', () => {
    expect(potongRentang(hari(10), 'semua')).toHaveLength(10)
    expect(potongRentang(hari(10), 'y1')).toHaveLength(10)
    expect(potongRentang([], 'b1')).toHaveLength(0)
  })
})

describe('captionRentang', () => {
  it('tanggal nyata + jumlah hari bursa', () => {
    const rows = hari(60)
    const c = captionRentang(rows)
    expect(c).toContain(rows[0].tanggal)
    expect(c).toContain(rows[59].tanggal)
    expect(c).toContain('60 hari bursa')
  })
  it('kosong dikatakan, bukan dikosongkan', () => {
    expect(captionRentang([])).toMatch(/tak ada data/)
  })
})
