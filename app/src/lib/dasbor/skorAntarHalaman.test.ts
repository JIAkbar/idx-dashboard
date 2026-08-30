/**
 * Penjaga untuk skor yang dilihat PEMBACA — bukan untuk salinan rumus.
 *
 * ## Kenapa uji ini ada
 *
 * `skorTeknikal.crossCheck.test.mjs` sudah membandingkan `skor.mjs` dengan
 * `skorTeknikal.ts` dan menuntut hasilnya identik. Ia hijau selamanya, dan itu
 * benar — keduanya memang dua salinan aturan yang SAMA (`[10,20,30,50,100,200]`).
 *
 * Yang tak dibandingkan siapa pun sampai 30 Agu 2026: konstanta KETIGA dan
 * KEEMPAT. Repo menyimpan empat daftar periode rata-rata bergerak, dua pasang:
 *
 *   Screener       skorTeknikal.ts:176        [10, 20, 30, 50, 100, 200]
 *                  scripts/lib/skor.mjs:127   [10, 20, 30, 50, 100, 200]  ← dijaga crossCheck
 *   Harian Papan   harianPapan.ts:46          [ 5, 10, 20, 50, 100, 200]
 *                  scripts/bangun-harian-papan.mjs:73  idem               ← tak berpenjaga
 *
 * Jadi penjaga yang ada menjaga pasangan yang tak pernah menyimpang, sementara
 * pasangan yang benar-benar memberi pembaca dua jawaban tak punya penjaga sama
 * sekali. Bentuk kegagalan yang sama dengan alat ukur yang menguji hal yang
 * bukan persoalannya.
 *
 * ## Bedanya bukan satu baris
 *
 * Daftar periode itu cuma sumbu PERTAMA. Uji negatif 30 Agu 2026 — menyamakan
 * periode Harian Papan dengan Screener lalu menjalankan uji ini — membuktikan
 * keduanya TETAP berbeda, jadi dugaan "bedanya satu baris" salah. Rumusnya
 * memang dua, berbeda di lima tempat:
 *
 *   1. periode MA      10·20·30·50·100·200   vs  5·10·20·50·100·200
 *   2. osilator        6 (RSI, Stoch, Williams %R, CCI, MACD, Momentum 10H)
 *                      vs 4 (tanpa Williams %R dan tanpa Momentum)
 *   3. ambang RSI      30/70                 vs  40/60
 *   4. MACD            garis vs sinyal       vs  garis vs nol
 *   5. pembobotan      rata SELURUH komponen vs  (rataMA + rataOsilator) / 2
 *                      → MA berbobot 12/18       → MA berbobot 1/2
 *
 * Akibatnya BBCA pada 28 Agu 2026 bernilai 0,2778 (“Buy”) di Screener dan
 * 0,7083 (“Strong Buy”) di Harian Papan. Terukur atas 961 emiten: skor harian
 * beda 325, pekanan 383, bulanan 470.
 *
 * Karena itu “satu konstanta, satu rumah” TIDAK cukup saat peleburan. Yang
 * perlu disatukan fungsinya, dan Johan yang memilih rumus mana yang menang —
 * memilih salah satu mengubah label yang sudah tayang di halaman yang kalah.
 *
 * ## Yang dijaga di sini
 *
 * 1. Salinan Harian Papan (TS ↔ mjs) wajib sepakat — lubang yang tadinya
 *    terbuka. Dibaca sebagai TEKS, bukan lewat impor: mengimpor
 *    `bangun-harian-papan.mjs` menjalankan pembangunan penuh dan menulis ke
 *    cakram, jadi impor bukan pilihan.
 * 2. Divergensi ANTAR-HALAMAN dikunci sebagai keadaan yang disengaja-sementara.
 *    Uji ini hijau hari ini justru karena keduanya berbeda. Ia berubah merah
 *    kalau ada yang menyamakan konstantanya diam-diam — dan itu memang harus
 *    berhenti dulu di meja Johan, karena menyamakannya mengubah label yang
 *    sudah tayang di salah satu halaman (klausul 3b CLAUDE.md).
 *
 * 3. Bentuk kedua rumus dikunci — jumlah dan nama komponennya. Menyamakan
 *    daftar periode saja tidak menyatukan keduanya, dan uji ini yang
 *    mengatakannya sebelum seseorang mengira pekerjaannya selesai.
 *
 * ## Saat peleburan Screener + Harian Papan dikerjakan
 *
 * Balik uji nomor 2 & 3 jadi menuntut kesamaan, dan jadikan skornya SATU
 * fungsi yang dipanggil kedua sisi — bukan dua yang "kebetulan disamakan",
 * karena yang kebetulan sama akan menyimpang lagi.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { skorTigaKerangka, skorTeknikal } from './skorTeknikal'
import { PERIODE_SKOR_PAPAN, skorPapan, skorPapanTigaKerangka } from './harianPapan'
import type { BarisOhlc } from './skorTeknikal'

const AKAR = join(__dirname, '..', '..', '..', '..')
const DIR_OHLC = join(AKAR, 'data-idx', 'json', 'ohlc')
const PEMBANGUN = join(AKAR, 'app', 'scripts', 'bangun-harian-papan.mjs')

/** Sampel deterministik, pola sama dengan crossCheck: tiap emiten ke-23. */
function sampelEmiten(): string[] {
  const semua = readdirSync(DIR_OHLC)
    .filter((f) => f.endsWith('.json') && !f.startsWith('_') && f !== 'IHSG.json')
    .sort()
  return semua.filter((_, i) => i % 23 === 0)
}

function bacaBaris(file: string): BarisOhlc[] {
  const d = JSON.parse(readFileSync(join(DIR_OHLC, file), 'utf8'))
  return Array.isArray(d.d) ? (d.d as BarisOhlc[]) : []
}

describe('salinan periode Harian Papan — TS vs skrip pembangun', () => {
  it('kedua salinan menyebut daftar periode yang sama persis', () => {
    const sumber = readFileSync(PEMBANGUN, 'utf8')
    const cocok = sumber.match(/PERIODE_SKOR_PAPAN\s*=\s*\[([^\]]+)\]/)
    expect(cocok, 'PERIODE_SKOR_PAPAN tak ditemukan di bangun-harian-papan.mjs').toBeTruthy()
    const dariSkrip = cocok![1].split(',').map((x) => Number(x.trim()))
    expect(dariSkrip).toEqual([...PERIODE_SKOR_PAPAN])
  })
})

describe('skor yang dilihat pembaca — Screener vs Harian Papan', () => {
  const sampel = sampelEmiten()

  it(`sampel mencakup >=30 emiten (dapat ${sampel.length})`, () => {
    expect(sampel.length).toBeGreaterThanOrEqual(30)
  })

  it('KEADAAN SEKARANG: dua halaman memberi label berbeda untuk sebagian emiten', () => {
    let diperiksa = 0
    let berbeda = 0
    const contoh: string[] = []

    for (const file of sampel) {
      const baris = bacaBaris(file)
      if (baris.length < 250) continue
      const sc = skorTigaKerangka(baris)
      const hp = skorPapanTigaKerangka(baris)
      diperiksa++
      const label = (x: { label?: string } | null | undefined) => x?.label ?? null
      // Kerangka yang BENAR-BENAR berbeda ikut dicetak. Versi pertama selalu
      // mencetak kerangka harian, jadi emiten yang bedanya di pekanan tampil
      // sebagai "Strong Buy / Strong Buy" — penanda yang menyanggah dirinya
      // sendiri, persis cacat yang uji ini dibuat untuk mengejar.
      const kerangka = (['harian', 'pekanan', 'bulanan'] as const).filter(
        (k) => label(sc[k]) !== label(hp[k]),
      )
      if (kerangka.length > 0) {
        berbeda++
        if (contoh.length < 3) {
          const k = kerangka[0]
          contoh.push(
            `${file.replace(/\.json$/, '')} (${k}): Screener ${label(sc[k])} / Harian Papan ${label(hp[k])}`,
          )
        }
      }
    }

    expect(diperiksa, 'tak ada emiten berlilin cukup untuk diperiksa').toBeGreaterThanOrEqual(20)
    // Sengaja `toBeGreaterThan(0)`, bukan `toEqual`. Uji ini MENCATAT bahwa
    // dua halaman belum sepakat, bukan merestuinya. Kalau ia merah, berarti
    // seseorang menyamakan periodenya — berhenti dan baca komentar kepala
    // berkas ini sebelum melanjutkan: penyamaan mengubah label yang sudah
    // tayang, dan itu keputusan Johan.
    expect(
      berbeda,
      `Screener & Harian Papan kini SEPAKAT di ${diperiksa} emiten sampel. ` +
        'Kalau itu disengaja (peleburan sudah dikerjakan), balik uji ini jadi ' +
        'menuntut kesamaan dan jadikan periodenya satu ekspor bersama.',
    ).toBeGreaterThan(0)

    // Dicetak supaya angkanya terlihat tiap uji jalan — divergensi yang tak
    // pernah disebut akan dilupakan.
    console.log(
      `[skor antar-halaman] ${berbeda}/${diperiksa} emiten sampel dinilai berbeda · ${contoh.join(' · ')}`,
    )
  })

  it('bedanya bukan karena salah satu sisi kosong — keduanya menghasilkan label', () => {
    const baris = bacaBaris(sampel.find((f) => bacaBaris(f).length >= 250)!)
    const sc = skorTigaKerangka(baris)
    const hp = skorPapanTigaKerangka(baris)
    expect(sc.harian?.label).toBeTruthy()
    expect(hp.harian?.label).toBeTruthy()
  })

  it('kedua rumus berbeda BENTUK, bukan cuma daftar periodenya', () => {
    // Penjaga terhadap kesimpulan yang terlalu cepat. Dugaan pertama 30 Agu
    // 2026 adalah "bedanya satu baris — daftar periode MA". Uji negatif
    // menjatuhkannya: periode disamakan, hasilnya tetap berbeda. Kalau nanti
    // ada yang menyamakan periodenya lalu mengira peleburan selesai, uji ini
    // yang memberitahu bahwa masih ada empat sumbu lagi.
    const baris = bacaBaris(sampel.find((f) => bacaBaris(f).length >= 250)!)
    const sc = skorTeknikal(baris)!
    const hp = skorPapan(baris)!
    const nama = (x: { komponen: { nama: string }[] }) => x.komponen.map((k) => k.nama)

    // Screener menimbang enam osilator, Harian Papan empat.
    expect(nama(sc)).toContain('Williams %R')
    expect(nama(hp)).not.toContain('Williams %R')
    expect(nama(sc).some((n) => n.startsWith('Momentum'))).toBe(true)
    expect(nama(hp).some((n) => n.startsWith('Momentum'))).toBe(false)

    // Dan menimbangnya dengan bobot berbeda: Screener merata-rata SELURUH
    // komponen (MA jadi 12 dari 18), Harian Papan merata-rata dua kelompok
    // lebih dulu (MA jadi separuh, berapa pun jumlahnya).
    expect(sc.skor).toBeCloseTo(
      sc.komponen.reduce((a, k) => a + k.bias, 0) / sc.komponen.length,
      10,
    )
    expect(hp.skor).toBeCloseTo((hp.ma + hp.osilator) / 2, 10)
  })
})
