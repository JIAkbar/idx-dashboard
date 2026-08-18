import { describe, it, expect } from 'vitest'
import {
  angka,
  bacaIndeks,
  labelEdisi,
  pangsa,
  persen,
  persenBanding,
  selisihBanding,
  tanggalPendek,
} from './statistikBerkala'

/**
 * Yang diuji di sini semuanya lahir dari BENTUK DATA NYATA, bukan dari
 * bayangan tentang datanya:
 *  - 3 dari 33 edisi mingguan tak punya `rentang_minggu` sama sekali;
 *  - edisi 14 Agu 2026 tak punya `net_asing`, sementara 32 lainnya punya;
 *  - `dana_dihimpun` punya ruas yang null di SELURUH edisi (reit, dinfra).
 * Ketiganya harus jadi "—" di layar, bukan 0 — nol itu pernyataan, dan
 * pernyataan yang salah lebih buruk daripada mengaku kosong.
 */
describe('label edisi', () => {
  it('menerjemahkan rentang bahasa Inggris ke bentuk Indonesia', () => {
    expect(labelEdisi({ stem: 'ws_260814', tanggal_edisi_iso: '2026-08-14', rentang_minggu: 'August 10-14, 2026' }))
      .toBe('10–14 Agu 2026')
    expect(labelEdisi({ stem: 'ws_260317', tanggal_edisi_iso: '2026-03-17', rentang_minggu: 'March 16-17, 2026' }))
      .toBe('16–17 Mar 2026')
  })

  it('jatuh ke tanggal edisi kalau rentangnya tak ada (3 edisi nyata)', () => {
    expect(labelEdisi({ stem: 'ws_260102', tanggal_edisi_iso: '2026-01-02', rentang_minggu: '' }))
      .toBe('s.d. 2 Jan 2026')
    expect(labelEdisi({ stem: 'ws_260703', tanggal_edisi_iso: '2026-07-03' }))
      .toBe('s.d. 3 Jul 2026')
  })

  it('memakai nama periode bulanan kalau itu yang diberi indeksnya', () => {
    // Indeks bulanan (18 Agu 2026) TIDAK sebangun dengan mingguan: tak ada
    // `tanggal_edisi_iso` maupun `rentang_minggu`, yang ada `periode_id`.
    expect(labelEdisi({ stem: 'ms_2607', periode: '2026-07', periode_id: 'Juli 2026' })).toBe('Juli 2026')
    expect(labelEdisi({ stem: 'ms_2607', periode: '2026-07' })).toBe('2026-07')
  })

  it('mengembalikan bentuk tak dikenal apa adanya, bukan menebaknya', () => {
    // Rentang menyeberang bulan belum pernah muncul di arsip, tapi bisa muncul.
    const aneh = 'June 29-July 3, 2026'
    expect(labelEdisi({ stem: 'ws_260703', tanggal_edisi_iso: '2026-07-03', rentang_minggu: aneh })).toBe(aneh)
  })

  it('tanggalPendek mengembalikan masukan tak berbentuk ISO apa adanya', () => {
    expect(tanggalPendek('2026-08-14')).toBe('14 Agu 2026')
    expect(tanggalPendek('bukan tanggal')).toBe('bukan tanggal')
  })
})

describe('pembanding antar-periode', () => {
  it('memakai angka sumber kalau sumbernya sudah menghitung', () => {
    const b = { minggu_lalu: 39948, minggu_ini: 34012, perubahan: -5936, persen: -14.86 }
    expect(selisihBanding(b)).toBe(-5936)
    expect(persenBanding(b)).toBe(-14.86)
  })

  it('menghitung sendiri kalau sumbernya cuma memberi dua nilai', () => {
    const b = { minggu_lalu: 100, minggu_ini: 110 }
    expect(selisihBanding(b)).toBe(10)
    expect(persenBanding(b)).toBeCloseTo(10, 6)
  })

  it('null (bukan 0) kalau pembandingnya hilang atau nol', () => {
    expect(persenBanding({ minggu_ini: 110 })).toBeNull()
    expect(persenBanding({ minggu_lalu: 0, minggu_ini: 110 })).toBeNull()
    expect(persenBanding(undefined)).toBeNull()
    expect(selisihBanding({ minggu_ini: 110 })).toBeNull()
    expect(selisihBanding(undefined)).toBeNull()
  })

  it('0% yang memang tertulis di sumber tetap 0%, tidak ikut jadi "—"', () => {
    expect(persenBanding({ minggu_lalu: 100, minggu_ini: 100, persen: 0 })).toBe(0)
    expect(selisihBanding({ minggu_lalu: 100, minggu_ini: 100, perubahan: 0 })).toBe(0)
  })
})

describe('angka & persen untuk layar', () => {
  it('ruas kosong jadi "—", bukan 0', () => {
    expect(angka(null)).toBe('—')
    expect(angka(undefined)).toBe('—')
    expect(persen(null)).toBe('—')
    expect(angka(0)).toBe('0')
    expect(persen(0)).toBe('+0,00%')
  })

  it('pangsa pasar TIDAK bertanda — ia porsi, bukan perubahan', () => {
    // "+86,96%" pada porsi Pasar Reguler terbaca sebagai "naik 87%", padahal
    // artinya "87% dari seluruh volume". Dua jenis persen ini hidup di berkas
    // yang sama dan cuma dibedakan oleh nama ruasnya.
    expect(pangsa(86.96)).toBe('86,96%')
    expect(pangsa(0)).toBe('0,00%')
    expect(pangsa(null)).toBe('—')
    expect(persen(86.96)).toBe('+86,96%')
  })

  it('angka nyata diformat gaya Indonesia', () => {
    expect(angka(170059)).toBe('170.059')
    expect(angka(6401.888, 3)).toBe('6.401,888')
    expect(persen(-14.86)).toBe('−14,86%')
  })
})

describe('baca daftar edisi', () => {
  it('mengambil larik pertama apa pun nama ruasnya (mingguan/bulanan)', () => {
    const mingguan = { minggu: [{ stem: 'ws_260814', tanggal_edisi_iso: '2026-08-14' }] }
    const bulanan = { bulan: [{ stem: 'ms_2607', tanggal_edisi_iso: '2026-07-31' }] }
    expect(bacaIndeks(mingguan)).toHaveLength(1)
    expect(bacaIndeks(bulanan)[0].stem).toBe('ms_2607')
  })

  it('mengurutkan indeks bulanan yang tak punya tanggal_edisi_iso tanpa meledak', () => {
    // Bentuk NYATA index_monthly.json. Versi pertama fungsi ini mengurutkan
    // lewat `tanggal_edisi_iso.localeCompare` dan cuma selamat karena arsipnya
    // masih satu baris (comparator tak pernah dipanggil untuk larik satu isi).
    const bulanan = {
      bulan: [
        { stem: 'ms_2607', periode: '2026-07', periode_id: 'Juli 2026' },
        { stem: 'ms_2606', periode: '2026-06', periode_id: 'Juni 2026' },
      ],
    }
    expect(bacaIndeks(bulanan).map((e) => e.stem)).toEqual(['ms_2606', 'ms_2607'])
  })

  it('mengurutkan naik supaya "edisi berikutnya" = indeks + 1', () => {
    const acak = {
      minggu: [
        { stem: 'ws_260814', tanggal_edisi_iso: '2026-08-14' },
        { stem: 'ws_260102', tanggal_edisi_iso: '2026-01-02' },
        { stem: 'ws_260807', tanggal_edisi_iso: '2026-08-07' },
      ],
    }
    expect(bacaIndeks(acak).map((e) => e.stem)).toEqual(['ws_260102', 'ws_260807', 'ws_260814'])
  })

  it('daftar kosong (arsip bulanan belum ada) bukan galat', () => {
    expect(bacaIndeks(null)).toEqual([])
    expect(bacaIndeks('<!doctype html>')).toEqual([])
    expect(bacaIndeks({})).toEqual([])
  })
})
