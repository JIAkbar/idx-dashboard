/**
 * PAPAN Baru (re-imagined, #586): 5 layar, 18 lapisan. Satu sumber untuk
 * navigasi layar/lapisan — kepala tiap halaman membaca daftar ini, jadi
 * menambah lapisan cukup satu baris di sini + satu rute.
 */
export interface Lapisan {
  /** Segmen rute di bawah /baru (atau di bawah /baru/emiten/:kode untuk layar 3). */
  slug: string
  label: string
}

export interface Layar {
  id: 'tanya' | 'pasar' | 'emiten' | 'rekam' | 'pagi'
  label: string
  lapisan: Lapisan[]
}

export const LAYAR: Layar[] = [
  { id: 'tanya', label: 'Tanya', lapisan: [
    { slug: 'bukti', label: 'Bukti' },
    { slug: 'metodologi', label: 'Bagaimana dihitung' },
  ] },
  { id: 'pasar', label: 'Peta pasar', lapisan: [
    { slug: 'indeks', label: 'Indeks' },
    { slug: 'arus', label: 'Arus' },
    { slug: 'peringkat', label: 'Peringkat' },
    { slug: 'hari-ini', label: 'Hari ini' },
    { slug: 'berkala', label: 'Berkala' },
  ] },
  { id: 'emiten', label: 'Emiten', lapisan: [
    { slug: 'harga', label: 'Harga' },
    { slug: 'berkas', label: 'Berkas' },
    { slug: 'broker', label: 'Sudut broker' },
    { slug: 'broker-summary', label: 'Broker summary' },
    { slug: 'musiman', label: 'Musiman' },
    { slug: 'ipo', label: 'IPO' },
  ] },
  { id: 'rekam', label: 'Rekam jejak', lapisan: [
    { slug: 'jago', label: 'Jago Papan' },
    { slug: 'terbitan', label: 'Terbitan' },
    { slug: 'screener', label: 'Screener' },
    { slug: 'redaksi', label: 'Meja redaksi' },
  ] },
  { id: 'pagi', label: 'Kartu pagi', lapisan: [
    { slug: 'watchlist', label: 'Watchlist' },
  ] },
]

/** Lapisan layar Emiten yang butuh kode saham di rutenya. IPO tidak. */
export const LAPIS_PER_EMITEN = new Set(['harga', 'berkas', 'broker', 'broker-summary', 'musiman'])

export const EMITEN_BAWAAN = 'BBCA'

/** Rute lengkap satu lapisan. */
export function ruteLapisan(slug: string, kode: string = EMITEN_BAWAAN): string {
  return LAPIS_PER_EMITEN.has(slug) ? `/baru/emiten/${kode}/${slug}` : `/baru/${slug}`
}

export function layarDari(slug: string): Layar | undefined {
  return LAYAR.find((l) => l.id === slug || l.lapisan.some((p) => p.slug === slug))
}

/** Rute layar utama (#231). Layar Emiten per kode: /baru/emiten/:kode. */
export function ruteLayar(id: Layar['id'], kode: string = EMITEN_BAWAAN): string {
  return id === 'emiten' ? `/baru/emiten/${kode}` : `/baru/${id}`
}
