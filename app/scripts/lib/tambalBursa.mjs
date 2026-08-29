/**
 * Tambalan ujung dari arsip bursa — dipakai bersama oleh pembangun turunan
 * harian yang membaca arsip harga.
 *
 * ## Kenapa ada
 *
 * Arsip harga memakai kredensial dan bisa berhenti terisi tanpa satu pun
 * galat: yang tertulis adalah bar bertanggal hari ini dengan volume nol.
 * Arsip bursa tidak memakai kredensial apa pun dan tetap terbit, lengkap
 * dengan tutup/tinggi/rendah, volume, nilai, frekuensi, aliran asing, dan
 * jumlah saham untuk 963 emiten.
 *
 * Keduanya boleh disambung karena terukur SAMA, bukan karena kelihatan mirip:
 * 8.976 pasang emiten-hari (150 emiten × 60 hari), median rasio tutup
 * 1,000000; satu-satunya 96 selisih >0,5% semuanya jatuh di hari yang arsip
 * harganya masih bar hantu. 59 hari lain nol selisih.
 *
 * ## Batasnya, dan kenapa ketat
 *
 * Konvensi kedua sumber BERBEDA di masa lalu — arsip harga menyesuaikan
 * riwayat ke aksi korporasi, bursa melaporkan apa adanya saat itu. Menjahit
 * berhari-hari menumpuk selisih yang tak terlihat. Jadi yang disambung hanya
 * hari yang arsip harga belum punya sama sekali, maksimal MAKS_HARI, dan
 * SELALU di memori — berkas arsip tak pernah ditulis ulang, sehingga panen
 * ulang berikutnya menang tanpa perlu membatalkan apa pun.
 *
 * Ekstraksi dari `bangun-harian-papan.mjs` (29 Agu 2026) supaya pembangun
 * lain tak menyalin logikanya — versi yang disalin akan berbeda diam-diam
 * begitu salah satunya diperbaiki.
 */
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'
import { join } from 'node:path'

/** Lebih dari ini = panen ulang sumbernya, bukan dijahit. */
export const MAKS_HARI = 5

const angka = (x) => {
  const v = Number(x)
  return Number.isFinite(v) && v !== 0 ? v : null
}

/**
 * Lembar → rupiah pakai harga rata-rata hari itu (nilai ÷ volume, dua-duanya
 * dari baris yang sama supaya pembilang dan penyebut satu rumah).
 *
 * Diukur atas 5.590 pasang emiten-hari terhadap angka rupiah sungguhan: arah
 * cocok 98,6%, median rasio 0,9995, kumulatif 1,0023, 93% dalam ±10%.
 *
 * BUKAN taksiran yang dulu dibuang karena miring +33% — yang itu level PASAR,
 * dan harga rata-rata pasar didominasi emiten bervolume besar berharga rendah
 * sementara transaksi asing terkonsentrasi di emiten berharga tinggi. Bias
 * komposisi; per emiten tak punya itu.
 */
export function taksirRupiah(lembar, volume, nilai) {
  const v = Number(volume)
  const n = Number(nilai)
  if (!(v > 0) || !(n > 0)) return null
  return (Number(lembar) || 0) * (n / v)
}

/** Bar 6 kolom `[tanggal, buka, tinggi, rendah, tutup, volume]` — format
 *  arsip harga gabungan. Pembukaan dibiarkan null kalau bursa tak
 *  melaporkannya; yang membacanya wajib menjaganya sendiri. */
export function barEnamKolom(r, iso) {
  const tutup = angka(r.Close)
  if (tutup == null) return null
  return [
    iso,
    angka(r.OpenPrice),
    angka(r.High) ?? tutup,
    angka(r.Low) ?? tutup,
    tutup,
    Number(r.Volume) || 0,
  ]
}

/** Bar 17 kolom format arsip harga sumber. Aliran asing DITAKSIR ke rupiah —
 *  slot itu berisi rupiah, sementara bursa melaporkan lembar; mengisinya apa
 *  adanya memberi angka yang berselisih ribuan kali di kolom yang sama. */
export function barTujuhBelasKolom(r, iso) {
  const tutup = angka(r.Close)
  if (tutup == null) return null
  return [
    iso,
    Math.floor(Date.parse(`${iso}T00:00:00+07:00`) / 1000),
    angka(r.OpenPrice),
    angka(r.High) ?? tutup,
    angka(r.Low) ?? tutup,
    tutup,
    Number(r.Volume) || 0,
    Number(r.Value) || 0,
    Number(r.Frequency) || 0,
    taksirRupiah(r.ForeignBuy, r.Volume, r.Value),
    taksirRupiah(r.ForeignSell, r.Volume, r.Value),
    0,
    0,
    Number(r.ListedShares) || 0,
    0,
    0,
    0,
  ]
}

/** Tanggal bar terakhir yang BERISI — bar hantu (volume nol) tak bersuara. */
export function tanggalBerisiTerakhir(bar, iVolume) {
  let i = bar.length - 1
  while (i > 0 && Number(bar[i]?.[iVolume] ?? 0) === 0) i -= 1
  return bar[i]?.[0] ?? null
}

/**
 * Sampai tanggal berapa sebuah direktori arsip harga BENAR-BENAR berisi —
 * modus atas sampel berkas.
 *
 * Untuk pembangun yang tak punya pass pendahulu (IPO membaca hanya emiten
 * yang pernah IPO, jadi ia tak menyapu seluruh arsip lebih dulu). Membaca
 * 60 berkas jauh lebih murah daripada 962, dan modus atas 60 sudah kokoh:
 * yang dicari tanggal yang dimiliki hampir semua emiten, bukan yang langka.
 */
export function tanggalBerisiDiDir(dir, { ruas = 'd', iVolume = 5, nSampel = 60 } = {}) {
  if (!existsSync(dir)) return null
  const c = new Map()
  for (const f of readdirSync(dir).filter((x) => x.endsWith('.json')).slice(0, nSampel)) {
    let j
    try {
      j = JSON.parse(readFileSync(join(dir, f), 'utf8'))
    } catch {
      continue
    }
    const bar = j?.[ruas]
    if (!Array.isArray(bar) || bar.length === 0) continue
    const t = tanggalBerisiTerakhir(bar, iVolume)
    if (t) c.set(t, (c.get(t) ?? 0) + 1)
  }
  return [...c.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null
}

/**
 * Berkas arsip bursa yang lebih muda daripada `punyaSampai`, siap disisipkan.
 *
 * Bentuk ini dipakai pembangun yang membaca berkas emiten SATU PER SATU
 * (Screener, IPO, Jago Papan): memuat seluruh bar 962 emiten ke memori dulu
 * hanya untuk menambal satu hari akan menelan lebih dari satu gigabita —
 * sementara tambalannya sendiri cuma beberapa ratus kilobita. Jadi yang
 * dimuat tambalannya, dan penyisipannya terjadi saat tiap emiten dibaca.
 *
 * @returns `{ tanggal: string[], perKode: Map<string, bar[]> }`
 */
export function muatTambalanBursa({ dirBursa, punyaSampai, keBar, log = console }) {
  const kosong = { tanggal: [], perKode: new Map() }
  if (!existsSync(dirBursa) || !punyaSampai) return kosong

  const kandidat = []
  for (const th of readdirSync(dirBursa)) {
    if (!/^\d{4}$/.test(th)) continue
    for (const f of readdirSync(join(dirBursa, th))) {
      const m = f.match(/^(\d{4})(\d{2})(\d{2})\.json\.gz$/)
      if (!m) continue
      const iso = `${m[1]}-${m[2]}-${m[3]}`
      if (iso <= punyaSampai) continue
      const jalur = join(dirBursa, th, f)
      if (statSync(jalur).size < 1000) continue
      kandidat.push([iso, jalur])
    }
  }
  if (kandidat.length === 0) return kosong
  kandidat.sort((a, b) => (a[0] < b[0] ? -1 : 1))

  if (kandidat.length > MAKS_HARI) {
    log.warn(
      `arsip harga tertinggal ${kandidat.length} hari dari arsip bursa ` +
        `(${punyaSampai} → ${kandidat.at(-1)[0]}). Melewati batas tambal ` +
        `${MAKS_HARI} hari; sumbernya perlu dipanen ulang, bukan dijahit.`,
    )
    return kosong
  }

  const tanggal = []
  const perKode = new Map()
  for (const [iso, jalur] of kandidat) {
    let rows
    try {
      rows = JSON.parse(gunzipSync(readFileSync(jalur)).toString('utf8'))?.data
    } catch (e) {
      log.warn(`arsip bursa ${iso} tak terbaca: ${e.message}`)
      continue
    }
    if (!Array.isArray(rows) || rows.length === 0) continue
    let n = 0
    for (const r of rows) {
      const baru = keBar(r, iso)
      if (!baru) continue
      const daftar = perKode.get(r.StockCode)
      if (daftar) daftar.push(baru)
      else perKode.set(r.StockCode, [baru])
      n += 1
    }
    if (n > 0) {
      tanggal.push(iso)
      log.log(`tambal ${iso} dari arsip bursa: ${n} emiten`)
    }
  }
  return { tanggal, perKode }
}

/**
 * Sisipkan bar tambahan ke larik bar satu emiten, di tempat.
 *
 * Bar hantu bertanggal sama DITIMPA; bar berisi tak pernah disentuh — arsip
 * yang sudah punya isinya sendiri selalu menang.
 */
export function sisipkanTambalan(bar, tambahan, iVolume) {
  if (!Array.isArray(bar) || !Array.isArray(tambahan)) return bar
  for (const baru of tambahan) {
    const i = bar.findIndex((b) => b[0] === baru[0])
    if (i === -1) bar.push(baru)
    else if (Number(bar[i][iVolume] ?? 0) === 0) bar[i] = baru
  }
  return bar
}

/**
 * Sambung hari yang belum dimiliki arsip harga, DI MEMORI.
 *
 * @param petaBar   Map kode → larik bar (dimodifikasi di tempat)
 * @param opsi.dirBursa   direktori arsip mentah bursa
 * @param opsi.iVolume    indeks kolom volume di bar
 * @param opsi.keBar      pembentuk bar dari satu baris arsip bursa
 * @param opsi.log        penulis pesan (default console)
 * @returns larik tanggal yang benar-benar ditambal
 */
export function tambalDariArsipBursa(petaBar, { dirBursa, iVolume, keBar, log = console }) {
  if (!existsSync(dirBursa)) return []

  // Sampai tanggal berapa arsip harga BENAR-BENAR berisi — modus, bukan satu
  // emiten acak yang bisa kebetulan disuspensi hari itu.
  const suara = new Map()
  for (const bar of petaBar.values()) {
    if (!Array.isArray(bar) || bar.length === 0) continue
    const t = tanggalBerisiTerakhir(bar, iVolume)
    if (t) suara.set(t, (suara.get(t) ?? 0) + 1)
  }
  const punyaSampai = [...suara.entries()].sort((a, b) => b[1] - a[1])[0]?.[0]
  if (!punyaSampai) return []

  const kandidat = []
  for (const th of readdirSync(dirBursa)) {
    if (!/^\d{4}$/.test(th)) continue
    for (const f of readdirSync(join(dirBursa, th))) {
      const m = f.match(/^(\d{4})(\d{2})(\d{2})\.json\.gz$/)
      if (!m) continue
      const iso = `${m[1]}-${m[2]}-${m[3]}`
      if (iso <= punyaSampai) continue
      const jalur = join(dirBursa, th, f)
      // Arsip 0-baris bertanggal muda = "belum terbit", bukan hari libur.
      // Yang kosong tak boleh dianggap sebagai hari bursa.
      if (statSync(jalur).size < 1000) continue
      kandidat.push([iso, jalur])
    }
  }
  if (kandidat.length === 0) return []
  kandidat.sort((a, b) => (a[0] < b[0] ? -1 : 1))

  if (kandidat.length > MAKS_HARI) {
    log.warn(
      `arsip harga tertinggal ${kandidat.length} hari dari arsip bursa ` +
        `(${punyaSampai} → ${kandidat.at(-1)[0]}). Melewati batas tambal ` +
        `${MAKS_HARI} hari; sumbernya perlu dipanen ulang, bukan dijahit.`,
    )
    return []
  }

  const ditambal = []
  for (const [iso, jalur] of kandidat) {
    let rows
    try {
      rows = JSON.parse(gunzipSync(readFileSync(jalur)).toString('utf8'))?.data
    } catch (e) {
      log.warn(`arsip bursa ${iso} tak terbaca: ${e.message}`)
      continue
    }
    if (!Array.isArray(rows) || rows.length === 0) continue

    let n = 0
    for (const r of rows) {
      const bar = petaBar.get(r.StockCode)
      if (!Array.isArray(bar)) continue
      const baru = keBar(r, iso)
      if (!baru) continue
      const i = bar.findIndex((b) => b[0] === iso)
      // Bar hantu (ada tapi volume nol) DITIMPA; bar berisi tak disentuh.
      if (i === -1) bar.push(baru)
      else if (Number(bar[i][iVolume] ?? 0) === 0) bar[i] = baru
      else continue
      n += 1
    }
    if (n > 0) {
      ditambal.push(iso)
      log.log(`tambal ${iso} dari arsip bursa: ${n} emiten`)
    }
  }
  return ditambal
}
