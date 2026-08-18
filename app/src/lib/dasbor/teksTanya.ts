/**
 * Penanganan TEKS pertanyaan yang dipakai bersama tiga mesin Tanya PAPAN:
 * `tanyaPapan.ts` (blok data), `pengetahuan.ts` (cara kerja platform), dan
 * `glosarium.ts` (arti istilah).
 *
 * Sebelumnya tiap berkas membersihkan teksnya sendiri-sendiri, jadi perbaikan
 * di satu tempat tak terasa di dua tempat lain — "brp" dikenali blok data tapi
 * tidak oleh glosarium. Yang ditaruh di sini cuma yang memang harus SAMA di
 * ketiganya: pembersihan, padanan kata, pelepasan imbuhan, dan toleransi salah
 * ketik.
 */

/** Huruf kecil, tanda baca dibuang, spasi dirapikan. */
export function bersih(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim()
}

/**
 * Padanan kata — cara orang menyebut hal yang sama.
 *
 * Diurut: yang lebih spesifik duluan. "tanggal merah" wajib jadi "tanggal
 * libur" SEBELUM "merah" jadi "turun", kalau tidak pertanyaan kalender berubah
 * jadi pertanyaan saham turun.
 *
 * Yang SENGAJA tidak dipadankan: "menguat"/"melemah". Keduanya dipakai utuh
 * sebagai kata kunci ("menguat kuat", "melemah tajam") di `pengetahuan.ts` —
 * memadankannya ke "naik"/"turun" justru membuat entri itu tak pernah bisa
 * kena lagi.
 */
const PADANAN: [RegExp, string][] = [
  [/\btanggal merah\b/g, 'tanggal libur'],
  [/\bbig player\b|\bbandar besar\b|\bpemain besar\b/g, 'bandar'],
  [/\bgmn\b|\bgmna\b|\bgmana\b/g, 'bagaimana'],
  [/\bbrp\b/g, 'berapa'],
  [/\bskrg\b|\bskg\b|\bsekrang\b/g, 'sekarang'],
  [/\bhrga\b/g, 'harga'],
  [/\bshm\b/g, 'saham'],
  [/\bhijau\b|\bmenghijau\b/g, 'naik'],
  [/\bmerah\b|\bmemerah\b/g, 'turun'],
  [/\bnaek\b/g, 'naik'],
  [/\bgk\b|\bga\b|\bgak\b|\bnggak\b/g, 'tidak'],
]

/** Bentuk baku pertanyaan: dibersihkan lalu dipadankan. Semua pencocokan kata
 *  di ketiga mesin berangkat dari sini. */
export function normalTanya(s: string): string {
  let t = bersih(s)
  for (const [pola, ganti] of PADANAN) t = t.replace(pola, ganti)
  return t.replace(/\s+/g, ' ').trim()
}

/**
 * Imbuhan Indonesia yang dilepas sebelum kata dicocokkan.
 *
 * Inilah yang membuat pencocokan kata-utuh masuk akal di bahasa yang
 * menempelkan imbuhan ke kata dasarnya. "benefitnya" gagal cocok dengan kunci
 * "benefit", "dihitung" gagal dengan "hitung", "keuntungan" gagal dengan
 * "untung" — dan tiap kegagalan itu terbaca pengguna sebagai "AI-nya bodoh",
 * padahal entrinya ada dan isinya benar.
 *
 * Sengaja BUKAN pemenggal kata penuh: stemmer agresif memotong sampai akar
 * yang tak lagi berarti dan justru melahirkan kecocokan palsu. Yang dilepas
 * hanya imbuhan yang jelas bukan bagian kata dasarnya, dan cuma kalau sisanya
 * masih >= 4 huruf.
 */
const AKHIRAN = ['nya', 'kan', 'kah', 'lah', 'pun', 'ku', 'mu']
const AWALAN = ['meng', 'meny', 'mem', 'men', 'ber', 'ter', 'di', 'ke', 'me', 'pe']

export function pangkas(kata: string): string {
  let k = kata
  for (const a of AKHIRAN) {
    if (k.endsWith(a) && k.length - a.length >= 4) { k = k.slice(0, -a.length); break }
  }
  for (const a of AWALAN) {
    if (k.startsWith(a) && k.length - a.length >= 4) { k = k.slice(a.length); break }
  }
  return k
}

/** Bentuk sebuah kata yang dianggap sama: aslinya DAN hasil pangkasnya.
 *  Aslinya tetap disimpan supaya kata yang memang berawalan sama ("kertas",
 *  "kepala", "menu") tak kehilangan bentuk sebenarnya. */
export function bentuk(kata: string): string[] {
  const p = pangkas(kata)
  return p === kata ? [kata] : [kata, p]
}

/** Jarak Levenshtein, berhenti begitu melewati `batas` — dipanggil ribuan kali
 *  per pertanyaan, jadi tak perlu menghitung jarak sebenarnya kalau sudah
 *  pasti terlalu jauh. */
function jarak(a: string, b: string, batas: number): number {
  const m = a.length
  const n = b.length
  let baris = Array.from({ length: n + 1 }, (_, i) => i)
  for (let i = 1; i <= m; i++) {
    const baru = [i]
    let min = i
    for (let j = 1; j <= n; j++) {
      const v = Math.min(
        baris[j] + 1,
        baru[j - 1] + 1,
        baris[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1),
      )
      baru.push(v)
      if (v < min) min = v
    }
    if (min > batas) return batas + 1
    baris = baru
  }
  return baris[n]
}

/**
 * Dua kata dianggap sama walau salah ketik.
 *
 * Ambangnya BERJENJANG menurut panjang kata, dan itu bukan kehati-hatian
 * berlebihan: "ara" dan "arb" berjarak satu huruf tapi artinya berlawanan
 * (batas atas vs batas bawah), begitu juga "datar" dan "daftar". Karena itu
 * kata di bawah 6 huruf WAJIB persis. Huruf pertama juga harus sama — salah
 * ketik hampir tak pernah mengenai huruf pertama, sementara pasangan kata
 * berbeda yang cuma beda huruf pertama justru banyak.
 */
export function mirip(a: string, b: string): boolean {
  if (a === b) return true
  if (vokalHilang(a, b)) return true
  const n = Math.min(a.length, b.length)
  if (n < 6 || a[0] !== b[0]) return false
  // Dua edit hanya diizinkan kalau panjangnya BERBEDA — artinya ada huruf yang
  // hilang/tertambah, bentuk salah ketik yang wajar ("divergen" →
  // "divergensi"). Kalau panjangnya sama, dua edit berarti dua SUBSTITUSI, dan
  // itu sudah cukup untuk melompat ke kata lain yang sah: "pembukaan" dan
  // "pembekuan" berjarak tepat dua substitusi, dan gara-gara itu "apa arti
  // pembukaan dan penutupan bursa" dijawab aturan pembekuan akun kontributor.
  const batas = n >= 8 && a.length !== b.length ? 2 : 1
  if (Math.abs(a.length - b.length) > batas) return false
  return jarak(a, b, batas) <= batas
}

/**
 * Satu kata adalah kata lain yang HURUF VOKALNYA dibuang: "frksi" → "fraksi",
 * "kntributor" → "kontributor".
 *
 * Ini jalan keluar untuk salah ketik pada kata pendek TANPA melonggarkan
 * ambang `mirip()` — pelonggaran itu sudah ditolak sekali dengan alasan yang
 * masih berlaku: "ara" dan "arb" berjarak satu SUBSTITUSI tapi artinya
 * berlawanan. Yang diizinkan di sini cuma PENGHAPUSAN vokal, tak pernah
 * substitusi, jadi pasangan berbahaya itu tetap tak bisa saling cocok:
 * kerangka konsonannya berbeda ("r" lawan "rb"), begitu juga "datar"/"daftar"
 * ("dtr" lawan "dftr").
 *
 * Syaratnya ketat supaya tak melahirkan kecocokan palsu: huruf pertama sama,
 * kerangka konsonan sama persis, yang pendek minimal 4 huruf, dan bedanya
 * paling banyak 3 vokal.
 */
const VOKAL = /[aeiou]/g
function vokalHilang(a: string, b: string): boolean {
  const [pendek, panjang] = a.length <= b.length ? [a, b] : [b, a]
  if (pendek.length < 4 || pendek === panjang) return false
  if (panjang.length - pendek.length > 3) return false
  if (pendek[0] !== panjang[0]) return false
  if (pendek.replace(VOKAL, '') !== panjang.replace(VOKAL, '')) return false
  // Yang pendek harus benar-benar bisa DIPEROLEH dari yang panjang dengan
  // membuang huruf (bukan sekadar berkerangka sama) — tanpa ini "bandar" dan
  // "bunder" dianggap sama karena kerangkanya sama-sama "bndr".
  let i = 0
  for (const c of panjang) if (c === pendek[i]) i++
  return i === pendek.length
}
