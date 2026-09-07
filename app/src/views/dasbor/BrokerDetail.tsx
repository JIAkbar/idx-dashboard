import { useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { KonteksData } from '../../components/dasbor/KonteksData'
import { PemilihRentang } from '../../components/dasbor/PemilihRentang'
import { IkonMenu, IKON_PERINGATAN } from '../../components/dasbor/IkonMenu'
import { pilRentang } from '../../lib/dasbor/periode'
import { fN, tanggalRingkas } from '../../lib/dasbor/format'
import { kelasBroker, namaBroker } from '../../lib/dasbor/kelompokBroker'
import { sisiBroker } from '../../lib/dasbor/pilihGarisBroker'
import { useBrokerPivot, type BarisPivot, type PresetPivot } from '../../lib/dasbor/brokerPivot'
import './BrokerDetail.css'

/**
 * Rincian satu broker — di emiten apa saja ia mengakumulasi dan mendistribusi.
 *
 * Johan, 7 Sep 2026 di Top Broker: *"dan misal broker itu di klik bisa kita
 * lihat aslinya oh XL lagi akumulasi di saham apa saja, CC, dan lain
 * sebagainya"*, lalu: *"jika tidak ada page nya bisa buat section dibawah nya
 * atau lebih baiknya di buat page baru saya ikuti rekomendasimu"*.
 *
 * Halaman sendiri, bukan panel di bawah Top Broker: URL-nya bisa dibagikan,
 * kendali periodenya tak berebut dengan kendali periode Top Broker, dan pola
 * "tiap tab halaman sendiri" tetap utuh.
 *
 * ## Dua hal yang WAJIB terbaca di layar, bukan cuma di kode
 *
 * 1. **Daftarnya terpotong di hulu.** Rekap broker harian per emiten memuat 50
 *    teratas tiap sisi. Broker yang tiap hari duduk di peringkat 51 di sebuah
 *    emiten karena itu tak pernah terhitung di sana. Untuk pertanyaan "di
 *    saham apa broker ini bergerak besar" potongan itu tepat sasaran — tapi
 *    dibaca sebagai rekap lengkap ia salah, jadi kalimatnya dicetak.
 * 2. **Pangsa itu terhadap NILAI TRANSAKSI emiten**, bukan terhadap total
 *    broker ini. Tanpa keterangan itu angka 7,55% mudah terbaca sebagai
 *    "7,55% dari kegiatan broker ini", yang artinya jauh berbeda.
 */

/** Kolom rupiah: dua desimal TETAP. `fN` memakai `maximumFractionDigits`
 *  sehingga 110,00 tercetak "110" dan 465,40 jadi "465,4" - satu kolom
 *  angka dengan tiga panjang desimal berbeda tak bisa dibandingkan
 *  sekilas, dan itu justru tugas kolom ini. */
/** Dua desimal TETAP, dipakai kolom rupiah maupun kolom pangsa. */
function dua(v: number): string {
  return v.toLocaleString('id-ID', {
    minimumFractionDigits: 2, maximumFractionDigits: 2,
  })
}

function miliar(v: number): string {
  return dua(Math.abs(v) / 1e9)
}

/** Kata dan urutannya dari kamus rentang (#70) - halaman cuma menyebut
 *  kunci mana yang punya rollup. */
const PRESET = pilRentang<PresetPivot>([
  { id: 'h5', kunci: 'h5' },
  { id: 'b1', kunci: 'b1' },
  { id: 'b3', kunci: 'b3' },
])

function Tabel({ baris, sisi }: { baris: BarisPivot[]; sisi: 'beli' | 'jual' }) {
  if (baris.length === 0) {
    return <p className="lbl bdt-kosong">Tak ada emiten di sisi ini pada periode tersebut.</p>
  }
  return (
    <div className="board-tbl-wrap">
      <table className="tbl bdt-tbl">
        <thead>
          <tr>
            <th>Emiten</th>
            <th className="r">Net (miliar)</th>
            <th className="r">Net (lot)</th>
            <th className="r">Hari</th>
            <th className="r">Pangsa</th>
          </tr>
        </thead>
        <tbody>
          {baris.map((b) => (
            <tr key={b.kode}>
              <td><Link to={`/grafik?kode=${b.kode}`} className="tick">{b.kode}</Link></td>
              <td className={`r num ${sisi === 'beli' ? 'green' : 'red'}`}>
                {miliar(b.net_nilai)}
              </td>
              <td className="r num muted">{fN(Math.abs(b.net_lot), 0)}</td>
              <td className="r num muted">{b.hari}</td>
              {/* "—" bukan "0%": penyebut yang tak ada berarti tak diketahui,
                  dan menuliskannya nol adalah pernyataan yang bisa salah. */}
              <td className="r num muted">{b.pangsa == null ? '—' : `${dua(b.pangsa * 100)}%`}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export function BrokerDetail() {
  const { kode = '' } = useParams()
  const broker = kode.toUpperCase()
  const [preset, setPreset] = useState<PresetPivot>('b1')
  const { data, memuat } = useBrokerPivot(broker || null)

  const isi = data?.data[preset] ?? null
  const rentang = data?.periode[preset] ?? null
  const nama = useMemo(() => namaBroker(broker), [broker])
  const sisi = sisiBroker(broker)

  const kepala = (
    <div className="vhead">
      <div className="vhead-kiri">
        <h1>
          <span className={`bchip ${kelasBroker(broker)}`}>{broker}</span>{' '}
          {nama === 'belum dikurasi' ? 'Broker' : nama}
        </h1>
        <span className="sub">
          {sisi === 'asing' ? 'sekuritas berinduk luar negeri' : 'sekuritas lokal'}
          {' · '}akumulasi &amp; distribusi per emiten
        </span>
      </div>
      <KonteksData tanggal={data?.akhir ?? null} />
    </div>
  )

  if (!memuat && !data) {
    return (
      <div className="lantai">
        {kepala}
        <div className="panel panel-b bdt-pesan">
          <p><IkonMenu d={IKON_PERINGATAN} size={28} /></p>
          <p className="lbl">Rincian untuk broker ini belum tersedia.</p>
          <p className="muted bdt-pesan-sub">
            Rinciannya dibangun dari arsip transaksi per emiten. Broker yang belum pernah
            muncul di arsip itu — atau yang rollupnya belum dijalankan — belum punya halaman isi.
          </p>
          <p><Link to="/broker" className="kd-tautan">← Kembali ke Top Broker</Link></p>
        </div>
      </div>
    )
  }

  return (
    <div className="lantai">
      {kepala}

      <div className="bilah-kendali">
        <div className="grup-k">
          <PemilihRentang
            ariaLabel="Periode rincian broker"
            nilai={preset}
            onGanti={(id) => setPreset(id as PresetPivot)}
            opsi={PRESET}
          />
        </div>
      </div>

      {memuat && <p className="lbl bdt-kosong">Memuat rincian…</p>}

      {isi && rentang && (
        <>
          <p className="muted bdt-basis">
            Dijumlah dari transaksi harian <b>{tanggalRingkas(rentang.mulai)}</b> s.d.
            {' '}<b>{tanggalRingkas(rentang.akhir)}</b> —
            {' '}broker ini tercatat di <b>{isi.n_emiten} emiten</b> pada periode itu; tabel memuat
            {' '}20 teratas tiap sisi. <b>Pangsa</b> dihitung terhadap nilai transaksi emiten
            {' '}tersebut pada periode yang sama, bukan terhadap kegiatan broker ini.
            {data?.terpotong ? (
              <>
                {' '}Rekap harian per emiten memuat <b>{data.terpotong} broker teratas tiap sisi</b>,
                {' '}jadi hari saat broker ini berada di bawah peringkat itu tidak ikut terhitung.
              </>
            ) : null}
          </p>

          <div className="bdt-grid">
            <div className="panel">
              <div className="panel-h"><span className="lbl">Akumulasi — net beli terbesar</span></div>
              <div className="panel-b"><Tabel baris={isi.beli} sisi="beli" /></div>
            </div>
            <div className="panel">
              <div className="panel-h"><span className="lbl">Distribusi — net jual terbesar</span></div>
              <div className="panel-b"><Tabel baris={isi.jual} sisi="jual" /></div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
