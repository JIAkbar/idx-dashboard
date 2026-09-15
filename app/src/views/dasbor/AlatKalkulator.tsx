import { lazy, Suspense } from 'react'
import { PenjagaHalaman } from '../../components/PenjagaHalaman'
import { PemuatHalaman } from '../../components/dasbor/PemuatHalaman'
import { BagianHalaman } from '../../components/dasbor/BagianHalaman'
import { KalkulatorJia } from './KalkulatorJia'

const KuliPapan = lazy(() => import('./KuliPapan').then((m) => ({ default: m.KuliPapan })))

/**
 * Kalkulator dengan Kuli Papan sebagai bagian kedua (#200 A gelombang 4,
 * susunan lima pintu keputusan Johan 15 Sep 2026). Keduanya alat hitung;
 * bedanya Kalkulator memakai angka yang diisi pembaca, Kuli Papan membaca data
 * emiten (docs/peta-fungsi-halaman.md, "mirip tapi beda"), jadi isinya tidak
 * dilebur. Kunci tetap per bagian: Kalkulator `kalkulator` (dijaga rute), Kuli
 * Papan `kuli-papan` (dijaga di sini). Alamat lama `/kuli-papan` dialihkan ke
 * `?bagian=kuli-papan`.
 */
export function AlatKalkulator() {
  return (
    <BagianHalaman label="Bagian Kalkulator" bagian={[
      { id: 'kalkulator', label: 'Kalkulator', isi: <KalkulatorJia /> },
      {
        id: 'kuli-papan', label: 'Kuli Papan',
        isi: (
          <PenjagaHalaman kunci="kuli-papan">
            <Suspense fallback={<PemuatHalaman />}><KuliPapan /></Suspense>
          </PenjagaHalaman>
        ),
      },
    ]} />
  )
}
