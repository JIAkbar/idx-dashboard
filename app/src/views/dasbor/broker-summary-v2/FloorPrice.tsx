import { floorPriceBroker, type HariBroker } from '../../../lib/dasbor/brokerEmiten'
import { keFraksi } from '../../../lib/fraksiHarga'
import { kelompokBroker, warnaBroker, LABEL_KELOMPOK } from '../../../lib/dasbor/kelompokBroker'
import { labelTanggal } from '../../../lib/dasbor/brokerHarian'

interface FloorPriceProps {
  hari: Array<[string, HariBroker]>
}

/**
 * Tab "Floor Price" — harga beli rata-rata TERENDAH tiap broker sepanjang
 * rentang aktif (`floorPriceBroker`, brokerEmiten.ts — definisi kita sendiri,
 * belum diverifikasi setara "floor price" tradersaham). Harga dibulatkan ke
 * fraksi bursa (`keFraksi`) karena angka ini dari rata-rata rupiah mentah,
 * bukan satu transaksi — jadi bisa jatuh di antara dua tick.
 */
export function FloorPrice({ hari }: FloorPriceProps) {
  const baris = floorPriceBroker(hari, 1000)

  if (baris.length === 0) {
    return <p className="lbl" style={{ padding: '20px 0', textAlign: 'center' }}>Tak ada broker dengan ≥1.000 lot dalam satu hari pada rentang ini.</p>
  }

  return (
    <div className="board-tbl-wrap">
      <table className="tbl">
        <thead>
          <tr><th>Broker</th><th>Kelompok</th><th className="r">Floor</th><th className="r">Tanggal</th></tr>
        </thead>
        <tbody>
          {baris.map((b) => (
            <tr key={b.broker}>
              <td><span className="bchip" style={{ borderColor: warnaBroker(b.broker), color: warnaBroker(b.broker) }}>{b.broker}</span></td>
              <td style={{ color: 'var(--text3)' }}>{LABEL_KELOMPOK[kelompokBroker(b.broker)]}</td>
              <td className="r num">Rp {keFraksi(b.floor).toLocaleString('id-ID')}</td>
              <td className="r num">{labelTanggal(b.tanggal)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="lbl" style={{ marginTop: 10 }}>Beli rata-rata terendah per broker, minimal 1.000 lot dalam satu hari — bukan definisi resmi bursa.</p>
    </div>
  )
}
