import { describe, expect, it } from 'vitest'
import {
  ALASAN_MAKS, ALASAN_MIN, HORIZON_TESIS, periksaTesis, ringkasTesis, tanggalSinyalSekarang,
  type TesisBaru, type TesisRow,
} from './tesis'
import { pasangDaftarHariBursa } from './tanggalBursa'

/**
 * Uji ini menjaga tiga aturan yang kalau bocor tak menimbulkan satu pun galat,
 * cuma angka yang salah: arah `turun` sebagai cermin, hari sinyal yang tak
 * boleh jatuh di bar yang masih bergerak, dan penyebut akurasi yang tak boleh
 * memuat tesis yang belum selesai.
 */

const dasar: TesisBaru = {
  kode: 'BBCA', arah: 'naik', tanggal_sinyal: '2026-09-04',
  masuk_bawah: 100, masuk_atas: 105, target: 120, stop: 90,
  horizon_hari: 5, alasan: 'Akumulasi asing lima hari beruntun, tutup di atas EMA20.',
}

describe('periksa tesis sebelum dikirim', () => {
  it('tesis naik yang sehat lolos', () => {
    expect(periksaTesis(dasar)).toBeNull()
  })

  it('naik: target di bawah area ditolak', () => {
    expect(periksaTesis({ ...dasar, target: 104 })).toMatch(/DI ATAS/)
  })

  it('naik: batas rugi di atas area ditolak', () => {
    expect(periksaTesis({ ...dasar, stop: 101 })).toMatch(/DI BAWAH/)
  })

  it('turun adalah CERMIN, bukan arah yang dilarang', () => {
    const turun: TesisBaru = { ...dasar, arah: 'turun', target: 90, stop: 120 }
    expect(periksaTesis(turun)).toBeNull()
    // Angka tesis naik yang sama persis, dipakai untuk arah turun, harus jatuh.
    expect(periksaTesis({ ...dasar, arah: 'turun' })).toMatch(/DI BAWAH area masuk/)
  })

  it('area terbalik ditolak sebelum sampai server', () => {
    expect(periksaTesis({ ...dasar, masuk_bawah: 110 })).toMatch(/melebihi/)
  })

  it('alasan terlalu pendek/panjang ditolak dengan angkanya', () => {
    expect(periksaTesis({ ...dasar, alasan: 'pendek' })).toMatch(new RegExp(`${ALASAN_MIN}`))
    expect(periksaTesis({ ...dasar, alasan: 'x'.repeat(ALASAN_MAKS + 1) })).toMatch(new RegExp(`${ALASAN_MAKS}`))
  })

  it('horizon di luar 5/10/20 ditolak', () => {
    expect(periksaTesis({ ...dasar, horizon_hari: 7 as never })).toMatch(/5, 10, atau 20/)
    for (const h of HORIZON_TESIS) expect(periksaTesis({ ...dasar, horizon_hari: h })).toBeNull()
  })
})

describe('hari sinyal tak pernah jatuh di bar yang masih bergerak', () => {
  // Jumat 4 Sep, Senin 7 Sep 2026 hari bursa; Sabtu–Minggu tidak.
  pasangDaftarHariBursa(['2026-09-03', '2026-09-04', '2026-09-07'], '2026-09-07')

  const jkt = (iso: string) => new Date(`${iso}+07:00`)

  it('sebelum 16:45 WIB memakai hari bursa SEBELUMNYA', () => {
    expect(tanggalSinyalSekarang(jkt('2026-09-07T10:00'))).toBe('2026-09-04')
    expect(tanggalSinyalSekarang(jkt('2026-09-07T16:44'))).toBe('2026-09-04')
  })

  it('sesudah bursa tutup memakai hari itu sendiri', () => {
    expect(tanggalSinyalSekarang(jkt('2026-09-07T16:45'))).toBe('2026-09-07')
    expect(tanggalSinyalSekarang(jkt('2026-09-07T20:00'))).toBe('2026-09-07')
  })

  it('akhir pekan memakai hari bursa terakhir, jam berapa pun', () => {
    // Sabtu pagi: barnya Jumat sudah lama final, jadi tak perlu mundur lagi.
    expect(tanggalSinyalSekarang(jkt('2026-09-05T09:00'))).toBe('2026-09-04')
  })
})

describe('penyebut akurasi', () => {
  const baris = (status: TesisRow['status']) => ({ status } as TesisRow)

  it('yang masih berjalan TIDAK menghukum penyetor yang rajin', () => {
    const r = ringkasTesis([
      baris('menang'), baris('menang'), baris('menang'), baris('kalah'),
      baris('menggantung'), baris('menunggu'),
    ])
    expect(r.tuntas).toBe(4)          // dua yang berjalan di luar penyebut
    expect(r.berjalan).toBe(2)
    expect(r.akurasi).toBe(75)        // 3 dari 4, bukan 3 dari 6
  })

  it('tak masuk TETAP di penyebut — tanpanya asal-tembak jadi gratis', () => {
    const r = ringkasTesis([baris('menang'), baris('tak_masuk')])
    expect(r.tuntas).toBe(2)
    expect(r.akurasi).toBe(50)
  })

  it('belum ada yang tuntas = akurasi null, bukan 0', () => {
    // Nol persen berarti "selalu meleset"; null berarti "belum terukur".
    expect(ringkasTesis([baris('menunggu')]).akurasi).toBeNull()
  })

  it('tesis batal tak dihitung di mana pun', () => {
    const r = ringkasTesis([baris('menang'), baris('batal')])
    expect(r.tuntas).toBe(1)
    expect(r.berjalan).toBe(0)
    expect(r.akurasi).toBe(100)
  })
})
