import { useMemo, useState } from 'react'
import { TombolIkon } from './TombolIkon'
import { Dropdown } from './Dropdown'
import {
  IKON_KURSOR, IKON_GARIS_TREN, IKON_GARIS_H, IKON_GARIS_V, IKON_FIBONACCI,
  IKON_PERSEGI, IKON_TEKS, IKON_KUAS, IKON_TONG,
} from './IkonMenu'
import { ALAT_UTAMA, ID_ALAT_UTAMA, KATEGORI_GAMBAR, type muatPustakaGambar } from '../../lib/dasbor/gambarPustaka'

type ModulPustaka = Awaited<ReturnType<typeof muatPustakaGambar>>

/** Ikon per id alat utama — dipisah dari `ALAT_UTAMA` (lib) supaya berkas
 *  data itu tak perlu tahu apa-apa soal komponen React. */
const IKON_ALAT: Record<string, string> = {
  'trend-line': IKON_GARIS_TREN,
  'horizontal-line': IKON_GARIS_H,
  'vertical-line': IKON_GARIS_V,
  'fib-retracement': IKON_FIBONACCI,
  rectangle: IKON_PERSEGI,
  'text-annotation': IKON_TEKS,
  brush: IKON_KUAS,
}

/**
 * Bilah alat gambar — kiri kanvas di desktop, baris mendatar yang bisa
 * disembunyikan di telepon (lihat blok telepon di bawah).
 *
 * **Kenapa TUJUH ini yang jadi tombol utama, dari 68 alat pustaka:**
 * kursor/pilih, Garis Tren, Garis Horizontal, Garis Vertikal, Fibonacci
 * Retracement, Persegi, Teks, Kuas — persis daftar yang diminta spek tugas,
 * dan alasannya bisa diperiksa dari acuan Stockbit/TradingView yang sudah
 * dipakai seluruh halaman ini (`GrafikEmiten.tsx`): tujuh inilah yang ada di
 * baris TERATAS bilah alat gambar acuan tsb, sebelum kelompok "lainnya" yang
 * baru terbuka lewat klik. Menampilkan ke-68 sekaligus (audit serupa sudah
 * pernah terjadi di indikator, #170) menghasilkan bilah yang tak bisa dipakai
 * siapa pun — 68 baris tombol ikon 32px setinggi >2.100px.
 *
 * Sisanya (60 alat, sembilan kategori pustaka — kategori "Trading" di
 * `KATEGORI_GAMBAR` belum dipakai versi pustaka ini) ada di dropdown "Alat
 * lainnya": FLYOUT dua kolom (kategori kiri, isi kategori disorot kanan) —
 * pola sama dengan katalog indikator pustaka soal pembagian kepemilikan:
 * kategori milik pustaka (`DrawingCategory`), urutan & terjemahan milik kita
 * (`KATEGORI_GAMBAR`). Di layar sempit atau selagi mengetik di kotak cari,
 * `Dropdown` (prop `flyout`) jatuh balik ke daftar bertumpuk dengan judul
 * kategori sticky — lihat komentar `flyout` di `Dropdown.tsx`. SEMUA 60 di
 * dalamnya benar-benar bisa dipakai (klik sejumlah titik yang diminta
 * jenisnya, sama seperti tujuh tombol utama) — bukan daftar dekoratif yang
 * separuhnya tombol mati.
 */
export function AlatGambar({
  pustaka, galat, alatAktif, onPilihAlat, adaTerpilih, onHapusTerpilih, onSentuh,
}: {
  pustaka: ModulPustaka | null
  galat: string | null
  alatAktif: string | null
  onPilihAlat: (id: string | null) => void
  adaTerpilih: boolean
  onHapusTerpilih: () => void
  onSentuh: () => void
}) {
  // Telepon: bilah vertikal permanen memakan lebar yang justru dibutuhkan
  // kanvas (412px sudah sempit). Disembunyikan di balik SATU tombol yang
  // membuka baris mendatar (bisa digulung, pola sama dgn `.grf-kerangka`) —
  // bukan dipaksakan tetap vertikal dengan kanvas tinggal separuh, dan bukan
  // pula dihilangkan sama sekali (menggambar dari telepon tetap harus bisa).
  const [terbuka, setTerbuka] = useState(false)

  const opsiLainnya = useMemo(() => {
    if (!pustaka) {
      return [{
        nilai: '__memuat',
        label: galat ? 'Gagal memuat alat gambar — coba lagi' : 'Memuat alat gambar…',
        nonaktif: !galat, // galat: biarkan diklik lagi (memicu onSentuh -> mintaPustaka ulang)
      }]
    }
    const urutan = new Map(KATEGORI_GAMBAR.map(([ing], i) => [ing, i]))
    return pustaka.TOOL_DEFINITIONS
      .filter((t) => !ID_ALAT_UTAMA.has(t.type))
      .sort((a, b) => (urutan.get(a.category) ?? 99) - (urutan.get(b.category) ?? 99)
        || a.name.localeCompare(b.name))
      .map((t) => ({
        nilai: t.type,
        label: t.name,
        grup: KATEGORI_GAMBAR.find(([ing]) => ing === t.category)?.[1] ?? t.category,
      }))
  }, [pustaka, galat])

  return (
    <div className="grf-alat-gambar" onPointerDownCapture={onSentuh} onFocusCapture={onSentuh}>
      <TombolIkon
        d={IKON_KUAS} label={terbuka ? 'Sembunyikan alat gambar' : 'Alat gambar'}
        className="grf-alat-toggle" onClick={() => setTerbuka((v) => !v)}
      />
      <div className={'ti-grup grf-alat-isi' + (terbuka ? ' buka' : '')} role="group" aria-label="Alat gambar">
        <TombolIkon d={IKON_KURSOR} label="Kursor — pilih/geser gambar"
          className={alatAktif === null ? 'on' : ''} onClick={() => onPilihAlat(null)} />
        {ALAT_UTAMA.map((a) => (
          <TombolIkon key={a.id} d={IKON_ALAT[a.id]} label={a.label}
            className={alatAktif === a.id ? 'on' : ''}
            onClick={() => onPilihAlat(alatAktif === a.id ? null : a.id)} />
        ))}
        <span className="grf-alat-pisah" aria-hidden="true" />
        <Dropdown
          opsi={opsiLainnya}
          nilai={alatAktif && !ID_ALAT_UTAMA.has(alatAktif) ? alatAktif : ''}
          placeholder="⋯"
          ariaLabel="Alat gambar lainnya (60 alat)"
          flyout
          onGanti={(v) => { if (v !== '__memuat') onPilihAlat(v) }}
        />
        <TombolIkon d={IKON_TONG} label="Hapus gambar terpilih" nada="merah"
          disabled={!adaTerpilih} onClick={onHapusTerpilih} />
      </div>
    </div>
  )
}
