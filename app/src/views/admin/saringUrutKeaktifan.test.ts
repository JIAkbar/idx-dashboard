import { describe, expect, it } from 'vitest'
import { saringUrutKeaktifan } from './AktivitasAdmin'
import type { RingkasanKeaktifan } from '../../lib/aktivitas'

function baris(p: Partial<RingkasanKeaktifan>): RingkasanKeaktifan {
  return {
    id: p.alias ?? p.email ?? 'x',
    email: 'x@papan.id',
    alias: null,
    tier: 0,
    jenjang: 'Pemula',
    aktif: true,
    setoran: 0,
    disetujui: 0,
    dihapus: 0,
    menunggu: 0,
    akurasi: null,
    terakhir_setor: null,
    hari_diam: 0,
    ip_berbeda: 0,
    ...p,
  } as RingkasanKeaktifan
}

describe('saringUrutKeaktifan', () => {
  it('jenjang tertinggi lebih dulu', () => {
    const hasil = saringUrutKeaktifan(
      [baris({ alias: 'Pemula', tier: 0 }), baris({ alias: 'Emas', tier: 3 }), baris({ alias: 'Perak', tier: 2 })],
      ''
    )
    expect(hasil.map((r) => r.alias)).toEqual(['Emas', 'Perak', 'Pemula'])
  })

  it('tier sama dipecah oleh jumlah disetujui, lalu setoran, lalu nama', () => {
    // Keadaan nyata: 13 dari 13 kontributor masih tier 0. Tanpa pemecah seri
    // berlapis, urutannya terlihat acak dan berubah tiap muat.
    const hasil = saringUrutKeaktifan(
      [
        baris({ alias: 'Cici', disetujui: 2, setoran: 2 }),
        baris({ alias: 'Adi', disetujui: 5, setoran: 5 }),
        baris({ alias: 'Budi', disetujui: 2, setoran: 9 }),
      ],
      ''
    )
    expect(hasil.map((r) => r.alias)).toEqual(['Adi', 'Budi', 'Cici'])
  })

  it('cari cocok ke alias, email, dan nama jenjang — tanpa peduli huruf besar', () => {
    const data = [
      baris({ alias: 'Agitama', email: 'agi@papan.id' }),
      baris({ alias: 'Zainul', email: 'zainul@papan.id', tier: 2, jenjang: 'Perak' }),
    ]
    expect(saringUrutKeaktifan(data, 'AGIT').map((r) => r.alias)).toEqual(['Agitama'])
    expect(saringUrutKeaktifan(data, 'zainul@').map((r) => r.alias)).toEqual(['Zainul'])
    expect(saringUrutKeaktifan(data, 'perak').map((r) => r.alias)).toEqual(['Zainul'])
  })

  it('alias kosong tidak membuat pencarian pecah', () => {
    const data = [baris({ alias: null, email: 'tanpa-alias@papan.id' })]
    expect(saringUrutKeaktifan(data, 'tanpa').length).toBe(1)
    expect(saringUrutKeaktifan(data, 'lainnya').length).toBe(0)
  })

  it('cari kosong mengembalikan semua baris', () => {
    const data = [baris({ alias: 'A' }), baris({ alias: 'B' })]
    expect(saringUrutKeaktifan(data, '   ').length).toBe(2)
  })
})
