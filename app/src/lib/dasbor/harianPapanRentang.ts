/**
 * Akumulasi Harian Papan atas RENTANG tanggal.
 *
 * Asal (Johan, 29 Agu 2026): *"saya suka komponen kalender seperti ini,
 * jadikan ini bisa select range waktu ini ada di page harian papan"*.
 *
 * ## Kenapa modul ini kecil — dan sengaja begitu
 *
 * Harian Papan menampilkan 20-an kolom, dan **sebagian besar tidak boleh
 * dijumlahkan lintas hari**:
 *
 * - `harga`, `free_float`, `rvol10`, posisi terhadap MA/EMA, dan ketiga skor
 *   adalah keadaan **pada satu hari**. Menjumlahkannya tak punya arti;
 *   merata-ratakannya menghasilkan angka yang terlihat masuk akal dan
 *   menyesatkan (rata-rata "Strong Buy" itu apa?).
 * - `tdm_persen`, `chg_1d`, `chg_wtd`, `chg_mtd` adalah persentase
 *   berjenjang. Menjumlahkan persen harian BUKAN return periode —
 *   +10% lalu −10% menghasilkan −1%, bukan 0%.
 *
 * Yang **boleh** dijumlahkan cuma tiga: volume (lembar), nilai (rupiah), dan
 * net beli/jual asing (ribu rupiah). Ketiganya besaran aliran yang memang
 * aditif. Jadi mode rentang menampilkan tiga kolom itu saja, plus jumlah hari
 * yang benar-benar dipakai — bukan tabel penuh dengan sebagian kolom diam-diam
 * salah.
 */
import type { BarisHarianPapan } from './harianPapan'

export interface BarisRentang {
  kode: string
  nama: string | null
  sektor: string
  /** Lembar, dijumlahkan. */
  volume: number
  /** Rupiah, dijumlahkan. */
  nilai: number
  /** Ribu rupiah, dijumlahkan (positif = net beli asing). */
  nbsf_000: number
  /** Berapa hari emiten ini benar-benar punya baris di rentang tsb. */
  nHari: number
  /** Harga penutupan hari TERAKHIR yang ada — konteks, bukan hasil hitungan. */
  harga_akhir: number | null
}

export interface HasilRentang {
  baris: BarisRentang[]
  /** Tanggal yang benar-benar punya data di rentang itu, urut lama→baru. */
  tanggalDipakai: string[]
}

/**
 * Jumlahkan beberapa hari jadi satu tabel.
 *
 * `perTanggal` = tanggal → baris hari itu, dan hanya tanggal yang ADA di peta
 * yang dihitung. Akhir pekan atau hari libur yang tak punya berkas tidak
 * membuat hasilnya nol; ia hanya tak menambah apa-apa, dan `nHari` melaporkan
 * berapa hari yang sesungguhnya terpakai.
 */
export function akumulasiRentang(
  perTanggal: ReadonlyMap<string, readonly BarisHarianPapan[]>,
): HasilRentang {
  const tanggalDipakai = [...perTanggal.keys()].sort()
  const peta = new Map<string, BarisRentang>()

  for (const tgl of tanggalDipakai) {
    for (const b of perTanggal.get(tgl) ?? []) {
      let r = peta.get(b.kode)
      if (!r) {
        r = {
          kode: b.kode, nama: b.nama, sektor: b.sektor,
          volume: 0, nilai: 0, nbsf_000: 0, nHari: 0, harga_akhir: null,
        }
        peta.set(b.kode, r)
      }
      r.volume += b.volume ?? 0
      r.nilai += b.nilai ?? 0
      r.nbsf_000 += b.nbsf_000 ?? 0
      r.nHari += 1
      // Tanggal diiterasi urut lama→baru, jadi nilai terakhir yang menang
      // adalah hari paling baru yang punya data untuk emiten ini.
      if (b.harga != null) r.harga_akhir = b.harga
      // Nama/sektor bisa kosong di hari lama; isi begitu ada yang punya.
      if (!r.nama && b.nama) r.nama = b.nama
      if ((!r.sektor || r.sektor === '–') && b.sektor) r.sektor = b.sektor
    }
  }

  return { baris: [...peta.values()], tanggalDipakai }
}

/** Kalimat cakupan untuk dicetak di layar — menyebut yang TIDAK dihitung. */
export function catatanRentang(h: HasilRentang): string {
  const n = h.tanggalDipakai.length
  if (n === 0) return 'Tak ada hari bursa berdata di rentang ini.'
  const a = h.tanggalDipakai[0]
  const z = h.tanggalDipakai[n - 1]
  return `${n} hari bursa berdata (${a} – ${z}). Hanya volume, nilai, dan net asing yang dijumlahkan — harga, persentase, dan skor adalah keadaan satu hari dan tak bisa ditambahkan.`
}
