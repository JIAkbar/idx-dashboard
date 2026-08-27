import { describe, expect, it } from 'vitest'
import { cariHariResmiTerakhir, type TanggalIndex } from './dataHarian'

function t(iso: string, cadangan?: boolean): TanggalIndex {
  return { stem: iso, date_iso: iso, date_id: iso, date_raw: iso, ihsg: 0, ihsg_pct: 0, trading_day: 0, sumber: cadangan ? 'yahoo' : undefined }
}

describe('cariHariResmiTerakhir', () => {
  // Pola nyata 27 Agu 2026: index.json mencatat hari berjalan cuma dengan
  // `sumber:'yahoo'` (bukan `sementara`) — cadangan lampau yang tak pernah
  // tertimpa PDF resmi punya bentuk yang sama, jadi keduanya wajib tersaring.
  const daftar = [t('2026-08-24'), t('2026-08-25'), t('2026-08-26'), t('2026-08-27', true)]

  it('melewati hari cadangan (sumber yahoo), ambil hari resmi terakhir sebelum tanggal aktif', () => {
    expect(cariHariResmiTerakhir(daftar, '2026-08-27')?.date_iso).toBe('2026-08-26')
  })

  it('null kalau tak ada hari resmi sebelumnya', () => {
    expect(cariHariResmiTerakhir([t('2026-08-27', true)], '2026-08-27')).toBeNull()
  })
})
