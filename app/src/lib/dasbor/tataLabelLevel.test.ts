import { describe, expect, it } from 'vitest'
import { cariSlot, KolomLabel, type Band } from './tataLabelLevel'

const BATAS = { atas: 0, bawah: 400 }

describe('cariSlot', () => {
  it('membiarkan label di tempatnya kalau tak ada yang ditindih', () => {
    expect(cariSlot(100, 14, [], BATAS)).toBe(100)
    expect(cariSlot(100, 14, [{ y0: 200, y1: 214 }], BATAS)).toBe(100)
  })

  it('mendorong ke bawah pita yang ditindih, bukan sekadar menjauh sedikit', () => {
    // Mau di 100..114, pita terpakai 95..109 -> harus turun ke 109, bukan 110.
    expect(cariSlot(100, 14, [{ y0: 95, y1: 109 }], BATAS)).toBe(109)
  })

  it('menyelesaikan rantai pita berurutan dalam satu panggilan', () => {
    const terisi: Band[] = [
      { y0: 95, y1: 109 },
      { y0: 109, y1: 123 },
      { y0: 123, y1: 137 },
    ]
    expect(cariSlot(100, 14, terisi, BATAS)).toBe(137)
  })

  it('menyelesaikan rantai walau pitanya tak terurut', () => {
    const terisi: Band[] = [
      { y0: 123, y1: 137 },
      { y0: 95, y1: 109 },
      { y0: 109, y1: 123 },
    ]
    expect(cariSlot(100, 14, terisi, BATAS)).toBe(137)
  })

  it('berbalik NAIK kalau dorongan ke bawah keluar kanvas', () => {
    // Ini cacat penata lama: ia hanya mendorong ke bawah, jadi label di dasar
    // panel terdorong keluar layar dan hilang tanpa jejak.
    const terisi: Band[] = [{ y0: 388, y1: 400 }]
    const y = cariSlot(390, 14, terisi, BATAS)
    expect(y).toBe(374)
    expect(y + 14).toBeLessThanOrEqual(BATAS.bawah)
  })

  it('menjepit ke dalam kanvas kalau dua arah sama-sama buntu', () => {
    const sempit = { atas: 0, bawah: 20 }
    const y = cariSlot(5, 14, [{ y0: 0, y1: 20 }], sempit)
    expect(y).toBeGreaterThanOrEqual(sempit.atas)
    expect(y + 14).toBeLessThanOrEqual(sempit.bawah)
  })
})

describe('KolomLabel', () => {
  const tumpang = (a: { y: number; h: number }, b: { y: number; h: number }) =>
    a.y < b.y + b.h && b.y < a.y + a.h

  it('menjaga label DUA peserta berbeda tidak bertindih — inti #47', () => {
    const k = new KolomLabel()
    // Pivot menulis dulu (tiga level berdekatan), lalu RBS menulis di harga
    // yang hampir sama. Sebelum perbaikan, keduanya rapi sendiri-sendiri dan
    // tetap saling menimpa.
    k.mulai('pita-cpr')
    const pivot = [200, 206, 212].map((y) => ({ y: k.pesan(y, 14, BATAS), h: 14 }))
    k.mulai('rbs')
    const rbs = [203, 209].map((y) => ({ y: k.pesan(y, 14, BATAS), h: 14 }))

    const semua = [...pivot, ...rbs]
    for (let i = 0; i < semua.length; i++) {
      for (let j = i + 1; j < semua.length; j++) {
        expect(tumpang(semua[i], semua[j])).toBe(false)
      }
    }
  })

  it('membersihkan pita begitu peserta yang sama menyetor lagi (frame baru)', () => {
    const k = new KolomLabel()
    k.mulai('pita-cpr')
    const frame1 = k.pesan(100, 14, BATAS)
    k.mulai('rbs')
    k.pesan(100, 14, BATAS)

    k.mulai('pita-cpr')
    const frame2 = k.pesan(100, 14, BATAS)
    // Tanpa pembersihan, frame kedua akan menumpuk terus dan label merayap
    // turun tiap frame sampai keluar layar.
    expect(frame2).toBe(frame1)
  })

  it('tetap benar kalau hanya satu peserta yang menggambar', () => {
    const k = new KolomLabel()
    for (let frame = 0; frame < 5; frame++) {
      k.mulai('avg-broker')
      expect(k.pesan(150, 14, BATAS)).toBe(150)
    }
  })
})
