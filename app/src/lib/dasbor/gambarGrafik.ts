/**
 * Penyimpanan gambar (drawing tools) Grafik Emiten — logika MURNI, dipisah
 * dari komponen supaya bisa diuji tanpa `lightweight-charts-drawing`/DOM,
 * sama seperti `grafikEmiten.ts` dipisah dari `GrafikEmiten.tsx`.
 *
 * Disimpan di localStorage, PER EMITEN — bukan Supabase, bukan satu kunci
 * gabungan. Alasannya sama dengan template (lihat catatan panjang di
 * `grafikEmiten.ts` dekat `KUNCI_TEMPLATE`): ini preferensi tampilan, bukan
 * data bersama, dan tak perlu berpindah perangkat. Per-emiten karena gambar
 * BBCA tak boleh muncul di TLKM — Johan: "gambar BBCA tak boleh muncul di
 * TLKM" (spek tugas). Kunci gabungan satu daftar besar akan memaksa tiap
 * pembacanya menyaring milik emiten mana, dan kesalahan penyaringan sekali
 * saja membuat gambar orang lain bocor ke layar yang salah.
 *
 * Anchor disimpan sebagai `{ waktu, harga }` — `waktu` string INTERNAL
 * (`'yyyy-mm-dd'` harian, `'yyyy-mm-dd HH:mm'` intraday), BUKAN tipe `Time`
 * lightweight-charts (BusinessDay/epoch). Konversi ke/dari `Time` terjadi di
 * `GrafikEmiten.tsx` lewat `keWaktuChart`/`dariWaktuChart` yang sudah ada —
 * satu tempat, sama seperti data lilin. Menyimpan `Time` mentah akan mengunci
 * bentuknya ke representasi kanvas saat itu (epoch detik untuk intraday), dan
 * berkas ini sama sekali tak perlu tahu bedanya.
 */

export interface AnchorTersimpan {
  waktu: string
  harga: number
}

/** Satu gambar tersimpan — bentuknya sengaja LONGGAR untuk `style`/`options`
 *  (Record, bukan tipe pustaka): berkas ini tak boleh mengimpor
 *  `lightweight-charts-drawing` sama sekali (lihat catatan impor dinamis di
 *  `gambarPustaka.ts`), dan validasi bentuknya cukup "objek", bukan skema
 *  penuh — pustaka sendiri yang menolak nilai yang tak dikenalinya. */
export interface GambarTersimpan {
  versi: number
  /** `type` dari `lightweight-charts-drawing` (mis. 'trend-line'). */
  type: string
  id: string
  anchors: AnchorTersimpan[]
  style: Record<string, unknown>
  options: Record<string, unknown>
}

export const VERSI_GAMBAR = 1

/** Kunci localStorage PER EMITEN. Kode yang aneh (kosong, spasi) tetap
 *  menghasilkan kunci yang sah — penyaringan kode yang valid itu tugas
 *  pemanggil (halaman sudah menyaringnya sebelum `kode` sampai sini). */
export function kunciGambar(kode: string): string {
  return `papan:grafik-gambar:${kode}`
}

function anchorSah(a: unknown): a is AnchorTersimpan {
  if (!a || typeof a !== 'object') return false
  const o = a as Record<string, unknown>
  return typeof o.waktu === 'string' && o.waktu.length > 0
    && typeof o.harga === 'number' && Number.isFinite(o.harga)
}

/**
 * Membaca daftar gambar dari teks JSON. Bentuk yang tak dikenal DILEWATI,
 * bukan menjatuhkan seluruh daftar — satu baris gambar yang rusak (mis. hasil
 * tempelan manual, atau versi pustaka lampau yang bentuk anchornya berubah)
 * tak boleh membuat gambar-gambar LAIN yang sah ikut hilang.
 */
export function uraiGambar(raw: string | null): GambarTersimpan[] {
  if (!raw) return []
  let data: unknown
  try { data = JSON.parse(raw) } catch { return [] }
  if (!Array.isArray(data)) return []
  const hasil: GambarTersimpan[] = []
  for (const g of data) {
    if (!g || typeof g !== 'object') continue
    const o = g as Record<string, unknown>
    if (o.versi !== VERSI_GAMBAR) continue
    if (typeof o.type !== 'string' || !o.type) continue
    if (typeof o.id !== 'string' || !o.id) continue
    if (!Array.isArray(o.anchors) || o.anchors.length === 0) continue
    if (!o.anchors.every(anchorSah)) continue
    hasil.push({
      versi: VERSI_GAMBAR,
      type: o.type,
      id: o.id,
      anchors: o.anchors as AnchorTersimpan[],
      style: (o.style && typeof o.style === 'object' ? o.style : {}) as Record<string, unknown>,
      options: (o.options && typeof o.options === 'object' ? o.options : {}) as Record<string, unknown>,
    })
  }
  return hasil
}

/* Dua fungsi berikut satu-satunya yang tahu di mana gambar disimpan — pola
   sama persis dengan `bacaTemplateTersimpan`/`tulisTemplateTersimpan`.
   Keduanya menelan galat: kuota penuh atau localStorage yang dimatikan (mode
   privat) tak boleh menjatuhkan halaman grafik, cukup berarti gambarnya tak
   bertahan. */

export function bacaGambarTersimpan(kode: string): GambarTersimpan[] {
  try { return uraiGambar(localStorage.getItem(kunciGambar(kode))) } catch { return [] }
}

export function tulisGambarTersimpan(kode: string, daftar: GambarTersimpan[]): void {
  try { localStorage.setItem(kunciGambar(kode), JSON.stringify(daftar)) } catch { /* kuota penuh / mode privat */ }
}

/* ---------------- Gaya gambar BAWAAN (#185 lanjutan, Johan 21 Agu: "selalu
   berat bawaan nya") ----------------
   Beda dari GambarTersimpan di atas: ini SATU setelan GLOBAL (bukan per
   emiten) — gambar baru di emiten mana pun mengikuti warna/tebal/gaya garis
   TERAKHIR yang dipilih pembaca di modal setelan, di emiten mana pun itu
   dipilih. `warna` di sini SELALU warna CSS literal yang sudah di-resolve
   (mis. "#38B77E"), bukan nama token (`--green`) — canvas pustaka gambar
   butuh warna sungguhan, dan resolusi token->warna terjadi SEKALI di
   pemanggil (GrafikEmiten.tsx, sudah punya `getComputedStyle` di dalam
   `.lantai` untuk kebutuhan lain) sebelum sampai ke sini. Berkas ini sengaja
   tak tahu apa-apa soal CSS custom property. */
export type GayaGaris = 'solid' | 'dashed' | 'dotted'

export interface GayaGambar {
  warna: string
  tebal: number
  gaya: GayaGaris
}

/** Sama dengan `DEFAULT_DRAWING_STYLE.lineColor` pustaka (`#2962FF`) — biru
 *  bawaannya sendiri, cuma tebalnya diturunkan dari 2 ke 1 (itu jawaban
 *  "selalu berat bawaannya": 2px pustaka + fill lembut membuat garis BARU
 *  terasa tebal sejak diklik pertama, sebelum sempat disetel). */
export const GAYA_BAWAAN: GayaGambar = { warna: '#2962FF', tebal: 1, gaya: 'solid' }

const KUNCI_GAYA = 'papan:alat-gambar-gaya'

function gayaSah(g: unknown): g is GayaGambar {
  if (!g || typeof g !== 'object') return false
  const o = g as Record<string, unknown>
  return typeof o.warna === 'string' && o.warna.length > 0
    && typeof o.tebal === 'number' && Number.isFinite(o.tebal) && o.tebal > 0
    && (o.gaya === 'solid' || o.gaya === 'dashed' || o.gaya === 'dotted')
}

/** Dibaca tiap gambar BARU dibuat (`useAlatGambar.ts`) dan tiap modal setelan
 *  dibuka (prefill chip mana yang "diingat" sebagai bawaan). Bentuk tak
 *  dikenal (kuota rusak, versi lama, tempelan manual) jatuh ke `GAYA_BAWAAN`
 *  — pola sama dengan `uraiGambar` di atas: gagal senyap ke nilai aman,
 *  bukan melempar. */
export function bacaGayaBawaan(): GayaGambar {
  try {
    const raw = localStorage.getItem(KUNCI_GAYA)
    if (!raw) return GAYA_BAWAAN
    const parsed: unknown = JSON.parse(raw)
    return gayaSah(parsed) ? parsed : GAYA_BAWAAN
  } catch { return GAYA_BAWAAN }
}

export function tulisGayaBawaan(gaya: GayaGambar): void {
  try { localStorage.setItem(KUNCI_GAYA, JSON.stringify(gaya)) } catch { /* kuota penuh / mode privat */ }
}

/** `lineDash` pustaka per gaya garis pilihan pembaca — satu tempat, dipakai
 *  modal setelan (gambar TERPILIH) dan pembuatan gambar BARU, supaya
 *  keduanya memakai angka putus-putus yang SAMA persis. */
export function dashDariGaya(gaya: GayaGaris): number[] {
  if (gaya === 'dashed') return [8, 4]
  if (gaya === 'dotted') return [2, 4]
  return []
}

/** Kebalikan `dashDariGaya` — dipakai modal setelan menyorot chip yang cocok
 *  untuk gambar yang SUDAH ADA (dimuat dari localStorage lama, atau gaya
 *  bawaan pustaka sendiri yang `lineDash`-nya tak persis dua angka di atas).
 *  Heuristik pendek, bukan identitas presisi: tanpa dash = solid, dash
 *  pertama pendek (≤3px) = dotted, selebihnya = dashed — cukup untuk
 *  menyorot chip terdekat. */
export function gayaDariDash(dash: number[] | undefined): GayaGaris {
  if (!dash || dash.length === 0) return 'solid'
  return dash[0] <= 3 ? 'dotted' : 'dashed'
}
