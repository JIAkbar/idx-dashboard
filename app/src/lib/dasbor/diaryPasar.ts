import type { BarisOhlc } from './ihsgOhlc'

/**
 * Diary Pasar — kalender IHSG berwarna + tally hari naik/turun + performa
 * beberapa periode.
 *
 * Johan 21 Agu 2026 menaruh dua tangkapan layar di `data ide/`; yang pertama
 * panel "IDX Diary" RTI Business, dengan panah menunjuk baris hitungan hari.
 * Yang ditiru SIFATNYA: satu layar yang menjawab "sebulan ini pasarnya lebih
 * sering naik atau turun, dan seberapa jauh" — bukan tata letak persisnya.
 *
 * Seluruhnya dihitung dari `ihsg_ohlc_ringkas.json` (250 hari bursa, ±13 KB)
 * yang sudah diunduh halaman lain — nol unduhan tambahan. Riwayat 36 tahun
 * (`ihsg_harian.json`, 354 KB) sengaja TIDAK dipakai: periode terpanjang di
 * panel ini 1 tahun, dan 250 hari bursa sudah melampauinya.
 *
 * ## Satu keputusan yang perlu ditulis: hari "datar"
 *
 * IHSG praktis tak pernah tutup di angka yang sama persis, tapi `ihsg_pct`
 * dibulatkan dua desimal dan 0,00% muncul beberapa kali setahun. Hari
 * seperti itu dihitung sebagai DATAR — bukan dipaksa masuk naik atau turun.
 * Tally yang jumlahnya tak sama dengan jumlah hari bursa lebih jujur daripada
 * tally yang memasukkan hari tanpa arah ke salah satu kubu.
 */

/** Arah satu hari bursa. `null` tak dipakai — hari tanpa data tak jadi sel. */
export type ArahHari = 'naik' | 'turun' | 'datar'

export interface SelDiary {
  /** `yyyy-mm-dd`. */
  tanggal: string
  arah: ArahHari
  /** Perubahan penutupan terhadap hari bursa SEBELUMNYA, persen. */
  persen: number
  /** Perubahan dalam poin indeks. */
  poin: number
  tutup: number
}

/** Perubahan hari-ke-hari dari deret OHLC. Baris pertama dibuang: tanpa hari
 *  sebelumnya, perubahannya tak bisa dihitung — dan 0% palsu di sel pertama
 *  akan terbaca sebagai "hari datar" yang tak pernah terjadi. */
export function selDiary(baris: BarisOhlc[]): SelDiary[] {
  const keluar: SelDiary[] = []
  for (let i = 1; i < baris.length; i++) {
    const tutup = baris[i][4]
    const sebelum = baris[i - 1][4]
    if (!(sebelum > 0) || !Number.isFinite(tutup)) continue
    const poin = tutup - sebelum
    const persen = (poin / sebelum) * 100
    // Ambangnya pembulatan dua desimal yang dipakai seluruh halaman, bukan
    // nol matematis: 0,004% tercetak "0,00%" dan menyebutnya "naik" membuat
    // angka di layar bertentangan dengan warnanya sendiri.
    const arah: ArahHari = Math.abs(persen) < 0.005 ? 'datar' : persen > 0 ? 'naik' : 'turun'
    keluar.push({ tanggal: baris[i][0], arah, persen, poin, tutup })
  }
  return keluar
}

export interface TallyDiary {
  hariNaik: number
  hariTurun: number
  hariDatar: number
  /** Jumlah poin SELURUH hari naik di jendela (selalu ≥ 0). */
  poinNaik: number
  /** Jumlah poin seluruh hari turun, sebagai bilangan NEGATIF — supaya
   *  tandanya tak perlu ditebak lagi saat dicetak. */
  poinTurun: number
  /** Poin naik dan turun sebagai persen terhadap penutupan sebelum jendela. */
  persenNaik: number
  persenTurun: number
  /** Selisih bersihnya — persis "30-day Cumulative Up/Down" di panel RTI. */
  poinBersih: number
  persenBersih: number
  /** Berapa hari BURSA yang jatuh di dalam jendela kalender itu — angka yang
   *  dicetak sebagai "n hari naik" + "n hari turun". Tak tetap: 30 hari
   *  kalender berisi 20-22 hari bursa tergantung liburnya. */
  hari: number
}

/**
 * Tally `hariKalender` hari terakhir.
 *
 * **Kalender, bukan hari bursa** — dan itu bukan selera, melainkan hasil
 * pencocokan ke panel yang jadi acuan. Panel RTI 21 Agu 2026 13.54 menyebut
 * "12 days −527,254" untuk sisi turun; jendela 30 hari BURSA memberi angka
 * yang sama sekali lain, sementara 30 hari KALENDER (mulai 22 Juli) memberi
 * **12 hari, −527,250** — cocok sampai desimal ketiga. Sisi naiknya beda satu
 * hari (kita 9/688,810 lawan RTI 10/722,809) karena panel itu diambil saat
 * bursa 21 Agustus masih berjalan sementara data kita berhenti di 20 Agustus;
 * selisih poinnya, ~34, persis sebesar satu hari perdagangan.
 *
 * Penyebut persennya penutupan SEBELUM jendela dimulai — bukan penutupan hari
 * ini. Dengan penyebut hari ini, "poin naik 11,50%" berubah tiap hari walau
 * tak satu pun hari di dalam jendela berubah, dan dua panel bertanggal beda
 * jadi tak bisa dibandingkan sama sekali.
 */
export function tallyDiary(sel: SelDiary[], hariKalender = 30): TallyDiary | null {
  if (!sel.length) return null
  const akhir = new Date(`${sel[sel.length - 1].tanggal}T00:00:00Z`)
  akhir.setUTCDate(akhir.getUTCDate() - hariKalender)
  const mulai = akhir.toISOString().slice(0, 10)
  const potong = sel.filter((x) => x.tanggal >= mulai)
  if (!potong.length) return null
  const awal = potong[0]
  // Penutupan sebelum jendela = tutup hari pertama dikurangi perubahannya.
  const dasar = awal.tutup - awal.poin
  if (!(dasar > 0)) return null
  let hariNaik = 0, hariTurun = 0, hariDatar = 0, poinNaik = 0, poinTurun = 0
  for (const s of potong) {
    if (s.arah === 'naik') { hariNaik++; poinNaik += s.poin }
    else if (s.arah === 'turun') { hariTurun++; poinTurun += s.poin }
    else hariDatar++
  }
  const poinBersih = poinNaik + poinTurun
  return {
    hariNaik, hariTurun, hariDatar, poinNaik, poinTurun,
    persenNaik: (poinNaik / dasar) * 100,
    persenTurun: (poinTurun / dasar) * 100,
    poinBersih,
    persenBersih: (poinBersih / dasar) * 100,
    hari: potong.length,
  }
}

/** Satu baris di blok performa. */
export interface PerformaPeriode {
  id: '1D' | '5D' | '1M' | '3M' | '6M' | 'YTD' | '1Y'
  label: string
  /** `null` = riwayatnya belum cukup panjang untuk periode itu. Nol lebih
   *  buruk daripada tak ada: bar sepanjang nol terbaca "pasar tak bergerak
   *  setahun", yang tak pernah benar. */
  persen: number | null
}

/** Urutan tampil, sama dengan panel RTI yang jadi acuan. */
export const PERIODE_PERFORMA: Array<{ id: PerformaPeriode['id']; label: string }> = [
  { id: '1D', label: '1 Hari' },
  { id: '5D', label: '5 Hari' },
  { id: '1M', label: '1 Bulan' },
  { id: '3M', label: '3 Bulan' },
  { id: '6M', label: '6 Bulan' },
  { id: 'YTD', label: 'Tahun berjalan' },
  { id: '1Y', label: '1 Tahun' },
]

/** Hari bursa terakhir yang tanggalnya ≤ `batas`. `-1` kalau tak ada — deret
 *  yang mulai sesudah `batas` memang tak bisa menjawab periode itu. */
function indeksSampai(baris: BarisOhlc[], batas: string): number {
  for (let i = baris.length - 1; i >= 0; i--) if (baris[i][0] <= batas) return i
  return -1
}

/** Mundur `bulan` bulan kalender dari `tanggal` (`yyyy-mm-dd`). Memakai
 *  aritmetika UTC supaya 31 Maret − 1 bulan jatuh di 28/29 Februari, bukan
 *  meleset sehari karena zona waktu. */
function mundurBulan(tanggal: string, bulan: number): string {
  const d = new Date(`${tanggal}T00:00:00Z`)
  d.setUTCMonth(d.getUTCMonth() - bulan)
  return d.toISOString().slice(0, 10)
}

/**
 * Performa beberapa periode, dari penutupan terakhir.
 *
 * Periode bulanan dihitung dari TANGGAL KALENDER mundur (lalu hari bursa
 * terakhir sebelum tanggal itu), bukan dari "20 lilin ke belakang": pembaca
 * yang membaca "1 Bulan" berharap sebulan kalender, dan jumlah hari bursa per
 * bulan tak tetap — Mei 2026 cuma 12 hari bursa karena libur panjang.
 * `5D` justru sebaliknya: ia memang dimaksudkan lima hari BURSA (sepekan
 * perdagangan), dan lima hari kalender akan mendarat di akhir pekan.
 */
export function performaIhsg(baris: BarisOhlc[]): PerformaPeriode[] {
  const n = baris.length
  if (n < 2) return PERIODE_PERFORMA.map((p) => ({ ...p, persen: null }))
  const akhir = baris[n - 1]
  const kini = akhir[4]

  const dari = (i: number): number | null => {
    if (i < 0 || i >= n - 0) return null
    const dasar = baris[i][4]
    if (!(dasar > 0)) return null
    return (kini / dasar - 1) * 100
  }

  return PERIODE_PERFORMA.map(({ id, label }) => {
    let i: number
    if (id === '1D') i = n - 2
    else if (id === '5D') i = n - 6
    else if (id === 'YTD') {
      // Penutupan terakhir TAHUN SEBELUMNYA — itu titik nol tahun berjalan.
      i = indeksSampai(baris, `${akhir[0].slice(0, 4)}-01-01`)
      // `<= 1 Januari` bisa mendarat tepat di 1 Januari kalau hari itu bursa
      // buka (tak pernah di IDX, tapi deret Yahoo pernah memuatnya).
      if (i >= 0 && baris[i][0].slice(0, 4) === akhir[0].slice(0, 4)) i -= 1
    } else {
      const bulan = id === '1M' ? 1 : id === '3M' ? 3 : id === '6M' ? 6 : 12
      i = indeksSampai(baris, mundurBulan(akhir[0], bulan))
    }
    return { id, label, persen: dari(i) }
  })
}

/** Satu kotak kalender: tanggalnya, dan datanya kalau hari itu bursa buka. */
export interface KotakDiary {
  /** Tanggal 1-31. */
  hari: number
  /** `null` = bursa libur hari itu — kotaknya tetap bernomor, tanpa warna. */
  sel: SelDiary | null
}

/** Satu bulan kalender siap dirender: lima kolom Senin-Jumat per baris.
 *  Akhir pekan tak punya kolom sama sekali — bursa tutup, dan dua kolom
 *  yang selamanya kosong cuma menyempitkan lima kolom yang berisi. */
export interface BulanDiary {
  tahun: number
  /** 1-12. */
  bulan: number
  /** `null` = kotak di luar bulan itu (sebelum tanggal 1 / sesudah akhir). */
  minggu: Array<Array<KotakDiary | null>>
}

/**
 * Susun kalender bulan itu.
 *
 * Tanggalnya IKUT di dalam kotak, tidak dihitung ulang oleh penggambar dari
 * (baris, kolom). Versi pertama melakukan itu dan salah di bulan yang tanggal
 * 1-nya jatuh di akhir pekan: Agustus 2026 mulai Sabtu, sehingga baris nol
 * sebenarnya berisi 3-7 Agustus, tapi rumus penggambarnya menghitung −4..0 dan
 * mengosongkan seluruh pekan pertama. Terlihat di layar sebagai 12 hari
 * "libur" pada bulan yang cuma punya satu hari libur.
 */
export function bulanDiary(sel: SelDiary[], tahun: number, bulan: number): BulanDiary {
  const peta = new Map(sel.map((s) => [s.tanggal, s]))
  const p2 = (x: number) => String(x).padStart(2, '0')
  const hariDalamBulan = new Date(Date.UTC(tahun, bulan, 0)).getUTCDate()
  const minggu: Array<Array<KotakDiary | null>> = []
  let baris: Array<KotakDiary | null> = []
  for (let h = 1; h <= hariDalamBulan; h++) {
    const d = new Date(Date.UTC(tahun, bulan - 1, h))
    const hariPekan = d.getUTCDay() // 0=Minggu, 6=Sabtu
    if (hariPekan === 0 || hariPekan === 6) continue
    // Kolom 0 = Senin. Baris baru dimulai tiap kali Senin datang, jadi bulan
    // yang dimulai di tengah pekan tetap sejajar kolomnya.
    if (hariPekan === 1 && baris.length) { minggu.push(isiPenuh(baris)); baris = [] }
    while (baris.length < hariPekan - 1) baris.push(null)
    baris.push({ hari: h, sel: peta.get(`${tahun}-${p2(bulan)}-${p2(h)}`) ?? null })
  }
  if (baris.length) minggu.push(isiPenuh(baris))
  return { tahun, bulan, minggu }
}

function isiPenuh(baris: Array<KotakDiary | null>): Array<KotakDiary | null> {
  const out = baris.slice()
  while (out.length < 5) out.push(null)
  return out
}
