import { describe, it, expect } from 'vitest'
import {
  sumberBar,
  sumberDalamRentang,
  catatanSumber,
  NAMA_SUMBER,
  type RentangSumber,
} from './sumberBar'

// Bentuk nyata sebuah arsip gabungan: riwayat tua hanya ada di cadangan,
// hari-hari baru seluruhnya dari penyedia utama.
const RENTANG: RentangSumber[] = [
  ['1990-04-06', '2003-12-30', 'yh'],
  ['2004-01-02', '2026-09-04', 'sb'],
]

describe('sumberBar — menjawab per tanggal', () => {
  it('tanggal di blok cadangan menjawab cadangan', () => {
    expect(sumberBar(RENTANG, '1990-04-06')).toBe('yh')
    expect(sumberBar(RENTANG, '1998-05-21')).toBe('yh')
    expect(sumberBar(RENTANG, '2003-12-30')).toBe('yh')
  })

  it('tanggal di blok utama menjawab utama', () => {
    expect(sumberBar(RENTANG, '2004-01-02')).toBe('sb')
    expect(sumberBar(RENTANG, '2026-09-04')).toBe('sb')
  })

  it('kedua ujung rentang inklusif — batas tak boleh jatuh ke celah', () => {
    for (const [dari, sampai, kode] of RENTANG) {
      expect(sumberBar(RENTANG, dari)).toBe(kode)
      expect(sumberBar(RENTANG, sampai)).toBe(kode)
    }
  })

  it('di luar seluruh rentang menjawab null, bukan menebak', () => {
    expect(sumberBar(RENTANG, '1980-01-01')).toBeNull()
    expect(sumberBar(RENTANG, '2030-01-01')).toBeNull()
    // celah antar blok (2003-12-31 & 2004-01-01 tak ada di kedua rentang)
    expect(sumberBar(RENTANG, '2003-12-31')).toBeNull()
  })

  it('berkas lama tanpa penanda menjawab null, tidak meledak', () => {
    expect(sumberBar(undefined, '2026-09-04')).toBeNull()
    expect(sumberBar([], '2026-09-04')).toBeNull()
  })

  it('pencarian biner benar untuk banyak blok', () => {
    const banyak: RentangSumber[] = [
      ['2020-01-01', '2020-01-31', 'sb'],
      ['2020-02-01', '2020-02-05', 'yh'],
      ['2020-02-06', '2020-03-31', 'sb'],
      ['2020-04-01', '2020-04-02', 'yh'],
      ['2020-04-03', '2020-12-31', 'sb'],
    ]
    expect(sumberBar(banyak, '2020-01-15')).toBe('sb')
    expect(sumberBar(banyak, '2020-02-03')).toBe('yh')
    expect(sumberBar(banyak, '2020-03-01')).toBe('sb')
    expect(sumberBar(banyak, '2020-04-01')).toBe('yh')
    expect(sumberBar(banyak, '2020-06-01')).toBe('sb')
  })
})

describe('sumberDalamRentang — apa yang tersentuh tampilan', () => {
  it('rentang yang seluruhnya baru hanya menyentuh sumber utama', () => {
    expect(sumberDalamRentang(RENTANG, '2026-01-01', '2026-09-04')).toEqual(['sb'])
  })

  it('rentang yang melintasi batas menyentuh keduanya', () => {
    expect(sumberDalamRentang(RENTANG, '2003-01-01', '2005-01-01')).toEqual(['yh', 'sb'])
  })

  it('rentang di luar data menyentuh nol sumber', () => {
    expect(sumberDalamRentang(RENTANG, '1970-01-01', '1980-01-01')).toEqual([])
  })
})

describe('catatanSumber — diam saat tak perlu, bicara saat perlu', () => {
  it('DIAM kalau seluruhnya dari sumber utama', () => {
    // Catatan yang selalu muncul berhenti dibaca; yang menarik justru
    // pengecualiannya.
    expect(catatanSumber(RENTANG, '2026-01-01', '2026-09-04')).toBeNull()
  })

  it('DIAM kalau berkasnya belum berpenanda — jangan mengarang', () => {
    expect(catatanSumber(undefined, '2026-01-01', '2026-09-04')).toBeNull()
  })

  it('menyebut penyedia kalau seluruhnya dari cadangan', () => {
    const t = catatanSumber(RENTANG, '1995-01-01', '1999-12-31')
    expect(t).toContain(NAMA_SUMBER.yh)
    expect(t).not.toContain(NAMA_SUMBER.sb)
  })

  it('menyebut TANGGAL bagian cadangan saat campuran, DIPOTONG ke jendela', () => {
    const t = catatanSumber(RENTANG, '2003-01-01', '2005-01-01') ?? ''
    expect(t).toContain(NAMA_SUMBER.sb)
    expect(t).toContain(NAMA_SUMBER.yh)
    // Dipotong ke jendela: blok aslinya mulai 1990-04-06, tapi pembaca sedang
    // melihat sejak 2003-01-01. Menyebut 1990 membuatnya mengira melihat
    // sesuatu yang tak ada di layarnya.
    expect(t).toMatch(/2003-01-01 s\.d\. 2003-12-30/)
    expect(t).not.toContain('1990-04-06')
  })

  it('TIDAK PERNAH mengklaim mana yang mayoritas', () => {
    // Versi pertama membuka dengan "Sebagian besar harga dari Stockbit" begitu
    // dua sumber tersentuh, tanpa menghitung satu bar pun. Terukur terbalik di
    // GOLD: 107 dari 114 bar justru dari cadangan.
    const berselang: RentangSumber[] = [
      ['2016-01-04', '2016-08-12', 'sb'],
      ['2016-08-15', '2017-08-04', 'yh'],
      ['2017-08-07', '2026-09-04', 'sb'],
    ]
    const t = catatanSumber(berselang, '2016-08-15', '2017-08-04') ?? ''
    expect(t).not.toMatch(/[Ss]ebagian besar/)
    expect(t).toContain(NAMA_SUMBER.yh)
  })

  it('meringkas saat potongannya banyak — bukan menuang isi berkas ke layar', () => {
    // GOLD nyata: 22 blok cadangan berselang-seling menghasilkan satu paragraf
    // 549 aksara berisi 22 rentang tanggal. Yang tayang berhenti jadi
    // keterangan dan mulai jadi isi berkas.
    const banyak: RentangSumber[] = []
    for (let i = 0; i < 12; i++) {
      const b = 2016 + i
      banyak.push([`${b}-01-04`, `${b}-01-10`, 'yh'])
      banyak.push([`${b}-01-11`, `${b}-12-30`, 'sb'])
    }
    const t = catatanSumber(banyak, '2016-01-04', '2027-12-30') ?? ''
    expect(t).toMatch(/12 potongan antara 2016-01-04 dan 2027-01-10/)
    expect(t.length).toBeLessThan(180)
  })

  it('tetap menyebut satu per satu selama masih sedikit', () => {
    const sedikit: RentangSumber[] = [
      ['2020-01-02', '2020-01-03', 'yh'],
      ['2020-01-06', '2026-09-04', 'sb'],
    ]
    const t = catatanSumber(sedikit, '2020-01-02', '2026-09-04') ?? ''
    expect(t).toContain('2020-01-02 s.d. 2020-01-03')
  })

  it('tidak membocorkan nama endpoint atau jalur berkas', () => {
    const semua = [
      catatanSumber(RENTANG, '1995-01-01', '1999-12-31'),
      catatanSumber(RENTANG, '2003-01-01', '2005-01-01'),
    ].join(' ')
    expect(semua).not.toMatch(/chartbit|marketdetector|data-idx|\.json|query1|finance\/chart/i)
  })
})
