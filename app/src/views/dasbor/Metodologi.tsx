import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { GLOSARIUM } from '../../lib/dasbor/glosarium'
import { saringGlosarium, urutkanGlosarium, OPSI_URUTAN, type UrutanGlosarium } from '../../lib/dasbor/metodologi'
import { MENU_ITEMS } from '../../lib/dasbor/menu'
import { PemilihRentang } from '../../components/dasbor/PemilihRentang'
import { IkonMenu, IKON_CARI, IKON_PANAH_KANAN } from '../../components/dasbor/IkonMenu'
import './Metodologi.css'

/** Label halaman tujuan dari sebuah rute `ke` — dibaca dari `MENU_ITEMS`
 *  (satu-satunya sumber nama halaman), bukan diketik ulang di sini. Rute
 *  yang belum/tidak terdaftar di menu (mis. berubah nanti) tetap tertaut,
 *  cuma labelnya jatuh ke rute mentah. */
function labelRute(path: string): string {
  return MENU_ITEMS.find((m) => m.path === path)?.label ?? path
}

/**
 * Metodologi & Glosarium (backlog C6) — halaman publik, sengaja TANPA
 * PenjagaHalaman: ini justru untuk pembaca yang belum percaya sistemnya,
 * mengunci di balik login melawan tujuannya sendiri.
 *
 * Glosarium: `glosarium.json` isinya campuran dua asal. Mayoritas ditambang
 * dari korpus PAPAN sendiri (`scripts/bangun_glosarium.py` — lihat
 * `dibuat`/`sumber` di berkasnya), bukan disalin dari kamus umum — itu yang
 * membuat `frekuensi` per entri berarti sesuatu: seberapa sering istilah itu
 * benar-benar dipakai di terbitan PAPAN, bukan seberapa "penting" ia
 * terdengar. Sebagian kecil (`frekuensi: 0`) ditambahkan MANUAL — istilah
 * fundamental Stock Detail yang dulu hidup sebagai seksi Glosarium halaman
 * Bedah Emiten sendiri, dipindah ke sini saat halaman itu pensiun (21 Agu
 * 2026) supaya glosariumnya satu sumber, bukan dua.
 *
 * Metodologi: HANYA klaim yang bisa ditunjuk ke sumbernya (kode/dokumen) —
 * lihat rujukan inline tiap bagian. Tak ada yang ditulis dari ingatan.
 */
export function Metodologi() {
  const [cari, setCari] = useState('')
  const [urutan, setUrutan] = useState<UrutanGlosarium>('abjad')

  const tersaring = useMemo(() => urutkanGlosarium(saringGlosarium(GLOSARIUM, cari), urutan), [cari, urutan])

  return (
    <div className="lantai mtd">
      <section className="panel">
        <div className="panel-h">
          <span className="lbl">Metodologi</span>
        </div>
        <div className="panel-b">
          <p className="muted mtd-intro">
            Cara PAPAN mengambil dan mengolah data — batasnya disebutkan apa adanya, bukan disembunyikan.
          </p>

          <div className="mtd-kartu">
            <h3>Sumber harga: IDX + Yahoo Finance, saling menambal</h3>
            <p>
              Hari berjalan dan riwayat harian sejak awal 2020 (High/Low/Close/Volume, asing, frekuensi
              transaksi) diambil dari IDX. Harga BUKA riwayat dan data sebelum
              2020 diambil dari Yahoo Finance — ruas <code>OpenPrice</code> IDX bolong parah pada rentang lama
              (8% terisi Januari 2020, membaik jadi 74% Agustus 2026). Kandang OHLC lokal (dipakai halaman
              Grafik Emiten) mengikuti pola ini: kedalaman sekitar 10 tahun per emiten.
            </p>
          </div>

          {/* Ditambahkan 29 Agu 2026. Rincian angka perkiraan Net Asing tinggal
              DI SINI, bukan di halaman yang memakainya: di sana ia cuma
              ditandai ≈, karena cara angka dirakit bukan urusan pembaca yang
              sedang memindai tabel. Halaman ini justru dibuat untuk itu. */}
          <div className="mtd-kartu">
            <h3>Net Asing bertanda ≈ — angka perkiraan, dan seberapa dekat</h3>
            <p>
              Aliran asing dilaporkan bursa dalam <b>lembar saham</b>, sementara kolom Net Asing di
              Harian Papan menyatakan <b>rupiah</b>. Untuk hari yang nilai rupiahnya belum tersedia,
              angkanya dihitung dari lembar dikalikan harga rata-rata emiten itu pada hari yang sama
              (nilai transaksi dibagi volumenya). Angka hasil hitungan itu diberi tanda{' '}
              <b>≈</b>; angka tanpa tanda adalah nilai yang dilaporkan apa adanya.
            </p>
            <p>
              Seberapa dekat perkiraannya, diuji atas <b>5.590 pasang emiten-hari</b> terhadap nilai
              rupiah sungguhan: arahnya cocok 98,6%, nilai tengahnya 0,9995 (praktis pas), dan 93%
              meleset kurang dari 10%. Dijumlahkan seluruh sampel, selisihnya 0,23%.
            </p>
            <p>
              Batasnya jujur disebut: 7% emiten meleset lebih dari 10%, dan perkiraan ini hanya
              dipakai untuk hari terakhir yang nilai resminya belum masuk — begitu masuk, angka
              resmi menggantikannya dan tanda ≈ hilang dengan sendirinya.
            </p>
          </div>

          <div className="mtd-kartu">
            <h3>Fraksi harga &amp; auto rejection — aturan resmi BEI</h3>
            <p>
              Setiap angka harga yang ditampilkan (target, support, resistance) dibulatkan ke fraksi (tick
              size) yang benar-benar bisa dipesan di bursa: Rp 1 (&lt;Rp 200), Rp 2 (Rp 200–500), Rp 5 (Rp
              500–2.000), Rp 10 (Rp 2.000–5.000), Rp 25 (&gt;Rp 5.000) — batas atas tiap rentang inklusif.
              Auto rejection: 35% (≤Rp 200), 25% (Rp 200–5.000), 20% (&gt;Rp 5.000), simetris ARA/ARB sejak
              4 September 2023.
            </p>
          </div>

          <div className="mtd-kartu">
            <h3>Laporan keuangan: dua sumber, TIDAK bisa dijumlah begitu saja</h3>
            <p>
              PAPAN memanen laporan keuangan dari yfinance (kuartal <b>diskret</b>) dan dari XLSX ber-XBRL
              resmi IDX (interim <b>kumulatif</b> sejak awal tahun buku). Keduanya berbagi kunci periode yang
              sama persis (mis. <code>2026-06-30</code>) tapi menghitung rentang berbeda — revenue TLKM 1,96×
              lebih besar di XBRL untuk kunci yang sama, karena satu diskret satu kumulatif. Kedua sumber
              {/* Nama direktori internal TIDAK dicetak di sini. Halaman ini publik, dan
                  menyebut "keuangan/" vs "keuangan_idx/" membocorkan tata letak penyimpanan
                  tanpa menambah satu pun pemahaman bagi pembaca — yang perlu ia tahu adalah
                  KEDUA SUMBERNYA disimpan utuh, bukan di folder mana. Preseden: halaman ini
                  pernah terbit dengan nama berkas kode tercetak dan itu dinilai fatal. */}
              tetap disimpan terpisah supaya
              asalnya tak pernah hilang, tapi <b>digabungkan saat ditampilkan</b>: laporan resmi bursa
              menang bila ada, interim kumulatif dikonversi lebih dulu jadi kuartal diskret, dan tiap sel
              membawa lencana asalnya (<code>B</code> laporan bursa, <code>B·YTD</code> interim kumulatif).
              Ruas yang tak ada di kedua sumber dibiarkan kosong — bukan diisi nol.
            </p>
          </div>

          <div className="mtd-kartu">
            <h3>Skor Radar WDWL: dikalibrasi dari arsip sendiri, bukan angka tetap</h3>
            <p>
              Tiap sinyal (Greens+Whites, Streak≥3, Oscillator+Greens, Reds+Blacks) dihitung hit-rate-nya
              dari forward return antar-edisi di arsip PAPAN sendiri — bukan ambang yang ditentukan di muka.
              Sampel kecil ditarik ke prior netral 50% (semakin sedikit sampel, semakin dekat ke netral)
              supaya sinyal langka tak dibaca lebih pasti daripada datanya sendiri.
            </p>
          </div>

          <div className="mtd-kartu">
            <h3>Riwayat &amp; Win Rate preset: tiga definisi menang, dicetak apa adanya</h3>
            <p>
              Jejak rekomendasi preset (tab Riwayat &amp; Win Rate di halaman Screener) ditulis SEKALI tiap
              sore dan tidak pernah diedit ulang — supaya rapor menang/kalahnya jujur terhadap apa yang
              sungguh direkomendasikan saat itu. Tiga definisi menang dihitung berdampingan: <b>Open-Tinggi
              H+1</b> (longgar — harga tertinggi keesokan hari lebih tinggi dari pembukaannya sendiri),
              <b> Tutup-ke-Tutup H+1</b> (ketat — penutupan keesokan hari lebih tinggi dari penutupan hari
              rekomendasi), dan <b>TP/SL H+5</b> (realistis — dalam 5 hari bursa, target tersentuh sebelum
              batas rugi; kalau keduanya tersentuh di hari yang SAMA, hasilnya "tak tentu", tidak diklaim
              menang, karena data harian tak bisa membuktikan urutannya). Win rate dibagi hanya atas hasil
              yang terukur (menang+kalah) — "tak tentu"/"tak terukur" dikeluarkan dari pembagi, bukan
              dihitung sebagai kalah. Target &amp; batas rugi memakai rentang harga rata-rata sejati (ATR)
              14 hari, dibulatkan ke fraksi harga BEI. Preset tetap <b>penyaring</b>, bukan peringkat
              kelayakan beli — dan berkas backtest (kalau ada) ditandai terpisah karena bisa bias
              survivorship: daftar emiten yang dipakai adalah daftar hari ini, bukan daftar yang benar-benar
              tersedia pada tanggal itu.
            </p>
          </div>
        </div>
      </section>

      <section className="panel">
        <div className="panel-h mtd-h">
          <span className="lbl">Glosarium ({GLOSARIUM.length})</span>
          <span className="mtd-alat">
            <PemilihRentang opsi={OPSI_URUTAN} nilai={urutan} onGanti={setUrutan} ariaLabel="Urutkan glosarium" className="mtd-urutan" />
            <span className="af-cari">
              <IkonMenu d={IKON_CARI} size={13} />
              <input className="inp" type="search" value={cari} onChange={(e) => setCari(e.target.value)}
                placeholder="Cari istilah…" aria-label="Cari glosarium" />
            </span>
          </span>
        </div>
        <div className="panel-b">
          <p className="muted mtd-intro">
            Sebagian besar istilah ditambang dari korpus terbitan PAPAN sendiri (edisi, bedah, dokumen
            pedoman, kode radar/skor/fraksi) — <code>frekuensi</code> menunjukkan berapa kali istilah itu
            benar-benar muncul, bukan hafalan kamus umum. Istilah fundamental Stock Detail (TTM, CAGR,
            DER, Altman Z-Score, dan sejenisnya) ditambahkan manual saat halaman Bedah Emiten pensiun dan
            digabung ke Stock Detail — <code>frekuensi</code> 0 menandai entri itu, bukan hasil tambang.
          </p>

          {tersaring.length === 0 && <p className="muted">Tak ada istilah yang cocok dengan pencarian ini.</p>}

          <div className="mtd-list">
            {tersaring.map((e) => (
              <div key={e.id} id={e.id} className="mtd-entri">
                <div className="mtd-entri-h">
                  <h4>{e.istilah}</h4>
                  <span className="muted mtd-frek">dipakai {e.frekuensi}× di terbitan PAPAN</span>
                </div>
                <p className="mtd-def">{e.definisi}</p>
                {e.contoh && <p className="mtd-contoh">&ldquo;{e.contoh}&rdquo;</p>}
                {e.catatan && <p className="muted mtd-catatan">{e.catatan}</p>}
                {e.ke && (
                  <Link to={e.ke} className="mtd-ke">
                    Lihat di {labelRute(e.ke)} <IkonMenu d={IKON_PANAH_KANAN} size={11} />
                  </Link>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pindahan dari kaki global (Johan 28 Agu: "footer nya di hapus saja").
          Klausa atribusi WAJIB lisensi Apache 2.0 lightweight-charts — README
          mensyaratkan tautan nyata ke tradingview.com di halaman yang terlihat
          pengguna. Kaki globalnya hilang, klausanya TIDAK BOLEH ikut hilang:
          rumah barunya di sini. Jangan hapus tautan ini. */}
      <p className="muted" style={{ fontSize: 12 }}>
        Sumber data: <b>Statistik Ringkas IDX</b> (idx.co.id), Yahoo Finance, dan KSEI.
        {' '}Grafik memakai Lightweight Charts&trade; (
        <a href="https://www.tradingview.com/" target="_blank" rel="noopener noreferrer"
          style={{ color: 'var(--text2)' }}>TradingView</a>
        ). PAPAN (Pusat Analisa Pasar Nusantara) bukan produk resmi Bursa Efek Indonesia.
      </p>
    </div>
  )
}
