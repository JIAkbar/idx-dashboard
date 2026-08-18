/**
 * Ikon menu — satu <path> di atas viewBox 24×24, digambar sendiri (lihat
 * `menu.ts`). Pakai `stroke: currentColor` supaya warnanya ikut warna teks
 * induknya, jadi tema terang/gelap dan keadaan aktif tidak perlu diurus
 * terpisah. Dipakai Sidebar (rail) dan MobileNav (bilah bawah + laci).
 * `.dasbor-ikon` juga `display: inline-block` (lantai.css) — jadi komponen
 * ini bisa langsung ditaruh di antara teks (`<IkonMenu .../> Label`), sama
 * seperti node teks biasa, tanpa wrapper flex tambahan tiap dipakai.
 */
export function IkonMenu({ d, size = 20 }: { d: string; size?: number }) {
  return (
    <svg
      className="dasbor-ikon"
      viewBox="0 0 24 24"
      width={size}
      height={size}
      aria-hidden="true"
      focusable="false"
    >
      <path d={d} />
    </svg>
  )
}

/**
 * Path ikon lepasan (bukan menu rail) — dipakai judul panel/tombol/notice/
 * empty-state di berkas dasbor lain, gantinya emoji mentah yang tampilannya
 * beda-beda tiap OS, tidak ikut tema, dan kerasa templat (lihat komentar
 * `menu.ts`). Satu path dipakai di banyak tempat kalau kontennya cocok
 * (mis. IKON_GLOBE = ikon "Indeks Dunia" di rail, IKON_KALKULATOR = ikon
 * "Kalkulator JIA" di rail) — DRY, satu sumber bentuk per konsep.
 */
export const IKON_PERINGATAN = 'M12 3L2.5 20h19L12 3zM12 9.5v4.5M12 17h.01' // ganti ⚠️
export const IKON_CENTANG = 'M4 12.5l4.5 4.5L20 6' // ganti ✅
export const IKON_SILANG = 'M6 6l12 12M18 6L6 18' // ganti ❌ (sama dgn ikon "keluar layar penuh")
export const IKON_GRAFIK_BATANG = 'M4 20V10M10 20V4M16 20v-7M4 20h16' // ganti 📊
export const IKON_GRAFIK_NAIK = 'M4 19h16M4 15l4-5 4 3 5-7 3 4' // ganti 📈 (sama dgn ikon "Top Stocks" di rail)
export const IKON_GRAFIK_TURUN = 'M4 19h16M4 7l4 4 4-2 5 8 3-3' // ganti 📉
export const IKON_UANG = 'M12 21a9 9 0 100-18 9 9 0 000 18zM12 6.5v11M9 9.3c0-1.4 1.5-2.3 3-2.3s3 .8 3 1.8c0 1.7-2.2 2-3 2.2-1 .3-3 .7-3 2.3 0 1.1 1.5 2 3 2s3-.9 3-2.1' // ganti 💰
export const IKON_UANG_KERTAS = 'M3 7h18v10H3zM12 9a3 3 0 100 6 3 3 0 000-6z' // ganti 💵
export const IKON_TIMBANGAN = 'M12 3v18M5 7h14M5 7l-2.5 5a3 3 0 006 0zM19 7l-2.5 5a3 3 0 006 0zM8 21h8' // ganti ⚖️
export const IKON_ULANG = 'M4 12a8 8 0 0114-5.3M20 4v5h-5M20 12a8 8 0 01-14 5.3M4 20v-5h5' // ganti 🔄
export const IKON_OMBAK = 'M2 12c1.6-3 3.6-3 5.2 0s3.6 3 5.2 0 3.6-3 5.2 0 3.6 3 5.2 0' // ganti 🌊
export const IKON_CARI = 'M11 4a7 7 0 100 14 7 7 0 000-14zM21 21l-4.3-4.3' // ganti 🔍
export const IKON_PAPAN_KLIP = 'M9 4h6a1 1 0 011 1v1h2a1 1 0 011 1v13a1 1 0 01-1 1H6a1 1 0 01-1-1V7a1 1 0 011-1h2V5a1 1 0 011-1zM9 4v2h6V4M8 12h8M8 16h5' // ganti 📋
export const IKON_PERLUAS = 'M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5' // ganti ⛶ (layar penuh)
export const IKON_BULAN_SABIT = 'M20.5 14.5A8.5 8.5 0 119.5 3.5a7 7 0 1011 11z' // ganti ☪️ (Indeks Syariah)
export const IKON_KOTAK_ARSIP = 'M4 7a2 2 0 012-2h4l2 2h6a2 2 0 012 2v9a2 2 0 01-2 2H6a2 2 0 01-2-2V7z' // ganti 🗂️
export const IKON_CATATAN = 'M7 3h7l5 5v13a1 1 0 01-1 1H7a1 1 0 01-1-1V4a1 1 0 011-1zM14 3v5h5M9 13h7M9 17h5' // ganti 📝 (tab Changelog)
export const IKON_GLOBE = 'M12 3a9 9 0 100 18 9 9 0 000-18zM3 12h18M12 3c2.5 2.4 3.8 5.6 3.8 9s-1.3 6.6-3.8 9c-2.5-2.4-3.8-5.6-3.8-9s1.3-6.6 3.8-9z' // ganti 🌐 (sama dgn ikon "Indeks Dunia" di rail)
export const IKON_LOKASI = 'M12 21s7-6.5 7-11a7 7 0 10-14 0c0 4.5 7 11 7 11zM12 13a2 2 0 100-4 2 2 0 000 4z' // ganti 🇮🇩 (pin lokasi, bukan bendera — rendernya beda-beda tiap OS)
export const IKON_KLIK = 'M5 3l6.5 16.5 2-6.5 6.5-2z' // ganti 👆
export const IKON_LAMPU = 'M9 18h6M10 21h4M12 3a6 6 0 00-3 11.2c.6.4 1 1.1 1 1.8h4c0-.7.4-1.4 1-1.8A6 6 0 0012 3z' // ganti 💡
export const IKON_KALKULATOR = 'M6 3h12a1 1 0 011 1v16a1 1 0 01-1 1H6a1 1 0 01-1-1V4a1 1 0 011-1zM8 7h8M8.5 12h.01M12 12h.01M15.5 12h.01M8.5 16h.01M12 16h.01M15.5 16h.01' // ganti 🧮 (sama dgn ikon "Kalkulator JIA" di rail)
export const IKON_JAM = 'M12 21a9 9 0 100-18 9 9 0 000 18zM12 7v5l3 3' // ganti ⏳
export const IKON_GIR = 'M12 8a4 4 0 100 8 4 4 0 000-8zM12 2v3M12 19v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M2 12h3M19 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1' // ganti ⚙️
export const IKON_API = 'M12 2.5c1.6 2.6 4 5.3 4 9a4 4 0 01-8 0c0-1.4.5-2.4 1.2-3.3-.1 1.2.4 1.8.9 2 .3-1.9-.5-3-.1-5.3.7.9 1.3 1.6 2 2.6z' // ganti 🔥
export const IKON_PENGGARIS = 'M3 8h18v8H3zM7 8v3M11 8v3M15 8v3M19 8v3' // ganti 📐
export const IKON_KALENDER = 'M5 5h14a1 1 0 011 1v13a1 1 0 01-1 1H5a1 1 0 01-1-1V6a1 1 0 011-1zM4 9.5h16M8 3v4M16 3v4' // field tanggal (DatePicker)
export const IKON_LONCENG = 'M12 3a5 5 0 00-5 5c0 4-1.5 5.5-2 6h14c-.5-.5-2-2-2-6a5 5 0 00-5-5zM10 18a2 2 0 004 0' // notifikasi (#137/#123)
export const IKON_TONG = 'M4 7h16M9 7V5a1 1 0 011-1h4a1 1 0 011 1v2M6 7l1 13a1 1 0 001 1h10a1 1 0 001-1l1-13M10 11v6M14 11v6' // hapus unggahan
export const IKON_GAMBAR = 'M4 5h16a1 1 0 011 1v12a1 1 0 01-1 1H4a1 1 0 01-1-1V6a1 1 0 011-1zM3.5 15.5L8.5 10l4 4 3-3 5 5M9 9h.01' // pilih berkas gambar
export const IKON_TAMBAH = 'M12 5v14M5 12h14' // tombol tambah (mis. "+ Tambah Emiten")
export const IKON_PANAH_KANAN = 'M5 12h13M13 6l6 6-6 6' // menuju — kartu aksi Beranda
export const IKON_PENSIL = 'M4 20h4L19 9a2.1 2.1 0 00-3-3L5 17v3zM14.5 6.5l3 3' // pensil — ubah unggahan yang sudah masuk
export const IKON_KUNCI = 'M7 10V7a5 5 0 0110 0v3M5 10h14a1 1 0 011 1v9a1 1 0 01-1 1H5a1 1 0 01-1-1v-9a1 1 0 011-1zM12 14v3' // gembok — atur ulang sandi
export const IKON_RADAR = 'M12 3a9 9 0 109 9M12 7a5 5 0 105 5M12 12l5.5-5.5M12 12h.01' // sama dgn ikon "Radar Watchlist" di rail (menu.ts) — tab Radar AdminLayout
export const IKON_MATA = 'M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12zM12 12m-2.6 0a2.6 2.6 0 1 0 5.2 0 2.6 2.6 0 1 0-5.2 0' // intip sandi / pratinjau
export const IKON_MATA_CORET = 'M2.5 12S6 5.5 12 5.5c1.7 0 3.2.5 4.5 1.2M21.5 12s-1.6 2.9-4.5 4.6c-1.4.8-3.1 1.4-5 1.4-1.9 0-3.6-.6-5-1.4M4 4l16 16' // sandi sedang terlihat
export const IKON_SURAT = 'M4 6h16a1 1 0 011 1v10a1 1 0 01-1 1H4a1 1 0 01-1-1V7a1 1 0 011-1zM3.5 7l8.5 6 8.5-6' // amplop — ubah alamat email
export const IKON_INFO = 'M12 21a9 9 0 100-18 9 9 0 000 18zM12 11v6M12 7.5h.01' // "i" dalam lingkaran — panduan singkat
export const IKON_LILIN = 'M8 3v18M5 7h6v10H5zM16 3v18M13 10h6v6h-6z' // dua lilin — pilihan jenis gambar harga di Grafik Emiten
export const IKON_KAMERA = 'M4 7h3l1.5-2h7L17 7h3a1 1 0 011 1v10a1 1 0 01-1 1H4a1 1 0 01-1-1V8a1 1 0 011-1zM12 15.5a3.5 3.5 0 100-7 3.5 3.5 0 000 7z' // simpan tangkapan kanvas jadi PNG
export const IKON_SALIN ='M9 9h10a1 1 0 011 1v10a1 1 0 01-1 1H9a1 1 0 01-1-1V10a1 1 0 011-1zM5 15H4a1 1 0 01-1-1V4a1 1 0 011-1h10a1 1 0 011 1v1' // dua lembar bertumpuk — salin ke papan klip

/* ---------- Bilah alat gambar (Grafik Emiten, #185) ---------- */
export const IKON_KURSOR = 'M5 3l6.5 16.5 2-6.5 6.5-2z' // panah pilih — sama bentuk dgn IKON_KLIK, dipakai terpisah supaya makna "alat kursor/pilih" tak tercampur "klik di sini"
export const IKON_GARIS_TREN = 'M4 20L20 4' // diagonal — garis tren
export const IKON_GARIS_H = 'M3 12h18M4 9v6M20 9v6' // garis horizontal, ujung ditandai tegak kecil
export const IKON_GARIS_V = 'M12 3v18M9 4h6M9 20h6' // garis vertikal, ujung ditandai datar kecil
export const IKON_FIBONACCI = 'M3 5h18M3 9h13M3 13h18M3 17h8M3 21h18' // lima garis panjang berbeda — tangga retracement
export const IKON_PERSEGI = 'M4 6h16v12H4z' // rectangle
export const IKON_TEKS = 'M5 5h14M12 5v14M8 19h8' // huruf T bertumpu
export const IKON_KUAS = 'M18.4 3c.9 0 1.6.7 1.6 1.6 0 .4-.2.8-.5 1.1L11 14.2l-3.2-3.2 8.5-8.5c.3-.3.7-.5 1.1-.5zM7 12l-3.5 8.5S6 20 8 18l3-3' // kuas — freehand
