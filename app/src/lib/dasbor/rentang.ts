import { LABEL_RENTANG } from './periode'

/**
 * Modul rentang BERSAMA (spek konsistensi §2) — satu-satunya tempat preset
 * rentang waktu didefinisikan untuk seluruh halaman.
 *
 * Lahir dari audit 26 Agu: EMPAT kosakata hidup berdampingan (`b3` Neo Papan
 * vs `3M` Stock Detail vs `60 hari` Stalker vs `5D` Diary) karena tiap
 * halaman mengeja presetnya sendiri. Label TETAP dari `LABEL_RENTANG`
 * (aturan #170 — kata rentang cuma dieja di sana); yang modul ini tambahkan:
 *
 * 1. daftar preset baku + berapa hari BURSA tiap preset,
 * 2. logika ketersediaan — preset yang datanya tak ada JANGAN tampil
 *    (atau nonaktif berikut alasan, pola chip intraday Whales),
 * 3. caption rentang SEBENARNYA — judul wajib menampilkan tanggal nyata
 *    ("2026-05-26 → 2026-08-24 · 60 hari bursa"), bukan label presetnya,
 *    karena "60d" pernah bohong saat datanya lebih pendek.
 */

export type IdRentang =
  | 'w1' | 'w2' | 'b1' | 'b3' | 'b6' | 'ytd' | 'y1' | 'y3' | 'y5' | 'y10' | 'semua'

/** Hari BURSA per preset (±252/tahun) — bukan hari kalender. */
export const HARI_BURSA: Record<Exclude<IdRentang, 'ytd' | 'semua'>, number> = {
  w1: 5, w2: 10, b1: 21, b3: 63, b6: 126, y1: 252, y3: 756, y5: 1260, y10: 2520,
}

/** Urutan tampil baku. Halaman memilih subset lewat `opsiRentang`. */
export const URUTAN_RENTANG: IdRentang[] =
  ['w1', 'w2', 'b1', 'b3', 'b6', 'ytd', 'y1', 'y3', 'y5', 'y10', 'semua']

export interface OpsiRentang {
  id: IdRentang
  label: string
  nonaktif?: boolean
  /** Alasan nonaktif — dipasang ke `title` supaya pembaca tahu kenapa. */
  alasan?: string
}

/**
 * Susun daftar opsi untuk satu halaman dari kedalaman data NYATA.
 *
 * `nHari` = jumlah hari bursa yang benar-benar tersedia. Preset yang lebih
 * panjang dari data DIHILANGKAN (bawaan) atau dinonaktifkan dengan alasan
 * (`tampilkanNonaktif` — dipakai bila halaman ingin memberi tahu data akan
 * hadir, mis. tombol muat bertaksiran MB). w1..y1 + ytd + semua selalu
 * tampil; ambang hanya menyaring y3/y5/y10 (spek: "data ≥3 tahun").
 */
export function opsiRentang(
  nHari: number,
  pilih: IdRentang[] = URUTAN_RENTANG,
  tampilkanNonaktif = false,
): OpsiRentang[] {
  const keluar: OpsiRentang[] = []
  for (const id of URUTAN_RENTANG) {
    if (!pilih.includes(id)) continue
    if (id === 'ytd' || id === 'semua' || HARI_BURSA[id] <= 252 || nHari >= HARI_BURSA[id]) {
      keluar.push({ id, label: LABEL_RENTANG[id] })
    } else if (tampilkanNonaktif) {
      const th = Math.round(HARI_BURSA[id] / 252)
      keluar.push({
        id, label: LABEL_RENTANG[id], nonaktif: true,
        alasan: `Arsip baru ${Math.floor(nHari / 252)} tahun — butuh ±${th} tahun data`,
      })
    }
  }
  return keluar
}

/**
 * Potong deret ber-`tanggal` ISO (urut naik) sesuai preset. YTD = sejak
 * 1 Januari tahun baris TERAKHIR (bukan hari ini — deret bisa berhenti di
 * hari bursa lampau). `semua` mengembalikan apa adanya.
 */
export function potongRentang<T>(
  rows: T[],
  id: IdRentang,
  tanggal: (r: T) => string = (r) => (r as { tanggal: string }).tanggal,
): T[] {
  if (id === 'semua' || rows.length === 0) return rows
  if (id === 'ytd') {
    const awal = `${tanggal(rows[rows.length - 1]).slice(0, 4)}-01-01`
    return rows.filter((r) => tanggal(r) >= awal)
  }
  return rows.slice(-HARI_BURSA[id])
}

/**
 * Caption rentang SEBENARNYA — wajib menyertai preset apa pun. Kalau hasil
 * potongan lebih pendek dari yang diminta, itu terlihat sendiri dari n-nya;
 * pemanggil boleh menambah "(diminta X, arsip hanya Y)" pola Seasonality.
 */
export function captionRentang<T>(
  rows: T[],
  tanggal: (r: T) => string = (r) => (r as { tanggal: string }).tanggal,
): string {
  if (rows.length === 0) return 'tak ada data di rentang ini'
  return `${tanggal(rows[0])} → ${tanggal(rows[rows.length - 1])} · ${rows.length.toLocaleString('id-ID')} hari bursa`
}
