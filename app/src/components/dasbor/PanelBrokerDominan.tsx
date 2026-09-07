import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { PemilihRentang } from './PemilihRentang'
import { tanggalRingkas } from '../../lib/dasbor/format'
import {
  RENTANG_DOMINAN,
  hitungDominan,
  type BarisDominan,
  type HariRingkas,
  type RentangDominan,
} from '../../lib/dasbor/brokerDominan'
import './PanelBrokerDominan.css'

/**
 * Panel "Broker Dominan" di Berkas Emiten (#65).
 *
 * Johan, 7 Sep 2026: *"ada menu dimana broker-broker itu muncul yang dominan
 * beli dan dominan jual dan pakai rentang waktu"*.
 *
 * Empat baris terlihat, tiga berikutnya di balik satu tombol. Bukan tujuh
 * sekaligus: dua tabel × tujuh baris × enam kolom di satu kartu mengubur
 * yang dominan di antara yang sekadar hadir — dan yang ditanyakan justru
 * "siapa yang dominan".
 */

const TAMPIL_AWAL = 4

function rupiah(v: number): string {
  const m = Math.abs(v)
  if (m >= 1e12) return `${(v / 1e12).toLocaleString('id-ID', { maximumFractionDigits: 2 })} T`
  if (m >= 1e9) return `${(v / 1e9).toLocaleString('id-ID', { maximumFractionDigits: 2 })} M`
  return `${(v / 1e6).toLocaleString('id-ID', { maximumFractionDigits: 1 })} jt`
}

function persen(v: number | null, tanda = false): string {
  if (v == null) return '—'
  const s = (v * 100).toLocaleString('id-ID', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  return `${tanda && v > 0 ? '+' : ''}${s}%`
}

function harga(v: number | null): string {
  return v == null ? '—' : v.toLocaleString('id-ID', { maximumFractionDigits: 0 })
}

function Tabel({ baris, sisi }: { baris: BarisDominan[]; sisi: 'beli' | 'jual' }) {
  const [semua, setSemua] = useState(false)
  const tampil = semua ? baris : baris.slice(0, TAMPIL_AWAL)
  if (baris.length === 0) {
    return <p className="pbd-kosong">Tak ada broker di sisi ini pada rentang tersebut.</p>
  }
  return (
    <>
      <div className="board-tbl-wrap">
        <table className="tbl pbd-tbl">
          <thead>
            <tr>
              <th>Broker</th>
              <th className="r">{sisi === 'beli' ? 'Nilai beli' : 'Nilai jual'}</th>
              <th className="r">Nilai bersih</th>
              <th className="r">Rata-rata</th>
              <th className="r" title="Selisih penutupan terakhir terhadap harga rata-rata broker ini. Estimasi posisi berjalan, bukan laba yang sudah terealisasi.">Est. L/R</th>
              <th className="r" title="Porsi nilai broker ini terhadap jumlah nilai beli seluruh broker di rentang yang sama.">Dominasi</th>
            </tr>
          </thead>
          <tbody>
            {tampil.map((b) => (
              <tr key={b.kode}>
                <td className="pbd-kode">
                  <Link to={`/broker/${b.kode}`} className="bchip">{b.kode}</Link>
                  {/* (L)/(A) dieja di sini, bukan diwakili warna: warna sudah
                      dipakai kelompok identitas di tabel lain, dan pembaca
                      tak seharusnya menghafal dua kamus warna. */}
                  <span className="pbd-sisi">{b.sisi === 'asing' ? '(A)' : '(L)'}</span>
                  <span className="pbd-nama muted">
                    {b.nama === 'belum dikurasi' ? '—' : b.nama}
                  </span>
                </td>
                <td className={`r num ${sisi === 'beli' ? 'green' : 'red'}`}>{rupiah(b.nilai)}</td>
                <td className={`r num ${b.netNilai >= 0 ? 'green' : 'red'}`}>{rupiah(b.netNilai)}</td>
                <td className="r num muted">{harga(b.avg)}</td>
                <td className={`r num ${b.estimasi == null ? 'muted' : b.estimasi >= 0 ? 'green' : 'red'}`}>
                  {persen(b.estimasi, true)}
                </td>
                <td className="r num muted">{persen(b.dominasi)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {baris.length > TAMPIL_AWAL && (
        <button type="button" className="chip-t pbd-lagi" onClick={() => setSemua((v) => !v)}>
          {semua ? 'Tampilkan 4 teratas' : `${baris.length - TAMPIL_AWAL} berikutnya`}
        </button>
      )}
    </>
  )
}

export function PanelBrokerDominan({ hari, hargaAkhir }: {
  hari: HariRingkas[]
  hargaAkhir: number | null
}) {
  const [rentang, setRentang] = useState<RentangDominan>('b1')
  const hasil = useMemo(() => hitungDominan(hari, rentang, hargaAkhir), [hari, rentang, hargaAkhir])

  return (
    <section className="be-kartu pbd">
      <div className="pbd-kepala">
        <h2>Broker dominan</h2>
        <PemilihRentang
          className="pbd-rentang"
          ariaLabel="Rentang broker dominan"
          nilai={rentang}
          onGanti={(id) => setRentang(id as RentangDominan)}
          opsi={RENTANG_DOMINAN}
        />
      </div>

      {!hasil ? (
        <p className="pbd-kosong">Arsip transaksi broker emiten ini belum tersedia.</p>
      ) : (
        <>
          <p className="pbd-basis muted">
            {hasil.nHari} hari bursa, {tanggalRingkas(hasil.mulai)} s.d.
            {' '}{tanggalRingkas(hasil.akhir)} — total nilai beli seluruh
            {' '}broker <b>{rupiah(hasil.totalNilai)}</b>, dan itulah penyebut kolom Dominasi.
            {' '}Rekap harian memuat <b>50 broker teratas tiap sisi</b>, jadi angkanya bukan seluruh
            {' '}nilai transaksi bursa. <b>Est. L/R</b> memakai penutupan terakhir: posisi berjalan,
            {' '}bukan laba terealisasi.
          </p>
          <div className="pbd-grid">
            <div className="pbd-sisi-blok">
              <p className="lbl">Pembeli dominan</p>
              <Tabel baris={hasil.beli} sisi="beli" />
            </div>
            <div className="pbd-sisi-blok">
              <p className="lbl">Penjual dominan</p>
              <Tabel baris={hasil.jual} sisi="jual" />
            </div>
          </div>
        </>
      )}
    </section>
  )
}
