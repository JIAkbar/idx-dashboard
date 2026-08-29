import { describe, it, expect } from 'vitest'
import {
  susunBendera, AMBANG_KONSENTRASI, AMBANG_NEGO, AMBANG_BEKU, MIN_LILIN,
} from './berkasBendera'

describe('susunBendera', () => {
  it('tak menemukan apa-apa pada emiten bersih', () => {
    expect(susunBendera({
      riwayat: 'cukup', likuiditas: 'cukup', nLilin: 5487, bekuHari: 0,
      konsentrasi3: 0.31, porsiNego: 0.04, notasi: [], uma: false,
    })).toEqual([])
  })

  it('menyebut ANGKANYA, bukan cuma menyatakan ada masalah', () => {
    const [b] = susunBendera({ konsentrasi3: 0.72 })
    expect(b.kode).toBe('konsentrasi')
    expect(b.isi).toContain('72%')
  })

  it('mendahulukan penilaian bursa daripada hitungan sendiri', () => {
    // Notasi dan UMA datang dari otoritas; konsentrasi & nego dari kita.
    const out = susunBendera({
      notasi: ['B'], uma: true, konsentrasi3: 0.9, porsiNego: 0.9,
    })
    expect(out.slice(0, 2).map((x) => x.kode)).toEqual(['notasi', 'uma'])
  })

  it('membedakan likuiditas tipis dari tidur', () => {
    expect(susunBendera({ likuiditas: 'tipis' })[0].judul).toContain('tipis')
    expect(susunBendera({ likuiditas: 'tidur' })[0].judul).toContain('Nyaris')
  })

  it('menghormati ambangnya — tepat di ambang ikut, di bawahnya tidak', () => {
    expect(susunBendera({ konsentrasi3: AMBANG_KONSENTRASI })).toHaveLength(1)
    expect(susunBendera({ konsentrasi3: AMBANG_KONSENTRASI - 0.001 })).toHaveLength(0)
    expect(susunBendera({ porsiNego: AMBANG_NEGO })).toHaveLength(1)
    expect(susunBendera({ bekuHari: AMBANG_BEKU })).toHaveLength(1)
    expect(susunBendera({ bekuHari: AMBANG_BEKU - 1 })).toHaveLength(0)
  })

  it('riwayat pendek terdeteksi dari jumlah lilin walau labelnya bilang cukup', () => {
    // Label dan angka bisa tak sepakat; yang menentukan angkanya.
    const out = susunBendera({ riwayat: 'cukup', nLilin: MIN_LILIN - 1 })
    expect(out.map((x) => x.kode)).toContain('riwayat')
  })

  it('null dibedakan dari nol — tak tahu bukan berarti aman', () => {
    // Semua bahan tak tersedia: tak ada bendera, dan itu BUKAN klaim aman.
    expect(susunBendera({})).toEqual([])
    // Nol yang sungguhan juga tak menaikkan bendera.
    expect(susunBendera({ konsentrasi3: 0, porsiNego: 0, bekuHari: 0 })).toEqual([])
  })

  it('notasi kosong/spasi tak dihitung sebagai penanda', () => {
    expect(susunBendera({ notasi: ['', '  '] })).toEqual([])
  })

  it('meringkas aksi korporasi lebih dari tiga', () => {
    const aksi = Array.from({ length: 5 }, (_, i) => ({ tanggal: `2026-0${i + 1}-01`, jenis: 'pecah saham' }))
    const [b] = susunBendera({ aksiKorporasi: aksi })
    expect(b.isi).toContain('2 lainnya')
  })
})
