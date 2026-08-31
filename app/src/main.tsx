import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'

/**
 * Gerbang tutup sementara — SATU saklar, bukan pembongkaran.
 *
 * Perintah Johan 1 Sep 2026: *"karena masih tahap renovasi jadi lebih baik
 * papan di tutup dulu untuk sementara"*. Dinyalakan dengan menyetel
 * `VITE_PAPAN_TUTUP=1` di Vercel; dimatikan dengan menghapus var itu lalu
 * redeploy — NOL perubahan kode untuk membuka kembali.
 *
 * ## Kenapa di SINI, bukan di dalam App
 *
 * Versi pertama memasangnya di akar `App()` dan gerbangnya memang menutup —
 * tapi terukur MASIH ada dua permintaan data yang berangkat
 * (`index.json`, `emiten_sektor.json`). Sebabnya `App.tsx` mengimpor modul
 * halaman secara STATIS, jadi modul-modul itu dievaluasi saat berkasnya dimuat,
 * sebelum satu baris pun di dalam `App()` sempat berjalan. Pulang lebih awal
 * di dalam fungsi tak menolong: impornya sudah terlanjur jalan.
 *
 * Itu melanggar syarat yang paling penting dari halaman ini — ia satu-satunya
 * yang tayang publik selama renovasi, jadi ia juga satu-satunya yang bisa
 * membocorkan alamat sumber data ke siapa pun yang membuka panel jaringan.
 * Dengan `await import()` di bawah, `App` tak pernah dimuat saat gerbangnya
 * menyala, dan permintaan itu tak pernah lahir.
 *
 * ## Kenapa dibandingkan ke string '1'
 *
 * Vite menyulih env var sebagai STRING. Diuji apa adanya, 'false' dan '0'
 * dua-duanya bernilai benar — jebakan yang akan menutup situs tanpa ada yang
 * memintanya.
 */
const PAPAN_TUTUP = import.meta.env.VITE_PAPAN_TUTUP === '1'

/**
 * Jalur intip — Johan melihat PAPAN sungguhan selama produksi tertutup.
 * Ketetapannya 1 Sep 2026: *"preview vercel saja dan jalur intip"* — dua-duanya.
 *
 * Buka `?intip=<kode>` sekali; kodenya disimpan per-TAB dan rute apa pun
 * sesudahnya terbuka normal sampai tabnya ditutup.
 *
 * Empat pengerasan, dan yang terakhir paling gampang terlewat:
 *
 * 1. **Kodenya dari env var, bukan ditulis di kode.** `?intip=1` bisa ditebak
 *    dalam satu percobaan — itu bukan gerbang. Lewat env var, kodenya tak
 *    pernah masuk git dan bisa dirotasi tanpa menyentuh satu baris pun.
 * 2. **sessionStorage, bukan localStorage.** Hidup per-tab, mati saat tab
 *    ditutup. Kunci yang menetap di peramban selamanya adalah kunci yang
 *    tertinggal di peramban orang lain saat laptop dipinjam.
 * 3. **Kode dibuang dari URL** begitu diterima (`replaceState`), supaya ia tak
 *    ikut tersalin saat Johan mengirim tautan atau menempelkannya ke mana pun.
 * 4. **Kalau env var-nya kosong, jalur ini MATI TOTAL.** Tanpa penjaga ini,
 *    `kode === import.meta.env.VITE_INTIP_KODE` akan bernilai benar saat
 *    keduanya `undefined`/kosong — jadi `?intip=` telanjang membuka seluruh
 *    situs, dan gerbangnya bocor persis lewat pintu yang dibuat untuk
 *    menjaganya.
 *
 * BATAS JUJURNYA: env var ber-awalan `VITE_` ikut ter-bake ke bundle
 * JavaScript. Siapa pun yang membaca bundle bisa menemukan kodenya. Ini TIRAI
 * dari pengunjung biasa, bukan kunci dari yang berniat — dan untuk gerbang
 * renovasi itu cukup, karena situs ini kemarin pun publik penuh. Jangan pernah
 * memakai pola ini untuk sesuatu yang sungguh rahasia.
 */
const INTIP_KODE = import.meta.env.VITE_INTIP_KODE
const KUNCI_SESI = 'papan-intip'

function bolehIntip(): boolean {
  if (!INTIP_KODE) return false        // penjaga (4) — tanpa kode, tak ada jalur
  try {
    const url = new URL(window.location.href)
    if (url.searchParams.get('intip') === INTIP_KODE) {
      sessionStorage.setItem(KUNCI_SESI, INTIP_KODE)
      url.searchParams.delete('intip')
      window.history.replaceState(null, '', url.toString())
      return true
    }
    return sessionStorage.getItem(KUNCI_SESI) === INTIP_KODE
  } catch {
    // Peramban yang memblokir penyimpanan situs melempar di sini. Gagal
    // TERTUTUP, bukan terbuka: gerbang yang membuka saat penjaganya rusak
    // bukan gerbang.
    return false
  }
}

const akar = createRoot(document.getElementById('root')!)

if (PAPAN_TUTUP && !bolehIntip()) {
  const { Maintenance } = await import('./views/Maintenance')
  akar.render(
    <StrictMode>
      <Maintenance />
    </StrictMode>,
  )
} else {
  const { default: App } = await import('./App.tsx')
  akar.render(
    <StrictMode>
      <App />
    </StrictMode>,
  )
}
