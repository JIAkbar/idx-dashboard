import { lazy, Suspense, type ReactNode } from 'react'
import { PenjagaHalaman } from '../../components/PenjagaHalaman'
import { PemuatHalaman } from '../../components/dasbor/PemuatHalaman'
import { BagianHalaman } from '../../components/dasbor/BagianHalaman'
import { SektorIndeks } from './SektorIndeks'

// Lazy: dua bagian ini membawa Chart.js dan ratusan berkas sampel; Sektor
// sendiri dimuat eager, jadi keduanya tak boleh ikut masuk bundel utama.
const RotasiTab = lazy(() => import('./neo-papan/RotasiTab').then((m) => ({ default: m.RotasiTab })))
const ActivityTab = lazy(() => import('./neo-papan/ActivityTab').then((m) => ({ default: m.ActivityTab })))

/**
 * Sektor & Indeks dengan dua bagian yang dulu tab Neo Papan: Rotasi sektor dan
 * Aktivitas sektor/indeks (#200 A gelombang 3, susunan lima pintu keputusan
 * Johan 15 Sep 2026). Topiknya sama — sektor — jadi pembaca menemukannya di
 * satu tempat. Bukan penggabungan angka: Sektor memakai potret harian resmi,
 * dua bagian itu membangun deret sendiri dari sampel emiten likuid
 * (docs/peta-fungsi-halaman.md, "mirip tapi beda").
 *
 * Komponen dipakai apa adanya. Kuncinya tetap kunci Neo Papan (`neo-papan`),
 * dan pembungkus `.neo-papan` dipertahankan karena gaya `np-*` kedua bagian
 * itu dicakup kelas tersebut. Alamat lama tetap terbuka:
 * `/neo-papan?tab=rotasi` dan `?tab=activity`.
 */
export function SektorPasar() {
  const dariNeo = (isi: ReactNode) => (
    <PenjagaHalaman kunci="neo-papan">
      <div className="lantai neo-papan hal-sektor">
        <Suspense fallback={<PemuatHalaman />}>{isi}</Suspense>
      </div>
    </PenjagaHalaman>
  )
  return (
    <BagianHalaman label="Bagian Sektor & Indeks" bagian={[
      { id: 'sektor', label: 'Sektor', isi: <SektorIndeks /> },
      { id: 'rotasi', label: 'Rotasi', isi: dariNeo(<RotasiTab />) },
      { id: 'aktivitas', label: 'Aktivitas', isi: dariNeo(<ActivityTab />) },
    ]} />
  )
}
