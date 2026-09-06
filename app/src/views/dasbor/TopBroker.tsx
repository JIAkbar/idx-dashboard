import { Link } from 'react-router-dom'
import { BilahTanggal } from '../../components/dasbor/BilahTanggal'
import { KonteksData } from '../../components/dasbor/KonteksData'
import { CatatanCakupan } from '../../components/dasbor/CatatanCakupan'
import { useDataHarian } from '../../lib/dasbor/dataHarian'
import { useUrut } from '../../lib/dasbor/useUrut'
import { fN } from '../../lib/dasbor/format'
import type { StockRankRow, BrokerRankRow } from '../../lib/dasbor/dataHarian'
import { IkonMenu, IKON_PERINGATAN } from '../../components/dasbor/IkonMenu'

/**
 * Reset tombol judul kolom ke tampilan teks polos — padanan `button{font:
 * inherit;color:inherit;background:none;border:none;cursor:pointer;padding:0}`
 * (docs/design-lantai-bursa-reimagined.html:55). Aturan itu ada di "BASE" milik
 * artifact tapi TIDAK ikut disalin ke lantai.css (komentar lantai.css bilang
 * "sudah ditangani di luar .lantai", nyatanya belum — dasbor.css juga tidak
 * punya reset button global). Ditaruh inline di sini, bukan di lantai.css,
 * karena file itu di luar cakupan Task 6.
 */

type UrutState<T> = { kunci: keyof T; arah: 'naik' | 'turun'; klik: (k: keyof T) => void }

/** Judul kolom yang bisa diklik untuk mengurutkan; teks & makna kolom tetap sama. */
function thSort<T extends object>(s: UrutState<T>, k: keyof T, label: string, kanan = false) {
  const aktif = s.kunci === k
  return (
    <th className={kanan ? 'r' : undefined}>
      <button type="button" className="th-sort" onClick={() => s.klik(k)}>
        {label}{aktif ? (s.arah === 'naik' ? ' ▲' : ' ▼') : ''}
      </button>
    </th>
  )
}

/**
 * Panel "Top Broker" — port buildBrokerPanel() index_live.html baris 2919-2967,
 * bergaya papan "Lantai Bursa" (docs/design-lantai-bursa-reimagined.html baris
 * 558-581). Enam blok dan urutannya beku: Top Stock Trading by Volume/Value/
 * Frequency, lalu Top Broker by Volume/Value/Frequency — hanya lapisan tampilan
 * dan pengurutan lewat judul kolom (useUrut) yang ditambahkan.
 */
export function TopBroker() {
  const { tanggalTersedia, hari, tanggalAktif, pilihTanggal, loading, error } = useDataHarian()

  // Hooks dipanggil tanpa syarat sebelum return dini loading/error (Rules of
  // Hooks) — pola sama dengan SektorIndeks.tsx.
  const volS = useUrut<StockRankRow>(hari?.top_vol ?? [], 'v')
  const valS = useUrut<StockRankRow>(hari?.top_val ?? [], 'v')
  const freqS = useUrut<StockRankRow>(hari?.top_freq ?? [], 'v')
  const volB = useUrut<BrokerRankRow>(hari?.broker_vol ?? [], 'v')
  const valB = useUrut<BrokerRankRow>(hari?.broker_val ?? [], 'v')
  const freqB = useUrut<BrokerRankRow>(hari?.broker_freq ?? [], 'v')

  // Judul = label menu resmi rute /broker (lib/dasbor/menu.ts) — dipakai
  // ulang di ketiga cabang return (loading/error/utama) supaya header tak
  // melompat, pola sama StatistikBerkala.tsx.
  // Baris "Data per …" TIDAK lagi berdiri sendiri di bawah kepala
  // (Johan 5 Sep 2026: "kenapa teks 2 juni 2026 gak di pindahkan saja
  // 1 baris dengan teks peta investor"). Ia masuk ke .vhead dan
  // didorong ke ujung kanan, jadi satu baris hilang tanpa ada yang
  // dibuang — tautan Metodologi di dalamnya ikut pindah, bukan mati.
  //
  // vhead jadi FUNGSI karena tanggalnya baru diketahui di cabang utama;
  // cabang memuat/galat memanggilnya tanpa argumen dan komponennya
  // menulis "Data per —" apa adanya, bukan menyembunyikan barisnya.
  const vhead = (tgl: string | null = null, sementara = false) => (
    <div className="vhead">
      <h1>Top Broker</h1>
      <CatatanCakupan inline />
      <KonteksData tanggal={tgl} sementara={sementara} />
    </div>
  )

  if (loading && !hari) {
    return (
      <div className="lantai">
        {vhead()}
        <BilahTanggal tanggalTersedia={tanggalTersedia} tanggalAktif={tanggalAktif} onPilih={pilihTanggal} />
        <div className="panel panel-b" style={{ textAlign: 'center', padding: '40px 20px' }}>
          <p style={{ fontSize: 28 }}>⏳</p>
          <p className="lbl">Memuat data…</p>
        </div>
      </div>
    )
  }

  if (error || !hari) {
    return (
      <div className="lantai">
        {vhead()}
        <BilahTanggal tanggalTersedia={tanggalTersedia} tanggalAktif={tanggalAktif} onPilih={pilihTanggal} />
        <div className="panel panel-b" style={{ textAlign: 'center', padding: '40px 20px' }}>
          <p><IkonMenu d={IKON_PERINGATAN} size={28} /></p>
          <p className="lbl">Data tidak tersedia untuk tanggal ini</p>
        </div>
      </div>
    )
  }

  const tblStock = (s: UrutState<StockRankRow> & { urut: StockRankRow[] }) => s.urut.map((x) => (
    <tr key={x.c}>
      <td><Link to={`/grafik?kode=${x.c}`} className="tick">{x.c}</Link></td>
      <td className="r num">{fN(x.v, 0)}</td>
      <td className="r num muted">{x.p}%</td>
    </tr>
  ))

  const tblBroker = (s: UrutState<BrokerRankRow> & { urut: BrokerRankRow[] }) => s.urut.map((x) => (
    <tr key={x.cd}>
      <td><span className="bchip">{x.cd}</span></td>
      <td className="muted">{x.nm}</td>
      <td className="r num">{fN(x.v, 0)}</td>
      <td className="r num muted">{x.p}%</td>
    </tr>
  ))

  return (
    <div className="lantai">
      {vhead(tanggalAktif, hari?.sementara === true)}
      <BilahTanggal tanggalTersedia={tanggalTersedia} tanggalAktif={tanggalAktif} onPilih={pilihTanggal} />

      <div className="panel">
        <div className="panel-h"><span className="lbl">Top Stock Trading — By Volume · Value · Frequency</span></div>
        <div className="panel-b">
          <div className="grid3">
            <div>
              <p className="lbl" style={{ marginBottom: 7 }}>By Volume (Juta Saham)</p>
              <table className="tbl">
                <thead><tr>{thSort(volS, 'c', 'Kode')}{thSort(volS, 'v', 'Volume', true)}{thSort(volS, 'p', '%', true)}</tr></thead>
                <tbody>{tblStock(volS)}</tbody>
              </table>
            </div>
            <div>
              <p className="lbl" style={{ marginBottom: 7 }}>By Value (Miliar IDR)</p>
              <table className="tbl">
                <thead><tr>{thSort(valS, 'c', 'Kode')}{thSort(valS, 'v', 'Nilai', true)}{thSort(valS, 'p', '%', true)}</tr></thead>
                <tbody>{tblStock(valS)}</tbody>
              </table>
            </div>
            <div>
              <p className="lbl" style={{ marginBottom: 7 }}>By Frequency (Kali)</p>
              <table className="tbl">
                <thead><tr>{thSort(freqS, 'c', 'Kode')}{thSort(freqS, 'v', 'Frekuensi', true)}{thSort(freqS, 'p', '%', true)}</tr></thead>
                <tbody>{tblStock(freqS)}</tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      <div className="grid3">
        <div className="panel">
          <div className="panel-h"><span className="lbl">Top Broker — By Volume (Juta Saham)</span></div>
          <div className="board-tbl-wrap">
            <table className="tbl">
              <thead><tr>{thSort(volB, 'cd', 'Kode')}{thSort(volB, 'nm', 'Nama Broker')}{thSort(volB, 'v', 'Volume', true)}{thSort(volB, 'p', '%', true)}</tr></thead>
              <tbody>{tblBroker(volB)}</tbody>
            </table>
          </div>
        </div>
        <div className="panel">
          <div className="panel-h"><span className="lbl">Top Broker — By Value (Miliar IDR)</span></div>
          <div className="board-tbl-wrap">
            <table className="tbl">
              <thead><tr>{thSort(valB, 'cd', 'Kode')}{thSort(valB, 'nm', 'Nama Broker')}{thSort(valB, 'v', 'Nilai', true)}{thSort(valB, 'p', '%', true)}</tr></thead>
              <tbody>{tblBroker(valB)}</tbody>
            </table>
          </div>
        </div>
        <div className="panel">
          <div className="panel-h"><span className="lbl">Top Broker — By Frequency (Kali)</span></div>
          <div className="board-tbl-wrap">
            <table className="tbl">
              <thead><tr>{thSort(freqB, 'cd', 'Kode')}{thSort(freqB, 'nm', 'Nama Broker')}{thSort(freqB, 'v', 'Frekuensi', true)}{thSort(freqB, 'p', '%', true)}</tr></thead>
              <tbody>{tblBroker(freqB)}</tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}
