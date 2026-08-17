import { describe, expect, it } from 'vitest'
import { keDataLilinVolume, batasBawahRentang, potongRentang } from './grafikEmiten'
import type { BarisOhlc } from './ihsgOhlc'

const baris: BarisOhlc[] = [
  ['2024-01-02', 100, 110, 95, 105, 1000], // tutup >= buka -> naik
  ['2024-01-03', 105, 108, 90, 90, 2000], // tutup < buka -> turun
  ['2025-06-10', 90, 95, 88, 92, 3000],
]

describe('keDataLilinVolume', () => {
  it('memisah lilin & volume, warna volume ikut arah lilin hari itu', () => {
    const { lilin, volume } = keDataLilinVolume(baris, 'HIJAU', 'MERAH')
    expect(lilin).toEqual([
      { time: '2024-01-02', open: 100, high: 110, low: 95, close: 105 },
      { time: '2024-01-03', open: 105, high: 108, low: 90, close: 90 },
      { time: '2025-06-10', open: 90, high: 95, low: 88, close: 92 },
    ])
    expect(volume).toEqual([
      { time: '2024-01-02', value: 1000, color: 'HIJAU' },
      { time: '2024-01-03', value: 2000, color: 'MERAH' },
      { time: '2025-06-10', value: 3000, color: 'HIJAU' },
    ])
  })
})

describe('batasBawahRentang', () => {
  it('dihitung mundur dari akhir DATA, bukan dari hari ini', () => {
    expect(batasBawahRentang('2026-08-14', 1)).toBe('2025-08-14')
    expect(batasBawahRentang('2026-08-14', 5)).toBe('2021-08-14')
  })
  it('null (Semua) -> string kosong, tak ada batas', () => {
    expect(batasBawahRentang('2026-08-14', null)).toBe('')
  })
  it('akhirData kosong -> string kosong (belum ada data)', () => {
    expect(batasBawahRentang('', 1)).toBe('')
  })
})

describe('potongRentang', () => {
  const seri = [{ time: '2024-01-01' }, { time: '2024-06-01' }, { time: '2025-01-01' }]
  it('batas kosong -> seluruh data lolos', () => {
    expect(potongRentang(seri, '')).toEqual(seri)
  })
  it('memotong ke tanggal >= batas', () => {
    expect(potongRentang(seri, '2024-06-01')).toEqual([{ time: '2024-06-01' }, { time: '2025-01-01' }])
  })
  it('batas di atas seluruh data -> array kosong', () => {
    expect(potongRentang(seri, '2099-01-01')).toEqual([])
  })
})

describe('hari tanpa perdagangan', () => {
  const N = '#0f0'
  const T = '#f00'

  it('membuang baris volume 0 yang harganya tak bergerak', () => {
    const { lilin, volume } = keDataLilinVolume(
      [
        ['2026-05-13', 6100, 6150, 6050, 6125, 1_000],
        ['2026-05-14', 6125, 6125, 6125, 6125, 0],
        ['2026-05-15', 6125, 6200, 6100, 6180, 2_000],
      ],
      N,
      T,
    )
    expect(lilin.map((l) => l.time)).toEqual(['2026-05-13', '2026-05-15'])
    expect(volume.map((v) => v.time)).toEqual(['2026-05-13', '2026-05-15'])
  })

  it('MEMPERTAHANKAN hari datar yang volumenya besar — auto-reject tetap hari bursa', () => {
    const { lilin } = keDataLilinVolume([['2026-05-14', 6100, 6100, 6100, 6100, 9_000_000]], N, T)
    expect(lilin).toHaveLength(1)
  })

  it('MEMPERTAHANKAN hari bervolume nol yang harganya bergerak — yang salah ruas volumenya', () => {
    const { lilin } = keDataLilinVolume([['2026-05-14', 6100, 6200, 6050, 6150, 0]], N, T)
    expect(lilin).toHaveLength(1)
  })
})
