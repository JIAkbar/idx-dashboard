import { describe, it, expect } from 'vitest'
import { barisTape, tambahTape, langkahTape, vwapTaksiran, nilaiPerTransaksi, type TitikLive } from './tapeLive'

const t = (pada: number, volume: number | null, value: number | null, frequency: number | null): TitikLive =>
  ({ pada, volume, value, frequency })

describe('barisTape', () => {
  it('dua tarikan berurutan jadi satu baris selisih', () => {
    // Jarak 10 detik = satu jendela, sesuai jeda tarikan sejak #156 A.
    const b = barisTape(t(0, 1_000_000, 5_000_000_000, 500), t(10_000, 1_012_400, 6_200_000_000, 587))
    expect(b).toEqual({ pada: 10_000, volume: 12_400, value: 1_200_000_000, frequency: 87, jendela: 1 })
  })

  it('satu tarikan gagal → baris berikutnya bertanda gabungan dua jendela', () => {
    // 20 detik = dua jendela 10 detik; angkanya TIDAK dibagi dua.
    const b = barisTape(t(0, 1_000_000, 5e9, 500), t(20_000, 1_030_000, 8e9, 700))
    expect(b?.jendela).toBe(2)
    expect(b?.volume).toBe(30_000)
    expect(b?.frequency).toBe(200)
  })

  it('akumulasi MUNDUR bukan transaksi negatif — barisnya dibuang', () => {
    // Terjadi saat hari berganti atau emiten diganti: angka mulai dari nol lagi.
    expect(barisTape(t(0, 5_000_000, 9e9, 900), t(45_000, 12_000, 2e7, 3))).toBeNull()
  })

  it('tak ada transaksi baru → tak ada baris', () => {
    expect(barisTape(t(0, 1_000, 2_000, 3), t(45_000, 1_000, 2_000, 3))).toBeNull()
  })

  it('ruas kosong → tak ada baris (bukan nol)', () => {
    expect(barisTape(t(0, null, 2_000, 3), t(45_000, 1_000, 2_000, 3))).toBeNull()
    expect(barisTape(t(0, 1_000, 2_000, 3), t(45_000, 1_100, undefined, 4))).toBeNull()
  })
})

describe('tambahTape', () => {
  it('tarikan pertama belum menghasilkan baris — belum ada pembandingnya', () => {
    expect(tambahTape([], null, t(0, 1_000, 2_000, 3))).toEqual([])
  })

  it('baris terbaru di depan, dan tarikan berstempel sama tak menggandakan', () => {
    const a = tambahTape([], t(0, 1_000, 2_000, 3), t(45_000, 1_100, 2_500, 5))
    expect(a).toHaveLength(1)
    const b = tambahTape(a, t(0, 1_000, 2_000, 3), t(45_000, 1_100, 2_500, 5))
    expect(b).toHaveLength(1)
    const c = tambahTape(b, t(45_000, 1_100, 2_500, 5), t(90_000, 1_150, 2_800, 6))
    expect(c).toHaveLength(2)
    expect(c[0].pada).toBe(90_000)
  })

  it('tape tak tumbuh melewati batas — ia hidup di memori halaman', () => {
    let tape = tambahTape([], null, t(0, 0, 0, 0))
    for (let i = 1; i <= 40; i++) {
      tape = tambahTape(tape, t((i - 1) * 45_000, i * 100, i * 1_000, i), t(i * 45_000, (i + 1) * 100, (i + 1) * 1_000, i + 1), 30)
    }
    expect(tape).toHaveLength(30)
  })
})

describe('langkahTape — urutan pemasangan di komponen', () => {
  // Uji ini menjaga URUTANNYA, bukan hitungannya: `tambahTape` sudah benar dan
  // ujinya hijau sepanjang bug produksi 9 Sep 2026 hidup. Yang salah dulu
  // membaca ref DI DALAM updater, yang React jalankan sesudah ref tertimpa.
  it('dua nilai live berurutan → tape satu baris', () => {
    const ref: { current: TitikLive | null } = { current: null }
    let tape = langkahTape(ref, t(0, 1_000_000, 5e9, 500))([])
    expect(tape).toEqual([])                       // tarikan pertama: belum ada pembanding
    tape = langkahTape(ref, t(45_000, 1_012_400, 6.2e9, 587))(tape)
    expect(tape).toHaveLength(1)
    expect(tape[0]).toMatchObject({ volume: 12_400, frequency: 87 })
  })

  it('updater yang dijalankan BELAKANGAN memberi hasil sama — ini bug yang dulu lolos', () => {
    // Dijalankan persis seperti React: updater disimpan, ref sudah bergerak ke
    // titik ketiga, baru updater-nya dipanggil. Versi lama menghasilkan [] di sini.
    const ref: { current: TitikLive | null } = { current: null }
    langkahTape(ref, t(0, 1_000_000, 5e9, 500))([])
    const tertunda = langkahTape(ref, t(45_000, 1_012_400, 6.2e9, 587))
    langkahTape(ref, t(90_000, 1_020_000, 7e9, 640))   // ref bergeser lebih dulu
    const tape = tertunda([])
    expect(tape).toHaveLength(1)
    expect(tape[0].volume).toBe(12_400)
  })
})

describe('turunan hari berjalan', () => {
  it('VWAP taksiran = nilai ÷ lembar; nol lembar → null, bukan pembagian nol', () => {
    expect(vwapTaksiran(6_600_000_000, 1_000_000)).toBe(6_600)
    expect(vwapTaksiran(6_600_000_000, 0)).toBeNull()
    expect(vwapTaksiran(null, 1_000)).toBeNull()
  })

  it('rata-rata nilai per transaksi = nilai ÷ frekuensi', () => {
    expect(nilaiPerTransaksi(1_000_000_000, 500)).toBe(2_000_000)
    expect(nilaiPerTransaksi(1_000_000_000, 0)).toBeNull()
  })
})
