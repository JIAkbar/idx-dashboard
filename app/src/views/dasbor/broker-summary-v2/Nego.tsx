import { useMemo, useState } from 'react'
import type { HariBroker } from '../../../lib/dasbor/brokerEmiten'
import { polaNegoBroker, type KelasPolaNego } from '../../../lib/dasbor/brokerEmitenV2'
import { warnaBroker, namaBroker } from '../../../lib/dasbor/kelompokBroker'
import { fmtB, fmtLot } from '../../../lib/dasbor/brokerSummaryFormat'
import { labelTanggal } from '../../../lib/dasbor/brokerHarian'
import { PemilihRentang } from '../../../components/dasbor/PemilihRentang'
import { EmptyState } from './Overview'

interface NegoProps {
  hari: Array<[string, HariBroker]>
}

type FilterPola = 'semua' | KelasPolaNego
const FILTER_OPSI: { id: FilterPola; label: string; judul: string }[] = [
  { id: 'semua', label: 'Semua', judul: 'Semua baris nego dalam rentang' },
  { id: 'berlawanan', label: 'Berlawanan', judul: 'Broker beli di nego tapi net jual di reguler (atau sebaliknya) — kandidat distribusi/akumulasi terselubung' },
  { id: 'searah', label: 'Searah', judul: 'Arah nego sama dengan arah net reguler broker itu hari itu' },
]

/** Tab "NEGO" — port `renderNego()` mockup + silang pola berlawanan/searah
 *  vs reguler (§B.2 spek C2, `polaNegoBroker`). */
export function Nego({ hari }: NegoProps) {
  const [filter, setFilter] = useState<FilterPola>('semua')
  const semuaBaris = useMemo(() => polaNegoBroker(hari), [hari])
  const baris = filter === 'semua' ? semuaBaris : semuaBaris.filter((r) => r.kelas === filter)
  const hariNego = hari.filter(([, h]) => h.nego)
  const nBerlawanan = semuaBaris.filter((r) => r.kelas === 'berlawanan').length

  return (
    <section className="panel">
      <div className="panel-h">
        <h2>Pasar negosiasi</h2>
        <span className="lbl">{hariNego.length ? `${hariNego.length} hari ber-data dalam rentang` : 'belum ada hari nego dalam rentang'}</span>
      </div>
      <div className="panel-b">
        {hariNego.length === 0 ? (
          <EmptyState>Tidak ada hari dengan data pasar negosiasi pada rentang ini.</EmptyState>
        ) : (
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 10 }}>
              <PemilihRentang opsi={FILTER_OPSI} nilai={filter} onGanti={setFilter} ariaLabel="Filter pola nego vs reguler" />
              <span className="lbl">{nBerlawanan} dari {semuaBaris.length} baris berlawanan arah dengan reguler</span>
            </div>
            {baris.length === 0 ? (
              <EmptyState>Tak ada baris {filter === 'berlawanan' ? 'berlawanan' : 'searah'} pada rentang ini.</EmptyState>
            ) : (
              <div className="board-tbl-wrap">
                <table className="tbl">
                  <thead><tr><th>Tanggal</th><th>Broker</th><th className="r">Beli (nilai)</th><th className="r">Jual (nilai)</th><th className="r">Lot</th><th className="r">Harga rata-rata</th><th>Pola</th></tr></thead>
                  <tbody>
                    {baris.map((r) => {
                      const rata = r.negoBeliLot ? r.negoBeliNilai / (r.negoBeliLot * 100) : r.negoJualLot ? r.negoJualNilai / (r.negoJualLot * 100) : null
                      return (
                        <tr key={`${r.tanggal}-${r.broker}`}>
                          <td className="num">{labelTanggal(r.tanggal)}</td>
                          <td style={{ color: warnaBroker(r.broker), fontWeight: 600 }} title={namaBroker(r.broker)}>{r.broker}</td>
                          <td className="r num">{r.negoBeliNilai ? fmtB(r.negoBeliNilai) : '—'}</td>
                          <td className="r num">{r.negoJualNilai ? fmtB(r.negoJualNilai) : '—'}</td>
                          <td className="r num">{fmtLot(Math.max(r.negoBeliLot, r.negoJualLot))}</td>
                          <td className="r num">{rata !== null ? Math.round(rata).toLocaleString('id-ID') : '—'}</td>
                          <td><span className={`chip${r.kelas === 'berlawanan' ? ' dn' : ''}`}>{r.pola}</span></td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
        <p className="lbl" style={{ marginTop: 8, textTransform: 'none', letterSpacing: 0 }}>
          Pasar negosiasi tidak aktif tiap hari, jadi rentang tanpa baris di sini wajar. Riwayatnya juga masih dilengkapi mundur, sehingga tanggal lama bisa belum tampil.
          Pola <b>berlawanan</b> = broker beli di nego sementara net jual di pasar reguler hari yang sama (atau sebaliknya) — kandidat distribusi/akumulasi yang disembunyikan lewat transaksi negosiasi, bukan bukti pasti.
        </p>
      </div>
    </section>
  )
}
