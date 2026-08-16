import { describe, expect, it } from 'vitest'
import { gabungKabar, type Kabar, type KabarItem } from './kabar'

const brt = (p: Partial<KabarItem>): KabarItem => ({
  sumber: 'IPOT News', jenis: 'berita', judul: 'Judul', tautan: 'https://x/1', waktu: null, emiten: [], ...p,
})

const IDX_GENERIK = 'https://www.idx.co.id/id/perusahaan-tercatat/keterbukaan-informasi'

const bungkus = (item: KabarItem[]): Kabar => ({ dipanen: '', sumber: [], item })

describe('gabungKabar', () => {
  it('pengumuman IDX ber-tautan sama TIDAK saling menghapus', () => {
    // Bug 16 Agu 2026: dedup ber-tautan saja meringkas seluruh pengumuman
    // resmi jadi satu baris. Dari layar terbaca sebagai "beritanya tidak ada",
    // bukan sebagai bug — tak ada galat yang muncul di mana pun.
    const p = [
      brt({ sumber: 'IDX', jenis: 'pengumuman', judul: 'RUPS ISAT', tautan: IDX_GENERIK, waktu: '2026-08-16T09:00:00+07:00' }),
      brt({ sumber: 'IDX', jenis: 'pengumuman', judul: 'Laporan kepemilikan MEDS', tautan: IDX_GENERIK, waktu: '2026-08-15T09:00:00+07:00' }),
      brt({ sumber: 'IDX', jenis: 'pengumuman', judul: 'Transaksi material', tautan: IDX_GENERIK, waktu: '2026-08-14T09:00:00+07:00' }),
    ]
    expect(gabungKabar(bungkus(p), [], []).item).toHaveLength(3)
  })

  it('berita yang benar-benar kembar tetap dibuang sekali', () => {
    const sama = brt({ judul: 'IHSG menguat', tautan: 'https://x/9', waktu: '2026-08-16T10:00:00+07:00' })
    expect(gabungKabar(bungkus([sama]), [], [{ ...sama }]).item).toHaveLength(1)
  })

  it('yang lebih dulu menang — kabar.json lebih segar dari arsip', () => {
    const segar = brt({ judul: 'Sama', tautan: 'https://x/9', waktu: '2026-08-16T10:00:00+07:00', kanal: 'Saham' })
    const arsip = { ...segar, kanal: 'Market/JCI' }
    expect(gabungKabar(bungkus([segar]), [], [arsip]).item[0].kanal).toBe('Saham')
  })

  it('sumber diturunkan dari isi, jadi ikut menyusut saat sebuah sumber dicabut', () => {
    const g = gabungKabar(
      bungkus([brt({ sumber: 'IDX', tautan: 'a', judul: 'satu' })]),
      [brt({ sumber: 'Stockbit Snips', tautan: 'b', judul: 'dua' })], [])
    expect(g.sumber).toEqual(['IDX', 'Stockbit Snips'])
  })

  it('terbaru di atas, yang tanpa waktu menyusul — bukan dibuang', () => {
    const g = gabungKabar(bungkus([
      brt({ judul: 'tanpa waktu', tautan: 'a' }),
      brt({ judul: 'lama', tautan: 'b', waktu: '2026-01-01T09:00:00+07:00' }),
      brt({ judul: 'baru', tautan: 'c', waktu: '2026-08-16T09:00:00+07:00' }),
    ]), [], [])
    expect(g.item.map((i) => i.judul)).toEqual(['baru', 'lama', 'tanpa waktu'])
  })
})
