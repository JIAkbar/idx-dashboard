import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { GLOSARIUM } from '../../lib/dasbor/glosarium'
import { saringGlosarium, urutkanGlosarium, OPSI_URUTAN, type UrutanGlosarium } from '../../lib/dasbor/metodologi'
import { MENU_ITEMS } from '../../lib/dasbor/menu'
import { PemilihRentang } from '../../components/dasbor/PemilihRentang'
import { IkonMenu, IKON_PANAH_KANAN } from '../../components/dasbor/IkonMenu'
import './Metodologi.css'

/** Label halaman tujuan dari sebuah rute `ke` — dibaca dari `MENU_ITEMS`
 *  (satu-satunya sumber nama halaman), bukan diketik ulang di sini. Rute
 *  yang belum/tidak terdaftar di menu (mis. berubah nanti) tetap tertaut,
 *  cuma labelnya jatuh ke rute mentah. */
function labelRute(path: string): string {
  return MENU_ITEMS.find((m) => m.path === path)?.label ?? path
}

/**
 * ATURAN HALAMAN INI (Johan, 6 Sep 2026 — "tolong perbaiki lagi ini cara
 * sistem bekerja tidak perlu di bocorkan", lalu "asal tidak membuka rahasia
 * PAPAN"):
 *
 *   Halaman ini menerangkan **ARTI angka bagi pembaca**, bukan **CARA sistem
 *   memperolehnya.** Yang TIDAK boleh tayang di sini: nama penyedia data
 *   sebagai sumber ruas, nama ruas mentah, persentase cakupan/kelengkapan,
 *   statistik uji internal, nama berkas/direktori/skrip, dan ambang
 *   kalibrasi. Yang BOLEH: apa arti sebuah tanda, apa arti sebuah lencana,
 *   aturan resmi bursa, dan penyangkalan yang wajib tercetak.
 *
 *   Kenapa: menerangkan mekanismenya tak menambah satu pun pemahaman bagi
 *   pembaca yang sedang memindai angka, tapi memberi tahu orang luar persis
 *   di mana sistemnya tipis. Prinsip lama "batasnya disebutkan apa adanya"
 *   benar untuk BATAS ("angka ini perkiraan"), bukan untuk MEKANISME
 *   ("perkiraannya dihitung begini, diuji atas sekian sampel").
 *
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
            Cara PAPAN menghitung angka yang ditampilkan.
          </p>

          {/* Ditambahkan 29 Agu 2026. Rincian angka perkiraan Net Asing tinggal
              DI SINI, bukan di halaman yang memakainya: di sana ia cuma
              ditandai ≈, karena cara angka dirakit bukan urusan pembaca yang
              sedang memindai tabel. Halaman ini justru dibuat untuk itu. */}
          <div className="mtd-kartu">
            <h3>Net Asing bertanda ≈ — angka perkiraan</h3>
            <p>
              Aliran asing dilaporkan bursa dalam <b>lembar saham</b>, sementara kolom Net Asing
              menyatakan <b>rupiah</b>. Untuk hari yang nilai rupiahnya belum tersedia, angkanya
              diperkirakan dan diberi tanda <b>≈</b>; angka tanpa tanda adalah nilai yang dilaporkan
              apa adanya. Begitu nilai resminya masuk, ia menggantikan perkiraan dan tandanya hilang
              dengan sendirinya.
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
            <h3>Laporan keuangan: lencana asal tiap angka</h3>
            <p>
              Tiap sel laporan keuangan membawa lencana asalnya: <b>B</b> untuk angka laporan resmi
              bursa, <b>B·YTD</b> untuk angka interim yang dihitung sejak awal tahun buku lalu
              dijadikan setara kuartal. Angka resmi bursa selalu menang bila tersedia. Ruas yang
              memang tak tersedia dibiarkan <b>kosong</b> — bukan diisi nol, karena nol adalah angka
              dan kosong adalah keterangan.
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
              <input className="inp" type="search" value={cari} onChange={(e) => setCari(e.target.value)}
                placeholder="Cari istilah…" aria-label="Cari glosarium" />
            </span>
          </span>
        </div>
        <div className="panel-b">
          <p className="muted mtd-intro">
            Istilah yang dipakai PAPAN, beserta artinya.
          </p>

          {tersaring.length === 0 && <p className="muted">Tak ada istilah yang cocok dengan pencarian ini.</p>}

          <div className="mtd-list">
            {tersaring.map((e) => (
              <div key={e.id} id={e.id} className="mtd-entri">
                <div className="mtd-entri-h">
                  <h4>{e.istilah}</h4>
                  {e.frekuensi > 0 && (
                  <span className="muted mtd-frek">dipakai {e.frekuensi}× di terbitan PAPAN</span>
                )}
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
