import { describe, expect, it } from 'vitest'
import { cariPengetahuan, PENGETAHUAN } from './pengetahuan'

describe('cariPengetahuan', () => {
  it('menjawab fraksi harga', () => {
    const e = cariPengetahuan('berapa fraksi harga saham di bawah 200?')
    expect(e?.id).toBe('fraksi-harga')
    expect(e?.isi).toContain('Rp1')
  })

  it('menjawab ARA/ARB dengan angka yang cocok dengan lib/fraksiHarga.ts', () => {
    const e = cariPengetahuan('berapa batas ARA hari ini')
    expect(e?.id).toBe('auto-rejection')
    expect(e?.isi).toContain('35%')
  })

  it('menjawab apa itu top stocks', () => {
    const e = cariPengetahuan('apa itu top stocks')
    expect(e?.id).toBe('halaman-top-stocks')
    expect(e?.ke).toBe('/stocks')
  })

  it('menjawab istilah broker summary, bukan orderbook', () => {
    const e = cariPengetahuan('kenapa disebut orderbook')
    expect(e?.id).toBe('istilah-broker-summary')
    expect(e?.isi).toContain('bukan')
  })

  it('menjawab kebijakan kredit kontributor', () => {
    const e = cariPengetahuan('kredit kontributor ikut yang mana kalau tidak dimuat edisi')
    expect(e?.id).toBe('kredit-setoran')
  })

  it('pertanyaan di luar topik mengembalikan null, bukan tebakan', () => {
    expect(cariPengetahuan('siapa presiden indonesia sekarang')).toBeNull()
  })

  it('pertanyaan kosong mengembalikan null', () => {
    expect(cariPengetahuan('   ')).toBeNull()
  })

  it('kata kunci tumpang tindih — "apa itu seasonality" menang ke entri HALAMAN (kecocokan lebih banyak)', () => {
    const e = cariPengetahuan('apa itu seasonality')
    expect(e?.id).toBe('halaman-seasonality')
  })

  it('kata kunci tumpang tindih — "pola musiman itu apa" menang ke entri ISTILAH, bukan halaman', () => {
    const e = cariPengetahuan('pola musiman itu apa maksudnya')
    expect(e?.id).toBe('istilah-seasonality')
  })

  it('tiap entri wajib punya kunci, judul, dan isi tak kosong', () => {
    for (const entri of PENGETAHUAN) {
      expect(entri.kunci.length).toBeGreaterThan(0)
      expect(entri.judul.trim().length).toBeGreaterThan(0)
      expect(entri.isi.trim().length).toBeGreaterThan(0)
    }
  })

  it('id tiap entri unik', () => {
    const ids = PENGETAHUAN.map((e) => e.id)
    expect(new Set(ids).size).toBe(ids.length)
  })
})

/**
 * Baterai cakupan — 20 pertanyaan yang wajar diketik pengunjung, dicoba
 * langsung di panel Tanya PAPAN 16 Agu 2026. Waktu itu **sembilan gagal
 * (45%)**, dan sebagian besar entrinya SUDAH ADA — cuma kuncinya terlalu
 * sempit sehingga tak pernah tersentuh.
 *
 * Ditulis sebagai tes supaya cakupannya TERUKUR, bukan dirasakan: menambah
 * entri baru gampang, yang sulit adalah tahu mana yang belum terjawab.
 * Tiap pertanyaan yang pernah gagal masuk sini permanen.
 */
describe('cariPengetahuan — baterai cakupan pertanyaan pengunjung', () => {
  const WAJIB: Array<[string, string]> = [
    ['apa itu PAPAN', 'tentang-papan'],
    ['PAPAN gratis atau bayar', 'biaya-papan'],
    ['bagaimana cara jadi kontributor', 'cara-jadi-kontributor'],
    ['kalkulator bisa apa saja', 'halaman-kalkulator'],
    ['data PAPAN dari mana', 'sumber-data'],
    ['kenapa data broker cuma sebagian emiten', 'broker-sebagian-emiten'],
    ['saham apa yang layak dibeli', 'bukan-saran-investasi'],
    ['bagaimana PAPAN menghitung akurasi kontributor', 'hitung-akurasi'],
    ['apa itu papan pencatatan', 'papan-pencatatan'],
  ]

  it.each(WAJIB)('“%s” dijawab entri %s', (tanya, id) => {
    expect(cariPengetahuan(tanya)?.id).toBe(id)
  })

  it('pertanyaan umum lain tetap terjawab — bukan sekadar yang dites di atas', () => {
    const lain = ['apa itu ARA', 'kuota setoran harian berapa', 'halaman radar isinya apa',
      'seasonality itu apa', 'bulletin terbit kapan', 'bedanya PAPAN dengan RTI']
    const gagal = lain.filter((q) => cariPengetahuan(q) === null)
    expect(gagal).toEqual([])
  })

  it('pertanyaan di luar cakupan TETAP dijawab null — jangan dipaksa cocok', () => {
    // Ambang keterbukaan kunci punya batas: kalau apa pun ikut cocok, jawaban
    // yang salah akan terasa seperti jawaban yang benar.
    expect(cariPengetahuan('resep rendang padang')).toBeNull()
    expect(cariPengetahuan('cuaca besok hujan tidak')).toBeNull()
  })
})
