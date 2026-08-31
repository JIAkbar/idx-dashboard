import './Maintenance.css'

/**
 * Halaman tutup sementara — satu-satunya yang tayang saat PAPAN direnovasi.
 *
 * Perintah Johan 1 Sep 2026: *"karena masih tahap renovasi jadi lebih baik
 * papan di tutup dulu untuk sementara, berikan icon papan terbaru dan under
 * maintenance"*.
 *
 * ## Empat batasan, dan tiga di antaranya soal apa yang TIDAK dilakukan
 *
 * 1. **Nol fetch data.** Tak satu pun permintaan jaringan dari halaman ini.
 *    Ia satu-satunya halaman publik selama renovasi, jadi ia juga satu-satunya
 *    yang bisa membocorkan alamat sumber data ke siapa pun yang membuka panel
 *    jaringan peramban. Ikonnya digambar inline, bukan diambil dari berkas,
 *    supaya bahkan permintaan gambar pun tak ada.
 * 2. **Tanpa tanggal janji.** "Segera kembali", bukan "kembali 9 September".
 *    Tanggal yang meleset jadi teks basi yang tayang publik — kelas cacat yang
 *    sama dengan kalimat layar yang berhenti benar saat angkanya berubah.
 * 3. **Tak memakai konteks aplikasi.** Tidak ada ThemeProvider/AuthProvider di
 *    atasnya: gerbangnya berada di LUAR seluruh penyedia konteks, supaya
 *    menutup PAPAN tak bergantung pada satu pun bagian yang sedang direnovasi.
 *    Karena itu temanya dari `prefers-color-scheme` murni, bukan dari pemilih
 *    tema aplikasi.
 * 4. **Tanpa tautan ke mana pun.** Tak ada tombol "coba lagi" atau tautan
 *    masuk — keduanya cuma memancing orang menemukan rute yang sengaja
 *    ditutup.
 */
export function Maintenance() {
  return (
    <main className="mt-akar">
      <div className="mt-isi">
        {/* Ikon digambar inline, bukan <img>: nol permintaan jaringan.
            Geometrinya sama persis dengan favicon edisi kedua — empat siku
            pengukur mengepung dua bilah nilai, yang kedua sengaja lebih
            pendek. `currentColor` membuatnya ikut warna teks di terang
            maupun gelap tanpa aturan warna kedua. */}
        <svg
          className="mt-ikon"
          viewBox="0 0 64 64"
          role="img"
          aria-label="Lambang PAPAN"
        >
          <g fill="none" stroke="currentColor" strokeWidth="10" strokeLinecap="square">
            <path d="M11 22V11H22" />
            <path d="M42 11H53V22" />
            <path d="M11 42V53H22" />
            <path d="M42 53H53V42" />
          </g>
          <rect x="20" y="26" width="24" height="7" className="mt-bilah" />
          <rect x="20" y="37" width="14" height="7" className="mt-bilah mt-bilah2" />
        </svg>

        <h1 className="mt-nama">PAPAN</h1>
        <p className="mt-sub">Pusat Analisa Pasar Nusantara</p>

        <p className="mt-pesan">
          Sedang direnovasi — segera kembali.
        </p>
      </div>
    </main>
  )
}
