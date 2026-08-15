/**
 * Perhitungan seasonality — lima lapis, dan tiap lapis menambal satu cara
 * tabel seasonality biasa menyesatkan pembacanya.
 *
 * Yang beredar di aplikasi sekuritas umumnya berhenti di satu angka:
 * "peluang naik Juli 80%". Empat masalahnya, dan penawarnya di sini:
 *
 * 1. **Sampel tipis dibaca seolah pasti.** 4 dari 5 tahun jadi "80%", padahal
 *    selang kepercayaannya kira-kira 38–96%. → `peluangTersusut` menariknya
 *    ke peluang dasar emiten itu sendiri sesuai ketipisan sampel.
 * 2. **Ketidakpastian disembunyikan.** → `selangWilson` menampilkan
 *    rentangnya, bukan cuma titiknya.
 * 3. **Musiman pasar tertukar dengan musiman emiten.** Juli hijau di banyak
 *    emiten karena Juli memang bulan bagus untuk IHSG. → `unggulPasar`
 *    menghitung peluang emiten MENGALAHKAN IHSG di bulan yang sama.
 * 4. **Dua belas bulan diperiksa sekaligus, jadi salah satu pasti menonjol
 *    walau datanya acak.** → `ujiPermutasi` mengukur seberapa sering pola
 *    sekuat itu muncul dari urutan bulan yang diacak.
 *
 * Seluruh berkas ini murni fungsi — tanpa React, tanpa jaringan — supaya
 * bisa diuji tanpa merender apa pun (lihat seasonality.test.ts).
 */

export const BULAN = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
] as const

/** `{ "YYYY-MM": persen }` — bentuk berkas imbal_<HURUF>.json. */
export type SeriImbal = Record<string, number>

export interface RingkasBulan {
  /** 1-12. */
  bulan: number
  /** Semua imbal bulan kalender ini, terurut tahun. */
  nilai: Array<{ tahun: number; persen: number }>
  n: number
  naik: number
  /** naik/n × 100 — angka mentah, yang dipakai tabel sekuritas umum. */
  mentah: number
  /** Ditarik ke peluang dasar emiten sesuai ketipisan sampel. */
  tersusut: number
  /** Selang kepercayaan 95% (Wilson) dari angka MENTAH. */
  bawah: number
  atas: number
  median: number
  rata2: number
  /** Berapa kali emiten mengungguli IHSG di bulan yang sama; null kalau
   *  pembandingnya tak tersedia untuk tahun-tahun itu. */
  unggul: number | null
  unggulDari: number | null
}

export interface RingkasEmiten {
  kode: string
  mulai: string
  akhir: string
  /** Peluang naik seluruh bulan — dasar penyusutan. */
  dasar: number
  totalObservasi: number
  perBulan: RingkasBulan[]
  uji: HasilUji | null
}

export interface HasilUji {
  bulanJuara: number
  peluangJuara: number
  pValue: number
  putaran: number
}

/**
 * Peluang tersusut (shrinkage ke peluang dasar).
 *
 *   p̂ = (naik + α·p₀) / (n + α)
 *
 * α = 6 dipilih setara "enam pengamatan bayangan": pada n=5 bobot datanya
 * kurang dari setengah, pada n=25 sudah dominan — kira-kira titik di mana
 * seasonality bulanan mulai layak dipercaya. Bukan angka suci, tapi dipilih
 * sadar dan disebut di antarmuka, bukan disembunyikan.
 */
export const ALFA = 6

export function peluangTersusut(naik: number, n: number, dasar: number): number {
  if (n <= 0) return dasar
  return ((naik + ALFA * (dasar / 100)) / (n + ALFA)) * 100
}

/**
 * Selang kepercayaan 95% Wilson untuk proporsi.
 *
 * Dipilih ketimbang selang normal biasa karena tetap masuk akal di ujung:
 * pada 5 dari 5, selang normal memberi 100%–100% ("pasti"), Wilson memberi
 * kira-kira 57%–100% — yang jujur untuk lima pengamatan.
 */
export function selangWilson(naik: number, n: number, z = 1.96): [number, number] {
  if (n <= 0) return [0, 100]
  const p = naik / n
  const d = 1 + (z * z) / n
  const tengah = p + (z * z) / (2 * n)
  const sebar = z * Math.sqrt((p * (1 - p)) / n + (z * z) / (4 * n * n))
  return [
    Math.max(0, ((tengah - sebar) / d) * 100),
    Math.min(100, ((tengah + sebar) / d) * 100),
  ]
}

function median(a: number[]): number {
  if (!a.length) return 0
  const s = [...a].sort((x, y) => x - y)
  const t = s.length >> 1
  return s.length % 2 ? s[t] : (s[t - 1] + s[t]) / 2
}

/**
 * Generator acak berbenih — hasil uji permutasi harus SAMA tiap kali halaman
 * dibuka. Dengan Math.random, dua orang yang melihat emiten yang sama bisa
 * membaca p-value berbeda, dan angka yang berubah-ubah sendiri tak layak
 * dipakai untuk memutuskan apa pun. Mulberry32.
 */
function acakBerbenih(benih: number): () => number {
  let a = benih >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/**
 * Uji permutasi: seberapa sering bulan juara sekuat ini muncul dari data yang
 * bulannya diacak?
 *
 * Yang diacak adalah PELABELAN bulan, bukan nilainya — imbal aslinya tetap,
 * cuma dipasangkan ke bulan yang berbeda. Dengan begitu yang diuji benar-benar
 * "apakah bulan itu penting", bukan "apakah emitennya volatil".
 */
export function ujiPermutasi(
  imbal: Array<{ bulan: number; persen: number }>,
  putaran = 2000,
  benih = 20260815,
): HasilUji | null {
  if (imbal.length < 24) return null

  const puncak = (pasangan: Array<{ bulan: number; persen: number }>) => {
    const naik = new Array(13).fill(0)
    const total = new Array(13).fill(0)
    for (const { bulan, persen } of pasangan) {
      total[bulan]++
      if (persen > 0) naik[bulan]++
    }
    let terbaik = 0
    let bulanTerbaik = 1
    for (let b = 1; b <= 12; b++) {
      if (total[b] < 3) continue
      const p = (naik[b] / total[b]) * 100
      if (p > terbaik) { terbaik = p; bulanTerbaik = b }
    }
    return { bulan: bulanTerbaik, peluang: terbaik }
  }

  const asli = puncak(imbal)
  const nilai = imbal.map((x) => x.persen)
  const bulanList = imbal.map((x) => x.bulan)
  const rnd = acakBerbenih(benih)

  let lebihEkstrem = 0
  for (let i = 0; i < putaran; i++) {
    // Fisher-Yates pada salinan nilai; label bulan tetap di tempatnya.
    const campur = [...nilai]
    for (let j = campur.length - 1; j > 0; j--) {
      const k = Math.floor(rnd() * (j + 1))
      ;[campur[j], campur[k]] = [campur[k], campur[j]]
    }
    const acakan = puncak(bulanList.map((b, idx) => ({ bulan: b, persen: campur[idx] })))
    if (acakan.peluang >= asli.peluang) lebihEkstrem++
  }

  return {
    bulanJuara: asli.bulan,
    peluangJuara: Math.round(asli.peluang * 10) / 10,
    // +1 di pembilang dan penyebut: p-value tak boleh pernah tepat 0. Nol
    // berarti "mustahil dari kebetulan", padahal yang kita tahu cuma "tidak
    // muncul dalam 2.000 percobaan".
    pValue: (lebihEkstrem + 1) / (putaran + 1),
    putaran,
  }
}

/** Ringkas satu emiten dari seri imbalnya, dengan IHSG sebagai pembanding. */
export function ringkasEmiten(
  kode: string,
  seri: SeriImbal,
  ihsg: SeriImbal = {},
  sejakTahun = 0,
): RingkasEmiten | null {
  const kunci = Object.keys(seri).filter((k) => Number(k.slice(0, 4)) >= sejakTahun).sort()
  if (!kunci.length) return null

  const semua = kunci.map((k) => ({
    bulan: Number(k.slice(5, 7)),
    tahun: Number(k.slice(0, 4)),
    persen: seri[k],
    kunci: k,
  }))

  const naikSemua = semua.filter((x) => x.persen > 0).length
  const dasar = (naikSemua / semua.length) * 100

  const perBulan: RingkasBulan[] = []
  for (let b = 1; b <= 12; b++) {
    const isi = semua.filter((x) => x.bulan === b)
    const nilai = isi.map((x) => x.persen)
    const naik = nilai.filter((v) => v > 0).length
    const n = nilai.length
    const [bawah, atas] = selangWilson(naik, n)

    // Pembanding pasar hanya dihitung dari bulan yang IHSG-nya memang ada:
    // memakai penyebut penuh akan menghukum emiten atas data yang hilang.
    const dgnPasar = isi.filter((x) => ihsg[x.kunci] !== undefined)
    const unggul = dgnPasar.length ? dgnPasar.filter((x) => x.persen > ihsg[x.kunci]).length : null

    perBulan.push({
      bulan: b,
      nilai: isi.map((x) => ({ tahun: x.tahun, persen: x.persen })),
      n,
      naik,
      mentah: n ? (naik / n) * 100 : 0,
      tersusut: peluangTersusut(naik, n, dasar),
      bawah,
      atas,
      median: median(nilai),
      rata2: n ? nilai.reduce((a, v) => a + v, 0) / n : 0,
      unggul,
      unggulDari: dgnPasar.length || null,
    })
  }

  return {
    kode,
    mulai: kunci[0],
    akhir: kunci[kunci.length - 1],
    dasar,
    totalObservasi: semua.length,
    perBulan,
    uji: ujiPermutasi(semua.map((x) => ({ bulan: x.bulan, persen: x.persen }))),
  }
}

/** Kalimat vonis untuk hasil uji — bahasa manusia, bukan p-value telanjang. */
export function vonisUji(uji: HasilUji | null): { kuat: boolean; teks: string } {
  if (!uji) return { kuat: false, teks: 'Data belum cukup untuk diuji (perlu minimal 24 bulan).' }
  if (uji.pValue < 0.05) {
    return {
      kuat: true,
      teks: `Dari ${uji.putaran.toLocaleString('id-ID')} kali pengacakan urutan bulan, pola sekuat ini muncul kurang dari 5% waktu — sulit disebut kebetulan.`,
    }
  }
  return {
    kuat: false,
    teks: `Pola sekuat ini masih cukup sering muncul dari data acak (p = ${uji.pValue.toFixed(3)}). Belum cukup untuk disebut nyata.`,
  }
}
