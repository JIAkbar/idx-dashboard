import type { AsingHarian, StockFundamental } from './stockDetailData'
import {
  LABEL_VONIS,
  rasioKini,
  ringkasRasio,
  type DeretValuasi,
  type RingkasRasio,
} from './valuasiHistoris'
import {
  ada,
  keP,
  kualitasLaba,
  labelSkor,
  marjin,
  ringkasTransaksi,
  skorPilar,
  skorTotal,
  sumbuSektor,
  type Pilar,
  type RingkasTransaksi,
} from './bedahEmiten'
import { fMC, fRingkas, fvx } from './stockDetailFormat'
import { tanggalPendek } from './statistikBerkala'
import { keFraksi } from '../fraksiHarga'

/**
 * **Banding sampai lima emiten** di halaman Bedah Emiten, dan **ekspor
 * gambarnya** — dua hal yang sengaja tinggal di satu berkas karena yang
 * digambar ke kanvas persis tabel yang sama yang tampil di layar. Kalau
 * keduanya dipisah, tiap penambahan ruas harus diulang dua kali dan yang
 * kedua akan tertinggal diam-diam.
 *
 * Semua di berkas ini **fungsi murni**: `susunBanding()` menyusun tabelnya,
 * `gambarBanding()` menulis ke `CanvasRenderingContext2D` yang DISUNTIKKAN.
 * Tak satu pun menyentuh `document`, `window`, atau berkas. Pemicu unduhnya
 * (`unduhBandingPng`) berdiri terpisah di paling bawah dan cuma tiga baris —
 * itulah satu-satunya bagian yang butuh peramban, dan karena itu satu-satunya
 * bagian yang tak bisa diuji tanpa mata.
 *
 * ## Kenapa kanvas, bukan pustaka tangkap-layar
 *
 * Repo ini tak punya `html2canvas`/`dom-to-image`/`html-to-image` sama sekali,
 * dan menambah satu untuk satu tombol berarti membayar seumur hidup proyek
 * untuk kenyamanan sekali pakai. Yang menentukan bukan itu, melainkan **bentuk
 * kegagalannya**: pustaka tangkap-layar gagal SENYAP — webfont yang belum
 * termuat diganti font lain, `color-mix()` dan variabel CSS diabaikan, dan
 * hasilnya tetap berupa PNG yang terlihat jadi. Gambar yang beredar di grup
 * WhatsApp tak punya kesempatan kedua untuk diperiksa. Menggambar sendiri
 * membuat tiap piksel berasal dari kode yang bisa diuji, dan preseden kanvas →
 * `toDataURL` → `<a download>` sudah ada di halaman Grafik Emiten.
 *
 * Ongkosnya: tata letak gambar ditulis tangan dan **tidak** otomatis mengikuti
 * CSS halaman. Kalau kolom di layar bertambah, baris di sini harus ikut —
 * karena itu keduanya lahir dari satu `susunBanding()` yang sama.
 *
 * ## Aturan yang mengikat berkas ini
 *
 * - **Ruas kosong ditulis `—`, tak pernah `0`.** Emiten yang datanya belum
 *   terpanen tak boleh terbaca seperti emiten berkinerja nol. Ini aturan
 *   proyek dan sudah pernah menipu pembaca.
 * - **Tak ada kolom peringkat yang bisa diurut.** Emiten jadi KOLOM dan ruas
 *   jadi BARIS — bukan sekadar pilihan tata letak: tabel yang emitennya jadi
 *   baris mengundang satu ketukan di kepala kolom untuk mengurutkan "emiten
 *   terbaik", padahal tak satu pun ruas di sini adalah peringkat kualitas.
 *   Larangan yang sama sudah berlaku di Screener (`kartuRingkas.ts`).
 *   Urutan kolom = urutan pembaca menambahkannya, tak pernah diurutkan sendiri.
 * - **Tanggal diambil dari ISI data**, bukan dari `Date.now()`. Berkas bisa
 *   ditulis ulang tanpa membawa data baru, dan jam mesin akan membuat data
 *   basi terlihat segar selamanya.
 * - **Gambar tak boleh membocorkan dapur.** Tak ada nama endpoint, jalur
 *   berkas, nama modul, atau ambang skor yang tercetak — gambar ini beredar
 *   lepas dari situsnya dan hanya boleh membawa angka, periodenya, dan
 *   penanda PAPAN.
 */

/** Batas kolom. Bukan angka bulat yang dipilih asal: enam kolom sudah tak
 *  muat dibaca berdampingan di telepon, dan gambar ekspornya melebar melewati
 *  batas yang wajar ditempel ke percakapan. */
export const MAKS_BANDING = 5

/* ────────────────────────── bentuk tabel ────────────────────────── */

/** Arah untuk pewarnaan. `0` = netral — dipakai untuk ruas yang besar-kecilnya
 *  BUKAN baik-buruk (mis. posisi terhadap median sektor: murah tak sama dengan
 *  bagus). Mewarnai ruas semacam itu memberi vonis yang tak pernah dihitung. */
export type Arah = -1 | 0 | 1

export interface SelBanding {
  /** Teks siap tampil. `'—'` untuk yang tak ada — TIDAK PERNAH `'0'`. */
  teks: string
  arah: Arah
}

export interface BarisBanding {
  label: string
  /** Satu sel per emiten, urutannya sama persis dengan `kolom`. */
  sel: SelBanding[]
}

export interface GrupBanding {
  judul: string
  baris: BarisBanding[]
}

export interface KolomBanding {
  kode: string
  /** Nama panjang emiten; `''` kalau berkasnya belum ada. */
  nama: string
  /** `false` = berkas fundamental emiten ini tak ditemukan. Seluruh selnya
   *  `—`, dan layarnya menyebut alasannya alih-alih membiarkan kolom kosong
   *  terbaca sebagai angka nol. */
  ada: boolean
}

export interface TabelBanding {
  kolom: KolomBanding[]
  grup: GrupBanding[]
  /** Hari bursa terakhir yang terpanen di antara emiten terpilih — dari isi
   *  berkas transaksi, bukan dari jam mesin. `null` = belum satu pun punya. */
  tanggalPasar: string | null
  /** Pembaruan fundamental terbaru di antara emiten terpilih (`YYYY-MM-DD`). */
  tanggalFundamental: string | null
}

/** Bahan mentah satu kolom. Pemanggil yang mengambil berkasnya; berkas ini
 *  tak tahu apa pun tentang cara mengambilnya. */
export interface SumberBanding {
  kode: string
  fd: StockFundamental | null
  deret: DeretValuasi | null
  /** Baris transaksi harian terurut NAIK tanggal; `null` = belum terpanen. */
  asing: AsingHarian[] | null
}

/* ────────────────────────── penyusun ────────────────────────── */

const KOSONG: SelBanding = { teks: '—', arah: 0 }

function sel(teks: string | null, arah: Arah = 0): SelBanding {
  return teks == null || teks === '' || teks === '—' ? KOSONG : { teks, arah }
}

function persen(v: number | null | undefined, d = 1): string | null {
  return ada(v) ? `${v.toFixed(d)}%` : null
}

function persenTanda(v: number | null | undefined, d = 1): string | null {
  return ada(v) ? `${v >= 0 ? '+' : ''}${v.toFixed(d)}%` : null
}

function arahDari(v: number | null | undefined, titikBalik = 0): Arah {
  if (!ada(v)) return 0
  return v >= titikBalik ? 1 : -1
}

/** Net beli asing `hari` hari bursa terakhir, dalam LEMBAR. Bursa tidak
 *  melaporkan aliran asing dalam rupiah dan halaman ini tidak menaksirnya. */
export function netAsing(d: AsingHarian[] | null, hari: number): { net: number; hari: number } | null {
  if (!d || d.length === 0) return null
  const potongan = d.slice(-hari)
  return {
    net: potongan.reduce((s, r) => s + r.beli - r.jual, 0),
    hari: potongan.length,
  }
}

/** Hitungan satu kolom — semuanya dipinjam dari `bedahEmiten.ts` dan
 *  `valuasiHistoris.ts` apa adanya. Tak satu pun rumus dihitung ulang di sini;
 *  banding cuma menyandingkan angka yang sudah ada. */
interface Hitung {
  kode: string
  nama: string
  fd: StockFundamental | null
  pe: RingkasRasio | null
  pb: RingkasRasio | null
  pilar: Pilar[]
  total: { skor: number | null; n: number }
  trx: RingkasTransaksi | null
  net20: { net: number; hari: number } | null
}

function hitung(s: SumberBanding): Hitung {
  const fd = s.fd
  if (!fd) {
    return { kode: s.kode, nama: '', fd: null, pe: null, pb: null, pilar: [], total: { skor: null, n: 0 }, trx: null, net20: null }
  }
  const harga = fd.last_price ?? null
  const pe = ringkasRasio(s.deret?.pe, rasioKini(harga, s.deret?.eps_dasar))
  const pb = ringkasRasio(s.deret?.pb, rasioKini(harga, s.deret?.bv_dasar))
  const pilar = skorPilar(fd, pe.vonis, sumbuSektor(fd.pe_vs_sector_pct ?? null))
  return {
    kode: fd.ticker || s.kode,
    nama: fd.name || '',
    fd,
    pe,
    pb,
    pilar,
    total: skorTotal(pilar),
    trx: ringkasTransaksi(s.asing ?? [], fd.shares),
    net20: netAsing(s.asing, 20),
  }
}

function skorPilarSel(h: Hitung, id: Pilar['id']): SelBanding {
  const p = h.pilar.find((x) => x.id === id)
  return p && p.skor != null ? sel(p.skor.toFixed(0)) : KOSONG
}

/** Satu definisi baris: label + cara mengambil selnya dari satu kolom. */
interface DefBaris {
  label: string
  ambil: (h: Hitung) => SelBanding
}

interface DefGrup {
  judul: string
  baris: DefBaris[]
}

/**
 * Ruas yang dipilih untuk dibandingkan — **jauh lebih sedikit** daripada dua
 * belas seksi Bedah Emiten, dan itu keputusan, bukan kemalasan. Lima kolom
 * penuh dua belas seksi menghasilkan sekitar dua ratus angka di satu layar:
 * secara teknis lengkap, secara praktis tak terbaca, dan justru bentuk itulah
 * yang membuat dasbor pembanding terasa dihasilkan mesin.
 *
 * Saringannya satu pertanyaan: *apakah ruas ini berubah artinya ketika
 * disandingkan?* Yang lolos adalah ruas yang menjawab pertanyaan berbeda-beda:
 *
 * | Kelompok | Pertanyaan yang dijawab |
 * |---|---|
 * | Harga & Ukuran | Sebesar apa, dan seramai apa diperdagangkan — valuasi apa pun tak berarti kalau sahamnya tak bisa dilepas |
 * | Vonis Valuasi | Mahal atau murah **terhadap sejarahnya sendiri**, bukan terhadap emiten sebelah — dua emiten beda sektor tak sebanding P/E-nya mentah-mentah |
 * | Kualitas Laba | Labanya bisa dipercaya dan berulang, atau cuma di atas kertas |
 * | Aliran Asing | Siapa yang sedang menambah dan siapa yang sedang keluar |
 * | Skor & Pilar | Di mana masing-masing kuat — inilah satu-satunya tempat lima kolom benar-benar lebih berguna daripada lima halaman |
 *
 * Yang sengaja TIDAK ikut: lintasan laba lima tahun, denyut kuartalan, laporan
 * keuangan penuh, glosarium. Semuanya berupa DERET — satu emiten per grafik.
 * Disandingkan sebagai angka tunggal, deret kehilangan justru bagian yang
 * membuatnya berarti, dan pembacanya lebih baik membuka Bedah masing-masing.
 */
const DEF: DefGrup[] = [
  {
    judul: 'Harga & Ukuran',
    baris: [
      {
        label: 'Harga',
        ambil: (h) => sel(ada(h.fd?.last_price) ? `Rp ${keFraksi(h.fd!.last_price!).toLocaleString('id-ID')}` : null),
      },
      {
        // Perubahan 52 minggu, BUKAN perubahan sehari: berkas fundamental
        // dipanen berkala dan `prev_close`-nya bisa berumur beberapa hari —
        // "perubahan hari ini" yang dihitung darinya akan salah tanpa satu pun
        // galat. Rentang setahun tak punya masalah itu dan lebih berguna
        // disandingkan.
        label: 'Perubahan 52 minggu',
        ambil: (h) => sel(persenTanda(h.fd?.week52_change_pct), arahDari(h.fd?.week52_change_pct)),
      },
      { label: 'Kapitalisasi pasar', ambil: (h) => sel(h.fd?.market_cap ? fMC(h.fd.market_cap) : null) },
      { label: 'Nilai transaksi harian', ambil: (h) => sel(h.trx ? fMC(h.trx.value) : null) },
      {
        label: 'Volume vs rerata 20 hari',
        ambil: (h) => sel(ada(h.trx?.banding20) ? `${h.trx!.banding20!.toFixed(2)}x` : null),
      },
    ],
  },
  {
    judul: 'Vonis Valuasi',
    baris: [
      { label: 'P/E sekarang', ambil: (h) => sel(ada(h.pe?.kini) ? fvx(h.pe!.kini) : null) },
      { label: 'P/E vs sejarah sendiri', ambil: (h) => sel(h.pe?.vonis ? LABEL_VONIS[h.pe.vonis].replace(' vs sejarah', '') : null) },
      { label: 'P/BV sekarang', ambil: (h) => sel(ada(h.pb?.kini) ? fvx(h.pb!.kini) : null) },
      { label: 'P/BV vs sejarah sendiri', ambil: (h) => sel(h.pb?.vonis ? LABEL_VONIS[h.pb.vonis].replace(' vs sejarah', '') : null) },
      {
        // Netral disengaja (arah 0): di bawah median sektor berarti lebih
        // murah, dan lebih murah bukan sinonim lebih baik.
        label: 'P/E vs median sektor',
        ambil: (h) => sel(persenTanda(h.fd?.pe_vs_sector_pct)),
      },
    ],
  },
  {
    judul: 'Kualitas Laba',
    baris: [
      { label: 'ROE', ambil: (h) => sel(persen(keP(h.fd?.roe), 2)) },
      { label: 'Marjin bersih', ambil: (h) => sel(persen(marjin(h.fd?.npm), 2)) },
      { label: 'DER', ambil: (h) => sel(persen(h.fd ? kualitasLaba(h.fd).der : null, 1)) },
      { label: 'Kas operasi ÷ laba', ambil: (h) => sel(persen(h.fd ? kualitasLaba(h.fd).akrual : null, 0)) },
      { label: 'Imbal hasil dividen', ambil: (h) => sel(persen(h.fd?.dividend_yield, 2)) },
    ],
  },
  {
    judul: 'Aliran Asing',
    baris: [
      {
        // LEMBAR, bukan rupiah — bursa tidak melaporkan nilai rupiah aliran
        // asing dan halaman ini tidak menaksirnya.
        label: 'Net asing 20 hari (lembar)',
        ambil: (h) => sel(
          h.net20 ? `${h.net20.net >= 0 ? '+' : '-'}${fRingkas(Math.abs(h.net20.net))}` : null,
          arahDari(h.net20?.net),
        ),
      },
    ],
  },
  {
    judul: 'Skor & Pilar',
    baris: [
      {
        label: 'Skor fundamental',
        ambil: (h) => sel(h.total.skor != null ? `${h.total.skor.toFixed(0)} · ${labelSkor(h.total.skor)}` : null),
      },
      { label: 'Pilar Pertumbuhan', ambil: (h) => skorPilarSel(h, 'growth') },
      { label: 'Pilar Profitabilitas', ambil: (h) => skorPilarSel(h, 'profit') },
      { label: 'Pilar Kualitas & Neraca', ambil: (h) => skorPilarSel(h, 'quality') },
      { label: 'Pilar Valuasi', ambil: (h) => skorPilarSel(h, 'valuation') },
      { label: 'Pilar Dividen', ambil: (h) => skorPilarSel(h, 'dividend') },
    ],
  },
]

/** Tanggal terbaru di antara beberapa `YYYY-MM-DD`; `null` kalau tak satu pun
 *  berbentuk tanggal. Perbandingan teks cukup — ISO terurut leksikografis. */
function terbaru(xs: (string | null | undefined)[]): string | null {
  const sah = xs.filter((x): x is string => typeof x === 'string' && /^\d{4}-\d{2}-\d{2}/.test(x)).map((x) => x.slice(0, 10))
  return sah.length ? sah.sort()[sah.length - 1] : null
}

/**
 * Menyusun tabel banding. Kolom lebih dari `MAKS_BANDING` **dipotong di sini
 * juga** — layar sudah menolak yang keenam dengan pesan, tapi fungsi ini tak
 * boleh mengandalkan pemanggilnya untuk itu: satu pemanggil kedua yang lupa
 * memeriksanya akan menghasilkan gambar selebar apa pun tanpa satu pun galat.
 */
export function susunBanding(sumber: SumberBanding[]): TabelBanding {
  const dipakai = sumber.slice(0, MAKS_BANDING)
  const h = dipakai.map(hitung)
  return {
    kolom: h.map((x) => ({ kode: x.kode, nama: x.nama, ada: x.fd != null })),
    grup: DEF.map((g) => ({
      judul: g.judul,
      baris: g.baris.map((b) => ({ label: b.label, sel: h.map(b.ambil) })),
    })),
    tanggalPasar: terbaru(h.map((x) => x.trx?.tanggal)),
    tanggalFundamental: terbaru(h.map((x) => x.fd?.updated)),
  }
}

/** Kalimat tanggal yang dipakai layar MAUPUN gambar — satu ejaan, supaya
 *  keduanya tak bisa menyebut tanggal yang berbeda. */
export function kalimatTanggal(t: TabelBanding): string {
  const bagian: string[] = []
  if (t.tanggalPasar) bagian.push(`Transaksi ${tanggalPendek(t.tanggalPasar)}`)
  if (t.tanggalFundamental) bagian.push(`fundamental ${tanggalPendek(t.tanggalFundamental)}`)
  return bagian.length ? bagian.join(' · ') : 'Tanggal data belum tersedia'
}

/* ────────────────────────── gambar ────────────────────────── */

export interface PaletGambar {
  latar: string
  zebra: string
  garis: string
  teks: string
  teks2: string
  teks3: string
  aksen: string
  naik: string
  turun: string
}

/**
 * Palet TETAP, bukan dibaca dari variabel CSS saat itu.
 *
 * Nilainya disalin dari token `.lantai` (`lantai.css`) supaya gambarnya sewarna
 * dengan halaman, tapi disalin — bukan dibaca lewat `getComputedStyle`.
 * Alasannya: gambar ini beredar lepas dari situsnya, dan hasil `getComputedStyle`
 * bergantung pada elemen mana yang kebetulan dilewatkan dan apakah gaya halaman
 * sudah termuat. Kalau salah satunya meleset, yang terjadi bukan galat
 * melainkan gambar berwarna hitam-di-atas-hitam yang tetap terunduh dengan
 * sukses.
 */
export const PALET: Record<'dark' | 'light', PaletGambar> = {
  dark: {
    latar: '#14151A',
    zebra: '#1A1C22',
    garis: '#24262E',
    teks: '#EAEAEE',
    teks2: '#9CA0AC',
    teks3: '#888D99',
    aksen: '#F2C230',
    naik: '#38B77E',
    turun: '#E6635A',
  },
  light: {
    latar: '#FCFCFB',
    zebra: '#EEF0ED',
    garis: '#DDE0DC',
    teks: '#16181A',
    teks2: '#525860',
    teks3: '#5F656D',
    aksen: '#7A5E00',
    naik: '#197047',
    turun: '#B73A31',
  },
}

/** Ukuran tetap gambar, dalam piksel LOGIS (pemanggil yang mengalikan dengan
 *  rasio piksel perangkat). Angkanya sengaja lapang: gambar ini dibaca di
 *  layar telepon setelah dikirim ulang lewat percakapan, dan huruf 10px yang
 *  masih terbaca di monitor akan hilang di situ. */
export const UKUR = {
  pad: 24,
  lebarLabel: 200,
  lebarKolom: 140,
  tinggiJudul: 76,
  tinggiKepalaKolom: 44,
  tinggiJudulGrup: 30,
  tinggiBaris: 28,
  tinggiKaki: 56,
} as const

/** Font stack SISTEM, bukan webfont halaman. Webfont yang belum selesai
 *  termuat membuat kanvas diam-diam memakai font pengganti dan seluruh lebar
 *  kolom meleset — persis kegagalan senyap yang jadi alasan tidak memakai
 *  pustaka tangkap-layar. */
const FONT = '"Segoe UI", system-ui, -apple-system, sans-serif'

export function ukuranBanding(t: TabelBanding): { lebar: number; tinggi: number } {
  const barisTotal = t.grup.reduce((s, g) => s + g.baris.length, 0)
  return {
    lebar: UKUR.pad * 2 + UKUR.lebarLabel + Math.max(1, t.kolom.length) * UKUR.lebarKolom,
    tinggi:
      UKUR.tinggiJudul
      + UKUR.tinggiKepalaKolom
      + t.grup.length * UKUR.tinggiJudulGrup
      + barisTotal * UKUR.tinggiBaris
      + UKUR.tinggiKaki,
  }
}

/** Nama berkas unduhan — kode emiten + tanggal DATA, bukan tanggal unduh. */
export function namaBerkasBanding(t: TabelBanding): string {
  const kode = t.kolom.map((k) => k.kode).join('-') || 'kosong'
  const tgl = t.tanggalPasar ?? t.tanggalFundamental ?? 'tanpa-tanggal'
  return `PAPAN-banding-${kode}-${tgl}.png`
}

/** Potong teks yang tak muat, dengan elipsis. Kanvas tak punya `text-overflow`
 *  — tanpa ini nama emiten panjang menimpa kolom sebelahnya dan hasilnya tetap
 *  berupa PNG yang terlihat jadi. */
function potong(ctx: CanvasRenderingContext2D, teks: string, maks: number): string {
  if (ctx.measureText(teks).width <= maks) return teks
  let s = teks
  while (s.length > 1 && ctx.measureText(s + '…').width > maks) s = s.slice(0, -1)
  return s + '…'
}

/**
 * Menggambar seluruh tabel banding ke konteks kanvas yang disuntikkan.
 *
 * MURNI terhadap peramban: tak membuat elemen, tak membaca gaya, tak menyentuh
 * `document`. Yang dibutuhkannya dari `ctx` cuma `fillRect`, `fillText`,
 * `measureText`, dan penyetel `font`/`fillStyle`/`textAlign` — cukup sedikit
 * untuk ditiru objek pencatat di uji, dan itu memang cara ia dibuktikan.
 *
 * Koordinat dalam piksel LOGIS. Untuk layar ber-DPR tinggi, pemanggil
 * menyetel `canvas.width = lebar * dpr` lalu `ctx.scale(dpr, dpr)` sebelum
 * memanggil ini.
 */
export function gambarBanding(ctx: CanvasRenderingContext2D, t: TabelBanding, palet: PaletGambar): void {
  const { lebar, tinggi } = ukuranBanding(t)
  const x0 = UKUR.pad
  const xKolom = (i: number) => x0 + UKUR.lebarLabel + i * UKUR.lebarKolom
  /** Angka rata KANAN di dalam kolomnya — kolom angka yang rata kiri tak bisa
   *  dibandingkan sekilas, dan membandingkan sekilas itu seluruh gunanya. */
  const xKanan = (i: number) => xKolom(i) + UKUR.lebarKolom - 14

  ctx.fillStyle = palet.latar
  ctx.fillRect(0, 0, lebar, tinggi)
  ctx.textBaseline = 'middle'

  /* ── Judul ── */
  ctx.textAlign = 'left'
  ctx.fillStyle = palet.aksen
  ctx.font = `700 19px ${FONT}`
  ctx.fillText('PAPAN · Banding Emiten', x0, 30)

  ctx.fillStyle = palet.teks2
  ctx.font = `400 12px ${FONT}`
  ctx.fillText(kalimatTanggal(t), x0, 52)

  ctx.fillStyle = palet.garis
  ctx.fillRect(x0, UKUR.tinggiJudul - 10, lebar - x0 * 2, 1)

  /* ── Kepala kolom ── */
  let y = UKUR.tinggiJudul
  ctx.fillStyle = palet.teks3
  ctx.font = `600 11px ${FONT}`
  ctx.fillText('RUAS', x0, y + 22)
  t.kolom.forEach((k, i) => {
    ctx.textAlign = 'right'
    ctx.fillStyle = palet.teks
    ctx.font = `700 15px ${FONT}`
    ctx.fillText(k.kode, xKanan(i), y + 14)
    ctx.fillStyle = palet.teks3
    ctx.font = `400 10px ${FONT}`
    ctx.fillText(potong(ctx, k.ada ? k.nama : 'belum terpanen', UKUR.lebarKolom - 18), xKanan(i), y + 30)
    ctx.textAlign = 'left'
  })
  y += UKUR.tinggiKepalaKolom
  ctx.fillStyle = palet.garis
  ctx.fillRect(x0, y - 1, lebar - x0 * 2, 1)

  /* ── Grup & baris ── */
  let ganjil = false
  for (const g of t.grup) {
    ctx.fillStyle = palet.aksen
    ctx.font = `700 11px ${FONT}`
    ctx.textAlign = 'left'
    ctx.fillText(g.judul.toUpperCase(), x0, y + UKUR.tinggiJudulGrup / 2 + 2)
    y += UKUR.tinggiJudulGrup
    ganjil = false

    for (const b of g.baris) {
      if (ganjil) {
        ctx.fillStyle = palet.zebra
        ctx.fillRect(x0 - 8, y, lebar - (x0 - 8) * 2, UKUR.tinggiBaris)
      }
      ganjil = !ganjil

      ctx.textAlign = 'left'
      ctx.fillStyle = palet.teks2
      ctx.font = `400 12px ${FONT}`
      ctx.fillText(potong(ctx, b.label, UKUR.lebarLabel - 10), x0, y + UKUR.tinggiBaris / 2)

      ctx.textAlign = 'right'
      b.sel.forEach((s, i) => {
        ctx.fillStyle = s.arah === 1 ? palet.naik : s.arah === -1 ? palet.turun : palet.teks
        ctx.font = `600 12.5px ${FONT}`
        ctx.fillText(potong(ctx, s.teks, UKUR.lebarKolom - 18), xKanan(i), y + UKUR.tinggiBaris / 2)
      })
      ctx.textAlign = 'left'
      y += UKUR.tinggiBaris
    }
  }

  /* ── Kaki ──
     Dua kalimat, dan keduanya wajib: gambar ini akan dibaca oleh orang yang
     tak pernah melihat halamannya, jadi ia harus menjelaskan dirinya sendiri.
     Yang TIDAK boleh ada di sini: nama berkas sumber, nama endpoint, atau
     angka ambang skor. */
  ctx.fillStyle = palet.garis
  ctx.fillRect(x0, y + 10, lebar - x0 * 2, 1)
  ctx.fillStyle = palet.teks3
  ctx.font = `400 11px ${FONT}`
  ctx.fillText('Ruas yang belum tersedia ditulis “—”, tidak pernah nol. Skor dari aturan tetap, bukan model bahasa.', x0, y + 28)
  ctx.fillText('Bahan analisa, bukan rekomendasi atau saran investasi. Angka fundamental tertinggal dari harga.', x0, y + 44)
}

/* ────────────────────── pemicu unduh (butuh peramban) ────────────────────── */

/**
 * Satu-satunya bagian berkas ini yang menyentuh DOM, dan sengaja dijaga tetap
 * sependek mungkin: membuat kanvas, memanggil `gambarBanding`, mengunduh.
 * Tak ada satu pun keputusan tata letak di sini — semuanya sudah diputuskan di
 * fungsi murni di atas, yang bisa dibuktikan tanpa peramban.
 *
 * Pola kanvas → `toDataURL` → `<a download>` sama persis dengan tombol kamera
 * di halaman Grafik Emiten.
 */
export function unduhBandingPng(t: TabelBanding, tema: 'dark' | 'light'): void {
  const { lebar, tinggi } = ukuranBanding(t)
  const dpr = Math.min(3, Math.max(1, Math.round(window.devicePixelRatio || 1)))
  const kanvas = document.createElement('canvas')
  kanvas.width = lebar * dpr
  kanvas.height = tinggi * dpr
  const ctx = kanvas.getContext('2d')
  if (!ctx) return
  ctx.scale(dpr, dpr)
  gambarBanding(ctx, t, PALET[tema])
  const a = document.createElement('a')
  a.download = namaBerkasBanding(t)
  a.href = kanvas.toDataURL('image/png')
  a.click()
}
