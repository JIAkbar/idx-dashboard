import { describe, it, expect } from 'vitest'
import { kabarEmiten, type KabarItem } from './kabar'

function item(judul: string, emiten: string[] = []): KabarItem {
  return { sumber: 'IPOT News', jenis: 'berita', judul, tautan: 'https://x/' + judul, waktu: null, emiten }
}

describe('kabarEmiten', () => {
  it('menangkap kode di judul dan di ruas emiten pengumuman resmi', () => {
    const daftar = [
      item('BBCA bagikan dividen interim'),
      item('Laba bank pelat merah naik', ['BBRI']),
      item('IHSG ditutup menguat'),
    ]
    expect(kabarEmiten(daftar, 'BBCA').map((x) => x.judul)).toEqual(['BBCA bagikan dividen interim'])
    expect(kabarEmiten(daftar, 'BBRI').map((x) => x.judul)).toEqual(['Laba bank pelat merah naik'])
  })

  it('EMAS tidak menangkap "ETF Emas" — peka huruf besar', () => {
    // Pencocok lama (substring di judul yang di-uppercase) memberi 52 item
    // untuk EMAS, hanya 4 di antaranya benar. Ini kasus yang memicu #122.
    const daftar = [
      item('Harga ETF Emas naik 3%'),
      item('Emas dunia menembus rekor'),
      item('EMAS raih kontrak baru'),
    ]
    expect(kabarEmiten(daftar, 'EMAS').map((x) => x.judul)).toEqual(['EMAS raih kontrak baru'])
  })

  it('PADA tidak menangkap kata "pada"', () => {
    const daftar = [item('Investor asing masuk pada sesi kedua'), item('IHSG naik pada Rabu')]
    expect(kabarEmiten(daftar, 'PADA')).toEqual([])
  })

  it('batas kata: kode di dalam kata lain tidak dihitung', () => {
    const daftar = [item('ANTMAN tayang perdana'), item('ANTM produksi emas naik')]
    expect(kabarEmiten(daftar, 'ANTM').map((x) => x.judul)).toEqual(['ANTM produksi emas naik'])
  })

  it('tanda baca di sekitar kode tetap tertangkap', () => {
    const daftar = [item('(BBCA) tebar dividen'), item('Saham TLKM, ISAT, dan EXCL menguat')]
    expect(kabarEmiten(daftar, 'BBCA')).toHaveLength(1)
    expect(kabarEmiten(daftar, 'ISAT')).toHaveLength(1)
  })

  it('memotong di `maks` dan menolak kode tak masuk akal', () => {
    const daftar = Array.from({ length: 12 }, (_, i) => item(`BBCA kabar ke-${i}`))
    expect(kabarEmiten(daftar, 'BBCA')).toHaveLength(8)
    expect(kabarEmiten(daftar, 'BBCA', 3)).toHaveLength(3)
    expect(kabarEmiten(daftar, '')).toEqual([])
    expect(kabarEmiten(daftar, 'TERLALUPANJANG')).toEqual([])
  })
})
