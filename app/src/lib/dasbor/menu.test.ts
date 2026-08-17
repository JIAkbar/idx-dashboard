import { describe, it, expect } from 'vitest'
import { MENU_GRUP, MENU_ITEMS, MENU_KELOMPOK } from './menu'

/**
 * Rail desktop kini menggambar KELOMPOK, bukan menu satuan (#175). Menu yang
 * lahir tanpa ruas `grup` yang sah akan hilang diam-diam dari rail DAN dari
 * laci telepon — tak ada galat, cuma menu yang tak pernah muncul. Uji ini
 * menjaga hubungan itu, bukan tampilannya.
 */
describe('pengelompokan menu', () => {
  it('tiap menu masuk tepat satu kelompok, tak ada yang tercecer', () => {
    const terkumpul = MENU_KELOMPOK.flatMap((g) => g.items)
    expect(terkumpul).toHaveLength(MENU_ITEMS.length)
    expect(new Set(terkumpul.map((m) => m.id)).size).toBe(MENU_ITEMS.length)
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
