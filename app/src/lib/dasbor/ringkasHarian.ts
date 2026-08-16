import type { DataHarian, SectorRow } from './dataHarian'

/**
 * Ringkasan naratif harian — angka pasar dirakit jadi kalimat.
 *
 * SENGAJA rule-engine, bukan LLM. Tiap kalimat di sini lahir dari ambang yang
 * tertulis di kode ini, jadi pembaca yang bertanya "kenapa disebut rebound
 * kuat?" bisa dijawab dengan angkanya, bukan dengan "begitu kata modelnya".
 * Lapisan penulis ulang berbasis LLM boleh ditambahkan DI ATAS fakta yang
 * sudah terkunci ini (rencana #167) — bukan menggantikannya.
 *
 * Fungsi MURNI: tak menyentuh jaringan, tak membaca tanggal sistem. Itu yang
 * membuatnya bisa diuji dengan data buatan (lihat ringkasHarian.test.ts).
 */

export interface Chip {
  label: string
  nada: 'up' | 'dn' | 'netral'
  /** Halaman yang membuktikan angka ini — chip tanpa tujuan berarti angka
   *  yang tak bisa ditelusuri, dan itu yang kita hindari. */
  ke?: string
}

export interface Katalis {
  judul: string
  isi: string
  nada: 'up' | 'dn' | 'netral'
  ke?: string
}

export interface RingkasHarian {
  headline: string
  ringkasan: string
  chips: Chip[]
  katalis: Katalis[]
}

/** Ambang yang menentukan pilihan kata. Dikumpulkan di satu tempat supaya
 *  bisa dibaca (dan diperdebatkan) tanpa menyisir seluruh berkas. */
const AMBANG = {
  /** ≥ ini disebut "menguat kuat"/"melemah tajam", di bawahnya "tipis". */
  gerakBesar: 1.0,
  gerakTipis: 0.25,
  /** Net foreign dianggap layak disebut kalau melewati ini (miliar rupiah). */
  nfBerarti: 300,
  /** Kenaikan satu saham yang layak disebut sebagai penggerak. */
  lonjakan: 10,
}

const rp = (n: number, des = 2) =>
  n.toLocaleString('id-ID', { minimumFractionDigits: des, maximumFractionDigits: des })

const pct = (n: number) => `${n >= 0 ? '+' : '−'}${rp(Math.abs(n))}%`

/** "Rp1,03 triliun" dari nilai dalam MILIAR rupiah — satuan ruas `nf_*`. */
function miliarKeTeks(miliar: number): string {
  const abs = Math.abs(miliar)
  if (abs >= 1000) return `Rp${rp(abs / 1000)} triliun`
  return `Rp${rp(abs, 0)} miliar`
}

function katakerjaIndeks(p: number): string {
  if (p >= AMBANG.gerakBesar) return 'menguat kuat'
  if (p > AMBANG.gerakTipis) return 'menguat'
  if (p > -AMBANG.gerakTipis) return 'nyaris datar'
  if (p > -AMBANG.gerakBesar) return 'melemah'
  return 'melemah tajam'
}

/** Nama sektor IDX datang berawalan kode papan ("[F] Healthcare"). Awalan itu
 *  berguna di tabel, tapi di tengah kalimat cuma membuat pembaca tersandung. */
const rapikanSektor = (n: string) => n.replace(/^\[[A-Z]\]\s*/, '').trim()

/** Sektor yang naik vs total sektor — dasar kalimat "11/11 sektor hijau". */
function hitungSektor(sectors: SectorRow[] | undefined) {
  const s = sectors ?? []
  const naik = s.filter((x) => x.d > 0).length
  const turun = s.filter((x) => x.d < 0).length
  const urut = [...s].sort((a, b) => b.d - a.d)
  return { total: s.length, naik, turun, terbaik: urut[0], terburuk: urut[urut.length - 1] }
}

export function rangkumHari(hari: DataHarian): RingkasHarian {
  const p = hari.ihsg_pct
  const naik = p >= 0
  const delta = hari.ihsg_prev == null ? null : hari.ihsg_value - hari.ihsg_prev
  const sek = hitungSektor(hari.sectors)
  const nf = hari.nf_today_idr ?? null

  // ── Headline ─────────────────────────────────────────────────────────────
  const bagian: string[] = [`IHSG ${katakerjaIndeks(p)} ${pct(p)} ke ${rp(hari.ihsg_value)}`]
  if (sek.total > 0) {
    if (sek.naik === sek.total) bagian.push('seluruh sektor hijau')
    else if (sek.turun === sek.total) bagian.push('seluruh sektor merah')
    else bagian.push(`${sek.naik} dari ${sek.total} sektor menguat`)
  }
  const headline = bagian.join(' — ')

  // ── Ringkasan: satu kalimat yang menyebut ketegangan utamanya ────────────
  const kalimat: string[] = []
  if (hari.ihsg_high != null && hari.ihsg_low != null) {
    kalimat.push(
      `Indeks bergerak di rentang ${rp(hari.ihsg_low)}–${rp(hari.ihsg_high)}` +
      (delta == null ? '.' : ` dan ditutup ${naik ? 'naik' : 'turun'} ${rp(Math.abs(delta))} poin.`)
    )
  }
  if (nf != null && Math.abs(nf) >= AMBANG.nfBerarti) {
    const asingJual = nf < 0
    // Divergensi inilah yang paling sering luput dibaca: indeks naik TAPI
    // asing keluar berarti kenaikannya ditopang dana domestik.
    // BERLAWANAN = indeks naik saat asing jual, atau indeks turun saat asing
    // beli. `asingJual === naik` berarti tepat keadaan itu — sempat tertukar
    // di versi pertama dan menghasilkan kalimat yang membalik artinya.
    kalimat.push(
      asingJual === naik
        ? `Namun asing ${asingJual ? 'net sell' : 'net buy'} ${miliarKeTeks(nf)}, jadi pergerakan ini ditopang ${asingJual ? 'dana domestik' : 'aksi jual domestik'}.`
        : `Asing ${asingJual ? 'net sell' : 'net buy'} ${miliarKeTeks(nf)} — arah dana asing searah dengan indeks.`
    )
  }
  const ringkasan = kalimat.join(' ')

  // ── Chip angka ───────────────────────────────────────────────────────────
  const chips: Chip[] = [
    { label: `IHSG ${pct(p)}`, nada: naik ? 'up' : 'dn', ke: '/indeks' },
  ]
  if (nf != null) {
    chips.push({
      label: `Net foreign ${nf < 0 ? 'sell' : 'buy'} ${miliarKeTeks(nf)}`,
      nada: nf < 0 ? 'dn' : 'up',
      ke: '/indeks',
    })
  }
  if (sek.total > 0) {
    chips.push({
      label: `${sek.naik}/${sek.total} sektor ${sek.naik >= sek.turun ? 'hijau' : 'merah'}`,
      nada: sek.naik > sek.turun ? 'up' : sek.naik < sek.turun ? 'dn' : 'netral',
      ke: '/sector',
    })
  }
  if (hari.val_idr_today != null) {
    chips.push({ label: `Nilai transaksi Rp${rp(hari.val_idr_today, 0)} M`, nada: 'netral', ke: '/stocks' })
  }

  // ── Katalis: hal-hal yang menjelaskan angka di atas ──────────────────────
  const katalis: Katalis[] = []

  if (sek.total > 0 && sek.terbaik && sek.terburuk) {
    katalis.push(
      sek.naik === sek.total
        ? {
            judul: 'Penguatan merata semua sektor',
            isi: `Seluruh ${sek.total} sektor menguat tanpa kecuali — ${rapikanSektor(sek.terbaik.n)} (${pct(sek.terbaik.d)}) memimpin.`,
            nada: 'up', ke: '/sector',
          }
        : {
            judul: `Sektor ${sek.terbaik.d >= 0 ? 'penopang' : 'penekan'}: ${rapikanSektor(sek.terbaik.n)}`,
            isi: `${rapikanSektor(sek.terbaik.n)} ${pct(sek.terbaik.d)} memimpin, ${rapikanSektor(sek.terburuk.n)} ${pct(sek.terburuk.d)} tertinggal.`,
            nada: sek.terbaik.d >= 0 ? 'up' : 'dn', ke: '/sector',
          }
    )
  }

  if (nf != null && Math.abs(nf) >= AMBANG.nfBerarti && (nf < 0) === naik) {
    katalis.push({
      judul: 'Divergensi asing vs harga',
      isi: `Indeks ${naik ? 'naik' : 'turun'} sementara asing ${nf < 0 ? 'net sell' : 'net buy'} ${miliarKeTeks(nf)}` +
        ` — ${naik ? 'kenaikan' : 'penurunan'} ini bukan didorong arus asing. Perlu dicermati keberlanjutannya.`,
      nada: 'netral', ke: '/indeks',
    })
  }

  const jagoan = (hari.gainers ?? [])[0]
  if (jagoan && jagoan.p >= AMBANG.lonjakan) {
    const teman = (hari.gainers ?? []).slice(1, 3).map((g) => g.c)
    katalis.push({
      judul: `${jagoan.c} melesat ${pct(jagoan.p)}`,
      isi: teman.length
        ? `Bersama ${teman.join(' dan ')}, jadi top gainers hari ini.`
        : 'Kenaikan tertinggi di papan hari ini.',
      nada: 'up', ke: '/stocks',
    })
  }

  const pemimpin = (hari.leaders_today ?? [])[0]
  if (pemimpin) {
    katalis.push({
      judul: `Penggerak indeks: ${pemimpin.c}`,
      isi: `Menyumbang ${rp(pemimpin.ih)} poin ke IHSG — kontribusi terbesar hari ini.`,
      nada: pemimpin.ih >= 0 ? 'up' : 'dn', ke: '/stocks',
    })
  }

  if (hari.mkt_per != null && hari.mkt_pbv != null) {
    katalis.push({
      judul: 'Valuasi pasar',
      isi: `PER pasar ${rp(hari.mkt_per)}× dan PBV ${rp(hari.mkt_pbv)}× pada penutupan ini.`,
      nada: 'netral', ke: '/sector',
    })
  }

  return { headline, ringkasan, chips, katalis: katalis.slice(0, 4) }
}
