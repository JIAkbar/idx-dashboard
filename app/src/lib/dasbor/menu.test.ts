import { describe, it, expect } from 'vitest'
import { MENU_GRUP, MENU_ITEMS, MENU_KELOMPOK, MENU_UTAMA, tabHalaman } from './menu'

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
