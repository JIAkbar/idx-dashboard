import { afterEach, describe, expect, it, vi } from 'vitest'
import { cariHariAdjacent, sesiAktifPada, sesiUntukHari, todayIsoJakarta } from './Kalender'

const tanggal = [
  { stem: 'ds_260107', date_iso: '2026-01-07', date_id: '', date_raw: '', ihsg: 8000, ihsg_pct: 0.1, trading_day: 4 },
  { stem: 'ds_260108', date_iso: '2026-01-08', date_id: '', date_raw: '', ihsg: 8100, ihsg_pct: 1.2, trading_day: 5 },
  { stem: 'ds_260109', date_iso: '2026-01-09', date_id: '', date_raw: '', ihsg: 8050, ihsg_pct: -0.6, trading_day: 6 },
]

afterEach(() => {
  vi.useRealTimers()
})

describe('todayIsoJakarta (#22)', () => {
  it('pakai tanggal WIB, bukan tanggal UTC yang belum ganti hari', () => {
    // 2026-01-09 02:00 UTC = 2026-01-09 09:00 WIB — kedua zona masih sama hari, belum ngetes bug-nya.
    // Kasus nyata: 2026-01-09 00:30 UTC = 2026-01-09 07:30 WIB, keduanya "09" juga.
    // Kasus yg dulu salah: WIB sudah tgl 9 jam 02:00 pagi, UTC MASIH tgl 8 jam 19:00.
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-01-08T19:00:00Z')) // = 2026-01-09T02:00:00+07:00
    expect(todayIsoJakarta()).toBe('2026-01-09')
  })
})

describe('sesiUntukHari (#30)', () => {
  it('Pre-Closing dan Post-Closing terpisah, bukan digabung "P"', () => {
    const labels = sesiUntukHari(false).map(([lbl]) => lbl)
    expect(labels).toContain('Pre-Closing')
    expect(labels).toContain('Post-Closing')
    expect(labels).not.toContain('P')
  })

  it('Jumat tetap punya Post-Closing sampai 16:15 (bug lama: berhenti 16:00)', () => {
    const sessions = sesiUntukHari(true)
    const postClosing = sessions.find(([lbl]) => lbl === 'Post-Closing')
    expect(postClosing).toEqual(['Post-Closing', 16 * 60 + 1, 16 * 60 + 15, expect.any(String)])
  })

  it('Sesi II Jumat berakhir 11:30, non-Jumat 12:00', () => {
    expect(sesiUntukHari(true).find(([lbl]) => lbl === 'Sesi I')?.[2]).toBe(11 * 60 + 30)
    expect(sesiUntukHari(false).find(([lbl]) => lbl === 'Sesi I')?.[2]).toBe(12 * 60)
  })
})

describe('sesiAktifPada', () => {
  it('15:50 masuk Pre-Closing', () => {
    expect(sesiAktifPada(15 * 60 + 50, false, false)?.[0]).toBe('Pre-Closing')
  })

  it('16:01 masuk Post-Closing', () => {
    expect(sesiAktifPada(16 * 60 + 1, false, false)?.[0]).toBe('Post-Closing')
  })

  it('akhir pekan selalu tutup, tidak dicek jam', () => {
    expect(sesiAktifPada(10 * 60, false, true)).toBeUndefined()
  })

  it('di luar jam bursa (malam) tidak ada sesi aktif', () => {
    expect(sesiAktifPada(20 * 60, false, false)).toBeUndefined()
  })
})

describe('cariHariAdjacent (#26)', () => {
  it('ambil hari bursa sebelum/sesudah tanggal aktif', () => {
    expect(cariHariAdjacent(tanggal, '2026-01-08')).toEqual({ sebelum: tanggal[0], sesudah: tanggal[2] })
  })

  it('null di ujung awal/akhir daftar', () => {
    expect(cariHariAdjacent(tanggal, '2026-01-07').sebelum).toBeNull()
    expect(cariHariAdjacent(tanggal, '2026-01-09').sesudah).toBeNull()
  })

  it('null kalau tanggal aktif belum ada / tidak ditemukan', () => {
    expect(cariHariAdjacent(tanggal, null)).toEqual({ sebelum: null, sesudah: null })
    expect(cariHariAdjacent(tanggal, '2099-01-01')).toEqual({ sebelum: null, sesudah: null })
  })
})
