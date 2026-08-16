import type { DataHarian } from './dataHarian'
import type { EdisiBulletin } from './bulletin'
import type { KabarItem } from './kabar'
import { rangkumHari, ASAL_AMBANG } from './ringkasHarian'

/**
 * Mesin jawab "Tanya PAPAN" — tahap pertama: **menjawab dari data, bukan dari
 * model bahasa**.
 *
 * Ini sengaja dibangun sebelum LLM disambungkan, bukan sebagai penambal
 * sementara. Alasannya: begitu jalur tanya-jawab ada, pertanyaan yang paling
 * sering ditanyakan ternyata pertanyaan FAKTA ("IHSG hari ini berapa?",
 * "asing net sell berapa?") — dan pertanyaan fakta lebih baik dijawab dengan
 * angka yang ditarik langsung daripada dengan model yang menyusun ulang angka
 * itu. LLM nanti menambah yang memang tak bisa dilakukan di sini: pertanyaan
 * bebas yang tak cocok dengan pola mana pun.
 *
 * Fungsi MURNI: konteks dioper dari pemanggil, tak ada fetch di dalam.
 */

export interface KonteksTanya {
  hari: DataHarian | null
  edisi: EdisiBulletin[] | null
  kabar: KabarItem[] | null
}

export interface Jawaban {
  teks: string
  /** Halaman yang membuktikan jawaban — tiap jawaban WAJIB bisa ditelusuri. */
  ke?: string
  keLabel?: string
  /** true = tak ada pola yang cocok. Dipisah supaya antarmuka bisa menawarkan
   *  jalan lain, dan supaya kelak gampang dialihkan ke LLM. */
  takPaham?: boolean
}

const rp = (n: number, des = 2) =>
  n.toLocaleString('id-ID', { minimumFractionDigits: des, maximumFractionDigits: des })

const pct = (n: number) => `${n >= 0 ? '+' : '−'}${rp(Math.abs(n))}%`

const miliar = (n: number) =>
  Math.abs(n) >= 1000 ? `Rp${rp(Math.abs(n) / 1000)} triliun` : `Rp${rp(Math.abs(n), 0)} miliar`

const bersih = (s: string) => s.toLowerCase().replace(/[^a-z0-9\s]/g, ' ')
const punya = (t: string, ...kata: string[]) => kata.some((k) => t.includes(k))

/** Pertanyaan contoh — ditawarkan di antarmuka supaya pengguna tahu batas
 *  kemampuannya tanpa harus menebak-nebak. */
export const CONTOH_TANYA = [
  'IHSG hari ini berapa?',
  'Asing net buy atau net sell?',
  'Sektor apa yang paling kuat?',
  'Saham apa yang paling naik?',
  'Kenapa disebut menguat kuat?',
  'Edisi terakhir apa?',
]

export function jawab(pertanyaan: string, k: KonteksTanya): Jawaban {
  const t = bersih(pertanyaan)
  const h = k.hari

  if (!t.trim()) return { teks: 'Tanyakan sesuatu tentang data pasar hari ini.', takPaham: true }

  // ── Kenapa disebut kuat/tipis — pertanyaan tentang METODE, bukan angka ───
  if (punya(t, 'kenapa', 'mengapa') && punya(t, 'kuat', 'tipis', 'datar', 'ambang')) {
    return {
      teks:
        `Ambangnya dihitung dari sejarah IHSG, bukan ditebak. Dari ${ASAL_AMBANG.hari_bursa} hari bursa ` +
        `(${ASAL_AMBANG.mulai} sampai ${ASAL_AMBANG.akhir}), gerak ≥ ${rp(ASAL_AMBANG.gerakBesar)}% cuma terjadi ` +
        `di 15% hari teratas — itu yang disebut "kuat". Di bawah ${rp(ASAL_AMBANG.gerakTipis)}% masuk 30% hari ` +
        `paling adem, disebut "nyaris datar".`,
      ke: '/indeks', keLabel: 'Lihat papan IHSG',
    }
  }

  if (!h) {
    return { teks: 'Data hari ini belum termuat. Coba lagi sebentar lagi.', takPaham: true }
  }
  const r = rangkumHari(h)

  // ── IHSG / indeks ────────────────────────────────────────────────────────
  if (punya(t, 'ihsg', 'indeks', 'pasar hari ini', 'penutupan')) {
    return { teks: `${r.headline}. ${r.ringkasan}`, ke: '/indeks', keLabel: 'Papan IHSG' }
  }

  // ── Arus asing ───────────────────────────────────────────────────────────
  if (punya(t, 'asing', 'foreign', 'net buy', 'net sell')) {
    const nf = h.nf_today_idr
    if (nf == null) return { teks: 'Data arus asing hari ini belum ada di berkas harian.', takPaham: true }
    const ytd = h.nf_ytd_idr
    return {
      teks:
        `Asing ${nf < 0 ? 'net sell' : 'net buy'} ${miliar(nf)} hari ini` +
        (ytd != null ? `, dan ${ytd < 0 ? 'net sell' : 'net buy'} ${miliar(ytd)} sepanjang tahun berjalan.` : '.'),
      ke: '/indeks', keLabel: 'Lihat Net Foreign',
    }
  }

  // ── Sektor ───────────────────────────────────────────────────────────────
  if (punya(t, 'sektor', 'sector')) {
    const s = [...(h.sectors ?? [])].sort((a, b) => b.d - a.d)
    if (s.length === 0) return { teks: 'Data sektor hari ini belum ada.', takPaham: true }
    const rapi = (n: string) => n.replace(/^\[[A-Z]\]\s*/, '')
    const naik = s.filter((x) => x.d > 0).length
    return {
      teks:
        `${naik} dari ${s.length} sektor menguat. Terkuat ${rapi(s[0].n)} ${pct(s[0].d)}, ` +
        `terlemah ${rapi(s[s.length - 1].n)} ${pct(s[s.length - 1].d)}.`,
      ke: '/sector', keLabel: 'Sektor & Indeks',
    }
  }

  // ── Saham naik / turun ───────────────────────────────────────────────────
  if (punya(t, 'gainer', 'paling naik', 'top naik', 'naik tertinggi')) {
    const g = (h.gainers ?? []).slice(0, 3)
    if (g.length === 0) return { teks: 'Daftar gainers hari ini belum ada.', takPaham: true }
    return {
      teks: `Top gainers: ${g.map((x) => `${x.c} ${pct(x.p)}`).join(', ')}.`,
      ke: '/stocks', keLabel: 'Top Stocks',
    }
  }
  if (punya(t, 'loser', 'paling turun', 'turun terdalam')) {
    const l = (h.losers ?? []).slice(0, 3)
    if (l.length === 0) return { teks: 'Daftar losers hari ini belum ada.', takPaham: true }
    return {
      teks: `Top losers: ${l.map((x) => `${x.c} ${pct(x.p)}`).join(', ')}.`,
      ke: '/stocks', keLabel: 'Top Stocks',
    }
  }

  // ── Penggerak indeks ─────────────────────────────────────────────────────
  if (punya(t, 'penggerak', 'leader', 'penyumbang', 'kontribusi')) {
    const p = (h.leaders_today ?? []).slice(0, 3)
    if (p.length === 0) return { teks: 'Data penggerak indeks hari ini belum ada.', takPaham: true }
    return {
      teks: `Penyumbang terbesar ke IHSG: ${p.map((x) => `${x.c} ${rp(x.ih)} poin`).join(', ')}.`,
      ke: '/stocks', keLabel: 'Top Stocks',
    }
  }

  // ── Valuasi ──────────────────────────────────────────────────────────────
  if (punya(t, 'per', 'pbv', 'valuasi')) {
    if (h.mkt_per == null && h.mkt_pbv == null) return { teks: 'Data valuasi pasar hari ini belum ada.', takPaham: true }
    return {
      teks: `PER pasar ${h.mkt_per == null ? '—' : `${rp(h.mkt_per)}×`}, PBV ${h.mkt_pbv == null ? '—' : `${rp(h.mkt_pbv)}×`} pada penutupan ${h.date_id}.`,
      ke: '/sector', keLabel: 'Sektor & Indeks',
    }
  }

  // ── Edisi PAPAN ──────────────────────────────────────────────────────────
  if (punya(t, 'edisi', 'bulletin', 'buletin', 'arus pasar', 'pdf')) {
    const e = (k.edisi ?? [])[0]
    if (!e) return { teks: 'Belum ada edisi terbit.', takPaham: true }
    return {
      teks: `Edisi terakhir ${e.kode} — ${e.tanggal_id}, membahas ${e.emiten.length} emiten${e.emiten.length ? `: ${e.emiten.slice(0, 6).join(', ')}${e.emiten.length > 6 ? ', dan lainnya' : ''}` : ''}.`,
      ke: '/bulletin', keLabel: 'Buka Bulletin',
    }
  }

  // ── Kabar ────────────────────────────────────────────────────────────────
  if (punya(t, 'kabar', 'berita', 'news', 'pengumuman')) {
    const b = (k.kabar ?? []).slice(0, 3)
    if (b.length === 0) return { teks: 'Kabar belum termuat.', takPaham: true }
    return {
      teks: `Tiga kabar terbaru: ${b.map((x) => `"${x.judul}" (${x.sumber})`).join('; ')}.`,
      ke: '/kabar', keLabel: 'Semua kabar',
    }
  }

  // ── Emiten disebut langsung (4 huruf kapital di pertanyaan asli) ─────────
  const kode = pertanyaan.toUpperCase().match(/\b[A-Z]{4}\b/)?.[0]
  if (kode) {
    const dariKabar = (k.kabar ?? []).filter((x) => x.emiten.includes(kode) || x.judul.toUpperCase().includes(kode))
    const dariEdisi = (k.edisi ?? []).filter((e) => e.emiten.includes(kode))
    if (dariKabar.length || dariEdisi.length) {
      const bagian: string[] = []
      if (dariEdisi.length) bagian.push(`dibahas di ${dariEdisi.length} edisi (terakhir ${dariEdisi[0].kode})`)
      if (dariKabar.length) bagian.push(`disebut di ${dariKabar.length} kabar terbaru`)
      return { teks: `${kode} ${bagian.join(' dan ')}.`, ke: '/stock-detail', keLabel: `Buka Stock Detail` }
    }
    return {
      teks: `${kode} tidak muncul di edisi maupun kabar yang sedang termuat. Halaman Stock Detail punya data lengkapnya.`,
      ke: '/stock-detail', keLabel: 'Buka Stock Detail', takPaham: true,
    }
  }

  return {
    teks:
      'Belum bisa saya jawab. Tahap ini menjawab dari data yang sudah dihitung — ' +
      'coba tanya soal IHSG, arus asing, sektor, saham yang naik/turun, valuasi, edisi, atau kabar.',
    takPaham: true,
  }
}
