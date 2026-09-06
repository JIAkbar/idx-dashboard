/**
 * Kolom label BERSAMA di tepi kanan chart — dipakai semua primitive yang
 * menulis harga di sana: Pivot/CPR (`pitaCprChart.ts`), RBS
 * (`polaRbsChart.ts`), dan garis AVG broker (`garisAvgBroker.ts`).
 *
 * Akar masalahnya (#47, Johan: "label level bertumpuk — Pivot R1–R3/S1–S3 di
 * tepi kanan, RBS 6.625/6.588 berhimpit") BUKAN "tak ada penata". Penatanya
 * sudah ada, tiga buah, satu di tiap primitive: masing-masing mengurutkan
 * labelnya sendiri lalu mendorong yang bertindih ke bawah. Tiap satunya rapi
 * secara internal dan buta terhadap dua yang lain — padahal ketiganya
 * menggambar di kanvas yang sama, di frame yang sama, di kolom yang sama.
 * Menambah penata keempat di dalam salah satunya tak akan menyelesaikan apa
 * pun; yang kurang adalah SATU daftar pita terpakai yang dibaca bersama.
 *
 * Sekalian ditutup cacat penata lama: ia hanya mendorong KE BAWAH, tanpa
 * batas. Label yang levelnya berkerumun di dasar panel terdorong keluar
 * kanvas dan hilang tanpa jejak — persis di saat level paling rapat, yaitu
 * saat fiturnya paling dibutuhkan. Di sini, kalau dorongan ke bawah keluar
 * batas, pencariannya diulang ke ATAS.
 */

export interface Band {
  /** Tepi atas pita terpakai, piksel bitmap. */
  y0: number
  y1: number
}

export interface Batas {
  atas: number
  bawah: number
}

/**
 * Cari posisi tepi-atas bebas untuk sebuah label setinggi `tinggi`, sedekat
 * mungkin ke `mau`, tanpa menindih satu pun pita di `terisi`.
 *
 * Coba turun dulu (arah yang sudah jadi kebiasaan ketiga primitive, jadi
 * tampilannya tak berubah selama masih muat), dan baru coba naik kalau hasil
 * turunnya menembus `batas.bawah`.
 */
export function cariSlot(mau: number, tinggi: number, terisi: Band[], batas: Batas): number {
  const turun = geser(mau, tinggi, terisi, 1)
  if (turun + tinggi <= batas.bawah) return Math.max(batas.atas, turun)
  const naik = geser(mau, tinggi, terisi, -1)
  if (naik >= batas.atas) return naik
  // Ruangnya memang habis — label sebanyak ini tak muat di panel setinggi ini.
  // Dijepit ke dalam kanvas dan dibiarkan bertindih: bertindih masih terbaca
  // sebagian, di luar kanvas tidak terbaca sama sekali.
  return Math.max(batas.atas, Math.min(mau, batas.bawah - tinggi))
}

/**
 * Geser `mau` satu arah sampai tak menindih pita mana pun.
 *
 * Berhenti pasti: tiap tabrakan memindahkan y melewati pita itu seluruhnya
 * (turun ke `y1`, naik ke `y0 - tinggi`), jadi pita yang sama tak bisa
 * menabrak dua kali dan jumlah putarannya terbatas sebanyak pita.
 */
function geser(mau: number, tinggi: number, terisi: Band[], arah: 1 | -1): number {
  let y = mau
  for (let putar = 0; putar <= terisi.length; putar++) {
    const bentrok = terisi.find((b) => y < b.y1 && y + tinggi > b.y0)
    if (!bentrok) return y
    y = arah === 1 ? bentrok.y1 : bentrok.y0 - tinggi
  }
  return y
}

/**
 * Daftar pita terpakai untuk SATU frame gambar, dibagi lintas primitive.
 *
 * Batas frame dikenali dari peserta yang menyetor dua kali: tiap primitive
 * menggambar tepat sekali per frame, jadi melihat `id` yang sama lagi berarti
 * frame sudah berganti. Cara ini tak perlu tahu ada berapa primitive yang
 * aktif — dan itu penting, karena Pivot, RBS, dan AVG broker masing-masing
 * bisa dimatikan pengguna, dan `renderer()` yang mengembalikan null tak
 * pernah sampai menggambar.
 */
export class KolomLabel {
  private terisi: Band[] = []
  private hadir = new Set<string>()

  /** Dipanggil sekali di awal penggambaran label tiap primitive. */
  mulai(id: string): void {
    if (this.hadir.has(id)) {
      this.hadir.clear()
      this.terisi = []
    }
    this.hadir.add(id)
  }

  /** Ambil satu slot bebas dan tandai terpakai. Kembaliannya tepi ATAS. */
  pesan(mau: number, tinggi: number, batas: Batas): number {
    const y = cariSlot(mau, tinggi, this.terisi, batas)
    this.terisi.push({ y0: y, y1: y + tinggi })
    return y
  }
}

/**
 * Penunjuk tipis dari label yang tergeser ke garis harganya.
 *
 * Perlu justru karena penataan berhasil: pill RBS 6.625 bisa berakhir DI BAWAH
 * label S3 6.458 walau harganya lebih tinggi, dan tanpa penunjuk pembaca tak
 * punya cara tahu garis mana miliknya. Tak digambar kalau labelnya memang
 * masih di garisnya.
 *
 * Bentuknya SIKU (mendatar sedikit, lalu tegak), bukan diagonal. Diagonal
 * sudah dicoba dan salah baca: pergeserannya bisa 150 piksel sementara
 * lebarnya cuma 10, jadi garisnya tampil sebagai coretan miring panjang yang
 * menyerupai garis tren di tengah lilin. Siku terbaca sebagai penunjuk.
 */
export function garisPenunjuk(
  ctx: CanvasRenderingContext2D,
  xLabel: number, xUjung: number,
  yLabel: number, yGaris: number,
  warna: string, tebal: number,
): void {
  if (Math.abs(yLabel - yGaris) <= tebal * 2) return
  ctx.save()
  ctx.strokeStyle = warna
  ctx.globalAlpha = 0.55
  ctx.lineWidth = tebal
  ctx.setLineDash([])
  ctx.beginPath()
  ctx.moveTo(xLabel, yLabel)
  ctx.lineTo(xUjung, yLabel)
  ctx.lineTo(xUjung, yGaris)
  ctx.stroke()
  ctx.restore()
}

const perChart = new WeakMap<object, KolomLabel>()

/** Kolom milik satu chart — kuncinya objek chart dari `attached()`. */
export function kolomLabel(kunci: object): KolomLabel {
  let k = perChart.get(kunci)
  if (!k) {
    k = new KolomLabel()
    perChart.set(kunci, k)
  }
  return k
}
