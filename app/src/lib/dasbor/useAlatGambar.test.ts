import { describe, expect, it } from 'vitest'
import { magnetBerikutnya, snapkanHarga, type KeadaanMagnet } from './useAlatGambar'

// Hanya fungsi MURNI dari hook ini yang diuji — orkestrasi chart/manager
// butuh lightweight-charts sungguhan (lihat komentar berkas). Mengimpor
// modulnya tetap aman: `lightweight-charts-drawing` cuma diimpor sebagai
// TYPE di sana (dihapus saat kompilasi), jadi tak ada 2,7 MB pustaka gambar
// yang ikut termuat cuma untuk menguji dua fungsi kecil ini.

describe('magnetBerikutnya — putaran klik mati -> lemah -> kuat -> mati', () => {
  it('mengikuti urutan penuh', () => {
    const urutan: KeadaanMagnet[] = ['0']
    for (let i = 0; i < 3; i++) urutan.push(magnetBerikutnya(urutan[urutan.length - 1]))
    expect(urutan).toEqual(['0', 'lemah', 'kuat', '0'])
  })
})

describe('snapkanHarga — magnet snap ke OHLC terdekat', () => {
  const p2y = (h: number) => 100 - h // makin tinggi harga, makin kecil y (sumbu terbalik seperti chart)

  it('magnet mati -> harga klik apa adanya, walau ada kandidat persis di bawah kursor', () => {
    expect(snapkanHarga(50.3, 49.7, [50], '0', p2y)).toBe(50.3)
  })

  it('tak ada kandidat -> harga klik apa adanya', () => {
    expect(snapkanHarga(50.3, 49.7, [], 'kuat', p2y)).toBe(50.3)
  })

  it('lemah: snap kalau jarak piksel <= 8, tidak kalau lebih jauh', () => {
    // kandidat 50 -> y=50; klik di y=45 (jarak 5px) snap; y=30 (jarak 20px) tidak.
    expect(snapkanHarga(45.4, 45, [50], 'lemah', p2y)).toBe(50)
    expect(snapkanHarga(30.4, 30, [50], 'lemah', p2y)).toBe(30.4)
  })

  it('kuat: ambang 24px lolos jarak yang ditolak "lemah"', () => {
    expect(snapkanHarga(30.4, 30, [50], 'lemah', p2y)).toBe(30.4) // di luar ambang lemah
    expect(snapkanHarga(30.4, 30, [50], 'kuat', p2y)).toBe(50) // di dalam ambang kuat (jarak 20px)
  })

  it('memilih kandidat TERDEKAT kalau lebih dari satu masuk ambang', () => {
    // y klik = 40 (harga 60); kandidat 58 (y=42, jarak 2) dan 65 (y=35, jarak 5)
    expect(snapkanHarga(60, 40, [58, 65], 'kuat', p2y)).toBe(58)
  })

  it('kandidat yang priceToCoordinate-nya null (di luar skala) dilewati, bukan membuat galat', () => {
    const p2ySebagian = (h: number) => (h === 999 ? null : 100 - h)
    expect(snapkanHarga(45.4, 45, [999, 50], 'kuat', p2ySebagian)).toBe(50)
  })
})
