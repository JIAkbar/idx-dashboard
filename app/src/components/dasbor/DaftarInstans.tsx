import { useCallback, useState } from 'react'
import { buatInstans, type Instans, type SpekParam } from '../../lib/dasbor/grafikEmiten'

/**
 * Daftar instans berparameter — dipakai DUA KALI di Grafik Emiten: sekali
 * untuk indikator, sekali untuk pola. Keduanya persis sama kelakuannya
 * (tambah dari dropdown, ubah parameter, sembunyikan sementara, hapus,
 * simpan ke template), yang berbeda cuma spek parameternya; menuliskannya
 * dua kali berarti dua tempat yang harus diperbaiki tiap kali aturan
 * validasinya bergeser.
 *
 * Sejak setelan pindah ke MODAL bertransaksi (`ModalSetelanInstans`), hook ini
 * tak lagi menyimpan teks-yang-sedang-diketik: draf itu sekarang hidup di
 * dalam modalnya sendiri dan mati bersama tombol `Cancel`. Yang tersisa di
 * sini cuma daftar instans yang SUDAH berlaku — dan itu memang seharusnya
 * satu-satunya isi state bersama.
 */

/** Id instans baru. `crypto.randomUUID` ada di seluruh peramban yang
 *  didukung; jam + acak sebagai jaring pengaman kalau halaman dibuka lewat
 *  konteks tak-aman (http polos), di mana API itu tak tersedia. */
function idBaru(): string {
  return globalThis.crypto?.randomUUID?.() ?? `i${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

export interface DaftarInstans<J extends string> {
  daftar: Array<Instans<J>>
  /** Ganti seluruh daftar sekaligus (dipakai saat memuat template). */
  gantiSemua: (baru: Array<Instans<J>>) => void
  tambah: (jenis: string) => void
  hapus: (id: string) => void
  sakelarTampil: (id: string) => void
  /** Sakelar massal — mata master di kepala legenda (lihat implementasinya). */
  setSemuaTampil: (tampil: boolean) => void
  /** Timpa satu instans dengan versi barunya — jalur `Ok` modal setelan.
   *  Dicocokkan lewat `id`, jadi posisinya di daftar (dan warna gilirannya)
   *  tak bergeser. */
  terapkan: (baru: Instans<J>) => void
  /** Instans "pabrik" sebuah jenis — isi tombol `Defaults` di modal. */
  bawaan: (jenis: J) => Instans<J>
  paramSpek: (jenis: J) => SpekParam[]
  /** Tukar posisi dengan tetangga. Urutan daftar = urutan panel (B29). */
  geser: (id: string, arah: -1 | 1, bolehTukar?: (x: Instans<J>) => boolean) => void
  /** Menumpang panel harga, atau panel sendiri (B29). */
  pindahPanel: (id: string, ke: 'harga' | 'sendiri') => void
}

export function useDaftarInstans<J extends string>(
  paramSpek: (jenis: J) => SpekParam[],
  /**
   * Batasi satu instans per jenis. Dipakai POLA, tidak dipakai indikator, dan
   * bedanya mendasar: `MA 20` + `MA 200` dua garis berbeda yang berguna
   * bersamaan, sedangkan dua Double Bottom cuma menggambar hal yang sama dua
   * kali di atas dirinya sendiri — daftar temuannya tercetak dobel, penanda
   * di kanvas dobel, garis lehernya dobel. Johan 17 Agu 2026, setelah
   * melihatnya di layar: "untuk pola hanya bisa masukin 1x saja, tapi untuk
   * indikator boleh berkali-kali".
   */
  satuPerJenis = false,
): DaftarInstans<J> {
  const [daftar, setDaftar] = useState<Array<Instans<J>>>([])

  const gantiSemua = useCallback((baru: Array<Instans<J>>) => {
    // Template lama bisa memuat lebih dari satu instans sejenis (disimpan
    // sebelum batas ini ada). Disaring di sini juga, bukan cuma di `tambah` —
    // kalau tidak, batasnya bisa dilangkahi lewat pintu belakang template.
    setDaftar(satuPerJenis
      ? baru.filter((x, i) => baru.findIndex((y) => y.jenis === x.jenis) === i)
      : baru)
  }, [satuPerJenis])

  const tambah = useCallback((jenis: string) => {
    setDaftar((list) => (satuPerJenis && list.some((x) => x.jenis === jenis)
      ? list
      : [...list, buatInstans(jenis as J, paramSpek(jenis as J), idBaru(), list.length)]))
  }, [paramSpek, satuPerJenis])

  const hapus = useCallback((id: string) => {
    setDaftar((list) => list.filter((x) => x.id !== id))
  }, [])

  const sakelarTampil = useCallback((id: string) => {
    setDaftar((list) => list.map((x) => (x.id === id ? { ...x, tampil: !x.tampil } : x)))
  }, [])

  /** Sakelar MASSAL — tombol mata master di kepala legenda (Johan 21 Agu
   *  2026: "hide dan unhide indikator supaya tidak memenuhi chart, coba
   *  belajar dari trading view"; TradingView punya mata yang mematikan
   *  seluruh study sekali klik). Instansnya TETAP di daftar — cuma
   *  gambarnya yang padam, jadi satu klik lagi mengembalikan semuanya. */
  const setSemuaTampil = useCallback((tampil: boolean) => {
    setDaftar((list) => list.map((x) => (x.tampil === tampil ? x : { ...x, tampil })))
  }, [])

  const terapkan = useCallback((baru: Instans<J>) => {
    setDaftar((list) => list.map((x) => (x.id === baru.id ? baru : x)))
  }, [])

  /**
   * Tukar posisi satu instans dengan tetangganya (B29).
   *
   * URUTAN DAFTAR INI YANG MENENTUKAN URUTAN PANEL — panel indikator diberi
   * nomor mengikuti urutan instans yang berpanel sendiri. Jadi "naik-turunkan
   * panel" tak butuh model data kedua berisi nomor panel: cukup menukar
   * posisinya di sini, dan penomorannya ikut sendiri.
   *
   * Itu bukan kebetulan melainkan sengaja. Menyimpan nomor panel sebagai
   * angka di tiap instans berarti angka itu basi begitu satu panel dihapus:
   * `chart.panes()` lightweight-charts memakai INDEKS, jadi membuang panel
   * tengah menggeser semua indeks di bawahnya, dan daftar panel yang terlipat
   * ikut menunjuk panel yang salah.
   */
  const geser = useCallback((id: string, arah: -1 | 1, bolehTukar?: (x: Instans<J>) => boolean) => {
    setDaftar((list) => {
      const i = list.findIndex((x) => x.id === id)
      if (i < 0) return list
      // Tetangga LANGSUNG belum tentu tetangga yang berarti. Instans yang
      // menumpang panel harga tak punya nomor panel sendiri, jadi menukar
      // posisi dengannya tak memindahkan panel siapa pun — tombolnya terlihat
      // tak melakukan apa-apa. Ketahuan saat diuji di peramban: "Naikkan
      // MACD" pada susunan [MA sendiri, RSI di harga, MACD sendiri] menukar
      // MACD dengan RSI, dan nomor panel keduanya tetap sama persis.
      let j = i + arah
      while (j >= 0 && j < list.length && bolehTukar && !bolehTukar(list[j])) j += arah
      if (j < 0 || j >= list.length) return list
      const salinan = [...list]
      ;[salinan[i], salinan[j]] = [salinan[j], salinan[i]]
      return salinan
    })
  }, [])

  /** Pindah antara menumpang panel harga dan panel sendiri (B29). `undefined`
   *  berarti ikut bawaan pustaka (`overlay`), yaitu keadaan sebelum pembaca
   *  pernah memutuskan apa pun. */
  const pindahPanel = useCallback((id: string, ke: 'harga' | 'sendiri') => {
    setDaftar((list) => list.map((x) => (x.id === id ? { ...x, panel: ke } : x)))
  }, [])

  const bawaan = useCallback(
    (jenis: J) => buatInstans(jenis, paramSpek(jenis), idBaru(), 0),
    [paramSpek],
  )

  return { daftar, gantiSemua, tambah, hapus, sakelarTampil, setSemuaTampil, terapkan, bawaan, paramSpek, geser, pindahPanel }
}
