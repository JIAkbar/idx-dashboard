import { lazy, Suspense } from 'react'
import { useSearchParams } from 'react-router-dom'
import { PenjagaHalaman } from '../../components/PenjagaHalaman'
import { PemuatHalaman } from '../../components/dasbor/PemuatHalaman'
import { TopBroker } from './TopBroker'

// Spesifier modul sama dengan `prefetchRute.ts`, jadi tetap satu chunk.
const BrokerSummary = lazy(() => import('./BrokerSummary').then((m) => ({ default: m.BrokerSummary })))

/**
 * Broker Pasar — Top Broker dan Broker Summary level pasar jadi SATU halaman
 * (#200 A gelombang 2, keputusan Johan 15 Sep 2026: "ya #200 A susunan lima
 * pintu"). Keduanya membaca rekap broker harian yang sama (`brokerHarian.ts`,
 * tumpang tindih T1 di docs/peta-fungsi-halaman.md); bedanya kedalaman.
 *
 * Isi kedua komponen sengaja TIDAK ditulis ulang: halaman ini cuma pembungkus
 * dua bagian. Kunci akses tetap per bagian — Peringkat mengikuti `topbroker`
 * (dijaga rute), Rincian mengikuti `broker` (dijaga di sini) — supaya
 * penggabungan tidak membuka yang tadinya terkunci atau mengunci yang tadinya
 * terbuka. Alamat lama `/broker-summary` dialihkan ke `?bagian=rincian`.
 */
export function BrokerPasar() {
  const [sp, setSp] = useSearchParams()
  const rincian = sp.get('bagian') === 'rincian'
  const ke = (bagian: 'peringkat' | 'rincian') => {
    const baru = new URLSearchParams(sp)
    if (bagian === 'rincian') baru.set('bagian', 'rincian')
    else baru.delete('bagian')
    setSp(baru, { replace: true })
  }

  return (
    <>
      <div className="lantai">
        <div className="tabs" role="tablist" aria-label="Bagian Broker Pasar">
          <button type="button" role="tab" aria-selected={!rincian} className={'tab' + (rincian ? '' : ' on')} onClick={() => ke('peringkat')}>
            Peringkat harian
          </button>
          <button type="button" role="tab" aria-selected={rincian} className={'tab' + (rincian ? ' on' : '')} onClick={() => ke('rincian')}>
            Rincian 88 broker
          </button>
        </div>
      </div>
      {rincian ? (
        <PenjagaHalaman kunci="broker">
          <Suspense fallback={<PemuatHalaman />}>
            <BrokerSummary />
          </Suspense>
        </PenjagaHalaman>
      ) : (
        <TopBroker />
      )}
    </>
  )
}
