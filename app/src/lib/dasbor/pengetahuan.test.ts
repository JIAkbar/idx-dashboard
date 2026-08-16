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

/**
 * Baterai cakupan RONDE 2 — 16 Agu 2026, dipicu laporan Johan: pengunjung
 * mengetik "benefit nya" (maksudnya keuntungan jadi kontributor) dan dijawab
 * "Belum bisa saya jawab". Diukur lewat 70 pertanyaan wajar di
 * `docs/riset/cakupan-tanya-papan.md`: **25 gagal (36%)**, dua di antaranya
 * MEMANG seharusnya gagal (di luar cakupan PAPAN). Jadi 23 lubang nyata —
 * sebagian besar entrinya sudah ada (kredit, sumber data, halaman menu),
 * cuma kuncinya belum menjangkau kata yang benar-benar diketik orang; tiga
 * topik (manfaat kontributor, privasi, kesegaran data) belum punya entri
 * sama sekali. Sesudah perbaikan: 0 lubang nyata, dua di luar cakupan tetap
 * null sesuai desain.
 */
describe('cariPengetahuan — baterai cakupan ronde 2 (laporan "benefit nya")', () => {
  const WAJIB2: Array<[string, string]> = [
    ['benefit nya', 'manfaat-kontributor'],
    ['apa untungnya jadi kontributor', 'manfaat-kontributor'],
    ['keuntungan kontributor apa', 'manfaat-kontributor'],
    ['kewajiban kontributor apa saja', 'cara-jadi-kontributor'],
    ['siapa yang bisa lihat setoran saya', 'privasi-kontributor'],
    ['identitas kontributor lain kelihatan tidak', 'privasi-kontributor'],
    ['data ini update jam berapa', 'kesegaran-data'],
    ['kenapa data hari ini belum ada', 'kesegaran-data'],
    ['nama saya muncul di edisi tidak', 'kredit-setoran'],
    ['broker paling aktif halaman mana', 'halaman-top-broker'],
    ['forum buat apa', 'halaman-forum'],
    ['kritik saran kirim kemana', 'halaman-feedback'],
    ['apa itu saham gorengan', 'bukan-saran-investasi'],
    ['prediksi ihsg minggu depan gimana', 'bukan-saran-investasi'],
    ['laporan keuangan dari mana', 'sumber-data'],
    ['kenapa harga buka kosong', 'sumber-data-peran'],
  ]

  it.each(WAJIB2)('“%s” dijawab entri %s', (tanya, id) => {
    expect(cariPengetahuan(tanya)?.id).toBe(id)
  })

  it('pertanyaan umum lain ronde 2 tetap terjawab', () => {
    const lain = [
      'apa itu papan', 'papan itu situs apa', 'papan gratis atau berbayar',
      'bedanya papan dengan aplikasi lain', 'apa yang bisa kamu jawab',
      'benefit nya jadi kontributor apa',
      'cara jadi kontributor gimana', 'kenapa akun saya dibekukan',
      'akun saya beku kenapa', 'berapa lama akun bisa nonaktif otomatis',
      'kuota setoran harian berapa', 'cara naik jenjang gimana',
      'jenjang kontributor apa saja',
      'kredit saya ikut yang mana kalau tidak dimuat',
      'cara hitung akurasi kontributor gimana', 'setoran saya direvisi kenapa',
      'data saya disimpan buat apa', 'privasi kontributor gimana',
      'email saya aman tidak', 'data pribadi saya dipakai buat apa',
      'seberapa baru datanya', 'data terakhir diperbarui kapan',
      'data real time tidak', 'kenapa data kemarin belum update',
      'apa isi halaman indeks dunia', 'gimana cara baca top stocks',
      'apa itu sektor dan indeks', 'cara baca chart gimana', 'stock detail isinya apa',
      'peta investor buat lihat apa', 'apa itu broker summary',
      'kalkulator bisa apa aja', 'apa isi radar watchlist',
      'kabar pasar dari mana', 'bulletin terbit kapan',
      'apa itu ihsg', 'pbv itu apa', 'net foreign itu apa',
      'market cap itu apa', 'frekuensi saham itu apa', 'apa itu hari bursa',
      'fraksi harga itu apa', 'ara arb itu apa', 'apa itu broker summary bukan orderbook',
      'saham apa yang bagus dibeli', 'rekomendasi saham hari ini apa',
      'ramalan harga besok naik atau turun',
      'data pasar diambil dari mana', 'pakai data yahoo finance kapan',
      'lupa password gimana', 'cara login', 'akun saya kena kunci gimana buka lagi',
    ]
    const gagal = lain.filter((q) => cariPengetahuan(q) === null)
    expect(gagal).toEqual([])
  })

  it('pertanyaan di luar cakupan ronde 2 TETAP null', () => {
    expect(cariPengetahuan('skor bola tadi malam berapa')).toBeNull()
    expect(cariPengetahuan('resep mie goreng gimana')).toBeNull()
  })
})
