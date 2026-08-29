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
import { readFileSync, readdirSync, writeFileSync, mkdirSync, statSync, existsSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { sma, emaAkhir, rsi, stochK, cci, macd, rakitPeriode, labelSkor } from './lib/skor.mjs'

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
// Tambalan HANYA untuk ujung. Kalau arsip harga tertinggal lebih jauh dari
// ini, yang benar memanen ulang sumbernya — bukan menjahit berhari-hari dari
// sumber kedua dan membiarkan selisih konvensi menumpuk tanpa terlihat.
const MAKS_HARI_TAMBAL = 5

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

// ── Skor Papan (JS) — WAJIB sama persis dgn skorPapan() di harianPapan.ts ──
const PERIODE_SKOR_PAPAN = [5, 10, 20, 50, 100, 200]

function biasMomentum(v, ambangBawah, ambangAtas) {
  if (v === null) return 0
  if (v >= ambangAtas) return 1
  if (v <= ambangBawah) return -1
  return 0
}

function skorPapan(baris) {
  if (baris.length < 30) return null
  const tutup = baris.map((b) => b[4])
  const harga = tutup[tutup.length - 1]

  const ma = []
  const arahHarga = (v, nama) => {
    if (v === null) return
    ma.push({ nama, bias: harga > v ? 1 : harga < v ? -1 : 0 })
  }
  for (const n of PERIODE_SKOR_PAPAN) arahHarga(sma(tutup, n), `SMA ${n}`)
  for (const n of PERIODE_SKOR_PAPAN) arahHarga(emaAkhir(tutup, n), `EMA ${n}`)

  const osc = []
  const r = rsi(tutup, 14)
  if (r !== null) osc.push({ nama: 'RSI 14', bias: biasMomentum(r, 40, 60) })
  const k = stochK(baris, 14)
  if (k !== null) osc.push({ nama: 'Stoch 14', bias: biasMomentum(k, 20, 80) })
  const c = cci(baris, 20)
  if (c !== null) osc.push({ nama: 'CCI 20', bias: biasMomentum(c, -100, 100) })
  const m = macd(tutup, 12, 26, 9)
  if (m) osc.push({ nama: 'MACD 12-26', bias: m[0] > 0 ? 1 : m[0] < 0 ? -1 : 0 })

  if (ma.length === 0 && osc.length === 0) return null
  const rata = (arr) => (arr.length ? arr.reduce((a, b) => a + b.bias, 0) / arr.length : 0)
  const maSkor = rata(ma)
  const oscSkor = rata(osc)
  const skor = (maSkor + oscSkor) / 2
  return { skor, label: labelSkor(skor), ma: maSkor, osilator: oscSkor }
}

function skorPapanTigaKerangka(baris) {
  return {
    harian: skorPapan(baris),
    pekanan: skorPapan(rakitPeriode(baris, 'pekan')),
    bulanan: skorPapan(rakitPeriode(baris, 'bulan')),
  }
}

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
  if (!pemegang || pemegang.length === 0) return null
  const dikuasai = pemegang.filter((p) => p.pengendali).reduce((a, p) => a + (p.persen ?? 0), 0)
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
    chg_mtd: chgMtd,
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

// ── Tambalan ujung dari arsip bursa ────────────────────────────────────────
/**
 * Kenapa ada, dan kenapa CUMA di ujung.
 *
 * Johan 29 Agu 2026: *"berita juga gak ada update nih"* lalu *"kita punya data
 * 6 Varian kenapa tidak dipakai dipage itu?"*. Akarnya: rantai kredensial
 * sumber harga mati 28 Agu sore, jadi arsip harga berhenti di 27 Agu dan
 * halaman ini ikut berhenti — padahal arsip bursa untuk 28 Agu sudah ada di
 * cakram sejak sore itu juga, 963 emiten, tanpa perlu kredensial apa pun.
 *
 * Keduanya boleh disambung karena terukur SAMA, bukan karena kelihatan mirip:
 * 8.976 pasang emiten-hari (150 emiten x 60 hari), median rasio tutup
 * 1,000000, dan satu-satunya 96 selisih >0,5% semuanya jatuh di hari yang
 * arsip harganya masih bar hantu. 59 hari lain: nol selisih.
 *
 * Batasnya tetap ketat. Konvensi kedua sumber BERBEDA di masa lalu (arsip
 * harga menyesuaikan riwayat ke aksi korporasi, bursa melaporkan apa adanya),
 * jadi menjahit berhari-hari akan menumpuk selisih yang tak terlihat. Yang
 * disambung hanya hari yang arsip harga belum punya sama sekali, maksimal
 * MAKS_HARI_TAMBAL. Lebih dari itu = panen ulang, bukan tambal.
 */
function tanggalBerisiTerakhir(bar) {
  let i = bar.length - 1
  while (i > 0 && Number(bar[i]?.[6] ?? 0) === 0) i -= 1
  return bar[i]?.[0] ?? null
}

function barDariBursa(r, iso) {
  const angka = (x) => {
    const v = Number(x)
    return Number.isFinite(v) && v !== 0 ? v : null
  }
  const tutup = angka(r.Close)
  // Tinggi/rendah kosong = hari tanpa transaksi. Bar datar setinggi harga
  // tutup itu perilaku yang benar untuk hari begitu, dan menjaga indikator
  // yang membaca tinggi/rendah (Stochastic, CCI) tak menerima null.
  const tinggi = angka(r.High) ?? tutup
  const rendah = angka(r.Low) ?? tutup
  // Pembukaan DIBIARKAN null kalau bursa tak melaporkannya — lihat catatan
  // di hitungCloseGap(). Satu-satunya pembacanya kolom itu.
  return [
    iso,
    Math.floor(Date.parse(`${iso}T00:00:00+07:00`) / 1000),
    angka(r.OpenPrice),
    tinggi,
    rendah,
    tutup,
    Number(r.Volume) || 0,
    Number(r.Value) || 0,
    Number(r.Frequency) || 0,
    // Aliran asing SENGAJA null, bukan angka bursa.
    //
    // Slot ini berisi RUPIAH di arsip harga (BBCA 27 Agu: beli 228.367.645.000
    // = Rp 228 miliar). Bursa melaporkan aliran asing dalam LEMBAR saja dan
    // mengatakannya sendiri di arsipnya. Mengisi lembar ke slot rupiah
    // memberi angka yang berselisih ribuan kali di kolom yang sama --
    // BBCA 27 Agu -34.107.640 lalu 28 Agu 49.682, dua satuan berbeda, nol
    // galat. Taksiran rupiah (lembar x harga rata-rata) TIDAK dipakai tanpa
    // keputusan pemilik data: galatnya miring searah, jadi menumpuk kalau
    // dijumlahkan (terukur +33% kumulatif setahun).
    null,
    null,
    0,
    0,
    Number(r.ListedShares) || 0,
    0,
    0,
    0,
  ]
}

function tambalDariArsipBursa(berkasByKode) {
  if (!existsSync(DIR_BURSA)) return []

  // Sampai tanggal berapa arsip harga BENAR-BENAR berisi (modus, bukan satu
  // emiten acak yang bisa disuspensi).
  const suara = new Map()
  for (const bar of berkasByKode.values()) {
    const t = tanggalBerisiTerakhir(bar)
    if (t) suara.set(t, (suara.get(t) ?? 0) + 1)
  }
  const punyaSampai = [...suara.entries()].sort((a, b) => b[1] - a[1])[0]?.[0]
  if (!punyaSampai) return []

  const kandidat = []
  for (const th of readdirSync(DIR_BURSA)) {
    if (!/^\d{4}$/.test(th)) continue
    for (const f of readdirSync(join(DIR_BURSA, th))) {
      const m = f.match(/^(\d{4})(\d{2})(\d{2})\.json\.gz$/)
      if (!m) continue
      const iso = `${m[1]}-${m[2]}-${m[3]}`
      if (iso <= punyaSampai) continue
      const jalur = join(DIR_BURSA, th, f)
      // Arsip 0-baris bertanggal muda = "belum terbit", bukan hari libur
      // (§WF-207). Yang kosong tak boleh dianggap sebagai hari bursa.
      if (statSync(jalur).size < 1000) continue
      kandidat.push([iso, jalur])
    }
  }
  if (kandidat.length === 0) return []
  kandidat.sort((a, b) => (a[0] < b[0] ? -1 : 1))

  if (kandidat.length > MAKS_HARI_TAMBAL) {
    console.warn(
      `arsip harga tertinggal ${kandidat.length} hari dari arsip bursa ` +
        `(${punyaSampai} -> ${kandidat.at(-1)[0]}). Melewati batas tambal ` +
        `${MAKS_HARI_TAMBAL} hari; sumbernya perlu dipanen ulang, bukan dijahit.`,
    )
    return []
  }

  const ditambal = []
  for (const [iso, jalur] of kandidat) {
    let rows
    try {
      rows = JSON.parse(gunzipSync(readFileSync(jalur)).toString('utf8'))?.data
    } catch (e) {
      console.warn(`arsip bursa ${iso} tak terbaca: ${e.message}`)
      continue
    }
    if (!Array.isArray(rows) || rows.length === 0) continue

    let n = 0
    for (const r of rows) {
      const bar = berkasByKode.get(r.StockCode)
      if (!bar) continue
      const baru = barDariBursa(r, iso)
      if (baru[5] === null) continue // tanpa harga tutup tak ada yang bisa dihitung
      const i = bar.findIndex((b) => b[0] === iso)
      // Bar hantu (ada tapi volume nol) DITIMPA; bar berisi tak disentuh.
      if (i === -1) bar.push(baru)
      else if (Number(bar[i][6] ?? 0) === 0) bar[i] = baru
      else continue
      n += 1
    }
    if (n > 0) {
      ditambal.push(iso)
      console.log(`tambal ${iso} dari arsip bursa: ${n} emiten`)
    }
  }
  return ditambal
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
const tanggalDariBursa = tambalDariArsipBursa(berkasByKode)

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
