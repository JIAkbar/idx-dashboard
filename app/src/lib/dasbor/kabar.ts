import { useEffect, useState } from 'react'

/** Satu kabar dari `data-idx/json/kabar.json` (ditulis `scripts/panen_kabar.py`). */
export interface KabarItem {
  /** 'IDX' · 'IPOT News' · 'Kontan' — nama yang ditampilkan apa adanya. */
  sumber: string
  jenis: 'berita' | 'pengumuman' | 'snips'
  judul: string
  tautan: string
  /** ISO ber-offset WIB. `null` untuk sumber yang halaman daftarnya tak
   *  memuat tanggal (IPOT) — ditampilkan "—", bukan ditebak jadi hari ini. */
  waktu: string | null
  /** Kode emiten yang disebut pengumuman resmi; kosong untuk berita umum. */
  emiten: string[]
  nomor?: string | null
  /** Kanal topik di sumbernya — sekarang cuma IPOT News yang punya (Saham,
   *  Ekonomi, IPS News, Market/JCI), karena dipanen per kanal. */
  kanal?: string
}

export interface Kabar {
  dipanen: string
  sumber: string[]
  item: KabarItem[]
}

/** Cache modul: pindah halaman lalu kembali tak menarik ulang berkasnya —
 *  pola sama dengan `useBulletinList`. DUA cache, karena isinya beda: yang
 *  ringan (tanpa arsip IPOT) dipakai semua halaman, yang lengkap cuma
 *  `/kabar`. Satu cache saja akan membuat halaman ringan ikut menerima muatan
 *  berat begitu `/kabar` pernah dibuka. */
let cache: Kabar | null = null
let cacheArsip: Kabar | null = null
let cacheSejak = 0
let cacheArsipSejak = 0
// TTL 30 menit (audit kesegaran 27 Agu §2) — pola screener.ts; tanpa ini data halaman membeku sampai muat-ulang penuh.
const UMUR_CACHE_MS = 30 * 60 * 1000

/**
 * Gabung tiga berkas jadi satu daftar, buang yang benar-benar kembar.
 *
 * Kunci kembarnya **tautan + judul + waktu**, bukan tautan saja. Seluruh
 * pengumuman resmi IDX yang tak punya berkas terlampir jatuh ke satu URL
 * generik yang sama (halaman "keterbukaan informasi"), jadi dedup ber-tautan
 * meringkas belasan pengumuman berbeda menjadi satu baris — tanpa galat,
 * tanpa peringatan, cuma daftar yang diam-diam menyusut. Dari layar itu
 * terbaca sebagai "beritanya tidak ada" atau "situsnya mati", bentuk
 * kegagalan yang jauh lebih mahal daripada duplikat yang lolos.
 *
 * Urutan masuk menentukan siapa yang menang: `utama` (paling segar) di depan,
 * lalu snips, lalu arsip.
 */
/**
 * Detik epoch dari stempel waktu kabar; `null` untuk yang tak bertanggal.
 *
 * Perbandingan STRING sah hanya kalau semua stempel berzona sama, dan di
 * sini tidak: Google News menulis UTC sementara sumber lain menulis +07:00.
 * "2026-09-08T17:00:00Z" dan "2026-09-09T00:00:00+07:00" adalah SAAT YANG
 * SAMA, tapi diurutkan sebagai teks yang satu jatuh tujuh jam di bawah yang
 * lain — daftar tetap terlihat rapi menurun, cuma isinya di urutan yang
 * salah, dan itu tak kelihatan sampai ada yang mencocokkan jam beritanya.
 */
export function epochKabar(iso: string | null | undefined): number | null {
  if (!iso) return null
  const t = Date.parse(iso)
  return Number.isFinite(t) ? t : null
}

export function gabungKabar(utama: Kabar, snips: KabarItem[], arsip: KabarItem[]): Kabar {
  const terlihat = new Set<string>()
  const unik = [...utama.item, ...snips, ...arsip].filter((i) => {
    const k = `${i.tautan}|${i.judul}|${i.waktu ?? ''}`
    if (terlihat.has(k)) return false
    terlihat.add(k)
    return true
  })
  return {
    ...utama,
    sumber: [...new Set([...(utama.sumber ?? []), ...unik.map((i) => i.sumber)])],
    // Yang tak bertanggal (IPOT tak memuat tanggal di daftarnya) tetap di
    // bawah — dulu itu efek samping string kosong, sekarang dinyatakan.
    item: unik.sort((a, b) => (epochKabar(b.waktu) ?? -Infinity) - (epochKabar(a.waktu) ?? -Infinity)),
  }
}

/**
 * Kabar pasar dari berkas statis, bukan dari peramban pengunjung.
 *
 * Sengaja TIDAK memanggil RSS/endpoint IDX langsung dari klien: sumbernya
 * tidak mengizinkan CORS, endpoint IDX menolak permintaan tanpa header
 * peramban, dan tiap pengunjung memanggil sendiri berarti ratusan permintaan
 * ke server orang untuk data yang sama. Panen dijalankan di mesin rumahan
 * (`scripts/panen_kabar.py`), hasilnya berkas JSON yang ikut ter-deploy.
 */
function segarKabar(denganArsip: boolean): boolean {
  return denganArsip
    ? cacheArsip !== null && Date.now() - cacheArsipSejak < UMUR_CACHE_MS
    : cache !== null && Date.now() - cacheSejak < UMUR_CACHE_MS
}

/**
 * Kabar yang benar-benar menyebut satu emiten (#122).
 *
 * Dua sumber sebutan, dan keduanya perlu:
 *   1. ruas `emiten` — hanya terisi di pengumuman resmi bursa (75 dari 2.413
 *      item, 8 Sep 2026), jadi ia akurat tapi jauh dari cukup;
 *   2. KODE di judul — 769 judul menyebut kode nyata.
 *
 * Pencocokan judul dibuat KETAT, dan itu inti perbaikan ini: dua pencocok
 * yang sudah ada (Kabar.tsx dan tanyaPapan.ts) memakai substring tanpa batas
 * kata dan tak peka huruf, sehingga EMAS menangkap "ETF Emas" (52 item, 4
 * yang benar), PADA menangkap kata "pada" (106 vs 0), CUAN 28 vs 11. Di sini:
 * kode utuh berbatas kata DAN peka huruf besar — "Emas" bukan "EMAS".
 *
 * Batas yang disadari: judul yang menyebut NAMA tanpa kode ("Antam" tanpa
 * ANTM) tidak tertangkap. Terlewat lebih baik daripada salah tangkap —
 * pembaca yang melihat berita orang lain di halaman emitennya berhenti
 * mempercayai seluruh panelnya.
 */
export function kabarEmiten(item: KabarItem[], kode: string, maks = 8): KabarItem[] {
  const k = kode.trim().toUpperCase()
  if (!/^[A-Z0-9]{2,6}$/.test(k)) return []
  // \b tidak cukup sendirian: ia cocok juga di "BBCA-nya" (aman) DAN di
  // "PADA" pada teks huruf kecil kalau bendera `i` dipakai — jadi peka huruf
  // yang menutupnya, bukan pola yang lebih rumit.
  const pola = new RegExp(`(^|[^A-Z0-9])${k}([^A-Z0-9]|$)`)
  const cocok = item.filter((x) => x.emiten.includes(k) || pola.test(x.judul))
  // Satu peristiwa, satu baris. Agregator berita menyalurkan artikel yang
  // sama dari dua kanal dengan sufiks nama outlet berbeda ('… - Bisnis.com'
  // vs '… - market.bisnis.com'), jadi tautannya sama tapi judulnya tidak —
  // dedup `gabungKabar` (tautan+judul+waktu) melewatkannya dengan benar,
  // dan di daftar delapan baris hasilnya dua baris kembar yang mencolok.
  //
  // PENGUMUMAN RESMI dikecualikan, dan ini bukan kehati-hatian berlebih:
  // pengumuman bursa tanpa lampiran SEMUANYA menunjuk satu URL generik, jadi
  // dedup ber-tautan di sana meringkas belasan pengumuman berbeda jadi satu
  // baris — bug 16 Agu 2026 yang sudah dibayar sekali (CLAUDE.md).
  const terlihat = new Set<string>()
  const unik = cocok.filter((x) => {
    const kunci = x.jenis === 'pengumuman' ? `${x.tautan}|${x.judul}|${x.waktu ?? ''}` : x.tautan
    if (terlihat.has(kunci)) return false
    terlihat.add(kunci)
    return true
  })
  return unik.slice(0, maks)
}

export function useKabar(denganArsip = false) {
  const [kabar, setKabar] = useState<Kabar | null>(segarKabar(denganArsip) ? (denganArsip ? cacheArsip : cache) : null)
  const [galat, setGalat] = useState(false)

  useEffect(() => {
    if (segarKabar(denganArsip)) return
    let batal = false
    // DUA berkas, satu aliran. `kabar.json` berumur pendek (retensi 7 hari,
    // dipanen tiap jam); `snips.json` arsip panjang Stockbit Snips setahun
    // yang dipanen jarang. Dipisah di sisi panen supaya retensi kabar tak
    // ikut menghapus arsip — di sini keduanya digabung lagi jadi satu daftar.
    // Snips diperlakukan opsional: kalau berkasnya belum ada, kabar tetap
    // tampil dan cuma kolom Stockbit yang kosong.
    //
    // Berkas ketiga, `ipot_arsip.json`, cuma ditarik kalau diminta
    // (`denganArsip`): isinya arsip IPOT mundur sampai awal tahun, jadi
    // ukurannya berlipat dari dua berkas lain. Halaman `/kabar` memang butuh
    // kedalamannya; Beranda tidak — dan menariknya di semua halaman berarti
    // membayar megabita untuk empat baris kabar terbaru.
    const kosong = Promise.resolve({ item: [] as KabarItem[] })
    Promise.all([
      fetch('/data-idx/json/kabar.json')
        .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status))))),
      fetch('/data-idx/json/snips.json')
        .then((r) => (r.ok ? r.json() : { item: [] }))
        .catch(() => ({ item: [] })),
      denganArsip
        ? fetch('/data-idx/json/ipot_arsip.json')
          .then((r) => (r.ok ? r.json() : { item: [] }))
          .catch(() => ({ item: [] }))
        : kosong,
    ])
      .then(([utama, snips, arsip]: [Kabar, { item?: KabarItem[] }, { item?: KabarItem[] }]) => {
        const gabung = gabungKabar(utama, snips.item ?? [], arsip.item ?? [])
        if (denganArsip) { cacheArsip = gabung; cacheArsipSejak = Date.now() }
        else { cache = gabung; cacheSejak = Date.now() }
        if (!batal) setKabar(gabung)
      })
      .catch(() => !batal && setGalat(true))
    return () => { batal = true }
  }, [denganArsip])

  return { kabar, galat }
}

/**
 * Umur kabar dibaca dari ISI daftarnya — stempel waktu item terbaru.
 *
 * Ruas `dipanen` sengaja TIDAK dipakai untuk ini: berkasnya ditulis ulang tiap
 * 2 jam walau tak membawa satu pun kabar baru, jadi "diperbarui 5 menit lalu"
 * bisa terpampang di atas daftar yang isinya berhenti tiga hari lalu. Ini
 * bentuk kegagalan yang sama dengan membaca mtime berkas (CLAUDE.md, kasus
 * broker summary) — pembaca melihat angka yang segar dan menyimpulkan datanya
 * segar.
 */
export function kabarTerbaru(k: Kabar | null): string | null {
  // Perbandingan epoch, bukan string: alasan yang sama dengan pengurutan di
  // `gabungKabar` — kabar Google News berzona UTC akan selalu kalah dari
  // kabar WIB yang sebenarnya lebih tua.
  return (k?.item ?? []).reduce<string | null>((maks, i) => {
    const t = epochKabar(i.waktu)
    if (t == null) return maks
    const m = epochKabar(maks)
    return m == null || t > m ? i.waktu : maks
  }, null)
}

/** "2 jam lalu" / "Kamis, 14 Agu" — waktu relatif cuma sampai sehari, lewat
 *  itu tanggalnya lebih berguna daripada "31 jam lalu". */
export function waktuKabar(iso: string | null, sekarang = new Date()): string {
  if (!iso) return '—'
  const t = new Date(iso)
  if (Number.isNaN(t.getTime())) return '—'
  const menit = Math.round((sekarang.getTime() - t.getTime()) / 60000)
  if (menit < 1) return 'baru saja'
  if (menit < 60) return `${menit} menit lalu`
  if (menit < 24 * 60) return `${Math.round(menit / 60)} jam lalu`
  const bulan = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'][t.getMonth()]
  return `${t.getDate()} ${bulan}, ${String(t.getHours()).padStart(2, '0')}:${String(t.getMinutes()).padStart(2, '0')}`
}
