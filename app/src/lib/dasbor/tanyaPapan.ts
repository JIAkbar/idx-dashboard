import type { DataHarian, TanggalIndex } from './dataHarian'
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
  /** Seri penutupan IHSG per hari bursa (index.json) — bahan pertanyaan
   *  lintas waktu: sepekan, sebulan, beruntun berapa hari. */
  seri: TanggalIndex[] | null
  edisi: EdisiBulletin[] | null
  kabar: KabarItem[] | null
  /** Topik jawaban SEBELUMNYA. Tanpa ini, "kenapa?" dan "berapa?" tak punya
   *  rujukan — dan pertanyaan susulan sependek itu justru yang paling wajar
   *  diketik orang setelah membaca satu jawaban. */
  topik?: Topik | null
}

/** Topik yang bisa dilanjutkan pertanyaan susulan. */
export type Topik = 'ihsg' | 'asing' | 'sektor' | 'gainer' | 'loser' | 'penggerak'
  | 'valuasi' | 'edisi' | 'kabar' | 'ambang' | 'lintasWaktu' | null

export interface Jawaban {
  teks: string
  /** Topik jawaban ini — dikembalikan supaya pertanyaan berikutnya bisa
   *  menyambung ("kenapa?", "berapa?"). */
  topik?: Topik
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
  'IHSG sepekan terakhir bagaimana?',
  'Asing net buy atau net sell?',
  'Sektor apa yang paling kuat?',
  'Bagaimana BBCA?',
  'Kenapa disebut menguat kuat?',
]

/** Pertanyaan susulan yang terlalu pendek untuk berdiri sendiri. Dicocokkan
 *  UTUH, bukan sebagai potongan: "kenapa naik" adalah pertanyaan penuh yang
 *  tak boleh diperlakukan sebagai sambungan. */
const SUSULAN = /^(kenapa|mengapa|berapa|kok|detail(nya)?|lanjut|jelaskan|contohnya|gimana|bagaimana)\??$/

/** Perubahan persen antara dua titik seri. */
function ubah(seri: TanggalIndex[], mundur: number): number | null {
  if (seri.length < mundur + 1) return null
  const kini = seri[seri.length - 1].ihsg
  const lalu = seri[seri.length - 1 - mundur].ihsg
  return lalu ? ((kini - lalu) * 100) / lalu : null
}

/** Berapa hari bursa beruntun indeks bergerak ke arah yang sama. */
function beruntun(seri: TanggalIndex[]): { arah: 'naik' | 'turun'; hari: number } | null {
  if (seri.length < 3) return null
  const arah = seri[seri.length - 1].ihsg >= seri[seri.length - 2].ihsg ? 'naik' : 'turun'
  let n = 0
  for (let i = seri.length - 1; i > 0; i--) {
    const naikHariItu = seri[i].ihsg >= seri[i - 1].ihsg
    if ((arah === 'naik') !== naikHariItu) break
    n++
  }
  return { arah, hari: n }
}

export function jawab(pertanyaan: string, k: KonteksTanya): Jawaban {
  let t = bersih(pertanyaan)
  const h = k.hari

  if (!t.trim()) return { teks: 'Tanyakan sesuatu tentang data pasar hari ini.', takPaham: true }

  // Pertanyaan susulan ("kenapa?", "berapa?") diterjemahkan jadi pertanyaan
  // penuh memakai topik jawaban sebelumnya. Kalau belum ada topiknya, jangan
  // menebak — tanya balik, karena menjawab topik yang salah lebih buruk
  // daripada mengaku tak tahu maksudnya.
  if (SUSULAN.test(t.trim())) {
    if (!k.topik) {
      return { teks: 'Susulan dari yang mana? Tanyakan dulu satu hal — misalnya IHSG, arus asing, atau sektor.', takPaham: true }
    }
    const balik: Record<string, string> = {
      ihsg: 'ihsg', asing: 'asing', sektor: 'sektor', gainer: 'gainer', loser: 'loser',
      penggerak: 'penggerak', valuasi: 'valuasi', edisi: 'edisi', kabar: 'kabar',
      ambang: 'kenapa kuat ambang', lintasWaktu: 'ihsg sepekan',
    }
    // "kenapa" atas topik IHSG artinya: apa yang menggerakkannya hari itu.
    t = k.topik === 'ihsg' && /kenapa|mengapa|kok/.test(pertanyaan.toLowerCase())
      ? 'penggerak' : balik[k.topik]
  }

  // ── Kenapa disebut kuat/tipis — pertanyaan tentang METODE, bukan angka ───
  if (punya(t, 'kenapa', 'mengapa') && punya(t, 'kuat', 'tipis', 'datar', 'ambang')) {
    return {
      teks:
        `Ambangnya dihitung dari sejarah IHSG, bukan ditebak. Dari ${ASAL_AMBANG.hari_bursa} hari bursa ` +
        `(${ASAL_AMBANG.mulai} sampai ${ASAL_AMBANG.akhir}), gerak ≥ ${rp(ASAL_AMBANG.gerakBesar)}% cuma terjadi ` +
        `di 15% hari teratas — itu yang disebut "kuat". Di bawah ${rp(ASAL_AMBANG.gerakTipis)}% masuk 30% hari ` +
        `paling adem, disebut "nyaris datar".`,
      topik: 'ambang', ke: '/indeks', keLabel: 'Lihat papan IHSG',
    }
  }

  // ── Pertanyaan tentang ORANG (siapa direktur, siapa komisaris, dst) ─────
  // "siapa" menanyakan identitas, bukan data pasar — dan tahap ini tak punya
  // data personalia sama sekali. Diperiksa SEBELUM blok kode emiten karena
  // pertanyaan macam ini sering ikut menyebut kode ("siapa direktur BBCA?"),
  // dan sekadar menyebut kode tak membuatnya jadi pertanyaan data pasar.
  if (punya(t, 'siapa')) {
    return { teks: 'Belum ada data personalia (direksi/komisaris) di tahap ini — coba tanya soal data pasar.', takPaham: true }
  }

  if (!h) {
    return { teks: 'Data hari ini belum termuat. Coba lagi sebentar lagi.', takPaham: true }
  }
  const r = rangkumHari(h)

  // ── Lintas waktu (sepekan, sebulan, beruntun) ───────────────────────────
  // Diperiksa SEBELUM blok "IHSG" karena "IHSG sepekan" memuat kata ihsg juga
  // — kalau urutannya terbalik, pertanyaan rentang selalu dijawab data harian.
  if (punya(t, 'pekan', 'minggu', 'bulan', 'beruntun', 'berturut', 'sebulan', 'sepekan', 'ytd', 'tahun berjalan')) {
    const seri = k.seri ?? []
    if (seri.length < 6) {
      return { teks: 'Riwayat indeks belum termuat cukup untuk menghitung rentang.', takPaham: true }
    }
    const sepekan = ubah(seri, 5)
    const sebulan = ubah(seri, 21)
    const ytd = seri.length > 1 ? ((seri[seri.length - 1].ihsg - seri[0].ihsg) * 100) / seri[0].ihsg : null
    const run = beruntun(seri)
    const puncak = seri.reduce((a, b) => (b.ihsg > a.ihsg ? b : a), seri[0])
    const jarak = ((seri[seri.length - 1].ihsg - puncak.ihsg) * 100) / puncak.ihsg

    if (punya(t, 'beruntun', 'berturut') && run) {
      return {
        teks: `IHSG ${run.arah} ${run.hari} hari bursa beruntun sampai penutupan terakhir.`,
        topik: 'lintasWaktu', ke: '/chart', keLabel: 'Lihat chart',
      }
    }
    const bagian = [
      sepekan != null ? `sepekan (5 hari bursa) ${pct(sepekan)}` : null,
      sebulan != null ? `sebulan (21 hari bursa) ${pct(sebulan)}` : null,
      ytd != null ? `tahun berjalan ${pct(ytd)}` : null,
    ].filter(Boolean)
    return {
      teks:
        `IHSG ${bagian.join(', ')}. ` +
        (run ? `Terakhir ${run.arah} ${run.hari} hari beruntun. ` : '') +
        `Sekarang ${pct(jarak)} dari puncak tahun ini (${rp(puncak.ihsg)}, ${puncak.date_id}).`,
      topik: 'lintasWaktu', ke: '/chart', keLabel: 'Lihat chart',
    }
  }

  // ── IHSG / indeks ────────────────────────────────────────────────────────
  if (punya(t, 'ihsg', 'indeks', 'pasar hari ini', 'penutupan')) {
    return { teks: `${r.headline}. ${r.ringkasan}`, topik: 'ihsg', ke: '/indeks', keLabel: 'Papan IHSG' }
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
      topik: 'asing', ke: '/indeks', keLabel: 'Lihat Net Foreign',
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
      topik: 'sektor', ke: '/sector', keLabel: 'Sektor & Indeks',
    }
  }

  // ── Saham naik / turun ───────────────────────────────────────────────────
  if (punya(t, 'gainer', 'paling naik', 'top naik', 'naik tertinggi')) {
    const g = (h.gainers ?? []).slice(0, 3)
    if (g.length === 0) return { teks: 'Daftar gainers hari ini belum ada.', takPaham: true }
    return {
      teks: `Top gainers: ${g.map((x) => `${x.c} ${pct(x.p)}`).join(', ')}.`,
      topik: 'gainer', ke: '/stocks', keLabel: 'Top Stocks',
    }
  }
  if (punya(t, 'loser', 'paling turun', 'turun terdalam')) {
    const l = (h.losers ?? []).slice(0, 3)
    if (l.length === 0) return { teks: 'Daftar losers hari ini belum ada.', takPaham: true }
    return {
      teks: `Top losers: ${l.map((x) => `${x.c} ${pct(x.p)}`).join(', ')}.`,
      topik: 'loser', ke: '/stocks', keLabel: 'Top Stocks',
    }
  }

  // ── Penggerak indeks ─────────────────────────────────────────────────────
  if (punya(t, 'penggerak', 'leader', 'penyumbang', 'kontribusi')) {
    const p = (h.leaders_today ?? []).slice(0, 3)
    if (p.length === 0) return { teks: 'Data penggerak indeks hari ini belum ada.', takPaham: true }
    return {
      teks: `Penyumbang terbesar ke IHSG: ${p.map((x) => `${x.c} ${rp(x.ih)} poin`).join(', ')}.`,
      topik: 'penggerak', ke: '/stocks', keLabel: 'Top Stocks',
    }
  }

  // ── Valuasi ──────────────────────────────────────────────────────────────
  if (punya(t, 'per', 'pbv', 'valuasi')) {
    if (h.mkt_per == null && h.mkt_pbv == null) return { teks: 'Data valuasi pasar hari ini belum ada.', takPaham: true }
    return {
      teks: `PER pasar ${h.mkt_per == null ? '—' : `${rp(h.mkt_per)}×`}, PBV ${h.mkt_pbv == null ? '—' : `${rp(h.mkt_pbv)}×`} pada penutupan ${h.date_id}.`,
      topik: 'valuasi', ke: '/sector', keLabel: 'Sektor & Indeks',
    }
  }

  // ── Edisi PAPAN ──────────────────────────────────────────────────────────
  if (punya(t, 'edisi', 'bulletin', 'buletin', 'arus pasar', 'pdf')) {
    const e = (k.edisi ?? [])[0]
    if (!e) return { teks: 'Belum ada edisi terbit.', takPaham: true }
    return {
      teks: `Edisi terakhir ${e.kode} — ${e.tanggal_id}, membahas ${e.emiten.length} emiten${e.emiten.length ? `: ${e.emiten.slice(0, 6).join(', ')}${e.emiten.length > 6 ? ', dan lainnya' : ''}` : ''}.`,
      topik: 'edisi', ke: '/bulletin', keLabel: 'Buka Bulletin',
    }
  }

  // ── Kabar ────────────────────────────────────────────────────────────────
  if (punya(t, 'kabar', 'berita', 'news', 'pengumuman')) {
    const b = (k.kabar ?? []).slice(0, 3)
    if (b.length === 0) return { teks: 'Kabar belum termuat.', takPaham: true }
    return {
      teks: `Tiga kabar terbaru: ${b.map((x) => `"${x.judul}" (${x.sumber})`).join('; ')}.`,
      topik: 'kabar', ke: '/kabar', keLabel: 'Semua kabar',
    }
  }

  // ── Emiten disebut langsung (4 huruf kapital di pertanyaan asli) ─────────
  const kode = pertanyaan.toUpperCase().match(/\b[A-Z]{4}\b/)?.[0]
  if (kode) {
    // Satu emiten dijawab dari SEMUA sudut yang kita punya hari itu: posisinya
    // di papan peringkat, kontribusinya ke indeks, edisi yang membahasnya, dan
    // kabar yang menyebutnya. Versi pertama cuma menghitung kemunculan — benar,
    // tapi tak menjawab "bagaimana dia hari ini".
    const bagian: string[] = []
    const g = (h.gainers ?? []).find((x) => x.c === kode)
    const l = (h.losers ?? []).find((x) => x.c === kode)
    if (g) bagian.push(`naik ${pct(g.p)} ke ${rp(g.pr, 0)} — masuk top gainers hari ini`)
    if (l) bagian.push(`turun ${pct(l.p)} ke ${rp(l.pr, 0)} — masuk top losers hari ini`)

    const lead = (h.leaders_today ?? []).find((x) => x.c === kode)
    const lag = (h.laggards_today ?? []).find((x) => x.c === kode)
    if (lead) bagian.push(`menyumbang ${rp(lead.ih)} poin ke IHSG`)
    if (lag) bagian.push(`menekan IHSG ${rp(Math.abs(lag.ih))} poin`)

    const nilai = (h.top_val ?? []).findIndex((x) => x.c === kode)
    if (nilai >= 0) bagian.push(`peringkat ${nilai + 1} nilai transaksi terbesar`)

    const dariEdisi = (k.edisi ?? []).filter((e) => e.emiten.includes(kode))
    if (dariEdisi.length) bagian.push(`dibahas di ${dariEdisi.length} edisi (terakhir ${dariEdisi[0].kode})`)
    const dariKabar = (k.kabar ?? []).filter((x) => x.emiten.includes(kode) || x.judul.toUpperCase().includes(kode))
    if (dariKabar.length) bagian.push(`disebut di ${dariKabar.length} kabar terbaru`)

    if (bagian.length === 0) {
      return {
        teks: `${kode} tidak masuk papan peringkat hari ini, dan tak disebut di edisi maupun kabar yang termuat. ` +
          `Data lengkap per emiten ada di Stock Detail.`,
        ke: '/stock-detail', keLabel: 'Buka Stock Detail', takPaham: true,
      }
    }
    return { teks: `${kode}: ${bagian.join('; ')}.`, ke: '/stock-detail', keLabel: 'Buka Stock Detail' }
  }

  return {
    teks:
      'Belum bisa saya jawab. Tahap ini menjawab dari data yang sudah dihitung — ' +
      'coba tanya soal IHSG, arus asing, sektor, saham yang naik/turun, valuasi, edisi, atau kabar.',
    takPaham: true,
  }
}
