import { describe, it, expect } from 'vitest'
import {
  susunKsei, deretKomposisiKsei, angkaSingkatKeLembar, pemegangSaham, anakUsaha, pengurus,
  type BerkasKepemilikan, type BerkasProfil,
} from './brokerProfilKsei'

// kolom: [lembar_tercatat, harga, lokal_IS,CP,PF,IB,ID,MF,SC,FD,OT, lokal_total, asing_IS,CP,PF,IB,ID,MF,SC,FD,OT, asing_total]
const barisBulan = (tot: number, lokalId: number, lokalCp: number, lokalTotal: number, asingCp: number, asingTotal: number): number[] => [
  tot, 100, 0, lokalCp, 0, 0, lokalId, 0, 0, 0, 0, lokalTotal, 0, asingCp, 0, 0, 0, 0, 0, 0, 0, asingTotal,
]

const kepemilikan: BerkasKepemilikan = {
  kode: 'UJI', kolom: [], satuan: 'lembar', jenis: { IS: 'asuransi', CP: 'korporasi', PF: 'dana pensiun', IB: 'bank', ID: 'perorangan', MF: 'reksa dana', SC: 'sekuritas', FD: 'yayasan', OT: 'lainnya' },
  bulan: {
    '2025-01-31': barisBulan(1000, 100, 200, 300, 100, 200),
    '2026-01-31': barisBulan(1000, 150, 250, 400, 80, 150),
  },
}

describe('susunKsei', () => {
  it('total % dari posisi terakhir, delta setahun dari 12 bulan lalu', () => {
    const r = susunKsei(kepemilikan)!
    expect(r.bulanTerakhir).toBe('2026-01-31')
    expect(r.lembarTercatat).toBe(1000)
    // Asing total: 150/1000=15% (turun dari 200/1000=20%) -> delta -5pp
    expect(r.asingTotalPct).toBeCloseTo(15, 6)
    expect(r.asingDeltaSetahunPp).toBeCloseTo(-5, 6)
    // baris terurut turun by totalPct
    expect(r.baris[0].totalPct).toBeGreaterThanOrEqual(r.baris[r.baris.length - 1].totalPct)
  })
  it('bulan kosong -> null', () => {
    expect(susunKsei({ ...kepemilikan, bulan: {} })).toBeNull()
  })
})

describe('deretKomposisiKsei', () => {
  it('tiap seri % dari lembar_tercatat bulan itu', () => {
    const d = deretKomposisiKsei(kepemilikan)
    expect(d.bulanList).toEqual(['2025-01-31', '2026-01-31'])
    const perorangan = d.seri.find((s) => s.label === 'Perorangan lokal')!
    expect(perorangan.pct[1]).toBeCloseTo(15, 6) // 150/1000
  })
})

describe('angkaSingkatKeLembar', () => {
  it('mengurai sufiks B/M/K dan angka polos', () => {
    expect(angkaSingkatKeLembar('170.00 B')).toBe(170e9)
    expect(angkaSingkatKeLembar('30.43 M')).toBeCloseTo(30.43e6, 3)
    expect(angkaSingkatKeLembar('577,851')).toBe(577851)
    expect(angkaSingkatKeLembar('bukan angka')).toBeNull()
  })
})

const profil: BerkasProfil = {
  kode: 'UJI',
  shareholder: [
    { percentage: '54.2%', name: 'MASYARAKAT', value: '201.27 B', badges: [] },
    { percentage: '45.78%', name: 'MACH ENERGY', value: '170.00 B', badges: ['pengendali'] },
    { percentage: '0%', name: 'NOL PERSEN', value: '0', badges: [] },
  ],
  subsidiary: [
    { company: 'PT A', percentage: '51.00%', types: 'Tambang', value: '100' },
    { company: 'PT B', percentage: '90.00%', types: 'Tambang', value: '500' },
  ],
  key_executive: {
    commissioner: [{ key: 'Commissioner', value: 'BUDI' }],
    independent_commissioner: [{ key: 'Commissioner (Independent)', value: 'ANI' }],
    president_commissioner: [], vice_president_commissioner: [],
    director: [{ key: 'Director', value: 'CANDRA' }],
    president_director: [{ key: 'President Director', value: 'DEWI' }],
    vice_president: [],
  },
}

describe('pemegangSaham', () => {
  it('menyaring persen 0, urut turun, badge pengendali terbaca', () => {
    const rows = pemegangSaham(profil)
    expect(rows).toHaveLength(2)
    expect(rows[0].nama).toBe('MASYARAKAT')
    expect(rows[1].pengendali).toBe(true)
    expect(rows[1].lembar).toBe(170e9)
  })
})

describe('anakUsaha', () => {
  it('urut turun by nilai', () => {
    const rows = anakUsaha(profil)
    expect(rows.map((r) => r.nama)).toEqual(['PT B', 'PT A'])
  })
})

describe('pengurus', () => {
  it('gabung seluruh peran dengan label jabatan', () => {
    const p = pengurus(profil)
    expect(p.direksi).toEqual(['DEWI (presiden direktur)', 'CANDRA (direktur)'])
    expect(p.komisaris).toEqual(['BUDI (komisaris)', 'ANI (komisaris independen)'])
  })
})
