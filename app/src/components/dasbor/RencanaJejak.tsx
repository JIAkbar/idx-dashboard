import { useEffect, useState } from 'react'
import {
  muatRencana, metaRencana, bacaJejak,
  type RencanaEmiten, type JejakHorizon,
} from '../../lib/dasbor/rencanaSaham'
import './RencanaJejak.css'

/**
 * Rencana dagang + rekam jejaknya, di dalam kartu emiten.
 *
 * Lahir 1 Sep 2026 dari Johan yang menunjuk kartu "Rincian tiap saham" di
 * sebuah artifact: *"nah buat seperti ini menarik page baru ketik saham atau
 * ada preset atau pakai filter muncul"*. Rumahnya kartu yang sudah ada, bukan
 * halaman baru — kotak cari dan saringan likuiditasnya sudah di situ, dan
 * menambah pintu kesebelas membatalkan peleburan menu yang baru selesai.
 *
 * ## Kenapa EKSPEKTANSI yang besar, bukan win rate
 *
 * Ini keputusan yang paling menentukan di komponen ini, dan ia lahir dari
 * angka: BUMI pada 1 Sep 2026 menang 57,6% dari sinyal yang tuntas di lima
 * hari — terdengar bagus — sementara ekspektansinya −1,203% per sinyal.
 * Sebabnya incarannya +5,8% dan batas ruginya −12,1%; imbalan:risiko 0,48.
 * Aturan berekspektansi negatif memang sering menang. Yang membuatnya rugi
 * adalah ukuran kalahnya, bukan seringnya.
 *
 * Menaruh win rate sebagai angka besar akan membuat pembaca menyimpulkan
 * kebalikan dari yang datanya katakan. Jadi win rate tetap ditampilkan —
 * membuangnya juga menyesatkan — tapi kecil, di sebelah rincian
 * menang·kalah·menggantung yang membuatnya bisa dinilai sendiri.
 *
 * ## Tiga hal yang sengaja tampil walau tidak enak dilihat
 *
 * - **Menggantung** dihitung dan ditampilkan. Ia sinyal yang jendelanya tutup
 *   tanpa menyentuh target maupun batas — bukan menang, bukan kalah. Membuang
 *   kolomnya membuat aturan yang sering menggantung terlihat lebih baik
 *   daripada aturan yang selalu tuntas dan kadang kalah.
 * - **Dua penyebut**, dari-yang-tuntas dan dari-seluruh-sinyal. Yang pertama
 *   sendirian adalah cara paling mudah membuat angka terlihat bagus.
 * - **Imbalan:risiko di bawah 1** diberi peringatan eksplisit. Ia bukan cacat
 *   data melainkan bentuk aturannya sendiri, dan pembaca berhak tahu bahwa
 *   incarannya lebih kecil daripada yang dipertaruhkan.
 */

const rp = (v: number | null | undefined) =>
  v == null ? '—' : v.toLocaleString('id-ID')

const pct = (v: number | null | undefined, d = 1) =>
  v == null ? '—' : `${v > 0 ? '+' : v < 0 ? '−' : ''}${Math.abs(v).toFixed(d).replace('.', ',')}%`

const pct0 = (v: number | null | undefined) =>
  v == null ? '—' : `${v.toFixed(0)}%`

const miliar = (v: number | null | undefined) =>
  v == null ? '—' : `${(v / 1e9).toLocaleString('id-ID', { maximumFractionDigits: 1 })} M`

function BarisJejak({ label, j }: { label: string; j: JejakHorizon | undefined }) {
  if (!j) return null
  // Sesudah biaya; jatuh balik ke sebelum biaya hanya untuk berkas lama.
  const e = j.ekspektansiBiaya ?? j.ekspektansi
  return (
    <tr>
      <td>{label}</td>
      <td className="n">{pct0(j.winRate)}</td>
      <td className="n sepi">{pct0(j.winRateSemua)}</td>
      <td className="n sepi">{j.menang}·{j.kalah}·{j.gantung}</td>
      <td className={'n ' + (e == null ? 'sepi' : e > 0 ? 'up' : 'dn')}>
        {e == null ? '—' : pct(e, 2)}
      </td>
    </tr>
  )
}

export function RencanaJejak({ kode }: { kode: string }) {
  const [r, setR] = useState<RencanaEmiten | null | undefined>(undefined)

  useEffect(() => {
    let hidup = true
    muatRencana().then((p) => { if (hidup) setR(p.get(kode) ?? null) })
    return () => { hidup = false }
  }, [kode])

  if (r === undefined) return null
  if (r === null) {
    return (
      <div className="rj-kosong">
        Rencana belum tersedia untuk {kode} — riwayatnya terlalu pendek untuk diukur.
      </div>
    )
  }

  const j5 = r.jejak?.h5
  const baca = bacaJejak(j5)
  const meta = metaRencana()
  // Angka utama = SESUDAH biaya. Jatuh balik ke sebelum biaya hanya bila berkas
  // lama belum membawa ruasnya — dan saat itu keterangan tarifnya ikut hilang,
  // jadi pembaca tak dijanjikan potongan yang tak terjadi.
  const eksB = j5?.ekspektansiBiaya ?? j5?.ekspektansi ?? null
  const biaya = j5?.ekspektansiBiaya != null ? meta?.biayaPct ?? null : null
  const kelas = meta?.kelasBukti ?? 'REKONSTRUKSI'
  const rrLemah = r.rr != null && r.rr < 1
  const naikTp = ((r.tp1 - r.harga) / r.harga) * 100
  const turunSl = ((r.harga - r.sl) / r.harga) * 100

  return (
    <section className="rj">
      <div className="rj-kepala">
        <span className="rj-judul">Rencana &amp; rekam jejak</span>
        {/* Label kelas bukti — WAJIB tampil, bukan disembunyikan di kaki.
            Seluruh angka rekam jejak di kartu ini REKONSTRUKSI: aturan hari
            ini diterapkan mundur ke riwayat. Ia bukan catatan yang ditulis
            tiap sore sebelum hasilnya diketahui, dan pembaca berhak tahu
            bedanya sebelum membaca angkanya. */}
        <span className="rj-kelas" title="Aturan hari ini diterapkan mundur ke riwayat — bukan catatan harian">
          {kelas}
        </span>
        <span className="rj-tgl">{r.tanggal}</span>
      </div>

      <div className="rj-angka">
        <div>
          <b className={eksB != null && eksB > 0 ? 'up' : 'dn'}>
            {eksB == null ? '—' : pct(eksB, 2)}
          </b>
          <span>
            hasil rata-rata per sinyal, 5 hari bursa, <b>sesudah biaya</b>
            {biaya != null ? ` ${biaya.toFixed(2).replace('.', ',')}% pulang-pergi` : ''}
            {j5?.ekspektansi != null ? ` · sebelum biaya ${pct(j5.ekspektansi, 2)}` : ''}
          </span>
        </div>
        <div>
          <b>{pct0(j5?.winRate)}</b>
          <span>menang dari yang tuntas &middot; {pct0(j5?.winRateSemua)} dari semua</span>
        </div>
      </div>

      <p className={'rj-baca ' + baca.nada}>{baca.kalimat}</p>

      <table className="rj-tabel">
        <tbody>
          <tr>
            <td>Area beli</td>
            <td className="n">{rp(r.areaBeli[0])}–{rp(r.areaBeli[1])}</td>
            <td className="sepi">terendah hari ini sampai penutupannya</td>
          </tr>
          <tr>
            <td>Target 1</td>
            <td className="n up">{rp(r.tp1)}</td>
            <td className="sepi">{pct(naikTp)} dari penutupan</td>
          </tr>
          <tr>
            <td>Target 2</td>
            <td className="n up">{rp(r.tp2)}</td>
            <td className="sepi">{pct(((r.tp2 - r.harga) / r.harga) * 100)}</td>
          </tr>
          <tr>
            <td>Batas rugi</td>
            <td className="n dn">{rp(r.sl)}</td>
            <td className="sepi">−{turunSl.toFixed(2).replace('.', ',')}%</td>
          </tr>
          <tr>
            <td>Imbalan : risiko</td>
            <td className={'n ' + (rrLemah ? 'dn' : '')}>{r.rr?.toFixed(2).replace('.', ',') ?? '—'}</td>
            <td className="sepi">
              {rrLemah
                ? 'kurang dari 1 — incarannya lebih kecil dari yang dipertaruhkan'
                : 'lebih dari 1'}
            </td>
          </tr>
          <tr>
            <td>Gerak harian khas</td>
            <td className="n">{pct(r.atrPct, 2).replace('+', '')}</td>
            <td className="sepi">rentang tengah 14 hari</td>
          </tr>
          <tr>
            <td>Nilai transaksi</td>
            <td className="n">{miliar(r.nilaiHarian)}</td>
            <td className="sepi">median 20 hari, per hari</td>
          </tr>
        </tbody>
      </table>

      <div className="rj-gulir">
        <table className="rj-tabel rj-jejak">
          <thead>
            <tr>
              <th>Jendela</th>
              <th className="n">Dari tuntas</th>
              <th className="n">Dari semua</th>
              <th className="n">M·K·G</th>
              <th className="n">Sesudah biaya</th>
            </tr>
          </thead>
          <tbody>
            <BarisJejak label="5 hari" j={r.jejak?.h5} />
            <BarisJejak label="10 hari" j={r.jejak?.h10} />
            <BarisJejak label="20 hari" j={r.jejak?.h20} />
          </tbody>
        </table>
      </div>

      <p className="rj-kaki">
        <b>Sinyal direkonstruksi, bukan catatan harian</b> — aturan yang sama
        diterapkan mundur ke tiap hari sinyal di riwayat {r.kode}; hari
        sinyalnya sendiri tak ikut dinilai, dan target serta batas yang
        tersentuh di hari yang sama dihitung kalah. <b>M·K·G</b> = menang,
        kalah, menggantung; yang menggantung adalah sinyal yang jendelanya
        tutup tanpa menyentuh keduanya. Kolom <b>sesudah biaya</b> memotong
        {biaya != null ? ` ${biaya.toFixed(2).replace('.', ',')}%` : ' biaya'} pulang-pergi
        dari tiap sinyal, tarif yang sama dengan halaman Uji Aturan. Frekuensi
        masa lalu, bukan peluang untuk besok.
      </p>
    </section>
  )
}
