import './Maintenance.css'

/**
 * Halaman tutup sementara — satu-satunya yang tayang saat PAPAN direnovasi.
 *
 * Perintah Johan 1 Sep 2026: *"karena masih tahap renovasi jadi lebih baik
 * papan di tutup dulu untuk sementara, berikan icon papan terbaru dan under
 * maintenance"*. Dirancang ulang 1 Okt 2026 (#256 A): *"buatkan landing page
 * under maintenance yang top dewa"* + *"tutup saja papan"*.
 *
 * ## Empat batasan, dan tiga di antaranya soal apa yang TIDAK dilakukan
 *
 * 1. **Nol fetch data.** Tak satu pun permintaan jaringan dari halaman ini.
 *    Ia satu-satunya halaman publik selama renovasi, jadi ia juga satu-satunya
 *    yang bisa membocorkan alamat sumber data ke siapa pun yang membuka panel
 *    jaringan peramban. Ikon, latar candle, dan pita berjalan digambar inline;
 *    fonnya fon sistem — bahkan permintaan gambar atau fon pun tak ada.
 * 2. **Tanpa tanggal janji, tanpa angka pura-pura.** "Segera kembali", bukan
 *    tanggal. Pita berjalan memuat NAMA bagian PAPAN, bukan harga: angka yang
 *    terlihat seperti kutipan bursa tapi bukan data hidup adalah kebohongan
 *    yang tayang publik.
 * 3. **Tak memakai konteks aplikasi.** Tidak ada ThemeProvider/AuthProvider di
 *    atasnya: gerbangnya berada di LUAR seluruh penyedia konteks, supaya
 *    menutup PAPAN tak bergantung pada satu pun bagian yang sedang direnovasi.
 *    Karena itu temanya dari `prefers-color-scheme` murni.
 * 4. **Tanpa tautan ke mana pun.** Tak ada tombol "coba lagi" atau tautan
 *    masuk — keduanya cuma memancing orang menemukan rute yang sengaja
 *    ditutup.
 */

// Nama bagian PAPAN yang sedang dibenahi — label, bukan data.
const BAGIAN = [
  'Arus Broker', 'Aliran Asing', 'Kartu Analisa', 'Screener', 'Bandarmologi',
  'Harian Papan', 'Watchlist', 'Seasonality', 'Berkas Emiten', 'Kartu Pagi',
]

// Siluet candle dekoratif [tinggi tubuh, panjang sumbu, posisi y, naik?].
// Statis, bukan deret harga — hanya pola yang dikenali mata pembaca pasar.
const CANDLE: Array<[number, number, number, boolean]> = [
  [38, 22, 70, true], [30, 18, 82, false], [46, 26, 64, true], [26, 14, 90, true],
  [52, 30, 58, false], [34, 20, 76, true], [60, 28, 50, true], [28, 16, 86, false],
  [44, 24, 66, true], [36, 22, 74, false], [56, 30, 54, true], [32, 18, 80, true],
  [48, 26, 60, false], [40, 20, 70, true], [62, 32, 46, true], [30, 16, 84, false],
  [50, 28, 58, true], [38, 22, 72, true],
]

function LatarCandle() {
  const lebar = 34
  return (
    <svg className="mt-candle" viewBox={`0 0 ${CANDLE.length * lebar} 160`} preserveAspectRatio="xMidYMax slice" aria-hidden="true">
      {CANDLE.map(([tubuh, sumbu, y, naik], i) => {
        const x = i * lebar + lebar / 2
        return (
          <g key={i} className={naik ? 'mt-c-naik' : 'mt-c-turun'} style={{ animationDelay: `${(i % 6) * 0.7}s` }}>
            <line x1={x} x2={x} y1={y - sumbu / 2} y2={y + tubuh + sumbu / 2} />
            <rect x={x - 7} y={y} width={14} height={tubuh} rx={2} />
          </g>
        )
      })}
    </svg>
  )
}

export function Maintenance() {
  const pita = [...BAGIAN, ...BAGIAN]
  return (
    <main className="mt-akar">
      <div className="mt-grid" aria-hidden="true" />
      <div className="mt-sorot" aria-hidden="true" />
      <LatarCandle />

      <div className="mt-isi">
        {/* Geometri sama dengan favicon edisi kedua: empat siku pengukur
            mengepung dua bilah nilai. Bilah-bilahnya "mengisi" pelan sebagai
            penanda kerja yang sedang berjalan. */}
        <svg className="mt-ikon" viewBox="0 0 64 64" role="img" aria-label="Lambang PAPAN">
          <g fill="none" stroke="currentColor" strokeWidth="10" strokeLinecap="square">
            <path d="M11 22V11H22" />
            <path d="M42 11H53V22" />
            <path d="M11 42V53H22" />
            <path d="M42 53H53V42" />
          </g>
          <rect x="20" y="26" width="24" height="7" className="mt-bilah" />
          <rect x="20" y="37" width="14" height="7" className="mt-bilah mt-bilah2" />
        </svg>

        <p className="mt-status" role="status">
          <span className="mt-titik" aria-hidden="true" />
          Sedang direnovasi
        </p>

        <h1 className="mt-nama">PAPAN</h1>
        <p className="mt-sub">Pusat Analisa Pasar Nusantara</p>

        <p className="mt-pesan">
          Kami sedang merapikan data dan tampilan supaya setiap angka yang kamu
          baca lebih lengkap dan lebih bisa dipercaya.
        </p>
        <p className="mt-kembali">Segera kembali.</p>
      </div>

      <div className="mt-pita" aria-hidden="true">
        <div className="mt-pita-jalan">
          {pita.map((b, i) => (
            <span key={i} className="mt-pita-item">
              <span className="mt-pita-tanda">◆</span>
              {b}
              <span className="mt-pita-ket">dibenahi</span>
            </span>
          ))}
        </div>
      </div>
    </main>
  )
}
