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
 * ## Bedanya bukan satu baris — dan sebagian besar memang DISENGAJA
 *
 * Dugaan pertama 30 Agu 2026: "bedanya satu baris, daftar periode MA".
 * Dijatuhkan uji negatif — periode disamakan, hasilnya tetap berbeda.
 *
 * Dugaan kedua, yang sempat ditulis di sini: "lima sumbu yang menyimpang".
 * Itu juga salah, dan lebih berbahaya karena terdengar seperti temuan.
 * Kepala `harianPapan.ts:23-42` sudah menjelaskan tiga di antaranya sebagai
 * keputusan, verbatim: *"beda di tiga hal, dan ketiganya SENGAJA"*.
 *
 *   periode MA          SENGAJA   harianPapan.ts:29 + spek §Skor Papan
 *   arah osilator       SENGAJA   momentum, bukan kontrarian — benchmark 83
 *                                 label menunjukkan Strong Buy berkorelasi
 *                                 RSI≈73 (TINGGI), jadi arah TradingView
 *                                 dibalik dengan sengaja
 *   pembobotan skor     SENGAJA   50/50 dua kelompok, eksplisit "BUKAN
 *                                 rata-rata rata seluruh 16 komponen"
 *
 * Keduanya bahkan bernama berbeda di layar — Screener memajang "SSS D/W/M",
 * Harian Papan memajang "Skor Papan", dan speknya melarang memakai nama SSS
 * untuk yang kedua. Jadi BBCA "Buy di satu halaman, Strong Buy di halaman
 * lain" bukan kontradiksi: itu dua indikator berbeda yang berselisih, yang
 * memang dilakukan indikator berbeda.
 *
 * Yang tersisa sebagai cacat nyata cuma soal STRUKTUR, dan itu yang dijaga
 * berkas ini: empat salinan konstanta tanpa satu pun pengikat, dan pasangan
 * Harian Papan yang tak punya uji silang sama sekali.
 *
 * ## Yang dijaga di sini
 *
 * 1. (pindah) Salinan Harian Papan TS ↔ mjs kini dijaga uji silang sungguhan
 *    di `app/scripts/lib/skorPapan.crossCheck.test.mjs` — membandingkan
 *    KELUARANNYA pada data nyata, bukan teks konstantanya. Itu bisa ditulis
 *    setelah rumusnya dipindah ke `lib/skorPapan.mjs`, modul tanpa efek
 *    samping; selama ia tinggal di dalam skrip pembangun, mengimpornya berarti
 *    menjalankan pembangunan penuh dan menulis ke cakram.
 * 2. Perbedaan ANTAR-HALAMAN dikunci sebagai keputusan, bukan sebagai cacat.
 *    Uji ini hijau justru karena keduanya berbeda, dan merah kalau ada yang
 *    "merapikannya" jadi satu — termasuk aku, tiga jam sebelum komentar ini
 *    ditulis. Menyamakannya berarti membuang Skor Papan beserta kalibrasi 83
 *    labelnya, dan itu keputusan Johan (klausul 3b CLAUDE.md).
 *
 * 3. Bentuk kedua rumus dikunci — jumlah dan nama komponennya. Menyamakan
 *    daftar periode saja tidak menyatukan keduanya, dan uji ini yang
 *    mengatakannya sebelum seseorang mengira pekerjaannya selesai.
 *
 * ## Kalau Screener + Harian Papan dilebur
 *
 * Peleburan HALAMAN tak mengharuskan peleburan SKOR — satu halaman boleh
 * memajang dua indikator berdampingan. Kalau Johan memang memilih salah satu
 * rumus dibuang, barulah uji 2 & 3 dibalik jadi menuntut kesamaan.
 *
 * Yang tetap harus diperbaiki apa pun keputusannya: empat salinan konstanta
 * jadi SATU modul tanpa efek samping yang diimpor keempat pemakainya. Nilai
 * yang "kebetulan sama" di empat tempat akan menyimpang lagi, dan pasangan
 * Harian Papan tak punya penjaga yang menyadarinya.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { skorTigaKerangka, skorTeknikal } from '../../src/lib/dasbor/skorTeknikal.ts'
import { skorPapan, skorPapanTigaKerangka } from '../../src/lib/dasbor/harianPapan.ts'

const AKAR = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..')
const DIR_OHLC = join(AKAR, 'data-idx', 'json', 'ohlc')

/** Sampel deterministik, pola sama dengan crossCheck: tiap emiten ke-23. */
function sampelEmiten() {
  const semua = readdirSync(DIR_OHLC)
    .filter((f) => f.endsWith('.json') && !f.startsWith('_') && f !== 'IHSG.json')
    .sort()
  return semua.filter((_, i) => i % 23 === 0)
}

function bacaBaris(file) {
  const d = JSON.parse(readFileSync(join(DIR_OHLC, file), 'utf8'))
  return Array.isArray(d.d) ? d.d : []
}

describe('skor yang dilihat pembaca — Screener vs Harian Papan', () => {
  const sampel = sampelEmiten()

  it(`sampel mencakup >=30 emiten (dapat ${sampel.length})`, () => {
    expect(sampel.length).toBeGreaterThanOrEqual(30)
  })

  // Batas waktu dinaikkan 6 Sep 2026: uji ini membaca ratusan berkas OHLC
  // dari cakram dan makan 2,4-3,0 detik kalau mesinnya sepi — tapi 5-6,3
  // detik kalau build atau uji lain sedang jalan. Dengan batas bawaan 5
  // detik ia gagal EMPAT kali dalam satu sesi tanpa satu pun regresi, dan
  // uji yang merah karena mesin sibuk melatih orang mengabaikan warna merah.
  it('KEADAAN SEKARANG: dua halaman memberi label berbeda untuk sebagian emiten', { timeout: 30_000 }, () => {
    let diperiksa = 0
    let berbeda = 0
    const contoh = []

    for (const file of sampel) {
      const baris = bacaBaris(file)
      if (baris.length < 250) continue
      const sc = skorTigaKerangka(baris)
      const hp = skorPapanTigaKerangka(baris)
      diperiksa++
      const label = (x) => x?.label ?? null
      // Kerangka yang BENAR-BENAR berbeda ikut dicetak. Versi pertama selalu
      // mencetak kerangka harian, jadi emiten yang bedanya di pekanan tampil
      // sebagai "Strong Buy / Strong Buy" — penanda yang menyanggah dirinya
      // sendiri, persis cacat yang uji ini dibuat untuk mengejar.
      const kerangka = ['harian', 'pekanan', 'bulanan'].filter(
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
        'Skor Papan dirancang BERBEDA dari SSS (harianPapan.ts:23-42, benchmark ' +
        '83 label). Kalau penyamaan ini disengaja dan diputuskan Johan, balik ' +
        'uji ini jadi menuntut kesamaan; kalau tidak, kembalikan rumusnya.',
    ).toBeGreaterThan(0)

    // Dicetak supaya angkanya terlihat tiap uji jalan — divergensi yang tak
    // pernah disebut akan dilupakan.
    console.log(
      `[skor antar-halaman] ${berbeda}/${diperiksa} emiten sampel dinilai berbeda · ${contoh.join(' · ')}`,
    )
  })

  it('bedanya bukan karena salah satu sisi kosong — keduanya menghasilkan label', () => {
    const baris = bacaBaris(sampel.find((f) => bacaBaris(f).length >= 250))
    const sc = skorTigaKerangka(baris)
    const hp = skorPapanTigaKerangka(baris)
    expect(sc.harian?.label).toBeTruthy()
    expect(hp.harian?.label).toBeTruthy()
  })

  it('kedua rumus berbeda BENTUK — dan bedanya memang dirancang', () => {
    // Penjaga terhadap "perapian" yang tak sengaja membuang kalibrasi.
    // Screener menimbang enam osilator gaya kontrarian dan merata-rata semua
    // komponen; Skor Papan menimbang empat osilator gaya momentum dengan
    // bobot 50/50 — dikalibrasi ke 83 label penyedia lain (96% dalam ±1
    // tingkat, spek §Skor Papan). Menyamakan keduanya membuang kalibrasi itu
    // tanpa jejak di layar.
    const baris = bacaBaris(sampel.find((f) => bacaBaris(f).length >= 250))
    const sc = skorTeknikal(baris)
    const hp = skorPapan(baris)
    const nama = (x) => x.komponen.map((k) => k.nama)

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
