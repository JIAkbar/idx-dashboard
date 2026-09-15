import { lazy, Suspense } from 'react'
import { PenjagaHalaman } from '../../components/PenjagaHalaman'
import { PemuatHalaman } from '../../components/dasbor/PemuatHalaman'
import { BagianHalaman } from '../../components/dasbor/BagianHalaman'
import { TopBroker } from './TopBroker'

// Spesifier modul sama dengan `prefetchRute.ts`, jadi tetap satu chunk.
const BrokerSummary = lazy(() => import('./BrokerSummary').then((m) => ({ default: m.BrokerSummary })))

/**
 * Broker Pasar — Top Broker dan Broker Summary level pasar jadi SATU halaman
 * (#200 A gelombang 2, keputusan Johan 15 Sep 2026: "ya #200 A susunan lima
 * pintu"). Keduanya membaca rekap broker harian yang sama (`brokerHarian.ts`,
 * tumpang tindih T1 di docs/peta-fungsi-halaman.md); bedanya kedalaman.
 *
 * Isi kedua komponen sengaja TIDAK ditulis ulang. Kunci akses tetap per
 * bagian — Peringkat mengikuti `topbroker` (dijaga rute), Rincian mengikuti
 * `broker` (dijaga di sini) — supaya penggabungan tidak membuka yang tadinya
 * terkunci atau mengunci yang tadinya terbuka. Alamat lama `/broker-summary`
 * dialihkan ke `?bagian=rincian`.
 */
export function BrokerPasar() {
  return (
    <BagianHalaman label="Bagian Broker Pasar" bagian={[
      { id: 'peringkat', label: 'Peringkat harian', isi: <TopBroker /> },
      {
        id: 'rincian', label: 'Rincian 88 broker',
        isi: (
          <PenjagaHalaman kunci="broker">
            <Suspense fallback={<PemuatHalaman />}><BrokerSummary /></Suspense>
          </PenjagaHalaman>
        ),
      },
    ]} />
  )
}
