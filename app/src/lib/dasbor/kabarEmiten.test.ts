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

  it('satu tautan satu baris — artikel yang sama dari dua kanal agregator (#142)', () => {
    // Terukur 9 Sep 2026: kabar.json memuat 38 tautan yang muncul dua kali,
    // judulnya beda hanya di sufiks nama outlet, jadi dedup tautan+judul+waktu
    // di hulu melewatkannya. Di daftar delapan baris hasilnya kembar mencolok.
    const daftar = [
      item('Top Leaders Sepekan: Ditopang BBCA - market.bisnis.com'),
      { ...item('Top Leaders Sepekan: Ditopang BBCA - Bisnis.com - Market'), tautan: 'https://x/Top Leaders Sepekan: Ditopang BBCA - market.bisnis.com' },
      item('BBCA tebar dividen'),
    ]
    const hasil = kabarEmiten(daftar, 'BBCA')
    expect(hasil).toHaveLength(2)
    expect(new Set(hasil.map((x) => x.tautan)).size).toBe(2)
  })

  it('pengumuman resmi ber-tautan generik TIDAK saling menghapus (#142)', () => {
    // Kebalikannya, dan sama pentingnya: pengumuman bursa tanpa lampiran
    // semuanya menunjuk satu URL generik. Dedup ber-tautan di sana meringkas
    // belasan pengumuman berbeda jadi satu baris — bug 16 Agu 2026.
    const generik = 'https://www.idx.co.id/id/perusahaan-tercatat/keterbukaan-informasi'
    const peng = (judul: string, waktu: string) => ({
      sumber: 'IDX', jenis: 'pengumuman' as const, judul, tautan: generik, waktu, emiten: ['BBCA'],
    })
    const daftar = [
      peng('RUPS Luar Biasa', '2026-09-08T09:00:00+07:00'),
      peng('Laporan kepemilikan saham', '2026-09-07T09:00:00+07:00'),
      peng('Transaksi material', '2026-09-06T09:00:00+07:00'),
    ]
    expect(kabarEmiten(daftar, 'BBCA')).toHaveLength(3)
  })

  it('memotong di `maks` dan menolak kode tak masuk akal', () => {
    const daftar = Array.from({ length: 12 }, (_, i) => item(`BBCA kabar ke-${i}`))
    expect(kabarEmiten(daftar, 'BBCA')).toHaveLength(8)
    expect(kabarEmiten(daftar, 'BBCA', 3)).toHaveLength(3)
    expect(kabarEmiten(daftar, '')).toEqual([])
    expect(kabarEmiten(daftar, 'TERLALUPANJANG')).toEqual([])
  })
})
