import { describe, expect, it } from 'vitest'
import { WARNA, idTerbesar, warnaSimpul, type GNode } from './graphRender'

function simpul(id: string, size: number, kind: GNode['kind'] = 'investor'): GNode {
  return { id, label: id, kind, size }
}

describe('idTerbesar', () => {
  it('mengambil n simpul terbesar menurut size', () => {
    const nodes = [simpul('a', 3), simpul('b', 12), simpul('c', 7), simpul('d', 1)]
    expect([...idTerbesar(nodes, 2)].sort()).toEqual(['b', 'c'])
  })

  it('tidak mengubah array masukan (urutan simpul dipakai simulasi d3)', () => {
    const nodes = [simpul('a', 3), simpul('b', 12)]
    idTerbesar(nodes, 1)
    expect(nodes.map((n) => n.id)).toEqual(['a', 'b'])
  })

  it('pada ukuran sama, emiten menang karena didorong ke array lebih dulu', () => {
    const nodes = [simpul('E_AADI', 10, 'emiten'), simpul('E_AALI', 10, 'emiten'), simpul('I_X', 10), simpul('I_Y', 10)]
    expect([...idTerbesar(nodes, 2)]).toEqual(['E_AADI', 'E_AALI'])
  })

  it('n lebih besar dari jumlah simpul mengembalikan semuanya, bukan undefined', () => {
    const nodes = [simpul('a', 3), simpul('b', 12)]
    expect(idTerbesar(nodes, 12).size).toBe(2)
  })
})

describe('warnaSimpul', () => {
  it('emiten satu-satunya yang beraksen amber', () => {
    expect(warnaSimpul({ kind: 'emiten' })).toBe(WARNA.emiten)
  })

  it('kategori investor mengikuti holderType (cls kosong = lain/OTH)', () => {
    expect(warnaSimpul({ kind: 'investor', cls: 'Corporate' })).toBe(WARNA.institusi)
    expect(warnaSimpul({ kind: 'investor', cls: 'Mutual Fund' })).toBe(WARNA.institusi)
    expect(warnaSimpul({ kind: 'investor', cls: 'Individual' })).toBe(WARNA.individu)
    expect(warnaSimpul({ kind: 'investor', cls: '' })).toBe(WARNA.lain)
    expect(warnaSimpul({ kind: 'investor' })).toBe(WARNA.lain)
  })

  it('hijau & merah tidak boleh masuk palet simpul — keduanya dikunci untuk arah angka', () => {
    for (const w of Object.values(WARNA)) expect(w).not.toMatch(/green|red/)
  })
})
