/**
 * Pemilih garis rata-rata beli broker di Grafik Emiten (#46).
 *
 * ## Kenapa ini ada
 *
 * Johan, 7 Sep 2026, menunjuk BBCA dengan lima garis AVG yang warnanya
 * hampir sama: *"untuk gratis broker ini warna nya dibedakan lalu tambahkan
 * juga broker asing yang biasanya mengakumulasi misalnya AK BK ZP"*.
 *
 * Dua cacat berbeda dalam satu tangkapan layar:
 *
 * 1. **Warna dari KELOMPOK IDENTITAS, bukan dari garisnya.** Warna lama
 *    diambil dari enam kelompok (`kelompokBroker.ts`), jadi dua broker
 *    sekelompok — XL dan PD dua-duanya ritel — mendapat warna yang sama
 *    persis. Kelompok tetap berguna untuk MEMBACA identitas, tapi tidak bisa
 *    merangkap tugas "bedakan garis satu dari yang lain": jumlah kelompok (6)
 *    lebih sedikit daripada jumlah garis yang mungkin (10).
 * 2. **Peringkat tunggal menenggelamkan broker asing.** Satu daftar "5 net
 *    beli terbesar" hampir selalu diisi broker ritel — nilai transaksinya
 *    berlipat lebih besar — sehingga AK/BK/ZP nyaris tak pernah muncul
 *    walaupun justru merekalah yang ditanyakan.
 *
 * Sekarang: dua peringkat terpisah (lokal & asing, masing-masing 5), warna
 * dari palet kategorikal yang jaraknya terukur, dan broker yang sudah lama
 * tak bertransaksi dikecualikan.
 *
 * ## Sumber sisi lokal/asing — data dulu, kurasi tangan jadi cadangan (#82)
 *
 * Baris antrean #46 menulis tipe Lokal/Asing "ada di data pasar IDX, ruas
 * `type`". Yang diperiksa saat itu adalah rekap broker LEVEL PASAR, dan di
 * sana ruas itu memang tak ada — kesimpulannya benar untuk berkas yang
 * dibuka, dan salah untuk pertanyaannya. Rincian broker PER EMITEN membawa
 * ruas itu di tiap baris, dan sejak #81 ruasnya ikut tersimpan di gudang.
 *
 * Jadi urutannya sekarang: **jenis dari data** kalau harinya sudah dibangun
 * ulang, **kurasi `kelompokBroker.ts` sebagai cadangan** untuk kode yang tak
 * muncul di rentang yang sedang dibaca (dan untuk halaman yang cuma memegang
 * kode broker tanpa datanya). Terukur 2026-08-03 atas 962 emiten: sumbernya
 * menyebut 23 kode asing, kurasi tangan menyebut 17 — enam kode yang benar
 * ada di data tak pernah terbaca asing sebelum ini.
 *
 * Kategori PEMERINTAH dibaca sebagai lokal. Sumbernya punya tiga nilai
 * (terukur: Lokal 2.279 · Asing 1.281 · Pemerintah 301), sementara layar ini
 * cuma punya dua sisi; memetakan pemerintah ke "asing" akan mengubah arti
 * kolomnya. Nilai aslinya tetap tersimpan di gudang, jadi kalau nanti layar
 * perlu tiga sisi, datanya sudah ada tanpa panen ulang.
 */
import { kelompokBroker } from './kelompokBroker'
import { jenisBaris, type BarisBroker } from './brokerEmiten'
import type { AgregatBroker, HariBroker } from './brokerEmiten'

export type SisiBroker = 'lokal' | 'asing'

/**
 * Peta kode broker → sisi, dibaca dari baris gudang hari-hari yang diberikan.
 *
 * Kosong untuk hari yang dipanen sebelum 8 Sep 2026 — baris lama cuma punya
 * lima kolom, dan itu berarti "belum tahu", bukan "lokal". Pemanggil yang
 * mendapat peta kosong otomatis jatuh ke kurasi lewat `sisiBroker`.
 */
export function petaSisiBroker(
  hari: ReadonlyArray<{ broker: readonly BarisBroker[] }>,
): Map<string, SisiBroker> {
  const peta = new Map<string, SisiBroker>()
  for (const h of hari) {
    for (const r of h.broker) {
      const j = jenisBaris(r)
      if (j) peta.set(r[0], j === 'A' ? 'asing' : 'lokal')
    }
  }
  return peta
}

/**
 * Sisi kepemilikan satu kode broker: dari data kalau petanya memuatnya,
 * kalau tidak dari kurasi tangan (dan kode yang belum dikurasi = lokal).
 */
export function sisiBroker(kode: string, peta?: ReadonlyMap<string, SisiBroker>): SisiBroker {
  return peta?.get(kode) ?? (kelompokBroker(kode) === 'asing' ? 'asing' : 'lokal')
}

/**
 * Palet kategorikal garis AVG — dipilih oleh skrip, bukan dikarang.
 *
 * Syaratnya dua dan keduanya terukur dalam CIE Lab (ΔE, CIE76):
 * (a) jarak antar anggota palet ≥ 30 supaya delapan garis tetap terbedakan;
 * (b) jarak ke hijau (#38B77E) dan merah (#E6635A) lilin ≥ 30 — dua warna
 *     itu sudah berarti naik/turun di kanvas yang sama, dan memakainya ulang
 *     untuk identitas broker membuat satu garis terbaca sebagai arah harga.
 *
 * Urutannya bukan abjad: lima pertama sengaja yang paling berjauhan, karena
 * kasus lazimnya lima garis. Warna MELEKAT PADA URUTAN, bukan pada kode
 * broker — mengikat warna ke kode (mis. lewat hash) terdengar lebih rapi
 * tapi membuka tabrakan: dua broker yang kebetulan sehash jadi sewarna, dan
 * itu persis cacat yang sedang ditutup. Legenda pill membawa pemetaannya.
 */
export const PALET_GARIS = [
  '#4F8EF7', '#FACC15', '#A855F7', '#22D3EE',
  '#FB923C', '#F472B6', '#94A3B8', '#FDA4AF',
] as const

/** Batas maksimal garis tampak sekaligus di layar LEBAR (spek #46). */
export const MAKS_GARIS = 8

/** Batas di layar sempit (#67). Delapan pill menutup sekitar 40% tinggi
 *  kanvas di 412 px - diukur saat #46 diverifikasi - dan lilin di
 *  belakangnya jadi tak terbaca. Yang dikurangi jumlah GARIS, bukan tinggi
 *  pillnya: pill yang dikecilkan tetap menutup, cuma jadi lebih sulit
 *  dibaca. */
export const MAKS_GARIS_SEMPIT = 5

/** Ambang lebar tempat batasnya berganti. 1024 px, bukan 768: di antara
 *  keduanya kanvas masih setinggi ~300 px dan delapan pill sudah memakan
 *  sepertiganya. */
export const LEBAR_GARIS_PENUH = 1024

/** Batas garis untuk sebuah lebar layar. Satu tempat, dipakai mesin DAN
 *  pemanggilnya - dua ambang terpisah berarti jumlah garis yang dihitung
 *  bisa berbeda dari yang digambar. */
export function maksGaris(lebar: number): number {
  return lebar >= LEBAR_GARIS_PENUH ? MAKS_GARIS : MAKS_GARIS_SEMPIT
}

/** Berapa hari bursa terakhir yang dilihat untuk menilai "masih aktif". */
export const JENDELA_AKTIF = 60

export type TampilSisi = 'semua' | SisiBroker

export interface GarisTerpilih {
  broker: string
  sisi: SisiBroker
  /** Harga rata-rata beli tertimbang (rupiah per lembar). */
  harga: number
  /** Porsi nilai beli broker ini terhadap total beli rentang (0..1). */
  pct: number
  warna: string
}

/**
 * Kode broker yang muncul di `JENDELA_AKTIF` hari bursa TERAKHIR rentang.
 *
 * Kenapa perlu: pada rentang panjang, broker yang berhenti beroperasi tetap
 * memenangi peringkat net beli dari transaksi lamanya. GW, misalnya, tak
 * bertransaksi sejak Januari 2026 — garisnya akan berdiri di kanvas seolah
 * ada yang sedang mengakumulasi di situ hari ini. Yang dilihat hari bursa
 * dari DERETNYA sendiri, bukan hitungan kalender: hari libur dan hari tanpa
 * arsip tak boleh ikut menghabiskan jendelanya.
 */
export function brokerAktif(
  hari: Array<[string, HariBroker]>,
  jendela = JENDELA_AKTIF,
): Set<string> {
  const aktif = new Set<string>()
  for (const [, h] of hari.slice(-jendela)) {
    for (const r of h.broker) aktif.add(r[0])
  }
  return aktif
}

/**
 * Dua peringkat terpisah → satu daftar garis siap gambar.
 *
 * `totalBeli` adalah penyebut persen: nilai beli SELURUH broker di rentang,
 * bukan hanya yang terpilih — kalau memakai yang terpilih, angkanya selalu
 * berjumlah 100% dan berhenti memberi tahu seberapa besar broker itu
 * sebenarnya.
 */
export function pilihGarisBroker(
  agg: AgregatBroker[],
  aktif: Set<string>,
  tampil: TampilSisi = 'semua',
  perSisi = 5,
  /** Batas garis tampak. Bawaannya batas layar lebar supaya pemanggil lama
   *  tak berubah perilakunya; kanvas mengopernya dari lebar nyata (#67). */
  maks: number = MAKS_GARIS,
): GarisTerpilih[] {
  const totalBeli = agg.reduce((s, a) => s + a.beliNilai, 0)
  const layak = agg.filter(
    (a) => a.netNilai > 0 && a.beliAvg !== null && aktif.has(a.broker),
  )
  // `agg` sudah urut net nilai menurun (agregatBroker), jadi filter menjaga
  // urutannya dan `slice` langsung berarti "terbesar".
  const asing = layak.filter((a) => sisiBroker(a.broker) === 'asing').slice(0, perSisi)
  const lokal = layak.filter((a) => sisiBroker(a.broker) === 'lokal').slice(0, perSisi)

  // Kedua sisi DISELANG-SELING, tidak disambung. Menyambung
  // (`[...lokal, ...asing]`) lalu memotong di 8 akan membuang dua broker
  // asing peringkat bawah dan menyisakan lima lokal - persis kebalikan
  // dari yang diminta. Berselang, potongan 8 berarti 4 dan 4.
  const gabung: AgregatBroker[] = []
  for (let i = 0; i < perSisi; i++) {
    if (lokal[i]) gabung.push(lokal[i])
    if (asing[i]) gabung.push(asing[i])
  }
  const dipakai = tampil === 'asing' ? asing : tampil === 'lokal' ? lokal : gabung
  return dipakai.slice(0, maks).map((a, i) => ({
    broker: a.broker,
    sisi: sisiBroker(a.broker),
    harga: a.beliAvg as number,
    pct: totalBeli ? a.beliNilai / totalBeli : 0,
    warna: PALET_GARIS[i % PALET_GARIS.length],
  }))
}
