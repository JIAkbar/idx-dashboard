import { afterEach, describe, expect, it, vi } from 'vitest'
import { bukaBerikutnya, cariHariAdjacent, sesiAktifPada, sesiUntukHari, todayIsoJakarta } from './Kalender'

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
  it('Pra-Penutupan dan Pasca-Penutupan terpisah, bukan digabung "P"', () => {
    const labels = sesiUntukHari(false).map(([lbl]) => lbl)
    expect(labels).toContain('Pra-Penutupan')
    expect(labels).toContain('Pasca-Penutupan')
    expect(labels).not.toContain('P')
  })

  it('Jumat tetap punya Pasca-Penutupan sampai 16:15 (bug lama: berhenti 16:00)', () => {
    const sessions = sesiUntukHari(true)
    const pasca = sessions.find(([lbl]) => lbl === 'Pasca-Penutupan')
    expect(pasca).toEqual(['Pasca-Penutupan', 16 * 60 + 2, 16 * 60 + 15, expect.any(String)])
  })

  it('Sesi I Jumat berakhir 11:30, non-Jumat 12:00', () => {
    expect(sesiUntukHari(true).find(([lbl]) => lbl === 'Sesi I')?.[2]).toBe(11 * 60 + 30)
    expect(sesiUntukHari(false).find(([lbl]) => lbl === 'Sesi I')?.[2]).toBe(12 * 60)
  })

  it('batas segmen kontigu 08:45→16:15 (bar bersegmen digambar tanpa celah)', () => {
    for (const isFri of [false, true]) {
      const s = sesiUntukHari(isFri)
      expect(s[0][1]).toBe(8 * 60 + 45)
      expect(s[s.length - 1][2]).toBe(16 * 60 + 15)
      for (let i = 1; i < s.length; i++) expect(s[i][1]).toBe(s[i - 1][2])
    }
  })
})

describe('sesiAktifPada', () => {
  it('15:50 masuk Pra-Penutupan', () => {
    expect(sesiAktifPada(15 * 60 + 50, false, false)?.[0]).toBe('Pra-Penutupan')
  })

  it('16:01 masih Pra-Penutupan (matching s.d. 16:01:59 — koreksi jam resmi)', () => {
    expect(sesiAktifPada(16 * 60 + 1, false, false)?.[0]).toBe('Pra-Penutupan')
  })

  it('16:02 masuk Pasca-Penutupan (dulu salah mulai 16:01)', () => {
    expect(sesiAktifPada(16 * 60 + 2, false, false)?.[0]).toBe('Pasca-Penutupan')
  })

  it('akhir pekan selalu tutup, tidak dicek jam', () => {
    expect(sesiAktifPada(10 * 60, false, true)).toBeUndefined()
  })

  it('di luar jam bursa (malam & 16:15 tepat) tidak ada sesi aktif', () => {
    expect(sesiAktifPada(20 * 60, false, false)).toBeUndefined()
    expect(sesiAktifPada(16 * 60 + 15, false, false)).toBeUndefined()
  })
})

describe('bukaBerikutnya (feedback #2 — info statis saat bursa tutup)', () => {
  // Catatan: cuma weekend yang dilewati; libur nasional tidak terdeteksi.
  it('Rabu malam → Kamis 08:45', () => {
    expect(bukaBerikutnya(new Date('2026-08-12T20:00:00'))).toBe('Kamis 08:45')
  })

  it('Jumat malam & Sabtu → Senin 08:45 (lewati akhir pekan)', () => {
    expect(bukaBerikutnya(new Date('2026-08-14T17:00:00'))).toBe('Senin 08:45')
    expect(bukaBerikutnya(new Date('2026-08-15T10:00:00'))).toBe('Senin 08:45')
  })

  it('hari kerja sebelum 08:45 → buka hari itu juga', () => {
    expect(bukaBerikutnya(new Date('2026-08-12T07:00:00'))).toBe('Rabu 08:45')
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
