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
 * Glosarium: 75 istilah `glosarium.json` ditambang dari korpus PAPAN sendiri
 * (`scripts/bangun_glosarium.py` — lihat `dibuat`/`sumber` di berkasnya),
 * bukan disalin dari kamus umum — itu yang membuat `frekuensi` per entri
 * berarti sesuatu: seberapa sering istilah itu benar-benar dipakai di
 * terbitan PAPAN, bukan seberapa "penting" ia terdengar.
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
              tetap disimpan terpisah (<code>keuangan/</code> vs <code>keuangan_idx/</code>) supaya
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
            75 istilah ditambang dari korpus terbitan PAPAN sendiri (edisi, bedah, dokumen pedoman, kode
            radar/skor/fraksi) — <code>frekuensi</code> menunjukkan berapa kali istilah itu benar-benar
            muncul, bukan hafalan kamus umum.
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
    </div>
  )
}
