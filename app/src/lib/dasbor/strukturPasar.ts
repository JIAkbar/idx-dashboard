import type { LilinData } from './grafikEmiten'

/**
 * Struktur pasar: swing high/low, label HH/HL/LH/LL, dan patahan struktur
 * (BOS / CHoCH). Johan 21 Agu 2026: "buatkan juga HL LL HH Swing Low Swing
 * High cari web search yaa, lalu buatkan pola itu cek ke validitas nya di 1D
 * 4H backtest di beberapa saham".
 *
 * ## Definisinya, dan dari mana asalnya
 *
 * Metodenya baku dan sengaja dipilih yang paling sederhana yang masih benar:
 * sebuah lilin disebut **swing high** kalau tinggi-nya melampaui tinggi `N`
 * lilin di kiri DAN `N` lilin di kanannya. Swing low kebalikannya. Sekali `N`
 * ditetapkan, deteksinya sepenuhnya mekanis — dan itulah yang membuatnya bisa
 * diuji, bukan diperdebatkan.
 *
 * Williams Fractals adalah kasus khusus berlebar tetap `N = 2`. Jadi setiap
 * fraktal adalah swing, tapi tidak setiap swing adalah fraktal — dan itu
 * alasan `N` di sini bisa disetel, bukan dikunci di 2.
 *
 * Yang WAJIB disadari dan sering dilupakan: swing paling kanan baru bisa
 * dipastikan sesudah `N` lilin berikutnya terbentuk. Deteksi yang mengabaikan
 * itu akan "menemukan" swing di lilin terakhir, lalu membatalkannya besok —
 * bentuk kebocoran masa depan yang membuat backtest terlihat jauh lebih baik
 * daripada kenyataannya. Di sini `N` lilin terakhir memang tak pernah
 * dilabeli, dan itu disengaja.
 *
 * Rujukan metode: LuxAlgo "Swing High/Low" & "Swing Structure Grammar",
 * Quantum Algo "How to Identify Swing Highs and Lows Correctly".
 */

export type JenisSwing = 'high' | 'low'

/** Label struktur relatif terhadap swing SEJENIS sebelumnya. */
export type LabelStruktur = 'HH' | 'LH' | 'HL' | 'LL'

export interface Swing {
  i: number
  waktu: string
  harga: number
  jenis: JenisSwing
  /** null untuk swing pertama tiap jenis — tak ada pembanding. */
  label: LabelStruktur | null
}

export const N_SWING_BAWAAN = 5

/**
 * Cari swing high & low.
 *
 * Perbandingannya memakai `>=` ke kiri dan `>` ke kanan (kebalikannya untuk
 * low). Bukan kerapian: pada deret datar — yang sering terjadi di emiten tipis
 * IDX — perbandingan simetris `>` di kedua sisi membuang SELURUH swing, dan
 * perbandingan `>=` di kedua sisi menandai setiap lilin dalam datarnya. Yang
 * dipakai di sini menandai tepat satu lilin: yang terakhir dari deretan datar.
 */
export function cariSwing(lilin: LilinData[], n = N_SWING_BAWAAN): Swing[] {
  if (n < 1 || lilin.length < n * 2 + 1) return []
  const mentah: Array<Omit<Swing, 'label'>> = []
  for (let i = n; i < lilin.length - n; i++) {
    let tinggi = true
    let rendah = true
    for (let k = 1; k <= n; k++) {
      if (lilin[i].high < lilin[i - k].high) tinggi = false
      if (lilin[i].high <= lilin[i + k].high) tinggi = false
      if (lilin[i].low > lilin[i - k].low) rendah = false
      if (lilin[i].low >= lilin[i + k].low) rendah = false
      if (!tinggi && !rendah) break
    }
    if (tinggi) mentah.push({ i, waktu: lilin[i].time, harga: lilin[i].high, jenis: 'high' })
    // Satu lilin bisa jadi swing high DAN swing low sekaligus kalau ia lilin
    // rentang lebar di antara lilin-lilin sempit. Keduanya dicatat — membuang
    // salah satunya berarti memilih tanpa dasar.
    if (rendah) mentah.push({ i, waktu: lilin[i].time, harga: lilin[i].low, jenis: 'low' })
  }

  let hiSebelum: number | null = null
  let loSebelum: number | null = null
  return mentah.map((s) => {
    let label: LabelStruktur | null = null
    if (s.jenis === 'high') {
      if (hiSebelum !== null) label = s.harga > hiSebelum ? 'HH' : 'LH'
      hiSebelum = s.harga
    } else {
      if (loSebelum !== null) label = s.harga > loSebelum ? 'HL' : 'LL'
      loSebelum = s.harga
    }
    return { ...s, label }
  })
}

export type ArahStruktur = 'naik' | 'turun' | 'sisi'

/**
 * Arah struktur dari dua swing terakhir tiap jenis.
 *
 * "Naik" hanya kalau KEDUANYA sepakat (HH dan HL), "turun" kalau LH dan LL.
 * Kalau keduanya berlawanan — HH tapi LL, artinya rentangnya melebar ke dua
 * arah — jawabannya `sisi`, bukan memilih salah satu. Struktur yang belum
 * jelas jauh lebih sering daripada yang diakui kebanyakan alat.
 */
export function arahStruktur(swing: Swing[]): ArahStruktur {
  const hi = swing.filter((s) => s.jenis === 'high').at(-1)
  const lo = swing.filter((s) => s.jenis === 'low').at(-1)
  if (!hi?.label || !lo?.label) return 'sisi'
  if (hi.label === 'HH' && lo.label === 'HL') return 'naik'
  if (hi.label === 'LH' && lo.label === 'LL') return 'turun'
  return 'sisi'
}

export interface Patahan {
  i: number
  waktu: string
  harga: number
  /** BOS = struktur berlanjut; CHoCH = struktur berbalik. */
  jenis: 'BOS' | 'CHoCH'
  arah: 'naik' | 'turun'
}

/**
 * Patahan struktur: lilin yang menutup MELEWATI swing terakhir.
 *
 * Dipakai penutupan, bukan sentuhan tinggi/rendah — sumbu yang menembus lalu
 * ditarik kembali adalah kejadian paling sering di papan tipis, dan
 * menghitungnya sebagai patahan membuat sinyal ini berdengung terus-menerus.
 *
 * BOS vs CHoCH dibedakan dari arah struktur SEBELUM patahannya: menembus ke
 * atas saat struktur sudah naik itu kelanjutan (BOS); menembus ke atas saat
 * struktur sedang turun itu perubahan watak (CHoCH).
 */
export function cariPatahan(lilin: LilinData[], swing: Swing[]): Patahan[] {
  const keluar: Patahan[] = []
  let hi: Swing | null = null
  let lo: Swing | null = null
  let arah: ArahStruktur = 'sisi'
  const urut = [...swing].sort((a, b) => a.i - b.i)
  let p = 0

  for (let i = 0; i < lilin.length; i++) {
    // Swing baru boleh dipakai hanya SESUDAH lilin konfirmasinya lewat.
    while (p < urut.length && urut[p].i <= i) {
      const s = urut[p++]
      if (s.jenis === 'high') hi = s
      else lo = s
      const h = urut.filter((x) => x.jenis === 'high' && x.i <= s.i).at(-1)
      const l = urut.filter((x) => x.jenis === 'low' && x.i <= s.i).at(-1)
      if (h?.label && l?.label) {
        arah = h.label === 'HH' && l.label === 'HL' ? 'naik'
          : h.label === 'LH' && l.label === 'LL' ? 'turun' : arah
      }
    }
    const c = lilin[i].close
    if (hi && c > hi.harga) {
      keluar.push({ i, waktu: lilin[i].time, harga: hi.harga, arah: 'naik', jenis: arah === 'turun' ? 'CHoCH' : 'BOS' })
      arah = 'naik'
      hi = null
    } else if (lo && c < lo.harga) {
      keluar.push({ i, waktu: lilin[i].time, harga: lo.harga, arah: 'turun', jenis: arah === 'naik' ? 'CHoCH' : 'BOS' })
      arah = 'turun'
      lo = null
    }
  }
  return keluar
}

/**
 * Zona Pembalikan Potensial (PRZ) untuk pola harmonik XABCD.
 *
 * Yang membedakannya dari titik D biasa, dan ini inti definisinya: PRZ bukan
 * satu harga melainkan RENTANG tempat beberapa proyeksi Fibonacci dari kaki
 * yang berbeda berkumpul. Satu rasio yang kebetulan cocok tidak cukup —
 * rujukan mensyaratkan beberapa pengukuran mengelompok dalam pita sempit.
 *
 * Tiga proyeksi yang dipakai, sesuai rujukan:
 *   1. retracement XA (0,786 untuk Gartley, 0,886 untuk Bat, dst)
 *   2. proyeksi BC (1,27 dan 1,618)
 *   3. AB=CD — panjang CD menyamai AB
 *
 * `lebarPersen` mengukur seberapa rapat kumpulannya terhadap harga. Kumpulan
 * yang lebar bukan PRZ; ia cuma tiga angka yang kebetulan berdekatan.
 */
export interface Prz {
  bawah: number
  atas: number
  tengah: number
  /** Lebar zona relatif terhadap harga tengahnya, persen. Makin kecil makin rapat. */
  lebarPersen: number
  /** Nilai tiap proyeksi, untuk ditunjukkan apa adanya. */
  proyeksi: Array<{ nama: string; harga: number }>
}

export function hitungPrz(
  x: number, a: number, b: number, c: number,
  retraceXa: number,
): Prz | null {
  if (![x, a, b, c].every((v) => Number.isFinite(v))) return null
  const xa = a - x
  const bc = c - b
  const ab = b - a
  if (xa === 0) return null

  const proyeksi = [
    { nama: `XA ${retraceXa}`, harga: a - xa * retraceXa },
    { nama: 'BC 1.272', harga: c - bc * 1.272 },
    { nama: 'BC 1.618', harga: c - bc * 1.618 },
    { nama: 'AB=CD', harga: c + ab },
  ].filter((p) => Number.isFinite(p.harga))
  if (proyeksi.length < 3) return null

  const nilai = proyeksi.map((p) => p.harga)
  const bawah = Math.min(...nilai)
  const atas = Math.max(...nilai)
  const tengah = (bawah + atas) / 2
  if (tengah === 0) return null
  return { bawah, atas, tengah, lebarPersen: ((atas - bawah) / Math.abs(tengah)) * 100, proyeksi }
}
