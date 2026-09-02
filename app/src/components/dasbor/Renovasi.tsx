import { useEffect, useState } from 'react'
import './Renovasi.css'

/**
 * Pemberitahuan renovasi — modal saat halaman dibuka, lalu pita kecil permanen.
 *
 * Ketetapan Johan 1 Sep 2026 (mengubah keputusan sebelumnya yang menutup situs
 * penuh): *"artinya Papan skrg biarkan terbuka tapi di beri modal kalau Papan
 * belum bisa update dan under maintenance"*. Situs TETAP terbuka; yang
 * ditambahkan cuma kejujuran tentang keadaan datanya.
 *
 * ## Kenapa HARDCODE menyala, bukan env var
 *
 * Gerbang tutup-penuh (`VITE_PAPAN_TUTUP`, masih ada di `main.tsx` sebagai
 * saklar cadangan) memakai env var, dan itu berarti menunggu seseorang membuka
 * dasbor Vercel sebelum ia berpengaruh. Untuk pemberitahuan ini tak boleh ada
 * langkah yang menunggu siapa pun: begitu commit-nya tayang, ia menyala.
 * Mematikannya nanti satu commit, bersamaan dengan push pembukaan renovasi.
 *
 * ## Dua lapis, dan lapis kedua yang sering dilupakan
 *
 * Modal saja tidak cukup: begitu ditutup, pembaca yang menggulir berjam-jam
 * tak lagi punya petunjuk bahwa angkanya sedang tak diperbarui. Karena itu ada
 * PITA kecil permanen sesudahnya — modal memberi tahu sekali, pita menjaga
 * ingatan.
 *
 * ## sessionStorage, bukan localStorage
 *
 * Modal muncul sekali per TAB. Pindah halaman tak memunculkannya lagi (ia
 * mengganggu), tapi kunjungan berikutnya iya (keadaannya bisa sudah berubah,
 * dan pembaca baru berhak tahu). `localStorage` akan membuatnya hilang
 * selamanya sesudah satu klik — termasuk untuk pembaca yang kembali seminggu
 * kemudian dan tak pernah tahu apa-apa.
 */

/** Matikan di sini saat renovasi selesai — satu baris, satu commit. */
/* DIMATIKAN 2 Sep 2026 malam — keputusan Johan: *"bukannya angka sudah
 * selesai ya? dan workflow panen nya sudah paham"*. Premis pemberitahuan
 * ini ("datanya belum diperbarui") sudah tak benar: produksi menyajikan data
 * 2026-09-02, sama dengan repo, dan panen berjalan dari JALANKAN_BUKA_LAPTOP.
 * Ia dipasang 1 Sep saat produksi beku di 27 Agu (deploy ditolak Vercel —
 * `docs/catatan-vercel.md`), dan sejak deploy pulih siang tadi ia justru
 * membuat pembaca mengabaikan angka yang sudah segar. Peringatan yang salah
 * lebih buruk daripada tak ada peringatan.
 *
 * Komponen & ujinya dibiarkan utuh supaya bisa dinyalakan lagi dengan satu
 * `true` kalau produksi beku lagi — dan saat itu, periksa dulu teksnya
 * masih benar untuk sebab yang baru. */
export const RENOVASI_AKTIF = false

const KUNCI = 'papan-renovasi-ditutup'

function sudahDitutup(): boolean {
  try {
    return sessionStorage.getItem(KUNCI) === '1'
  } catch {
    // Peramban yang memblokir penyimpanan situs melempar di sini. Gagal ke
    // "belum ditutup" — pemberitahuan yang muncul sekali lagi jauh lebih baik
    // daripada pembaca yang tak pernah tahu datanya sedang tak diperbarui.
    return false
  }
}

export function Renovasi() {
  const [tampil, setTampil] = useState(false)

  // Dibaca di efek, bukan saat state diinisialisasi: `sessionStorage` tak ada
  // saat komponen dirender di sisi server atau saat diuji tanpa DOM, dan
  // membacanya di initializer akan melempar sebelum satu piksel pun tampil.
  useEffect(() => {
    if (RENOVASI_AKTIF && !sudahDitutup()) setTampil(true)
  }, [])

  function tutup() {
    setTampil(false)
    try {
      sessionStorage.setItem(KUNCI, '1')
    } catch {
      // Gagal menyimpan bukan alasan menahan modalnya tetap terbuka — ia
      // sudah dibaca. Konsekuensinya cuma muncul lagi di halaman berikutnya.
    }
  }

  if (!RENOVASI_AKTIF) return null

  return (
    <>
      {/* Pita permanen — tetap ada sesudah modal ditutup. */}
      <div className="rnv-pita" role="status">
        <svg className="rnv-pita-ikon" viewBox="0 0 64 64" aria-hidden="true">
          <g fill="none" stroke="currentColor" strokeWidth="10" strokeLinecap="square">
            <path d="M11 22V11H22" /><path d="M42 11H53V22" />
            <path d="M11 42V53H22" /><path d="M42 53H53V42" />
          </g>
          <rect x="20" y="26" width="24" height="7" fill="currentColor" />
          <rect x="20" y="37" width="14" height="7" fill="currentColor" opacity=".45" />
        </svg>
        <span>
          <b>Sedang renovasi</b> — data belum diperbarui, angka bisa berubah.
        </span>
      </div>

      {tampil && (
        <div className="rnv-tirai" role="dialog" aria-modal="true" aria-labelledby="rnv-judul">
          <div className="rnv-kotak">
            <svg className="rnv-ikon" viewBox="0 0 64 64" role="img" aria-label="Lambang PAPAN">
              <g fill="none" stroke="currentColor" strokeWidth="10" strokeLinecap="square">
                <path d="M11 22V11H22" /><path d="M42 11H53V22" />
                <path d="M11 42V53H22" /><path d="M42 53H53V42" />
              </g>
              <rect x="20" y="26" width="24" height="7" className="rnv-bilah" />
              <rect x="20" y="37" width="14" height="7" className="rnv-bilah rnv-bilah2" />
            </svg>

            <h2 id="rnv-judul" className="rnv-judul">Sedang Renovasi</h2>

            <p className="rnv-teks">
              PAPAN tetap bisa kau buka seperti biasa. Tapi selama renovasi,
              <b> datanya belum diperbarui</b> — angka yang kau lihat bisa
              tertinggal dari pasar, dan bisa berubah saat renovasinya selesai.
            </p>
            <p className="rnv-teks rnv-teks2">
              Jangan pakai angka di sini untuk keputusan yang mendesak dulu.
            </p>

            <button type="button" className="rnv-tombol" onClick={tutup} autoFocus>
              Saya mengerti, lanjut
            </button>
          </div>
        </div>
      )}
    </>
  )
}
