import { describe, expect, it } from 'vitest'
import { ringkasanJenjang, type JenjangRow } from './jenjang'

// Isi tabel `jenjang` sungguhan (lihat spek Fase 6).
const JENJANG: JenjangRow[] = [
  { tier: 0, nama: 'Pemula', min_disetujui: 0, min_akurasi: null, kuota: 1, hak: null },
  { tier: 1, nama: 'Perunggu', min_disetujui: 10, min_akurasi: 70, kuota: 2, hak: null },
  { tier: 2, nama: 'Perak', min_disetujui: 30, min_akurasi: 75, kuota: 3, hak: null },
  { tier: 3, nama: 'Emas', min_disetujui: 75, min_akurasi: 80, kuota: 5, hak: null },
  { tier: 4, nama: 'Platinum', min_disetujui: 150, min_akurasi: 85, kuota: 8, hak: null },
  { tier: 5, nama: 'Diamond', min_disetujui: 300, min_akurasi: 90, kuota: 12, hak: null },
]

describe('ringkasanJenjang', () => {
  it('0 setoran, tier Pemula -> 10 lagi menuju Perunggu, akurasi belum cukup (belum ada data)', () => {
    const r = ringkasanJenjang(0, null, 0, 0, JENJANG)
    expect(r.jenjangSaatIni.nama).toBe('Pemula')
    expect(r.kuotaEfektif).toBe(1)
    expect(r.akurasiPersen).toBeNull()
    expect(r.berikutnya?.nama).toBe('Perunggu')
    expect(r.kurangSetoran).toBe(10)
    expect(r.akurasiCukup).toBe(false)
  })

  it('12 disetujui akurasi 70%, tier Perunggu -> 18 lagi menuju Perak, akurasi belum cukup (butuh 75%)', () => {
    // 12 dari 12 disetujui = akurasi 100% kalau ditolak=0, jadi pakai ditolak
    // yang menghasilkan akurasi persis 70% (12 disetujui dari 17,14... —
    // dibulatkan lewat disetujui/ditolak integer terdekat: 14/6 = 70%).
    const r = ringkasanJenjang(1, null, 14, 6, JENJANG)
    expect(r.jenjangSaatIni.nama).toBe('Perunggu')
    expect(r.akurasiPersen).toBe(70)
    expect(r.berikutnya?.nama).toBe('Perak')
    expect(r.kurangSetoran).toBe(16) // 30 - 14
    expect(r.akurasiCukup).toBe(false)
  })

  it('40 disetujui akurasi 60%, tier tetap Pemula (akurasi menahan naik walau volume lewat) -> 0 kurang setoran tapi akurasi belum cukup', () => {
    // 40 disetujui, ditolak sehingga akurasi 60%: 40/(40+ditolak)=0.6 -> ditolak≈26.67, pakai 40/66.67 dibulatkan via disetujui=60,ditolak=40 (60%).
    const r = ringkasanJenjang(0, null, 60, 40, JENJANG)
    expect(r.jenjangSaatIni.nama).toBe('Pemula')
    expect(r.akurasiPersen).toBe(60)
    expect(r.berikutnya?.nama).toBe('Perunggu')
    expect(r.kurangSetoran).toBe(0) // 60 >= 10, volume sudah lewat syarat
    expect(r.akurasiCukup).toBe(false) // 60% < 70% yang disyaratkan
  })

  it('kuota_manual override kuota jenjang', () => {
    const r = ringkasanJenjang(1, 5, 14, 6, JENJANG)
    expect(r.kuotaEfektif).toBe(5)
  })

  it('tier tertinggi (Diamond) -> tak ada jenjang berikutnya', () => {
    const r = ringkasanJenjang(5, null, 500, 10, JENJANG)
    expect(r.berikutnya).toBeNull()
    expect(r.kurangSetoran).toBe(0)
    expect(r.akurasiCukup).toBe(true)
  })
})
