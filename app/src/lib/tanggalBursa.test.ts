import { describe, expect, it } from 'vitest'
import { tanggalBursaTerakhir } from './tanggalBursa'

// Jam 10 pagi waktu lokal — jauh dari tengah malam, supaya tesnya tidak
// bergantung pada zona waktu mesin yang menjalankannya.
const jam10 = (iso: string) => new Date(`${iso}T10:00:00`)

describe('tanggalBursaTerakhir', () => {
  it('hari kerja dikembalikan apa adanya', () => {
    expect(tanggalBursaTerakhir(jam10('2026-08-14'))).toBe('2026-08-14') // Jumat
    expect(tanggalBursaTerakhir(jam10('2026-08-17'))).toBe('2026-08-17') // Senin
    expect(tanggalBursaTerakhir(jam10('2026-08-12'))).toBe('2026-08-12') // Rabu
  })

  it('SABTU mundur ke Jumat', () => {
    // Kasus yang benar-benar terjadi: tiga setoran tercatat di Sabtu 15 Agu
    // 2026 padahal isinya penutupan Jumat 14 Agu.
    expect(tanggalBursaTerakhir(jam10('2026-08-15'))).toBe('2026-08-14')
  })

  it('MINGGU mundur dua hari ke Jumat', () => {
    expect(tanggalBursaTerakhir(jam10('2026-08-16'))).toBe('2026-08-14')
  })

  it('akhir pekan yang menyeberangi pergantian bulan tetap benar', () => {
    // 1 Agustus 2026 Sabtu → mundur ke Jumat 31 Juli, bukan "0 Agustus".
    expect(tanggalBursaTerakhir(jam10('2026-08-01'))).toBe('2026-07-31')
    // 2 Agustus Minggu → 31 Juli juga.
    expect(tanggalBursaTerakhir(jam10('2026-08-02'))).toBe('2026-07-31')
  })

  it('akhir pekan yang menyeberangi pergantian tahun tetap benar', () => {
    // 3 Januari 2027 Minggu → Jumat 1 Januari 2027.
    expect(tanggalBursaTerakhir(jam10('2027-01-03'))).toBe('2027-01-01')
  })

  it('tidak mengubah Date yang dioper pemanggil', () => {
    const asli = jam10('2026-08-15')
    const salinan = new Date(asli)
    tanggalBursaTerakhir(asli)
    expect(asli.getTime()).toBe(salinan.getTime())
  })
})
