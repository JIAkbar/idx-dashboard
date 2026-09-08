import { describe, expect, it } from 'vitest'
import { gabungKabar, kabarTerbaru, type Kabar, type KabarItem } from './kabar'

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

describe('kabarTerbaru', () => {
  it('dibaca dari isi, bukan dari `dipanen`', () => {
    // Berkasnya ditulis ulang tiap 2 jam walau tak membawa kabar baru. Kalau
    // umurnya diambil dari `dipanen`, halaman menulis "baru saja" di atas
    // daftar yang berhenti tiga hari lalu — segar di layar, mati di data.
    const k: Kabar = {
      dipanen: '2026-08-18T22:00:00+07:00', sumber: [],
      item: [brt({ tautan: 'a', waktu: '2026-08-15T09:00:00+07:00' }),
        brt({ tautan: 'b', waktu: '2026-08-16T09:00:00+07:00' })],
    }
    expect(kabarTerbaru(k)).toBe('2026-08-16T09:00:00+07:00')
  })

  it('daftar kosong / item tanpa waktu → null, bukan hari ini', () => {
    expect(kabarTerbaru(bungkus([]))).toBeNull()
    expect(kabarTerbaru(bungkus([brt({ waktu: null })]))).toBeNull()
    expect(kabarTerbaru(null)).toBeNull()
  })
})

describe('urutan lintas zona waktu (#135)', () => {
  it('Google News (UTC) dan sumber WIB diurutkan menurut SAAT sebenarnya', () => {
    // Kedua stempel ini menunjuk saat yang sama persis. Sebagai teks,
    // "2026-09-08T17:00:00Z" jatuh tujuh jam di bawah "…T00:00:00+07:00" —
    // daftar tetap terlihat rapi menurun, isinya saja yang salah urut.
    const wib = brt({ tautan: 'wib', judul: 'WIB lebih tua', waktu: '2026-09-08T20:00:00+07:00' })
    const utc = brt({ sumber: 'Google News', tautan: 'utc', judul: 'UTC lebih baru', waktu: '2026-09-08T14:00:00Z' })
    const urut = gabungKabar(bungkus([wib, utc]), [], []).item.map((i) => i.tautan)
    expect(urut).toEqual(['utc', 'wib'])
  })

  it('item tanpa waktu tetap di bawah yang bertanggal', () => {
    const ada = brt({ tautan: 'ada', waktu: '2026-09-01T09:00:00+07:00' })
    const kosong = brt({ tautan: 'kosong', waktu: null })
    expect(gabungKabar(bungkus([kosong, ada]), [], []).item.map((i) => i.tautan)).toEqual(['ada', 'kosong'])
  })

  it('kabarTerbaru membandingkan saat, bukan teks', () => {
    const k = bungkus([
      brt({ tautan: 'wib', waktu: '2026-09-08T20:00:00+07:00' }),
      brt({ sumber: 'Google News', tautan: 'utc', waktu: '2026-09-08T14:00:00Z' }),
    ])
    expect(kabarTerbaru(k)).toBe('2026-09-08T14:00:00Z')
  })
})
