import { useEffect, useMemo, useState } from 'react'
import { TAHUN_AWAL } from '../../lib/dasbor/brokerEmitenV2'
import { StockAutocomplete } from '../../components/dasbor/StockAutocomplete'
import { CatatanCakupan } from '../../components/dasbor/CatatanCakupan'
import { PemilihRentang } from '../../components/dasbor/PemilihRentang'
import { useStockIndex } from '../../lib/dasbor/stockDetailData'
import { useBrokerTahunan } from '../../lib/dasbor/brokerTahunanData'
import { warnaBrokerCanvas, kelompokBroker } from '../../lib/dasbor/kelompokBroker'
import { LABEL_RENTANG } from '../../lib/dasbor/periode'
import { useUrut } from '../../lib/dasbor/useUrut'
import {
  hariRentang, posisiBroker, TEKS_STATUS,
  type PosisiBroker, type StatusBroker,
} from '../../lib/dasbor/traderPapan'
import { InfoIndikator, type ItemInfoIndikator } from '../../components/dasbor/InfoIndikator'
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

/** Saring identitas broker — 'asing' persis kelompok `kelompokBroker.ts`,
 *  'domestik' semua kelompok lain (bumn/smart/ritel/afiliasi/lain digabung —
 *  penguji minta "asing vs domestik", bukan enam kelompok sekaligus). */
const FILTER_KELOMPOK = [
  { id: 'semua', label: 'Semua' },
  { id: 'asing', label: 'Asing' },
  { id: 'domestik', label: 'Domestik' },
] as const
type IdFilterKelompok = (typeof FILTER_KELOMPOK)[number]['id']

const HARI_MUNDUR: Record<Exclude<IdRentang, 'semua'>, number> = {
  b1: 30, b3: 91, b6: 182, y1: 365,
}

/** Modal "i" — penjelasan kendali & kolom tabel halaman ini (permintaan Johan
 *  27 Agu 2026: "sweep semua page setiap ada indikator seperti ini berikan
 *  modal informasi terkait fungsi nya"). Bahasa pembaca, tanpa nama sumber/
 *  jalur internal — diambil dari komentar & catatan "Cara membacanya" yang
 *  sudah ada di halaman ini. */
const INFO_TRADER: ItemInfoIndikator[] = [
  { nama: 'Rentang waktu', isi: 'Memilih seberapa jauh ke belakang posisi broker dihitung — 1/3/6 Bulan, 1 Tahun, atau seluruh arsip yang tersedia. Seluruh angka di tabel (net, rata-rata, hari aktif) mengikuti rentang yang dipilih.' },
  { nama: 'Broker', isi: 'Menyaring baris tabel menurut kelompok identitas broker: Asing atau Domestik. "Semua" menampilkan seluruh broker tanpa disaring.' },
  { nama: 'Arah', isi: 'Ringkasan arah broker pada rentang ini: Menampung (net beli) atau Melepas (net jual), dengan keterangan "mereda" kalau ia mulai mengerem, atau "berbalik" kalau arahnya baru saja membalik dari hari-hari sebelumnya.' },
  { nama: 'Net lot', isi: 'Selisih lembar yang dibeli dikurangi yang dijual broker itu sepanjang rentang.' },
  { nama: 'Net nilai', isi: 'Net lot dikalikan harga transaksi, dalam rupiah — porsi uang yang mengalir masuk atau keluar lewat broker itu.' },
  { nama: 'Rata beli', isi: 'Harga rata-rata SELURUH pembelian broker itu di rentang ini — harga rata-rata transaksi, bukan modal posisi yang masih dipegang.' },
  { nama: 'Termurah', isi: 'Harga rata-rata hari termurah tempat broker ini net membeli — seberapa murah ia pernah menampung di rentang ini.' },
  { nama: 'Untung/rugi', isi: 'Selisih harga terakhir terhadap rata-rata beli, dalam persen. Hanya diisi untuk broker yang net-nya masih positif; untuk yang sudah melepas lebih banyak daripada yang dibeli, angkanya tak punya arti dan sengaja dikosongkan. Posisi yang dibawa dari sebelum rentang tak ikut terhitung.' },
  { nama: 'Porsi', isi: 'Seberapa besar peran broker itu pada perdagangan emiten ini — nilai transaksinya (beli+jual) dibagi total nilai transaksi seluruh broker di rentang yang sama. Bukan bukti ia menggerakkan harga.' },
]

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

/** Kepala kolom yang bisa diurut dua arah — pola sama Screener.tsx `thSort`,
 *  disalin bukan diimpor karena `keyof`-nya beda (PosisiBroker vs BarisGab). */
type UrutStateBroker = {
  kunci: keyof PosisiBroker
  arah: 'naik' | 'turun'
  klik: (k: keyof PosisiBroker) => void
}
function thSort(s: UrutStateBroker, k: keyof PosisiBroker, label: string) {
  const aktif = s.kunci === k
  return (
    <th className="tp-n">
      <button type="button" className="th-sort" onClick={() => s.klik(k)}>
        {label}{aktif ? (s.arah === 'naik' ? ' ▲' : ' ▼') : ''}
      </button>
    </th>
  )
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
  const [filterKelompok, setFilterKelompok] = useState<IdFilterKelompok>('semua')
  const [batasBaris, setBatasBaris] = useState(BARIS_AWAL)

  const { hari, tahunAda, muat, galat } = useBrokerTahunan(kode)
  useEffect(() => { setBatasBaris(BARIS_AWAL) }, [kode, rentang, filterKelompok])

  const hasil = useMemo(() => {
    if (hari.length === 0) return null
    const akhir = hari[hari.length - 1].tanggal
    if (rentang === 'semua') return posisiBroker(hari)
    const d = new Date(`${akhir}T00:00:00Z`)
    d.setUTCDate(d.getUTCDate() - HARI_MUNDUR[rentang])
    return posisiBroker(hariRentang(hari, d.toISOString().slice(0, 10), akhir))
  }, [hari, rentang])

  const barisSaring = useMemo(() => {
    if (!hasil) return []
    if (filterKelompok === 'semua') return hasil.baris
    return hasil.baris.filter(
      (b) => (kelompokBroker(b.kode) === 'asing') === (filterKelompok === 'asing'),
    )
  }, [hasil, filterKelompok])

  const s = useUrut(barisSaring, 'netNilai', 'turun')
  const tampil = s.urut.slice(0, batasBaris)

  // Broker berporsi terbesar per sisi (net beli / net jual) — dihitung dari
  // SELURUH broker emiten (bukan hasil saring "Asing/Domestik"), supaya
  // badge-nya tetap menjawab "siapa terbesar di pasar ini", bukan berubah
  // makna tiap kali chip identitas diganti.
  const porsiTerbesar = useMemo(() => {
    let beli: PosisiBroker | null = null
    let jual: PosisiBroker | null = null
    for (const b of hasil?.baris ?? []) {
      if (b.netLot >= 0) { if (!beli || b.nilaiTotal > beli.nilaiTotal) beli = b }
      else if (!jual || b.nilaiTotal > jual.nilaiTotal) jual = b
    }
    return { beli: beli?.kode ?? null, jual: jual?.kode ?? null }
  }, [hasil])

  return (
    <div className="lantai">
      <div className="vhead">
        <h1>Trader Papan</h1>
        <CatatanCakupan inline />
      </div>

      {/* Bilah kendali berkelompok — sistem tata C+A (lantai.css). Emiten ·
          Rentang · Broker; info indikator di grup-kanan. */}
      <div className="bilah-kendali tp-atur">
        <div className="grup-k">
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
          {tahunAda.length > 0 && (
            <span className="muted tp-kecil">
              arsip {tahunAda[0]}–{tahunAda[tahunAda.length - 1]}
            </span>
          )}
          {muat && <span className="muted tp-kecil">memuat…</span>}
        </div>
        <span className="pemisah-v" aria-hidden="true" />
        <div className="grup-k">
          <PemilihRentang opsi={RENTANG} nilai={rentang} onGanti={setRentang} />
        </div>
        <span className="pemisah-v" aria-hidden="true" />
        <div className="grup-k">
          <span className="grup-lbl">Broker</span>
          {FILTER_KELOMPOK.map((f) => (
            <button
              key={f.id}
              type="button"
              className={'chip-t' + (filterKelompok === f.id ? ' on' : '')}
              title={f.id === 'asing' ? 'Kelompok identitas broker asing (kelompokBroker.ts), bukan kolom investor-type harian' : undefined}
              onClick={() => setFilterKelompok(f.id)}
            >
              {f.label}
            </button>
          ))}
        </div>
        <span className="pemisah-v" aria-hidden="true" />
        <div className="grup-k grup-kanan">
          <InfoIndikator judul="Indikator Trader Papan" item={INFO_TRADER} />
        </div>
      </div>

      {galat === 'belum-ada' || galat === 'kosong' ? (
        <div className="tp-kosong">
          Riwayat broker bertahun untuk <strong>{kode}</strong> belum tersedia.
          <br />
          Arsip broker mencakup {TAHUN_AWAL} sampai sekarang, dan emiten ini belum punya
          rincian broker di dalamnya — umumnya karena baru tercatat atau
          perdagangannya sangat tipis.
        </div>
      ) : !hasil || hasil.baris.length === 0 ? (
        <div className="tp-kosong">
          {muat ? 'Memuat…' : 'Tak ada transaksi broker di rentang ini.'}
        </div>
      ) : barisSaring.length === 0 ? (
        <div className="tp-kosong">Tak ada broker {filterKelompok} di rentang ini.</div>
      ) : (
        <>
          <p className="tp-sub">
            {hasil.tglMulai} – {hasil.tglAkhir} · {hasil.nHari.toLocaleString('id-ID')} hari bursa ·{' '}
            {barisSaring.length}
            {filterKelompok !== 'semua' ? ` dari ${hasil.baris.length}` : ''} broker · harga terakhir{' '}
            {harga(hasil.hargaAkhir)}
          </p>

          <div className="tp-gulung">
            <table className="tp-tabel">
              <thead>
                <tr>
                  <th>Broker</th>
                  <th>Arah</th>
                  {thSort(s, 'netLot', 'Net lot')}
                  {thSort(s, 'netNilai', 'Net nilai')}
                  <th className="tp-n">Rata beli</th>
                  <th className="tp-n">Termurah</th>
                  <th className="tp-n">Untung/rugi</th>
                  <th className="tp-n">Hari</th>
                  <th className="tp-n">Porsi</th>
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
                    <td className="tp-n">
                      {hasil.totalNilaiPasar > 0
                        ? `${((b.nilaiTotal / hasil.totalNilaiPasar) * 100).toFixed(1)}%`
                        : '—'}
                      {porsiTerbesar.beli === b.kode && (
                        <span className="badge" title="Nilai transaksi (beli+jual) terbesar di antara broker net-beli pada rentang ini — bukan bukti menggerakkan harga">
                          porsi beli terbesar
                        </span>
                      )}
                      {porsiTerbesar.jual === b.kode && (
                        <span className="badge" title="Nilai transaksi (beli+jual) terbesar di antara broker net-jual pada rentang ini — bukan bukti menggerakkan harga">
                          porsi jual terbesar
                        </span>
                      )}
                    </td>
                    <td>
                      <Strip net={b.netHarian} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {barisSaring.length > tampil.length && (
            <button type="button" className="btn-p tp-lagi" onClick={() => setBatasBaris((n) => n + 30)}>
              Tampilkan {Math.min(30, barisSaring.length - tampil.length)} broker lagi
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
            kalau ingin melihat lebih jauh ke belakang. Kolom <strong>Porsi</strong> menyatakan
            seberapa besar peran broker itu pada perdagangan emiten ini — nilai transaksinya
            dibagi total nilai transaksi seluruh broker di rentang yang sama — bukan bukti ia
            menggerakkan harga.
          </div>
        </>
      )}
    </div>
  )
}
