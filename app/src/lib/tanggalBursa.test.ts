import { afterEach, describe, expect, it } from 'vitest'
import { hariBursa, lupakanDaftarHariBursa, pasangDaftarHariBursa, tanggalBursaTerakhir } from './tanggalBursa'

// Daftar hari bursa itu keadaan tingkat-modul. Tanpa pembersihan ini, uji yang
// memasangnya akan diam-diam mengubah jawaban uji berikutnya.
afterEach(lupakanDaftarHariBursa)

// Jam 10 pagi waktu lokal — jauh dari tengah malam, supaya tesnya tidak
// bergantung pada zona waktu mesin yang menjalankannya.
const jam10 = (iso: string) => new Date(`${iso}T10:00:00`)

describe('tanggalBursaTerakhir', () => {
  it('hari kerja dikembalikan apa adanya', () => {
    expect(tanggalBursaTerakhir(jam10('2026-08-14'))).toBe('2026-08-14') // Jumat
    expect(tanggalBursaTerakhir(jam10('2026-08-18'))).toBe('2026-08-18') // Selasa
    expect(tanggalBursaTerakhir(jam10('2026-08-12'))).toBe('2026-08-12') // Rabu
  })

  it('LIBUR NASIONAL mundur ke hari bursa sebelumnya', () => {
    // Senin 17 Agu 2026 (HUT Kemerdekaan) → mundur melewati akhir pekan ke
    // Jumat 14 Agu. Inilah kasus yang memicu perbaikan ini: dua kontributor
    // menyetor untuk 17 Agu karena form terisi tanggal itu sejak awal.
    expect(tanggalBursaTerakhir(jam10('2026-08-17'))).toBe('2026-08-14')
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

describe('hariBursa', () => {
  it('Senin–Jumat hari bursa', () => {
    expect(hariBursa('2026-08-18')).toBe(true) // Selasa
    expect(hariBursa('2026-08-14')).toBe(true) // Jumat
  })

  it('Sabtu & Minggu bukan hari bursa', () => {
    expect(hariBursa('2026-08-15')).toBe(false)
    expect(hariBursa('2026-08-16')).toBe(false)
  })

  it('17 AGUSTUS 2026 bukan hari bursa walau hari Senin', () => {
    // Kasus yang memicu tugas ini: bursa libur HUT Kemerdekaan, dua kontributor
    // tetap menyetor karena tak ada satu pun bagian aplikasi yang tahu.
    expect(hariBursa('2026-08-17')).toBe(false)
  })

  it('tanggal tak berbentuk ISO ditolak, bukan dianggap hari bursa', () => {
    expect(hariBursa('')).toBe(false)
    expect(hariBursa('bukan-tanggal')).toBe(false)
  })

  it('tanpa daftar termuat, hari kerja tetap dianggap hari bursa', () => {
    // Halaman tak boleh berhenti cuma karena ihsg_harian.json belum datang:
    // aturan akhir pekan + tanggal merah harus tetap menjawab sendiri.
    expect(hariBursa('2026-07-08')).toBe(true) // Rabu, tak ada di daftar mana pun
  })

  it('daftar termuat: hari kerja yang TIDAK tercatat bukan hari bursa', () => {
    // Rabu 8 Jul sengaja dilubangi — begitulah libur dadakan/cuti bersama
    // terlihat di data: hari kerja tanpa penutupan.
    pasangDaftarHariBursa(['2026-07-07', '2026-07-09'], '2026-07-09')
    expect(hariBursa('2026-07-08')).toBe(false)
    expect(hariBursa('2026-07-07')).toBe(true)
  })

  it('daftar termuat: tanggal DI LUAR cakupan tetap ikut aturan akhir pekan', () => {
    // Daftarnya berhenti di hari bursa terakhir yang tercatat. Hari ini belum
    // ada di sana karena sesinya belum ditutup — menuduhnya "bukan hari bursa"
    // akan memblokir setoran yang justru paling wajar.
    pasangDaftarHariBursa(['2026-07-07', '2026-07-09'], '2026-07-09')
    expect(hariBursa('2026-07-10')).toBe(true)  // Jumat, sesudah cakupan
    expect(hariBursa('2026-07-11')).toBe(false) // Sabtu tetap bukan hari bursa
  })
})
