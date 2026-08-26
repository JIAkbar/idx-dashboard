import { useEffect, useMemo, useState } from 'react'
import { StockAutocomplete } from '../../components/dasbor/StockAutocomplete'
import { CatatanCakupan } from '../../components/dasbor/CatatanCakupan'
import { PemilihRentang } from '../../components/dasbor/PemilihRentang'
import { useStockIndex } from '../../lib/dasbor/stockDetailData'
import { useBrokerTahunan } from '../../lib/dasbor/brokerTahunanData'
import { warnaBrokerCanvas } from '../../lib/dasbor/kelompokBroker'
import { LABEL_RENTANG } from '../../lib/dasbor/periode'
import {
  hariRentang, posisiBroker, TEKS_STATUS,
  type PosisiBroker, type StatusBroker,
} from '../../lib/dasbor/traderPapan'
import './TraderPapan.css'

/**
 * Trader Papan — posisi tiap broker pada satu emiten.
 *
 * Bentuknya dipetik dari tab Inventory/Accumulation tradersaham.com (audit
 * `docs/riset/tradersaham-bongkar.md`); datanya arsip broker harian kita
 * sendiri, sumber yang sama dengan Whales Papan.
 *
 * Pasangannya, bukan penggantinya: Whales Papan masuk lewat HARGA ("di
 * 190-200 siapa yang menampung"), halaman ini masuk lewat PELAKU ("broker ini
 * posisinya bagaimana"). Satu layar yang menjawab keduanya berarti dua kendali
 * saling menimpa dan tak ada yang terbaca jelas.
 */

const RENTANG = [
  { id: 'b1', label: LABEL_RENTANG.b1 },
  { id: 'b3', label: LABEL_RENTANG.b3 },
  { id: 'b6', label: LABEL_RENTANG.b6 },
  { id: 'y1', label: LABEL_RENTANG.y1 },
  { id: 'semua', label: 'Semua' },
] as const
type IdRentang = (typeof RENTANG)[number]['id']

const HARI_MUNDUR: Record<Exclude<IdRentang, 'semua'>, number> = {
  b1: 30, b3: 91, b6: 182, y1: 365,
}

/** Berapa hari terakhir yang tergambar sebagai strip net harian. */
const STRIP = 12
const BARIS_AWAL = 20

function rupiahRingkas(n: number): string {
  const a = Math.abs(n)
  const t = n < 0 ? '−' : ''
  if (a >= 1e12) return `${t}${(a / 1e12).toFixed(2)} T`
  if (a >= 1e9) return `${t}${(a / 1e9).toFixed(2)} M`
  if (a >= 1e6) return `${t}${(a / 1e6).toFixed(1)} jt`
  return `${t}${Math.round(a).toLocaleString('id-ID')}`
}
function lotRingkas(n: number): string {
  const a = Math.abs(n)
  const t = n < 0 ? '−' : ''
  if (a >= 1e6) return `${t}${(a / 1e6).toFixed(2)} jt`
  if (a >= 1e3) return `${t}${(a / 1e3).toFixed(1)}rb`
  return `${t}${Math.round(a)}`
}
function harga(n: number | null): string {
  return n == null ? '—' : Math.round(n).toLocaleString('id-ID')
}

const KELAS_STATUS: Record<StatusBroker, string> = {
  akumulasi: 'tp-s-akum',
  'akumulasi-mereda': 'tp-s-akum-reda',
  distribusi: 'tp-s-dist',
  'distribusi-berbalik': 'tp-s-dist-balik',
  datar: 'tp-s-datar',
}

/** Strip net harian: satu batang per hari, tinggi relatif terhadap hari
 *  terbesar broker ITU SENDIRI — bukan skala pasar. Yang ditanyakan strip ini
 *  "kapan ia paling agresif", bukan "seberapa besar ia dibanding broker lain";
 *  skala pasar akan meratakan seluruh broker kecil jadi garis nol. */
function Strip({ net }: { net: number[] }) {
  const ekor = net.slice(-STRIP)
  const puncak = Math.max(1, ...ekor.map((n) => Math.abs(n)))
  return (
    <span className="tp-strip" aria-hidden="true">
      {ekor.map((n, i) => (
        <span
          key={i}
          className={n >= 0 ? 'tp-b-beli' : 'tp-b-jual'}
          style={{ height: `${Math.max(2, (Math.abs(n) / puncak) * 100)}%` }}
        />
      ))}
    </span>
  )
}

export default function TraderPapan() {
  const { index: indeks } = useStockIndex()
  const [ketik, setKetik] = useState('BBCA')
  const [kode, setKode] = useState('BBCA')
  const [rentang, setRentang] = useState<IdRentang>('b3')
  const [batasBaris, setBatasBaris] = useState(BARIS_AWAL)

  const { hari, tahunAda, muat, galat } = useBrokerTahunan(kode)
  useEffect(() => { setBatasBaris(BARIS_AWAL) }, [kode, rentang])

  const hasil = useMemo(() => {
    if (hari.length === 0) return null
    const akhir = hari[hari.length - 1].tanggal
    if (rentang === 'semua') return posisiBroker(hari)
    const d = new Date(`${akhir}T00:00:00Z`)
    d.setUTCDate(d.getUTCDate() - HARI_MUNDUR[rentang])
    return posisiBroker(hariRentang(hari, d.toISOString().slice(0, 10), akhir))
  }, [hari, rentang])

  const tampil = hasil?.baris.slice(0, batasBaris) ?? []

  return (
    <div className="lantai">
      <h2>Trader Papan</h2>
      <p className="muted tp-intro">
        Posisi tiap broker pada satu emiten: berapa rata-rata harga belinya, seberapa
        murah ia pernah menampung, dan bagaimana arahnya belakangan.
      </p>

      <CatatanCakupan />

      <div className="tp-atur">
        <div className="tp-emiten">
          <StockAutocomplete
            stocks={indeks?.stocks || []}
            value={ketik}
            onChange={setKetik}
            onSelect={(v) => { setKetik(v); setKode(v.toUpperCase()) }}
            placeholder="Cari emiten: BUMI, BBCA…"
          />
        </div>
        <strong>{kode}</strong>
        <PemilihRentang opsi={RENTANG} nilai={rentang} onGanti={setRentang} />
        {tahunAda.length > 0 && (
          <span className="muted tp-kecil">
            arsip {tahunAda[0]}–{tahunAda[tahunAda.length - 1]}
          </span>
        )}
        {muat && <span className="muted tp-kecil">memuat…</span>}
      </div>

      {galat === 'belum-ada' || galat === 'kosong' ? (
        <div className="tp-kosong">
          Riwayat broker bertahun untuk <strong>{kode}</strong> belum tersedia.
          <br />
          Data yang sudah tervalidasi baru sejak 2020, dan emiten ini belum masuk
          gelombang pengumpulannya.
        </div>
      ) : !hasil || hasil.baris.length === 0 ? (
        <div className="tp-kosong">
          {muat ? 'Memuat…' : 'Tak ada transaksi broker di rentang ini.'}
        </div>
      ) : (
        <>
          <p className="tp-sub">
            {hasil.tglMulai} – {hasil.tglAkhir} · {hasil.nHari.toLocaleString('id-ID')} hari bursa ·{' '}
            {hasil.baris.length} broker · harga terakhir {harga(hasil.hargaAkhir)}
          </p>

          <div className="tp-gulung">
            <table className="tp-tabel">
              <thead>
                <tr>
                  <th>Broker</th>
                  <th>Arah</th>
                  <th className="tp-n">Net lot</th>
                  <th className="tp-n">Net nilai</th>
                  <th className="tp-n">Rata beli</th>
                  <th className="tp-n">Termurah</th>
                  <th className="tp-n">Untung/rugi</th>
                  <th className="tp-n">Hari</th>
                  <th>{STRIP} hari terakhir</th>
                </tr>
              </thead>
              <tbody>
                {tampil.map((b: PosisiBroker) => (
                  <tr key={b.kode}>
                    <td>
                      <span className="tp-titik" style={{ background: warnaBrokerCanvas(b.kode) }} />
                      <span className="tp-kode">{b.kode}</span>
                    </td>
                    <td>
                      <span className={`tp-status ${KELAS_STATUS[b.status]}`}>
                        {TEKS_STATUS[b.status]}
                      </span>
                    </td>
                    <td className={`tp-n ${b.netLot >= 0 ? 'tp-plus' : 'tp-minus'}`}>
                      {lotRingkas(b.netLot)}
                    </td>
                    <td className={`tp-n ${b.netNilai >= 0 ? 'tp-plus' : 'tp-minus'}`}>
                      {rupiahRingkas(b.netNilai)}
                    </td>
                    <td className="tp-n">{harga(b.avgBeli)}</td>
                    <td className="tp-n">{harga(b.floor)}</td>
                    <td className={`tp-n ${b.pnlPct == null ? '' : b.pnlPct >= 0 ? 'tp-plus' : 'tp-minus'}`}>
                      {b.pnlPct == null
                        ? '—'
                        : `${b.pnlPct >= 0 ? '+' : '−'}${Math.abs(b.pnlPct).toFixed(1)}%`}
                    </td>
                    <td className="tp-n">
                      {b.hariNetBeli}/{b.hariAktif}
                    </td>
                    <td>
                      <Strip net={b.netHarian} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {hasil.baris.length > tampil.length && (
            <button type="button" className="btn-p tp-lagi" onClick={() => setBatasBaris((n) => n + 30)}>
              Tampilkan {Math.min(30, hasil.baris.length - tampil.length)} broker lagi
            </button>
          )}

          {/* Batas ini sengaja dekat dengan tabelnya, bukan di kaki halaman:
              kolom untung/rugi terlihat seperti P&L posisi terbuka, padahal
              bukan — dan pembaca yang tak melihat keterangannya akan memakainya
              sebagai itu. */}
          <div className="tp-batas">
            <strong>Cara membacanya.</strong> Rata-rata beli dihitung dari SELURUH pembelian
            broker itu di rentang terpilih, jadi ia harga rata-rata transaksi — bukan modal
            posisi yang masih dipegang. Untung/rugi karena itu hanya ditampilkan untuk broker
            yang net-nya masih positif; untuk yang sudah melepas lebih banyak daripada yang
            dibeli, angkanya tak punya arti dan sengaja dikosongkan. Posisi yang dibawa dari
            sebelum rentang tak terbaca sama sekali dari data harian — perlebar rentangnya
            kalau ingin melihat lebih jauh ke belakang.
          </div>
        </>
      )}
    </div>
  )
}
