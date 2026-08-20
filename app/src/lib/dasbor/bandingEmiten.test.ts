import { describe, expect, it } from 'vitest'
import {
  MAKS_BANDING,
  PALET,
  gambarBanding,
  kalimatTanggal,
  namaBerkasBanding,
  netAsing,
  susunBanding,
  ukuranBanding,
  type SumberBanding,
  type TabelBanding,
} from './bandingEmiten'
import type { AsingHarian, StockFundamental } from './stockDetailData'

/* ────────────────────────── perkakas uji ────────────────────────── */

/**
 * Konteks kanvas TIRUAN — mencatat tiap `fillText`/`fillRect` berikut warna
 * dan font yang berlaku saat itu.
 *
 * Ini satu-satunya cara membuktikan gambarnya tanpa peramban, dan sengaja
 * begitu: `gambarBanding()` dirancang cuma memakai empat kemampuan kanvas
 * supaya bisa dibuktikan seperti ini. Kalau suatu saat ia butuh gradien,
 * gambar, atau `clip`, tiruan ini akan gagal lebih dulu — dan itu memang
 * peringatan yang diinginkan, bukan gangguan.
 */
function ctxTiruan() {
  const teks: { teks: string; x: number; y: number; warna: string; font: string; align: string }[] = []
  const kotak: { x: number; y: number; w: number; h: number; warna: string }[] = []
  const ctx = {
    font: '',
    fillStyle: '',
    textAlign: 'left',
    textBaseline: 'alphabetic',
    fillText(s: string, x: number, y: number) {
      teks.push({ teks: s, x, y, warna: this.fillStyle, font: this.font, align: this.textAlign })
    },
    fillRect(x: number, y: number, w: number, h: number) {
      kotak.push({ x, y, w, h, warna: this.fillStyle })
    },
    // Lebar kira-kira; yang diuji bukan metrik font peramban melainkan bahwa
    // teks yang tak muat DIPOTONG, bukan dibiarkan menimpa kolom sebelahnya.
    measureText(s: string) {
      return { width: s.length * 6 }
    },
  }
  return { ctx: ctx as unknown as CanvasRenderingContext2D, teks, kotak }
}

function fd(over: Partial<StockFundamental> = {}): StockFundamental {
  return {
    ticker: 'AAAA',
    name: 'PT Aaaa Tbk',
    updated: '2026-08-17 13:37',
    last_price: 1000,
    ...over,
  } as StockFundamental
}

function hari(tanggal: string, beli: number, jual: number, volume = 1000, value = 5_000_000): AsingHarian {
  return { tanggal, beli, jual, volume, value, frekuensi: 10 }
}

/** Enam hari bursa; net harian +50, -50, 0, +190, -80, +20. */
const ASING: AsingHarian[] = [
  hari('2026-08-11', 100, 50),
  hari('2026-08-12', 30, 80),
  hari('2026-08-13', 60, 60),
  hari('2026-08-14', 200, 10),
  hari('2026-08-17', 10, 90),
  hari('2026-08-18', 40, 20),
]

function ambilBaris(t: TabelBanding, label: string) {
  for (const g of t.grup) {
    const b = g.baris.find((x) => x.label === label)
    if (b) return b
  }
  throw new Error(`baris "${label}" tak ada`)
}

/* ────────────────────────── netAsing ────────────────────────── */

describe('netAsing', () => {
  it('null kalau riwayatnya belum terpanen — bukan nol', () => {
    expect(netAsing(null, 20)).toBeNull()
    expect(netAsing([], 20)).toBeNull()
  })

  it('menjumlah beli-jual hari bursa terakhir dan menyebut berapa hari terpakai', () => {
    // 3 hari terakhir: (200-10) + (10-90) + (40-20) = 130
    expect(netAsing(ASING, 3)).toEqual({ net: 130, hari: 3 })
    // diminta 20 hari, yang ada cuma 6 — jumlahnya seluruh 6, dan `hari` jujur
    expect(netAsing(ASING, 20)).toEqual({ net: 130 + 50 - 50 + 0, hari: 6 })
  })
})

/* ────────────────────────── susunBanding ────────────────────────── */

describe('susunBanding', () => {
  it('memotong di lima kolom walau pemanggilnya mengirim lebih', () => {
    const enam: SumberBanding[] = ['A', 'B', 'C', 'D', 'E', 'F'].map((k) => ({
      kode: k, fd: fd({ ticker: k }), deret: null, asing: null,
    }))
    const t = susunBanding(enam)
    expect(t.kolom).toHaveLength(MAKS_BANDING)
    expect(t.kolom.map((k) => k.kode)).toEqual(['A', 'B', 'C', 'D', 'E'])
    // tiap baris punya persis satu sel per kolom — kalau tidak, sel akan
    // tergambar di bawah kolom emiten yang salah tanpa satu pun galat
    for (const g of t.grup) for (const b of g.baris) expect(b.sel).toHaveLength(MAKS_BANDING)
  })

  it('emiten tanpa berkas fundamental: seluruh selnya "—", dan kolomnya ditandai', () => {
    const t = susunBanding([{ kode: 'ZZZZ', fd: null, deret: null, asing: null }])
    expect(t.kolom[0]).toEqual({ kode: 'ZZZZ', nama: '', ada: false })
    for (const g of t.grup) for (const b of g.baris) expect(b.sel[0].teks).toBe('—')
  })

  it('ruas yang tak ada ditulis "—", TIDAK PERNAH "0"', () => {
    // ROE, marjin, DER, dividen, kapitalisasi — semuanya tak diisi
    const t = susunBanding([{ kode: 'AAAA', fd: fd(), deret: null, asing: null }])
    const kosong = ['ROE', 'Marjin bersih', 'DER', 'Imbal hasil dividen', 'Kapitalisasi pasar', 'Net asing 20 hari (lembar)']
    for (const label of kosong) expect(ambilBaris(t, label).sel[0].teks).toBe('—')
    // dan tak satu pun sel di seluruh tabel berbunyi nol dalam bentuk apa pun
    const semua = t.grup.flatMap((g) => g.baris.flatMap((b) => b.sel.map((s) => s.teks)))
    expect(semua.filter((s) => /^(0|0,0+|0\.0+|0%|0,00%|Rp 0)$/.test(s))).toEqual([])
  })

  it('marjin yang dilaporkan tepat 0 (bank) tetap "—", bukan "0,00%"', () => {
    const t = susunBanding([{ kode: 'BBBB', fd: fd({ gpm: 0, npm: 0 }), deret: null, asing: null }])
    expect(ambilBaris(t, 'Marjin bersih').sel[0].teks).toBe('—')
  })

  it('mengisi angka dan arahnya dari ruas yang ADA', () => {
    const t = susunBanding([{
      kode: 'AAAA',
      fd: fd({ last_price: 4320, week52_change_pct: -12.5, roe: 0.21818, npm: 0.53118, der: 0.81, dividend_yield: 5.61, shares: 1000 }),
      deret: null,
      asing: ASING,
    }])
    // 4.320 jatuh tepat di tick Rp 10 — harga yang tak bisa dipesan di bursa
    // tak boleh pernah tercetak, jadi tampilannya lewat `keFraksi()`.
    expect(ambilBaris(t, 'Harga').sel[0].teks).toBe(`Rp ${(4320).toLocaleString('id-ID')}`)
    expect(ambilBaris(t, 'Perubahan 52 minggu').sel[0]).toEqual({ teks: '-12.5%', arah: -1 })
    // roe RASIO → persen; der SUDAH persen (skalanya beda 100× di berkas yang sama)
    expect(ambilBaris(t, 'ROE').sel[0].teks).toBe('21.82%')
    expect(ambilBaris(t, 'DER').sel[0].teks).toBe('0.8%')
    expect(ambilBaris(t, 'Imbal hasil dividen').sel[0].teks).toBe('5.61%')
    expect(ambilBaris(t, 'Net asing 20 hari (lembar)').sel[0].arah).toBe(1)
  })

  it('vonis valuasi butuh riwayat lima tahun — kurang dari itu "—", bukan tebakan', () => {
    const pendek = { saham: 1, tahun_terakhir: '2025', eps_dasar: 100, bv_dasar: 500, pe: { '2023': 10, '2024': 11 }, pb: {} }
    const panjang = {
      saham: 1, tahun_terakhir: '2025', eps_dasar: 100, bv_dasar: 500,
      pe: { '2020': 20, '2021': 21, '2022': 22, '2023': 23, '2024': 24 }, pb: {},
    }
    const t = susunBanding([
      { kode: 'AAAA', fd: fd({ last_price: 1000 }), deret: pendek, asing: null },
      // kini = 1000/100 = 10 → di bawah kuartil bawah deret 20..24 → murah
      { kode: 'BBBB', fd: fd({ ticker: 'BBBB', last_price: 1000 }), deret: panjang, asing: null },
    ])
    const baris = ambilBaris(t, 'P/E vs sejarah sendiri')
    expect(baris.sel[0].teks).toBe('—')
    expect(baris.sel[1].teks).toBe('Murah')
  })

  it('tanggal diambil dari ISI data — yang TERBARU di antara emiten terpilih', () => {
    const t = susunBanding([
      { kode: 'AAAA', fd: fd({ updated: '2026-08-10 09:00' }), deret: null, asing: ASING.slice(0, 4) },
      { kode: 'BBBB', fd: fd({ ticker: 'BBBB', updated: '2026-08-17 13:37' }), deret: null, asing: ASING },
    ])
    expect(t.tanggalPasar).toBe('2026-08-18')
    expect(t.tanggalFundamental).toBe('2026-08-17')
    expect(kalimatTanggal(t)).toBe('Transaksi 18 Agu 2026 · fundamental 17 Agu 2026')
  })

  it('tanpa satu pun tanggal di data, kalimatnya mengatakan begitu — bukan memakai jam mesin', () => {
    const t = susunBanding([{ kode: 'ZZZZ', fd: null, deret: null, asing: null }])
    expect(t.tanggalPasar).toBeNull()
    expect(t.tanggalFundamental).toBeNull()
    expect(kalimatTanggal(t)).toBe('Tanggal data belum tersedia')
    expect(namaBerkasBanding(t)).toBe('PAPAN-banding-ZZZZ-tanpa-tanggal.png')
  })

  it('nama berkas memakai tanggal DATA, bukan tanggal unduh', () => {
    const t = susunBanding([
      { kode: 'AAAA', fd: fd(), deret: null, asing: ASING },
      { kode: 'BBBB', fd: fd({ ticker: 'BBBB' }), deret: null, asing: null },
    ])
    expect(namaBerkasBanding(t)).toBe('PAPAN-banding-AAAA-BBBB-2026-08-18.png')
  })
})

/* ────────────────────────── ukuranBanding ────────────────────────── */

describe('ukuranBanding', () => {
  it('melebar satu kolom penuh tiap emiten ditambahkan', () => {
    const satu = ukuranBanding(susunBanding([{ kode: 'A', fd: fd(), deret: null, asing: null }]))
    const dua = ukuranBanding(susunBanding([
      { kode: 'A', fd: fd(), deret: null, asing: null },
      { kode: 'B', fd: fd({ ticker: 'B' }), deret: null, asing: null },
    ]))
    expect(dua.lebar - satu.lebar).toBe(140)
    expect(dua.tinggi).toBe(satu.tinggi)
    expect(satu.tinggi).toBeGreaterThan(400)
  })
})

/* ────────────────────────── gambarBanding ────────────────────────── */

describe('gambarBanding', () => {
  const tabel = susunBanding([
    { kode: 'AAAA', fd: fd({ week52_change_pct: 12.5, roe: 0.2 }), deret: null, asing: ASING },
    { kode: 'BBBB', fd: fd({ ticker: 'BBBB', name: 'PT Bbbb Tbk', week52_change_pct: -4 }), deret: null, asing: null },
    { kode: 'CCCC', fd: null, deret: null, asing: null },
  ])

  function gambar(tema: 'dark' | 'light' = 'dark') {
    const t = ctxTiruan()
    gambarBanding(t.ctx, tabel, PALET[tema])
    return t
  }

  it('menggambar tiap emiten sebagai kepala kolomnya sendiri', () => {
    const { teks } = gambar()
    for (const kode of ['AAAA', 'BBBB', 'CCCC']) {
      expect(teks.some((x) => x.teks === kode)).toBe(true)
    }
    // kepala kolom tak boleh menumpuk di satu titik x yang sama
    const x = ['AAAA', 'BBBB', 'CCCC'].map((k) => teks.find((t) => t.teks === k)!.x)
    expect(new Set(x).size).toBe(3)
  })

  it('menggambar tiap label ruas dan tiap judul kelompok', () => {
    const { teks } = gambar()
    const semua = teks.map((t) => t.teks)
    expect(semua).toContain('Harga')
    expect(semua).toContain('ROE')
    expect(semua).toContain('Skor fundamental')
    expect(semua).toContain('VONIS VALUASI')
    expect(semua).toContain('ALIRAN ASING')
  })

  it('ruas kosong tergambar sebagai "—", tak pernah "0"', () => {
    const { teks } = gambar()
    expect(teks.filter((t) => t.teks === '—').length).toBeGreaterThan(10)
    expect(teks.some((t) => /^(0|0,00%|0%|Rp 0)$/.test(t.teks))).toBe(false)
  })

  it('kolom emiten yang berkasnya tak ada diberi keterangan, bukan dibiarkan kosong', () => {
    const { teks } = gambar()
    expect(teks.some((t) => t.teks === 'belum terpanen')).toBe(true)
  })

  it('penanda PAPAN dan tanggal data ikut tergambar — gambarnya harus bisa menjelaskan dirinya sendiri', () => {
    const { teks } = gambar()
    expect(teks.some((t) => t.teks.includes('PAPAN'))).toBe(true)
    expect(teks.some((t) => t.teks === kalimatTanggal(tabel))).toBe(true)
    expect(teks.some((t) => t.teks.includes('18 Agu 2026'))).toBe(true)
    expect(teks.some((t) => t.teks.includes('bukan rekomendasi'))).toBe(true)
  })

  it('naik hijau, turun merah, sisanya netral — memakai palet yang diberikan', () => {
    const { teks } = gambar('dark')
    expect(teks.find((t) => t.teks === '+12.5%')!.warna).toBe(PALET.dark.naik)
    expect(teks.find((t) => t.teks === '-4.0%')!.warna).toBe(PALET.dark.turun)
    const terang = gambar('light')
    expect(terang.teks.find((t) => t.teks === '+12.5%')!.warna).toBe(PALET.light.naik)
    // latar ikut tema — kotak pertama selalu latar penuh
    expect(terang.kotak[0].warna).toBe(PALET.light.latar)
  })

  it('latar digambar penuh seukuran kanvas — tanpa ini PNG-nya transparan dan tak terbaca di aplikasi pesan bertema terang', () => {
    const { kotak } = gambar()
    const { lebar, tinggi } = ukuranBanding(tabel)
    expect(kotak[0]).toEqual({ x: 0, y: 0, w: lebar, h: tinggi, warna: PALET.dark.latar })
  })

  it('teks yang tak muat dipotong, tidak dibiarkan menimpa kolom sebelahnya', () => {
    const panjang = susunBanding([{
      kode: 'DDDD',
      fd: fd({ ticker: 'DDDD', name: 'PT Perusahaan Dengan Nama Yang Sangat Panjang Sekali Tbk' }),
      deret: null, asing: null,
    }])
    const t = ctxTiruan()
    gambarBanding(t.ctx, panjang, PALET.dark)
    const nama = t.teks.find((x) => x.teks.startsWith('PT Perusahaan'))!
    expect(nama.teks.endsWith('…')).toBe(true)
    expect(nama.teks.length * 6).toBeLessThanOrEqual(140 - 18)
  })

  it('tak ada yang tergambar di luar kanvas — kaki tabel ikut termuat, bukan terpotong', () => {
    const { teks, kotak } = gambar()
    const { lebar, tinggi } = ukuranBanding(tabel)
    // Ini pengganti "sudah dilihat sendiri": tanpa peramban, satu-satunya cara
    // membuktikan gambarnya utuh adalah membuktikan tiap perintah gambar jatuh
    // di dalam kanvas yang ukurannya dihitung `ukuranBanding()`. Kalau tata
    // letak bergeser, kaki tabel yang pertama keluar batas.
    for (const t of teks) {
      expect(t.y).toBeGreaterThan(0)
      expect(t.y).toBeLessThan(tinggi)
      const lebarTeks = t.teks.length * 6
      const kiri = t.align === 'right' ? t.x - lebarTeks : t.x
      expect(kiri).toBeGreaterThanOrEqual(0)
      expect(kiri + lebarTeks).toBeLessThanOrEqual(lebar)
    }
    for (const k of kotak) {
      expect(k.x).toBeGreaterThanOrEqual(0)
      expect(k.x + k.w).toBeLessThanOrEqual(lebar)
      expect(k.y + k.h).toBeLessThanOrEqual(tinggi)
    }
    // baris kaki benar-benar ada, dan ada DI BAWAH baris terakhir
    const kaki = teks.filter((t) => t.teks.includes('bukan rekomendasi'))[0]
    const skor = teks.find((t) => t.teks === 'Pilar Dividen')!
    expect(kaki.y).toBeGreaterThan(skor.y)
  })

  it('tidak membocorkan dapur — nama berkas, endpoint, modul, atau ambang skor', () => {
    const { teks } = gambar()
    const bocor = /data-idx|\.json|\/json|fundamental\/|keuangan_idx|lib\/|\.ts\b|endpoint|GetStock|supabase|localhost|http/i
    const tersangka = teks.map((t) => t.teks).filter((s) => bocor.test(s))
    expect(tersangka).toEqual([])
  })
})
