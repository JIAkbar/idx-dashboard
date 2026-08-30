/**
 * Pembangun data Harian Papan — cross-section 962 emiten per tanggal,
 * `data-idx/json/harian_papan/<tanggal>.json` + `index.json` (daftar tanggal
 * tersedia). Pola sama `bangun-screener.mjs`: nol jaringan, seluruhnya dibaca
 * dari berkas yang sudah ada di cakram.
 *
 * Sumber (docs/spek-dev-papan/spek_harian_papan.md §Cakupan & sumber):
 *   - `ohlcv_stockbit/<KODE>.json` — SATU berkas per emiten sudah memuat
 *     harga+volume+foreignbuy/foreignsell, tak perlu menjahit sumber lain.
 *   - `emiten_sektor.json` — sektor IDX-IC resmi.
 *   - `profil/<KODE>.json` — free float, diturunkan dari `pemegang_saham`
 *     (100% − jumlah persen pemegang berlabel `pengendali:true`); ruas ini
 *     belum pernah dipakai halaman lain (spek: "perlu dipetakan").
 *
 * Rumus (skor Papan, NBSF, TDM=MTD, dst.) hidup di
 * `app/src/lib/dasbor/harianPapan.ts` — berkas ini PORT JS-nya, sama alasan
 * `lib/skor.mjs` (Node di sini tak bisa impor `.ts` langsung). Primitif
 * indikator (sma/emaAkhir/rsi/stochK/cci/macd/rakitPeriode) DIPAKAI ULANG
 * dari `lib/skor.mjs` yang sudah ada (sudah port dari skorTeknikal.ts) — cuma
 * fungsi skor Papan sendiri (periode/ambang beda) yang perlu ditulis ulang di
 * sini, isinya WAJIB sama persis dengan `skorPapan()` di harianPapan.ts.
 *
 *   node app/scripts/bangun-harian-papan.mjs [--hari N]
 *
 * `--hari N` (bawaan 30): berapa hari bursa terakhir yang dibangun. Dibatasi
 * (bukan riwayat penuh) karena satu tanggal × 962 emiten ~600KB — riwayat
 * penuh akan jadi ratusan MB, tak masuk akal di-fetch klien. Tanggal di luar
 * jendela ini belum tersedia di pemilih tanggal Harian Papan; memperluasnya
 * tinggal menaikkan N dan menjalankan ulang skrip ini (nol risiko, idempoten).
 */
import { readFileSync, readdirSync, writeFileSync, mkdirSync } from 'node:fs'
import { tambalDariArsipBursa, barTujuhBelasKolom } from './lib/tambalBursa.mjs'
import { skorPapanTigaKerangka } from './lib/skorPapan.mjs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { sma, emaAkhir, macd, rakitPeriode } from './lib/skor.mjs'

const AKAR = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const DIR_JSON = join(AKAR, 'data-idx', 'json')
const DIR_OHLCV = join(DIR_JSON, 'ohlcv_stockbit')
const DIR_PROFIL = join(DIR_JSON, 'profil')
const DIR_KELUARAN = join(DIR_JSON, 'harian_papan')
// Arsip mentah bursa: SATU berkas per hari bursa berisi 963 emiten sekaligus,
// lengkap dengan tutup/tinggi/rendah, volume, nilai, frekuensi, aliran asing,
// dan jumlah saham. Tidak memakai kredensial apa pun, jadi ia tetap terisi
// saat sumber harga utama berhenti.
const DIR_BURSA = join(AKAR, '_arsip-mentah', 'asing')

const argHari = process.argv.indexOf('--hari')
const N_HARI = argHari >= 0 ? Number(process.argv[argHari + 1]) : 30

// Jendela histori dilewatkan ke tiap tanggal target — BUKAN seluruh riwayat
// emiten. `macd()` (skor.mjs) itu O(n²) (loop EMA berulang atas larik yang
// makin panjang); tanpa batas, emiten setua ANTM (5.480 bar) × 30 tanggal ×
// 962 emiten meledak jadi puluhan miliar operasi (dicoba, dibunuh setelah
// >4 menit tanpa selesai). 600 bar cukup: EMA200 (periode terpanjang yang
// dipakai Skor Papan) konvergen jauh sebelum 3× periodenya (peluruhan
// eksponensial) — bar sebelum jendela ini pengaruhnya microskopis, bukan
// nol tapi tak terukur pada presisi tampilan manapun. TDM%/WTD/RVol10 tak
// tersentuh (semuanya cuma butuh beberapa bulan/hari terakhir, jauh di
// dalam jendela ini). ponytail: batas performa, naikkan kalau nanti ada
// indikator berperiode >200 hari yang butuh histori lebih panjang.
const JENDELA_HISTORI = 600

function bacaJson(path) {
  try {
    return JSON.parse(readFileSync(path, 'utf8'))
  } catch {
    return null
  }
}

// Skor Papan pindah ke `lib/skorPapan.mjs` (30 Agu 2026) — modul TANPA efek
// samping, supaya bisa diuji silang terhadap `harianPapan.ts`. Selama rumusnya
// tinggal di dalam skrip ini, tak ada uji yang bisa memanggilnya: mengimpor
// berkas ini menjalankan pembangunan penuh dan menulis ke cakram.

// ── Kolom lain — WAJIB sama persis dgn harianPapan.ts ──────────────────────
function hitungNbsf000(fb, fs) {
  return (fb - fs) / 1000
}
function hitungCloseGap(buka, kemarin) {
  // `buka` bisa TIDAK ADA. Arsip bursa tak selalu melaporkan harga pembukaan
  // (terukur 28 Agu 2026: kosong di 220 dari 833 emiten aktif, 26,4%, dan
  // ruas pengganti FirstTrade kosong di emiten yang persis sama). Kalau
  // lubang itu diisi nol, rumusnya mencetak -100,00% — angka yang terbaca
  // seperti hasil hitungan sungguhan dan tak akan dicurigai siapa pun.
  // Kosong yang jujur lebih murah daripada angka yang salah.
  if (!(buka > 0) || !(kemarin > 0)) return null
  return ((buka - kemarin) / kemarin) * 100
}
function hitungChg1d(kini, kemarin) {
  return kemarin > 0 ? (kini / kemarin - 1) * 100 : null
}
/** Return terhadap penutupan N hari bursa yang lalu. `null` kalau deretnya
 *  belum sepanjang itu — bukan diisi angka dari bar terlama yang ada, karena
 *  itu akan mengaku "3 bulan" untuk emiten yang baru listing sebulan. */
function hitungChgMundur(tutup, n) {
  if (tutup.length < n + 1) return null
  const dasar = tutup[tutup.length - 1 - n]
  return dasar > 0 ? (tutup[tutup.length - 1] / dasar - 1) * 100 : null
}

function hitungChgPeriode(kini, rakit) {
  if (rakit.length < 2) return null
  const dasar = rakit[rakit.length - 2][4]
  return dasar > 0 ? (kini / dasar - 1) * 100 : null
}
function hitungRvol10(volume, n = 10) {
  if (volume.length < n + 1) return null
  const dasar = volume.slice(-(n + 1), -1)
  const rata = dasar.reduce((a, b) => a + (b ?? 0), 0) / dasar.length
  return rata > 0 ? (volume[volume.length - 1] ?? 0) / rata : null
}
function hitungMa20Arah(tutup) {
  const kini = sma(tutup, 20)
  const lalu = tutup.length >= 21 ? sma(tutup.slice(0, -1), 20) : null
  if (kini === null || lalu === null) return null
  return kini > lalu ? 'naik' : kini < lalu ? 'turun' : 'datar'
}
function posisiHarga(harga, v) {
  if (v === null) return null
  if (harga > v) return 'atas'
  if (harga < v) return 'bawah'
  return null
}
function hitungFreeFloat(pemegang) {
  // WAJIB sama dgn hitungFreeFloat() di harianPapan.ts — termasuk `null` saat
  // daftar berisi tapi nol pengendali (42 emiten, mis. BBRI; lihat catatan di
  // sana).
  if (!pemegang || pemegang.length === 0) return null
  const berpengendali = pemegang.filter((p) => p.pengendali)
  if (berpengendali.length === 0) return null
  const dikuasai = berpengendali.reduce((a, p) => a + (p.persen ?? 0), 0)
  return Math.max(0, Math.min(100, 100 - dikuasai))
}
function tidakDiperdagangkanHariIni(vol) {
  return (vol ?? 0) === 0
}
function keBarisOhlc(bar) {
  return [bar[0], bar[2], bar[3], bar[4], bar[5], bar[6]]
}

function bangunBarisHarianPapan(kode, nama, sektor, freeFloat, barSampaiTanggal) {
  if (barSampaiTanggal.length === 0) return null
  const ohlc = barSampaiTanggal.map(keBarisOhlc)
  const tutup = ohlc.map((b) => b[4])
  const volume = ohlc.map((b) => b[5])
  const hargaTerakhir = tutup[tutup.length - 1]
  const barIni = barSampaiTanggal[barSampaiTanggal.length - 1]
  const kemarin = ohlc.length >= 2 ? ohlc[ohlc.length - 2] : null

  const mingguan = rakitPeriode(ohlc, 'pekan')
  const bulanan = rakitPeriode(ohlc, 'bulan')
  const chgWtd = hitungChgPeriode(hargaTerakhir, mingguan)
  const chgMtd = hitungChgPeriode(hargaTerakhir, bulanan)

  // Return BULANAN dihitung ROLLING, bukan "to date" (keputusan Johan 29 Agu
  // 2026 sesudah diberi angkanya).
  //
  // Kenapa penting: "to date" panjang periodenya berubah tiap hari — 28
  // Agustus mengukur 28 hari, 2 September mengukur 2 hari. Tabel ini
  // diperingkat antar emiten, jadi di awal bulan pembaca akan mengurutkan
  // 832 emiten berdasarkan return dua hari sambil membaca judul "1 bulan".
  // Rolling selalu 21 hari bursa, tanggal berapa pun, jadi peringkatnya
  // selalu membandingkan periode yang sama.
  const chg1m = hitungChgMundur(tutup, 21)
  const chg2m = hitungChgMundur(tutup, 42)
  const chg3m = hitungChgMundur(tutup, 63)

  const ema5 = emaAkhir(tutup, 5)
  const ma10 = sma(tutup, 10)
  const ma20 = sma(tutup, 20)
  const skor = skorPapanTigaKerangka(ohlc)

  // null = aliran asing tak tersedia untuk bar ini (lihat barDariBursa).
  // Dibedakan dari 0 yang berarti "tak ada asing bertransaksi".
  const adaAsing = barIni[9] != null && barIni[10] != null
  const foreignBuy = Number(barIni[9] ?? 0)
  const foreignSell = Number(barIni[10] ?? 0)
  const volumeIni = volume[volume.length - 1] ?? null

  return {
    kode,
    nama,
    sektor,
    harga: hargaTerakhir,
  // TDM% = month-to-date, sesuai `spek_harian_papan.md:20` ("close ÷ close hari
  // bursa terakhir bulan sebelumnya − 1", terverifikasi 10/10 emiten 18 Agu).
  // SENGAJA berbeda dari `chg_b1` yang rolling 21 hari: keduanya menjawab
  // pertanyaan berbeda, dan ruas ini dibaca Screener.
  //
  // Dikembalikan 30 Agu 2026 sesudah regresi 29 Agu (commit 6ed9d3580): ruas
  // ini dulu MENUMPANG variabel `chgMtd`, jadi ketika `chg_mtd` diubah jadi
  // rolling atas permintaan Johan, TDM% ikut berubah tanpa diminta — dan
  // speknya tetap menyebut month-to-date. Sekarang keduanya punya variabel
  // sendiri supaya tak bisa saling menyeret lagi.
    tdm_persen: chgMtd,
    volume: volumeIni,
    rvol10: hitungRvol10(volume),
    nilai: barIni[7] ?? null,
    nbsf_000: adaAsing ? hitungNbsf000(foreignBuy, foreignSell) : null,
    free_float: freeFloat,
    ma20_arah: hitungMa20Arah(tutup),
    close_gap: kemarin ? hitungCloseGap(ohlc[ohlc.length - 1][1], kemarin[4]) : null,
    chg_1d: kemarin ? hitungChg1d(hargaTerakhir, kemarin[4]) : null,
    chg_wtd: chgWtd,
    // `chg_b1`, BUKAN `chg_mtd`. Screener memakai nama itu untuk rumus yang
    // BERBEDA (sejak penutupan bulan sebelumnya), dan satu nama untuk dua
    // rumus memberi dua angka untuk emiten yang sama di hari yang sama —
    // terukur BBCA 28 Agu: 2,37% di sana, 4,02% di sini. Angkanya dua-duanya
    // benar; namanya yang bohong.
    chg_b1: chg1m,
    chg_2m: chg2m,
    chg_3m: chg3m,
    posisi_ema5: posisiHarga(hargaTerakhir, ema5),
    posisi_ma10: posisiHarga(hargaTerakhir, ma10),
    posisi_ma20: posisiHarga(hargaTerakhir, ma20),
    skor_d: skor.harian?.label ?? null,
    skor_w: skor.pekanan?.label ?? null,
    skor_m: skor.bulanan?.label ?? null,
    tidak_diperdagangkan: tidakDiperdagangkanHariIni(volumeIni),
    // Bahan mentah kolom Form (adendum Rapor & Badge) — dihitung ulang di
    // komponen lewat hitungForm() (raporBadge.ts), bukan di sini.
    bar5: barSampaiTanggal.slice(-5).map((b) => ({ open: b[2], close: b[5] })),
    // Selisih menang-kalah kolom Form (4-1 -> +3, 1-4 -> -3) — kunci urut
    // kolom itu. HARUS dihitung DI SINI: berkas JSON dibangun skrip ini,
    // sementara padanannya di `lib/dasbor/harianPapan.ts` cuma dipakai tipe
    // & uji. Menambahkannya di sana saja membuat kolomnya tetap tak bisa
    // diurut, dan gejalanya menipu — klik kepala kolom "berhasil" tapi
    // urutannya tak berubah sama sekali (Johan 29 Agu: "sorting form itu
    // tidak ngefek apapun").
    form_skor: (() => {
      const lima = barSampaiTanggal.slice(-5)
      if (lima.length === 0) return null
      let n = 0
      for (const b of lima) {
        // Bar tanpa harga pembukaan dilewati — WAJIB sama persis dengan
        // hitungForm() di raporBadge.ts, karena angka ini kunci urut untuk
        // panah yang dirender fungsi itu. Kalau keduanya beda aturan,
        // urutannya tak cocok dengan yang terlihat di layar.
        const buka = Number(b[2])
        if (!(buka > 0)) continue
        const d = Number(b[5]) - buka
        if (d > 0) n += 1
        else if (d < 0) n -= 1
      }
      return n
    })(),
  }
}

// ── Main ────────────────────────────────────────────────────────────────
const daftar = bacaJson(join(DIR_JSON, 'daftar_emiten.json'))
const namaByKode = new Map((daftar?.emiten ?? []).map((e) => [e.kode, e.nama]))
const sektorData = bacaJson(join(DIR_JSON, 'emiten_sektor.json'))
const sektorByKode = sektorData?.emiten ?? {}

const fileOhlcv = readdirSync(DIR_OHLCV)
  .filter((f) => f.endsWith('.json') && !f.startsWith('_') && f !== 'IHSG.json') // IHSG = indeks, bukan emiten (bukan barang dagangan broker)
  // Emiten yang TIDAK ada di daftar resmi bursa dibuang: arsip harga bisa
  // memuat kode yang sudah delisting atau yang sengaja dilewati
  // (`scripts/emiten_lewati.py` — GOTOM, saham multi-voting GoTo, muncul
  // sebagai baris kosong di layar sampai 29 Agu 2026). Daftar resmi jadi
  // wasitnya, jadi pengecualian cukup ditulis SEKALI di hulu.
  .filter((f) => namaByKode.has(f.replace(/\.json$/, '')))
  .sort()

// Pass 1: tanggal bursa terakhir = MODUS tanggal bar terakhir tiap emiten
// (sama alasan bangun-screener.mjs: bukan dari satu emiten acak yang bisa
// telat kalau ia disuspensi hari ini).
const berkasByKode = new Map()
for (const f of fileOhlcv) {
  const kode = f.replace(/\.json$/, '')
  const d = bacaJson(join(DIR_OHLCV, f))
  const bar = d?.bar
  if (!Array.isArray(bar) || bar.length === 0) continue
  berkasByKode.set(kode, bar)
}

// Ujung yang belum dimiliki arsip harga diisi dari arsip bursa — DI MEMORI
// saja. Berkas arsip harga tidak pernah ditulis ulang: penambal yang menimpa
// sumbernya sendiri tak bisa dibatalkan, dan begitu sumber utamanya dipanen
// ulang, bar aslinya yang menang tanpa perlu membatalkan apa pun.
const tanggalDariBursa = tambalDariArsipBursa(berkasByKode, {
  dirBursa: DIR_BURSA,
  iVolume: 6,
  keBar: barTujuhBelasKolom,
})

const hitungTanggal = new Map()
for (const bar of berkasByKode.values()) {
  const last = bar.at(-1)?.[0]
  // Bar HARI BERJALAN yang belum berdata (volume 0) TIDAK ikut memilih
  // tanggal — temuan Johan 28 Agu ("panen kok gak langsung jadi yaa? ini
  // data masih 27 agustus"): sumber harga memberi bar bertanggal hari ini
  // dengan volume/value/frekuensi nol, dan modus memenangkannya karena
  // SEMUA emiten punya bar hantu itu. Akibatnya halaman menawarkan tanggal
  // baru yang isinya nol di seluruh kolom. Kelas bug yang sama dengan
  // arsip-kosong (§WF-207): yang kosong tak boleh mengalahkan yang berisi.
  // Suara emiten ini = bar TERAKHIR YANG BERISI. Kalau bar paling ujung
  // hantu (volume 0), mundur satu — jangan diam, karena kalau semua emiten
  // diam tak ada tanggal terpilih sama sekali (dicoba: pembangun berhenti
  // "Tak ada satu pun tanggal bar ditemukan").
  let iSuara = bar.length - 1
  while (iSuara > 0 && Number(bar[iSuara]?.[6] ?? 0) === 0) iSuara -= 1
  const tglSuara = bar[iSuara]?.[0]
  if (tglSuara) hitungTanggal.set(tglSuara, (hitungTanggal.get(tglSuara) ?? 0) + 1)
}
const tanggalTerakhir = [...hitungTanggal.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null
if (!tanggalTerakhir) {
  console.error('Tak ada satu pun tanggal bar ditemukan di ohlcv_stockbit/.')
  process.exit(1)
}

// Kalender acuan: tanggal bar emiten mana pun yang bar terakhirnya PERSIS
// tanggalTerakhir (ada banyak, ambil yang riwayatnya terpanjang supaya N_HARI
// ke belakang aman tercakup).
let kalender = null
for (const [kode, bar] of berkasByKode) {
  // Bar ujung boleh HANTU (volume 0 hari berjalan) — yang penting emiten ini
  // MEMUAT tanggalTerakhir; kalendernya lalu dipotong sampai tanggal itu
  // supaya tanggal hantu tak ikut jadi target.
  if (!bar.some((b) => b[0] === tanggalTerakhir)) continue
  if (!kalender || bar.length > kalender.length) kalender = bar.map((b) => b[0])
}
const iAkhir = kalender ? kalender.lastIndexOf(tanggalTerakhir) : -1
const tanggalTarget = (iAkhir >= 0 ? kalender.slice(0, iAkhir + 1) : (kalender ?? [])).slice(-N_HARI) // lama -> baru

console.log(`tanggal bursa terakhir (modus): ${tanggalTerakhir}`)
console.log(`membangun ${tanggalTarget.length} tanggal: ${tanggalTarget[0]} .. ${tanggalTarget.at(-1)}`)

mkdirSync(DIR_KELUARAN, { recursive: true })

const hasilPerTanggal = new Map(tanggalTarget.map((t) => [t, []]))

for (const [kode, bar] of berkasByKode) {
  // Indeks tanggal -> posisi di larik bar, sekali per emiten (bukan per
  // tanggal target — O(n) sekali, bukan O(n × N_HARI)).
  const idxByTanggal = new Map(bar.map((b, i) => [b[0], i]))
  const profil = bacaJson(join(DIR_PROFIL, `${kode}.json`))
  const freeFloat = hitungFreeFloat(profil?.pemegang_saham)
  // Nilai klasifikasi Inggris resmi (Johan 27 Agu); ID = cadangan.
  const sektor = sektorByKode[kode]?.sektor_en ?? sektorByKode[kode]?.sektor ?? '-'
  const nama = namaByKode.get(kode) ?? null

  for (const t of tanggalTarget) {
    const idx = idxByTanggal.get(t)
    if (idx === undefined) continue // emiten belum listing / suspensi tanggal ini
    const potong = bar.slice(Math.max(0, idx + 1 - JENDELA_HISTORI), idx + 1)
    const baris = bangunBarisHarianPapan(kode, nama, sektor, freeFloat, potong)
    if (baris) hasilPerTanggal.get(t).push(baris)
  }
}

const diperbarui = new Date().toISOString()
for (const t of tanggalTarget) {
  const emiten = hasilPerTanggal.get(t)
  writeFileSync(
    join(DIR_KELUARAN, `${t}.json`),
    JSON.stringify({
      tanggal: t,
      diperbarui,
      n: emiten.length,
      // Hari yang isinya datang dari arsip bursa, bukan dari arsip harga.
      // Ditandai supaya halaman bisa MENGATAKANNYA — angka boleh berbeda
      // asal pembacanya tahu dari mana asalnya (aturan proyek: jahitan
      // wajib disebut di antarmuka halaman yang memakainya).
      dari_bursa: tanggalDariBursa.includes(t) || undefined,
      emiten,
    }),
  )
}
writeFileSync(
  join(DIR_KELUARAN, 'index.json'),
  JSON.stringify({ diperbarui, tanggal_tersedia: [...tanggalTarget].reverse() }),
)

console.log(`selesai: ${tanggalTarget.length} berkas tanggal + index.json di ${DIR_KELUARAN}`)
console.log(`emiten tanggal terakhir (${tanggalTerakhir}): ${hasilPerTanggal.get(tanggalTerakhir)?.length ?? 0}`)
