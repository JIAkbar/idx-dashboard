import { describe, expect, it } from 'vitest'
import { bandingkanBaris } from './useUrut'

describe('bandingkanBaris', () => {
  it('membandingkan angka secara numerik, turun', () => {
    expect(bandingkanBaris({ nilai: 3 }, { nilai: 1 }, 'nilai', 'turun')).toBeLessThan(0)
  })

  it('membalik urutan saat arah naik', () => {
    expect(bandingkanBaris({ nilai: 3 }, { nilai: 1 }, 'nilai', 'naik')).toBeGreaterThan(0)
  })

  it('membandingkan teks dengan localeCompare id, bukan urutan byte', () => {
    // 'Zebra' < 'apel' secara byte (Z=90 < a=97), tapi salah secara alfabet id-ID
    const hasil = bandingkanBaris({ nama: 'apel' }, { nama: 'Zebra' }, 'nama', 'turun')
    expect(hasil).toBeGreaterThan(0) // turun: apel setelah Zebra
  })
})
