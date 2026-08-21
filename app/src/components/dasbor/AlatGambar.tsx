import { useEffect, useMemo, useState } from 'react'
import { TombolIkon } from './TombolIkon'
import { Dropdown } from './Dropdown'
import {
  IkonMenu,
  IKON_KURSOR, IKON_GARIS_TREN, IKON_GARIS_H, IKON_GARIS_V, IKON_FIBONACCI,
  IKON_PERSEGI, IKON_TEKS, IKON_KUAS, IKON_TONG, IKON_GIR, IKON_MAGNET,
  IKON_PANAH_KIRI, IKON_PANAH_KANAN, IKON_PENGGARIS, IKON_CATATAN, IKON_LILIN,
  IKON_KEL_CHANNEL, IKON_KEL_PITCHFORK, IKON_KEL_GANN, IKON_KEL_FORECAST, IKON_KEL_BENTUK,
} from './IkonMenu'
import { ALAT_UTAMA, ID_ALAT_UTAMA, KATEGORI_GAMBAR, type muatPustakaGambar } from '../../lib/dasbor/gambarPustaka'
import type { KeadaanMagnet } from '../../lib/dasbor/useAlatGambar'

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

/** Ikon per KELOMPOK pustaka (Indonesia — kunci sama dengan nilai kedua
 *  `KATEGORI_GAMBAR`, yang jadi `opsi.grup` sesudah diterjemahkan di bawah).
 *  SATU ikon mewakili seluruh isi kelompoknya (Johan 21 Agu: "munculkan juga
 *  icon-icon dari titik 3 itu") — bukan 60 ikon unik, alasannya sama dengan
 *  kenapa cuma tujuh alat yang jadi tombol utama (lihat komentar
 *  `AlatGambar` di bawah). Separuh dipinjam dari ikon yang sudah ada (garis
 *  tren, fibonacci, penggaris, catatan, lilin) — cuma lima bentuk baru yang
 *  benar-benar ditambahkan (`IKON_KEL_*` di `IkonMenu.tsx`). */
const IKON_KATEGORI: Record<string, string> = {
  Garis: IKON_GARIS_TREN,
  Channels: IKON_KEL_CHANNEL,
  Pitchforks: IKON_KEL_PITCHFORK,
  Fibonacci: IKON_FIBONACCI,
  Gann: IKON_KEL_GANN,
  Forecasting: IKON_KEL_FORECAST,
  Pengukuran: IKON_PENGGARIS,
  Bentuk: IKON_KEL_BENTUK,
  Anotasi: IKON_CATATAN,
  Trading: IKON_LILIN,
}

/** Pilihan "sembunyikan seluruh bilah" — pola SAMA dengan tombol "tepikan"
 *  Tanya PAPAN (`TanyaPapan.tsx`/`.tp-tombol.tepi`): sliver di tepi, bukan
 *  `display:none`, satu ketukan untuk kembali. Beda dari toggle `terbuka` di
 *  bawah (itu cuma urusan telepon, baris mendatar buka/tutup) — ini
 *  menyembunyikan bilahnya SAMA SEKALI, di ukuran layar mana pun, dan
 *  bertahan lintas kunjungan lewat localStorage. */
const KUNCI_SEMBUNYI = 'papan:alat-gambar-sembunyi'

const LABEL_MAGNET: Record<KeadaanMagnet, string> = {
  '0': 'Magnet — mati (klik: nyalakan lemah)',
  lemah: 'Magnet — lemah, snap 8px (klik: naikkan ke kuat)',
  kuat: 'Magnet — kuat, snap 24px (klik: matikan)',
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
 * (`KATEGORI_GAMBAR`), IKON milik kita juga (`IKON_KATEGORI`, lewat prop
 * `ikonGrup` — `Dropdown` cuma tahu ADA peta ikon per grup, bukan makna
 * kelompoknya). Di layar sempit atau selagi mengetik di kotak cari,
 * `Dropdown` (prop `flyout`) jatuh balik ke daftar bertumpuk dengan judul
 * kategori sticky — lihat komentar `flyout` di `Dropdown.tsx`. SEMUA 60 di
 * dalamnya benar-benar bisa dipakai (klik sejumlah titik yang diminta
 * jenisnya, sama seperti tujuh tombol utama) — bukan daftar dekoratif yang
 * separuhnya tombol mati.
 */
export function AlatGambar({
  pustaka, galat, alatAktif, onPilihAlat, adaTerpilih, onHapusTerpilih, onSentuh,
  magnet, onSiklusMagnet, onBukaSetelan,
}: {
  pustaka: ModulPustaka | null
  galat: string | null
  alatAktif: string | null
  onPilihAlat: (id: string | null) => void
  adaTerpilih: boolean
  onHapusTerpilih: () => void
  onSentuh: () => void
  /** Keadaan magnet snap (mati/lemah/kuat) — orkestrasinya di
   *  `useAlatGambar.ts`, komponen ini cuma menampilkan & memutar. */
  magnet: KeadaanMagnet
  onSiklusMagnet: () => void
  /** Buka modal setelan (warna/tebal/gaya) gambar yang SEDANG terpilih.
   *  Modalnya sendiri di `GrafikEmiten.tsx` (butuh `getComputedStyle` buat
   *  resolusi token warna, komponen ini tak punya akses itu). */
  onBukaSetelan: () => void
}) {
  // Telepon: bilah vertikal permanen memakan lebar yang justru dibutuhkan
  // kanvas (412px sudah sempit). Disembunyikan di balik SATU tombol yang
  // membuka baris mendatar (bisa digulung, pola sama dgn `.grf-kerangka`) —
  // bukan dipaksakan tetap vertikal dengan kanvas tinggal separuh, dan bukan
  // pula dihilangkan sama sekali (menggambar dari telepon tetap harus bisa).
  const [terbuka, setTerbuka] = useState(false)

  // Sembunyikan SELURUH bilah (semua ukuran layar) — lihat komentar
  // `KUNCI_SEMBUNYI` di atas. Dibaca sekali dari localStorage, ditulis tiap
  // berganti; galat (mode privat/kuota) ditelan seperti pola lain di halaman
  // ini — pilihan tampilan tak boleh menjatuhkan kanvas.
  const [sembunyi, setSembunyi] = useState(() => {
    try { return localStorage.getItem(KUNCI_SEMBUNYI) === '1' } catch { return false }
  })
  useEffect(() => {
    try { localStorage.setItem(KUNCI_SEMBUNYI, sembunyi ? '1' : '0') } catch { /* mode privat */ }
  }, [sembunyi])

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

  // Disembunyikan: satu sliver di tepi kiri, apa pun ukuran layarnya — pola
  // sama persis dengan `.tp-tombol.tepi` (bukan `display:none`: tombol yang
  // hilang sama sekali tak punya jalan pulang). Hook di atas tetap harus
  // jalan tanpa syarat (aturan Hooks), jadi percabangannya baru di sini,
  // sesudah semuanya dihitung.
  if (sembunyi) {
    return (
      <div className="grf-alat-gambar">
        <button type="button" className="grf-alat-sliver" onClick={() => setSembunyi(false)}
          aria-label="Tampilkan bilah alat gambar"
          title="Alat gambar — disembunyikan, klik untuk menampilkan">
          <IkonMenu d={IKON_PANAH_KANAN} size={12} />
        </button>
      </div>
    )
  }

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
          ikonGrup={IKON_KATEGORI}
          onGanti={(v) => { if (v !== '__memuat') onPilihAlat(v) }}
        />
        {/* Magnet snap (#185 lanjutan) — TIGA keadaan diputar satu tombol,
            bukan tiga tombol terpisah: mati/lemah/kuat itu satu sumbu, dan
            tiga tombol untuk satu sumbu membuat pembaca menebak mana yang
            "aktif sekarang" dari tiga keadaan `.on` yang saling eksklusif.
            `.on` (amber, dari aturan `.grf-alat-isi .ti.on` yang sudah ada)
            dipakai untuk LEMAH MAUPUN KUAT — beda kuat vs lemah ditandai
            titik aksen kecil lewat kelas `.kuat` (CSS, lihat GrafikEmiten.css)
            supaya tak perlu ikon kedua atau huruf tambahan yang harus dibaca
            dulu; titik kecil sudah cukup terlihat begitu dibandingkan
            berdampingan dengan keadaan lemah. */}
        <TombolIkon d={IKON_MAGNET} label={LABEL_MAGNET[magnet]}
          className={'grf-alat-magnet' + (magnet !== '0' ? ' on' : '') + (magnet === 'kuat' ? ' kuat' : '')}
          onClick={onSiklusMagnet} />
        {/* Setelan gambar terpilih (#185 lanjutan, Johan: "line gak ada setup
            modal warna ketebalan ketipisan"). Mati kalau tak ada yang
            terpilih — sama alasannya dengan tombol Hapus di sebelahnya. */}
        <TombolIkon d={IKON_GIR} label="Setelan gambar terpilih — warna, ketebalan, gaya garis"
          disabled={!adaTerpilih} onClick={onBukaSetelan} />
        <TombolIkon d={IKON_TONG} label="Hapus gambar terpilih" nada="merah"
          disabled={!adaTerpilih} onClick={onHapusTerpilih} />
        <span className="grf-alat-pisah" aria-hidden="true" />
        {/* Sembunyikan SELURUH bilah — di ujung, bukan di awal: tombol yang
            paling jarang dipakai (sekali per sesi, kalau memang perlu ruang
            kanvas ekstra) tak boleh duduk di antara alat yang dipakai
            berulang-ulang. */}
        <TombolIkon d={IKON_PANAH_KIRI} label="Sembunyikan bilah alat gambar"
          onClick={() => setSembunyi(true)} />
      </div>
    </div>
  )
}
