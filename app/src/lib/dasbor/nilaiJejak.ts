/**
 * Pembaca berkas hakim — SATU sumber angka win rate.
 *
 * Sampai 5 Sep 2026 halaman Screener menghitung win rate sendiri di peramban
 * (`winRate.ts`) sementara `scripts/riset/nilai_jejak.py` menghitung hal yang
 * sama di sisi panen. Dua kalkulator untuk satu metrik, dan keduanya memakai
 * **aturan yang bertentangan** pada kasus ambigu:
 *
 * | Kasus | Hakim | Halaman (dulu) |
 * |---|---|---|
 * | TP & SL kena hari sama | KALAH | keluar dari penyebut |
 * | Harga tak pernah masuk area beli | ikut penyebut ukuran kedua | keluar juga |
 * | Berapa angka dilaporkan | dua | satu |
 *
 * Terukur sebelum diganti, preset whale-tiket jendela 1 bulan: halaman
 * menayangkan 90,6% / 38,8% / 89,4%, hakim memberi 81,0% / 32,0% / 83,3%
 * untuk irisan yang sama. Selisihnya searah — halaman selalu lebih tinggi —
 * karena aturannya lebih longgar DAN karena ia hanya memuat bar sebagian
 * emiten (sisanya jadi "tak terukur" dan hilang dari penyebut), sedangkan
 * hakim membaca seluruh arsip harga.
 *
 * Modul ini TIDAK menghitung apa pun kecuali penjumlahan lintas tanggal. Kalau
 * suatu saat ada angka yang perlu tapi tak ada di berkas, yang ditambah
 * keluaran hakimnya — bukan hitungan di sini. Itu seluruh alasan modul ini ada.
 */

export type VonisDefinisi = 'menang' | 'kalah' | 'gantung' | 'tak_masuk' | 'tak_terukur'
export type DefinisiId = 'openTinggi' | 'tutupTutup' | 'tpSl'

/** Ringkasan satu definisi H+1 (openTinggi / tutupTutup). */
export interface RingkasH1 {
  menang: number
  kalah: number
  takTerukur: number
  /** menang ÷ (menang+kalah); `null` kalau tak ada yang terukur — JANGAN
   *  dibaca sebagai 0%. */
  winRate: number | null
  /** hanya pada tutupTutup */
  rataPersen?: number | null
}

/** Ringkasan TP/SL — dua win rate, sesuai keputusan (4) hakim. */
export interface RingkasTpSl {
  menang: number
  kalah: number
  gantung: number
  tak_masuk: number
  ambigu: number
  menangDariTuntas: number | null
  menangDariSemua: number | null
}

export interface VonisSaham {
  kode: string
  tpSl: VonisDefinisi
  openTinggi: VonisDefinisi
  tutupTutup: VonisDefinisi
  persen: number | null
}

export interface PresetJejak {
  preset: string
  n: number
  saham: VonisSaham[]
  definisi: { openTinggi: RingkasH1; tutupTutup: RingkasH1; tpSl: RingkasTpSl }
}

export interface TanggalJejak {
  tanggal: string
  kelasBukti: 'REKONSTRUKSI' | 'CATATAN'
  era: 'abjad' | 'nilai-transaksi'
  hariBursaTersedia: number
  jendelaTutup: boolean
  n: number
  definisi: { openTinggi: RingkasH1; tutupTutup: RingkasH1; tpSl: RingkasTpSl }
  preset: PresetJejak[]
}

export interface BerkasJejak {
  horizon: number
  hariBursaTerakhir: string | null
  perTanggal: TanggalJejak[]
}

let singgahan: Promise<BerkasJejak | null> | null = null

/** Satu unduhan per sesi peramban — berkasnya ±173 KB dan dipakai beberapa
 *  tab sekaligus. */
export function ambilJejak(): Promise<BerkasJejak | null> {
  if (!singgahan) {
    singgahan = fetch('/data-idx/json/nilai_jejak.json')
      .then((r) => (r.ok ? (r.json() as Promise<BerkasJejak>) : null))
      .catch(() => null)
  }
  return singgahan
}

/** Baris tanggal untuk satu preset, terbaru dulu, dipotong ke `nHari` tanggal
 *  TERAKHIR yang ada — bukan snap kalender, sama seperti pemakai lamanya. */
export function tanggalPreset(berkas: BerkasJejak, preset: string, nHari: number): {
  tanggal: string
  kelasBukti: TanggalJejak['kelasBukti']
  era: TanggalJejak['era']
  jendelaTutup: boolean
  hariBursaTersedia: number
  p: PresetJejak
}[] {
  return berkas.perTanggal
    .map((t) => {
      const p = t.preset.find((x) => x.preset === preset)
      return p ? { tanggal: t.tanggal, kelasBukti: t.kelasBukti, era: t.era, jendelaTutup: t.jendelaTutup, hariBursaTersedia: t.hariBursaTersedia, p } : null
    })
    .filter((x): x is NonNullable<typeof x> => x !== null)
    .sort((a, b) => b.tanggal.localeCompare(a.tanggal))
    .slice(0, nHari)
}

/** Jumlahkan ringkasan H+1 lintas tanggal. Penjumlahan, bukan penilaian —
 *  vonis tiap sinyal sudah diputuskan hakim. */
export function jumlahH1(potong: RingkasH1[]): RingkasH1 {
  const menang = potong.reduce((s, x) => s + x.menang, 0)
  const kalah = potong.reduce((s, x) => s + x.kalah, 0)
  const takTerukur = potong.reduce((s, x) => s + x.takTerukur, 0)
  const tuntas = menang + kalah
  return { menang, kalah, takTerukur, winRate: tuntas ? (menang / tuntas) * 100 : null }
}

export function jumlahTpSl(potong: RingkasTpSl[]): RingkasTpSl {
  const a = (f: keyof RingkasTpSl) => potong.reduce((s, x) => s + (x[f] as number), 0)
  const menang = a('menang'); const kalah = a('kalah')
  const gantung = a('gantung'); const tak_masuk = a('tak_masuk')
  const tuntas = menang + kalah
  const n = tuntas + gantung + tak_masuk
  return {
    menang, kalah, gantung, tak_masuk, ambigu: a('ambigu'),
    menangDariTuntas: tuntas ? (menang / tuntas) * 100 : null,
    menangDariSemua: n ? (menang / n) * 100 : null,
  }
}

/** Rata-rata persen tutup-ke-tutup, DITIMBANG jumlah sinyal terukur tiap
 *  tanggal — bukan rata-rata dari rata-rata. Tanggal dengan 3 sinyal terukur
 *  tak boleh menimbang sama dengan tanggal yang 20. */
export function rataPersenTertimbang(potong: RingkasH1[]): number | null {
  let atas = 0
  let bawah = 0
  for (const x of potong) {
    const w = x.menang + x.kalah
    if (x.rataPersen == null || w === 0) continue
    atas += x.rataPersen * w
    bawah += w
  }
  return bawah ? atas / bawah : null
}

/** Satu baris siap tayang: VONIS dari hakim, keterangan sinyal (skor, target,
 *  batas rugi) dari berkas rekomendasi.
 *
 *  Membaca dua berkas di sini BUKAN dua kalkulator: yang satu memberi
 *  keputusan menang/kalah, yang lain cuma angka yang dipajang di kolom. Tak
 *  ada vonis yang dihitung ulang di peramban. */
export interface BarisJejakSaham {
  tanggal: string
  kode: string
  skor: number | null
  tp1: number | null
  sl: number | null
  openTinggi: VonisDefinisi
  tutupTutup: VonisDefinisi
  tpSl: VonisDefinisi
  persen: number | null
}

export function ambilVonis(b: BarisJejakSaham, definisi: DefinisiId): VonisDefinisi {
  return definisi === 'openTinggi' ? b.openTinggi : definisi === 'tutupTutup' ? b.tutupTutup : b.tpSl
}

/** Gabungkan vonis hakim untuk satu tanggal+preset dengan keterangan sinyalnya.
 *  Sinyal yang tak ada di berkas hakim dilewati — bukan ditebak vonisnya. */
export function barisSahamDariHakim(
  tanggal: string,
  presetJejak: PresetJejak,
  keterangan: ReadonlyMap<string, { skor: number | null; tp1: number | null; sl: number | null }>,
): BarisJejakSaham[] {
  return presetJejak.saham.map((s) => {
    const k = keterangan.get(s.kode)
    return {
      tanggal,
      kode: s.kode,
      skor: k?.skor ?? null,
      tp1: k?.tp1 ?? null,
      sl: k?.sl ?? null,
      openTinggi: s.openTinggi,
      tutupTutup: s.tutupTutup,
      tpSl: s.tpSl,
      persen: s.persen,
    }
  })
}
