/**
 * Pembangun data IPO & rapor Penjamin Emisi — `data-idx/json/ipo.json`.
 *
 * Nol jaringan: dibaca dari berkas yang sudah ada di cakram
 * (`data-idx/json/profil_stockbit/<KODE>.json` ruas `history` + `ohlc/<KODE>.json`),
 * pola sama `bangun-screener.mjs`.
 *
 *   node app/scripts/bangun-ipo.mjs
 */
import { readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const AKAR = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const DIR_JSON = join(AKAR, 'data-idx', 'json')
const DIR_PROFIL = join(DIR_JSON, 'profil_stockbit')
const DIR_OHLC = join(DIR_JSON, 'ohlc')
const KELUARAN = join(DIR_JSON, 'ipo.json')

// "bar ke-N" dari bar listing (bar ke-1 = bar pertama yang tanggalnya >=
// tanggal listing) — offset 0-based dari bar itu. 1M = 21 bar ≈ 1 bulan
// bursa, 1W = 5 bar ≈ 1 pekan bursa, definisi ini DICETAK di layar (view).
const OFFSET_1D = 0
const OFFSET_1W = 4
const OFFSET_1M = 20

const BULAN = {
  Jan: 0, Feb: 1, Mar: 2, Apr: 3, May: 4, Jun: 5,
  Jul: 6, Aug: 7, Sep: 8, Oct: 9, Nov: 10, Dec: 11,
}

function bacaJson(path) {
  try {
    return JSON.parse(readFileSync(path, 'utf8'))
  } catch {
    return null
  }
}

/** "31 May 2000" → "2000-05-31". null kalau bentuknya tak dikenal. */
function tanggalIso(raw) {
  const m = /^(\d{1,2}) (\w{3}) (\d{4})$/.exec(String(raw ?? '').trim())
  if (!m) return null
  const bulan = BULAN[m[2]]
  if (bulan == null) return null
  const d = new Date(Date.UTC(Number(m[3]), bulan, Number(m[1])))
  return d.toISOString().slice(0, 10)
}

/** String "1,400" / "662,400,000" → angka. KETAT: menolak apa pun yang bukan
 *  murni digit+koma (mis. "100 - 105", rentang book-building PSGO — bukan
 *  harga IPO final) — beda dari `angka()` longgar rasioTambahanKeystats.ts
 *  karena di sana input sudah rasio bersih, di sini mentah dari sumber. */
function angkaKetat(raw) {
  const s = String(raw ?? '').trim()
  if (!/^[\d,]+$/.test(s)) return null
  const n = Number(s.replace(/,/g, ''))
  return Number.isFinite(n) ? n : null
}

/** Uppercase, buang PT/Tbk/tanda baca/spasi ganda — MEKANIS saja, bukan
 *  menebak sinonim (dua penjamin beda nama tetap dibiarkan beda). Entri
 *  placeholder ("-") dibuang: tak ada huruf sama sekali sesudah dinormalkan.
 *  Prefiks "XX - " (kode broker IDX 1-3 huruf + tanda hubung, mis. "OD -
 *  BRI Danareksa Sekuritas") dibuang juga: pola tetap & terdeteksi murni
 *  lewat bentuknya (kode di depan tanda hubung), BUKAN tebakan nama —
 *  perlakuannya sama seperti membuang "PT." di depan. */
function normalisasiUnderwriters(raw) {
  const hasil = []
  for (const u of raw ?? []) {
    const upper = String(u).trim().toUpperCase()
    const tanpaKode = upper.replace(/^[A-Z]{1,3} - /, '')
    const kata = tanpaKode.replace(/[.,]/g, '').split(/\s+/)
      .filter((w) => w && w !== 'PT' && w !== 'TBK')
    const nama = kata.join(' ').trim()
    if (/[A-Z]/.test(nama) && !hasil.includes(nama)) hasil.push(nama)
  }
  return hasil
}

/** Median — satu IPO ekstrem (mis. crossing raksasa) tak boleh menyeret
 *  rata-rata rapor penjamin emisi lain yang kebetulan ikut menjaminnya. */
function median(arr) {
  if (arr.length === 0) return null
  const s = [...arr].sort((a, b) => a - b)
  const mid = Math.floor(s.length / 2)
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2
}

const daftar = bacaJson(join(DIR_JSON, 'daftar_emiten.json'))
const namaByKode = new Map((daftar?.emiten ?? []).map((e) => [e.kode, e.nama]))

const fileProfil = readdirSync(DIR_PROFIL).filter((f) => f.endsWith('.json')).sort()

const emiten = []
let dilewati = 0
const hitungTanggal = new Map() // modus tanggal bar terakhir dipakai — sama pola bangun-screener.mjs

for (const f of fileProfil) {
  const kode = f.replace(/\.json$/, '')
  const profil = bacaJson(join(DIR_PROFIL, f))
  const h = profil?.history

  const tanggalListing = tanggalIso(h?.date)
  const hargaIpo = angkaKetat(h?.price)
  if (!tanggalListing || hargaIpo == null) {
    dilewati++ // tanpa history/harga usable (kosong, atau rentang book-building tanpa harga final)
    continue
  }

  const lembar = angkaKetat(h?.shares)
  const underwriters = normalisasiUnderwriters(h?.underwriters)

  const ohlc = bacaJson(join(DIR_OHLC, `${kode}.json`))
  const baris = Array.isArray(ohlc?.d) ? ohlc.d : []
  const idx0 = baris.findIndex((b) => b[0] >= tanggalListing)

  function padaOffset(offset) {
    if (idx0 < 0) return { close: null, ret: null }
    const i = idx0 + offset
    if (i >= baris.length) return { close: null, ret: null }
    const close = baris[i][4]
    const ret = hargaIpo > 0 ? (close / hargaIpo - 1) * 100 : null
    return { close, ret }
  }

  const d1 = padaOffset(OFFSET_1D)
  const w1 = padaOffset(OFFSET_1W)
  const m1 = padaOffset(OFFSET_1M)
  const kini = baris.length > 0
    ? padaOffset(baris.length - 1 - idx0)
    : { close: null, ret: null }

  if (baris.length > 0) {
    const tglTerakhir = baris.at(-1)[0]
    hitungTanggal.set(tglTerakhir, (hitungTanggal.get(tglTerakhir) ?? 0) + 1)
  }

  emiten.push({
    kode,
    nama: namaByKode.get(kode) ?? null,
    tahun: Number(tanggalListing.slice(0, 4)),
    tanggal_listing: tanggalListing,
    harga_ipo: hargaIpo,
    lembar,
    dana: lembar != null ? hargaIpo * lembar : null,
    underwriters,
    close_1d: d1.close, return_1d: d1.ret,
    close_1w: w1.close, return_1w: w1.ret,
    close_1m: m1.close, return_1m: m1.ret,
    close_kini: kini.close, return_kini: kini.ret,
  })
}

// Agregat per underwriter — n IPO (jumlah emiten yang dijamin, terlepas dari
// ada/tidaknya return di suatu horizon), win rate (return > 0) & median return
// per horizon, dihitung hanya dari emiten yang punya angka di horizon itu.
const petaUw = new Map()
for (const e of emiten) {
  for (const uw of e.underwriters) {
    if (!petaUw.has(uw)) petaUw.set(uw, { n: 0, d1: [], w1: [], m1: [], kini: [] })
    const rec = petaUw.get(uw)
    rec.n++
    if (e.return_1d != null) rec.d1.push(e.return_1d)
    if (e.return_1w != null) rec.w1.push(e.return_1w)
    if (e.return_1m != null) rec.m1.push(e.return_1m)
    if (e.return_kini != null) rec.kini.push(e.return_kini)
  }
}

function ringkasHorizon(rets) {
  return {
    n: rets.length,
    win: rets.length > 0 ? rets.filter((r) => r > 0).length / rets.length : null,
    median: median(rets),
  }
}

const underwriter = [...petaUw.entries()]
  .map(([nama, rec]) => ({
    nama,
    n: rec.n,
    h1d: ringkasHorizon(rec.d1),
    h1w: ringkasHorizon(rec.w1),
    h1m: ringkasHorizon(rec.m1),
    hkini: ringkasHorizon(rec.kini),
  }))
  .sort((a, b) => b.n - a.n)

const tanggal = [...hitungTanggal.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null

writeFileSync(KELUARAN, JSON.stringify({
  diperbarui: new Date().toISOString(),
  tanggal,
  n: emiten.length,
  dilewati,
  emiten,
  underwriter,
}))

console.log(`ipo.json: ${emiten.length} emiten masuk, ${dilewati} dilewati (tanpa history/harga usable)`)
console.log(`${underwriter.length} penjamin emisi berbeda (sesudah normalisasi mekanis)`)
console.log('3 underwriter terbesar (n IPO):', underwriter.slice(0, 3).map((u) => `${u.nama} (${u.n})`).join(', '))
console.log(`tanggal hari bursa terakhir (modus): ${tanggal}`)
