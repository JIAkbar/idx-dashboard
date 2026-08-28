/**
 * Blok C Berkas Emiten — ALIRAN ASING.
 *
 * Menjawab: asing sedang menumpuk atau melepas emiten ini, sudah berapa lama
 * berturut-turut, dan seberapa besar dibanding perdagangan hariannya.
 *
 * ## Batas yang menentukan bentuk seluruh modul ini
 *
 * **IDX tidak melaporkan aliran asing dalam RUPIAH** — hanya lembar
 * (`catatan` di berkas mentah menyatakannya). Ruas `value` di berkas itu
 * adalah nilai transaksi PASAR hari itu, bukan nilai rupiah aliran asing;
 * mengalikannya dengan net lembar akan melahirkan angka yang terlihat resmi
 * dan salah. Karena itu seluruh modul ini berhitung dalam **lembar**, dan
 * porsi dinyatakan terhadap **volume**, bukan terhadap rupiah.
 *
 * Konsekuensi lain yang sengaja tak dilanggar: net lembar dari beberapa hari
 * TIDAK bisa dijumlahkan jadi rupiah dengan mengalikan harga rata-rata —
 * galat taksiran begitu terbukti MIRING (kumulatif 1,33× atas 138 hari), jadi
 * ia menumpuk alih-alih saling meniadakan.
 */

export interface HariAsing {
  tanggal: string
  /** Lembar. */
  beli: number
  jual: number
  volume: number
}

export interface RingkasAsing {
  nHari: number
  tglMulai: string | null
  tglAkhir: string | null
  /** Net lembar sepanjang jendela (beli − jual). */
  netLembar: number
  /** Porsi net terhadap total volume jendela (−1..1). null bila volume 0. */
  porsiVolume: number | null
  /** Hari berturut-turut TERAKHIR dengan arah net yang sama. Positif =
   *  beruntun net beli, negatif = beruntun net jual, 0 = hari terakhir netral
   *  atau tak ada data. */
  streak: number
  /** Berapa dari nHari yang net-nya positif. */
  hariNetBeli: number
  /** Deret net harian untuk sparkline — urut lama→baru. */
  deret: number[]
}

/** Net lembar satu hari. */
function net(h: HariAsing): number {
  return h.beli - h.jual
}

/**
 * Ringkas `n` hari terakhir. `hari` diharapkan urut lama→baru.
 *
 * Hari bervolume nol TIDAK dibuang di sini — berbeda dari perhitungan return,
 * hari tanpa transaksi memang bermakna "asing tak bergerak", dan membuangnya
 * akan memutus hitungan beruntun secara palsu.
 */
export function ringkasAsing(hari: HariAsing[], n = 20): RingkasAsing {
  const pilih = hari.slice(-Math.max(1, n))
  if (pilih.length === 0) {
    return {
      nHari: 0, tglMulai: null, tglAkhir: null, netLembar: 0,
      porsiVolume: null, streak: 0, hariNetBeli: 0, deret: [],
    }
  }

  const deret = pilih.map(net)
  const netLembar = deret.reduce((s, v) => s + v, 0)
  const totalVol = pilih.reduce((s, h) => s + h.volume, 0)

  // Beruntun dihitung dari hari TERAKHIR mundur, dan berhenti pada hari
  // netral (net persis 0) — bukan diperlakukan sebagai lanjutan arah lama.
  let streak = 0
  const arah = Math.sign(deret[deret.length - 1] ?? 0)
  if (arah !== 0) {
    for (let i = deret.length - 1; i >= 0; i -= 1) {
      if (Math.sign(deret[i]) !== arah) break
      streak += 1
    }
    streak *= arah
  }

  return {
    nHari: pilih.length,
    tglMulai: pilih[0].tanggal,
    tglAkhir: pilih[pilih.length - 1].tanggal,
    netLembar,
    porsiVolume: totalVol > 0 ? Math.max(-1, Math.min(1, netLembar / totalVol)) : null,
    streak,
    hariNetBeli: deret.filter((v) => v > 0).length,
    deret,
  }
}

/** Kalimat arah — menyebut angkanya, bukan cuma "positif/negatif". */
export function bacaAliran(r: RingkasAsing): string {
  if (r.nHari === 0) return 'Belum ada data aliran asing untuk emiten ini.'
  const lbr = Math.abs(r.netLembar).toLocaleString('id-ID')
  const arah = r.netLembar > 0 ? 'menumpuk' : r.netLembar < 0 ? 'melepas' : 'seimbang'
  if (r.netLembar === 0) return `Selama ${r.nHari} hari terakhir asing seimbang — beli dan jual berimbang.`
  const beruntun = Math.abs(r.streak) >= 3
    ? ` Beruntun ${Math.abs(r.streak)} hari ${r.streak > 0 ? 'net beli' : 'net jual'}.`
    : ''
  return `Selama ${r.nHari} hari terakhir asing ${arah} ${lbr} lembar.${beruntun}`
}

/** Porsi terhadap volume, dibaca sebagai kalimat. null bila tak terhitung. */
export function bacaPorsi(r: RingkasAsing): string | null {
  if (r.porsiVolume == null) return null
  const p = Math.abs(r.porsiVolume * 100)
  const sisi = r.porsiVolume >= 0 ? 'masuk' : 'keluar'
  if (p < 1) return `Netnya di bawah 1% dari volume — arus asing praktis netral.`
  return `Net ${sisi} setara ${p.toFixed(1).replace('.', ',')}% dari seluruh volume periode ini.`
}
