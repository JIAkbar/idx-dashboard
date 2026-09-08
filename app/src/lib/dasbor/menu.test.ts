import { describe, it, expect } from 'vitest'
import { MENU_GRUP, MENU_ITEMS, MENU_KELOMPOK, MENU_UTAMA, judulHalaman, tabHalaman } from './menu'

/**
 * Rail desktop kini menggambar KELOMPOK, bukan menu satuan (#175). Menu yang
 * lahir tanpa ruas `grup` yang sah akan hilang diam-diam dari rail DAN dari
 * laci telepon — tak ada galat, cuma menu yang tak pernah muncul. Uji ini
 * menjaga hubungan itu, bukan tampilannya.
 */
describe('pengelompokan menu', () => {
  it('tiap menu UTAMA masuk tepat satu kelompok, tak ada yang tercecer', () => {
    // Sejak peleburan 31 Agu 2026 rail hanya memuat menu tanpa `induk` —
    // halaman ber-induk sudah jadi tab, dan memunculkannya juga di rail
    // berarti satu halaman punya dua pintu. Penyebutnya karena itu
    // MENU_UTAMA, bukan MENU_ITEMS.
    const terkumpul = MENU_KELOMPOK.flatMap((g) => g.items)
    expect(terkumpul).toHaveLength(MENU_UTAMA.length)
    expect(new Set(terkumpul.map((m) => m.id)).size).toBe(MENU_UTAMA.length)
    expect(terkumpul.every((m) => !m.induk)).toBe(true)
  })

  it('menu utama tak lebih dari 10 — batas yang diminta Johan', () => {
    // "memang kita sudah over menu, pengen saya pangkas umum nya 10 maksimal
    // sudahan" (30 Agu 2026). Uji ini yang membuat batas itu tak bisa
    // dilanggar diam-diam oleh halaman baru: menambah menu ke-11 memerahkan
    // uji, dan yang menambahnya harus memutuskan halaman mana yang jadi tab.
    expect(MENU_UTAMA.length).toBeLessThanOrEqual(10)
  })

  it('tiap halaman ber-induk menunjuk induk yang BENAR-BENAR ada dan bukan dirinya', () => {
    const rute = new Set(MENU_ITEMS.map((m) => m.path))
    for (const m of MENU_ITEMS.filter((x) => x.induk)) {
      expect(rute.has(m.induk!), `${m.id} → ${m.induk}`).toBe(true)
      expect(m.induk).not.toBe(m.path)
      // Induk tak boleh punya induk lagi: tab bertingkat menyembunyikan
      // halaman di kedalaman kedua, dan itu justru yang sedang dihapus.
      const induk = MENU_ITEMS.find((x) => x.path === m.induk)
      expect(induk?.induk, `${m.induk} sendiri punya induk`).toBeUndefined()
    }
  })

  it('tiap induk punya minimal satu anak — kalau tidak, tabnya cuma satu', () => {
    const punyaAnak = new Set(MENU_ITEMS.map((m) => m.induk).filter(Boolean))
    for (const p of punyaAnak) {
      expect(tabHalaman(p as string).length).toBeGreaterThanOrEqual(2)
    }
  })

  it('tak ada kelompok kosong', () => {
    for (const g of MENU_KELOMPOK) expect(g.items.length).toBeGreaterThan(0)
  })

  it('kode kelompok & kode menu unik dan tiga huruf', () => {
    const kodeGrup = MENU_GRUP.map((g) => g.kode)
    expect(new Set(kodeGrup).size).toBe(kodeGrup.length)
    for (const k of kodeGrup) expect(k).toMatch(/^[A-Z]{3}$/)
    const kodeMenu = MENU_ITEMS.map((m) => m.kode)
    expect(new Set(kodeMenu).size).toBe(kodeMenu.length)
  })

  it('path menu unik', () => {
    const path = MENU_ITEMS.map((m) => m.path)
    expect(new Set(path).size).toBe(path.length)
  })
})

describe('judulHalaman (#103)', () => {
  it('cocok persis dari MENU_ITEMS, bukan teks yang diketik ulang', () => {
    expect(judulHalaman('/screener')).toBe(MENU_ITEMS.find((m) => m.path === '/screener')!.label)
    expect(judulHalaman('/winrate')).toBe('Winrate PAPAN')
  })

  it('halaman ber-parameter memakai nama induk ruas pertamanya', () => {
    expect(judulHalaman('/broker/BBCA')).toBe(judulHalaman('/broker'))
  })

  it('garis miring di ujung tak mengubah jawaban', () => {
    expect(judulHalaman('/screener/')).toBe(judulHalaman('/screener'))
  })

  it('Beranda null — kepalanya sudah berisi pita kurs', () => {
    expect(judulHalaman('/')).toBeNull()
    expect(judulHalaman('')).toBeNull()
  })

  it('alamat tak dikenal null, BUKAN tebakan', () => {
    // Kepala tanpa nama lebih jujur daripada kepala yang menyebut halaman salah.
    expect(judulHalaman('/entah-apa')).toBeNull()
    expect(judulHalaman('/rute/yang/tak/ada')).toBeNull()
  })

  it('rute di luar menu yang memang ada rutenya tetap bernama', () => {
    expect(judulHalaman('/admin')).toBe('Admin')
    expect(judulHalaman('/admin/changelog')).toBe('Admin')
    expect(judulHalaman('/login')).toBe('Masuk')
  })
})
