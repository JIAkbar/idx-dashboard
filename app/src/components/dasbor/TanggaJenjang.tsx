import { IkonMenu } from './IkonMenu'
import type { JenjangRow } from '../../lib/jenjang'

/**
 * Lambang tiap jenjang, urut naik. Bentuknya sengaja **berbeda satu sama
 * lain**, bukan satu bentuk yang cuma berganti warna: kartu jenjang dibaca
 * sekilas, dan pada layar kecil warna logam (perunggu vs perak vs platinum)
 * terlalu berdekatan untuk dibedakan tanpa membandingkan berdampingan.
 *
 * Kunci tabelnya `tier` (angka), bukan `nama` — nama jenjang tersimpan di DB
 * dan bisa diganti superadmin tanpa memberi tahu kode ini.
 */
const LAMBANG: Record<number, { d: string; warna: string }> = {
  0: { d: 'M12 21v-7M12 14c-3 0-5-2-5-5 3 0 5 2 5 5zM12 14c0-3 2-5 5-5 0 3-2 5-5 5z', warna: 'var(--text3)' },
  1: { d: 'M8 3l4 6 4-6M12 21a5.5 5.5 0 100-11 5.5 5.5 0 000 11z', warna: '#b87333' },
  2: { d: 'M12 3l7 3v6c0 4-3 7-7 9-4-2-7-5-7-9V6z', warna: '#9aa3ad' },
  3: { d: 'M4 8l3.5 3L12 5l4.5 6L20 8l-1.5 10h-13z', warna: 'var(--amber)' },
  4: { d: 'M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z', warna: '#8fa8b8' },
  5: { d: 'M6 3h12l3 6-9 12L3 9zM3 9h18M9 3L6 9M15 3l3 6', warna: '#6fd3e6' },
}

/** Lambang satu jenjang — dipakai tangga di bawah dan bisa dipakai sendiri
 *  (mis. di samping nama penyetor) tanpa membawa seluruh tangganya. Warnanya
 *  dipasang lewat `color` induk karena `.dasbor-ikon` memakai
 *  `stroke: currentColor`. */
export function IkonJenjang({ tier, size = 16 }: { tier: number; size?: number }) {
  const l = LAMBANG[tier] ?? LAMBANG[0]
  return (
    <span style={{ color: l.warna, display: 'inline-flex' }}>
      <IkonMenu d={l.d} size={size} />
    </span>
  )
}

/** Syarat naik ke satu jenjang, dalam satu kalimat pendek untuk tooltip. */
function syarat(j: JenjangRow): string {
  if (j.tier === 0) return 'Jenjang awal — tanpa syarat.'
  const akurasi = j.min_akurasi ? `, akurasi ≥ ${j.min_akurasi}%` : ''
  return `Butuh ${j.min_disetujui} setoran disetujui${akurasi}.`
}

/**
 * Tangga jenjang Pemula → Diamond.
 *
 * Ada karena kartu jenjang sebelumnya cuma menyebut jenjang SEKARANG dan satu
 * langkah berikutnya — kontributor baru tak punya cara melihat ke mana
 * jalurnya bermuara, berapa kuota yang menantinya, atau hak apa yang terbuka
 * di ujung. Tiga hal itu semuanya sudah ada di tabel `jenjang`; yang kurang
 * cuma tempat menampilkannya.
 *
 * `tierSaatIni` boleh `null` untuk superadmin — tangganya tetap tampil sebagai
 * rujukan, cuma tak ada yang disorot (kuotanya memang tidak diatur jenjang).
 */
export function TanggaJenjang({ daftar, tierSaatIni }: { daftar: JenjangRow[]; tierSaatIni: number | null }) {
  if (daftar.length === 0) return null
  const urut = [...daftar].sort((a, b) => a.tier - b.tier)
  return (
    <div className="af-tangga" role="list" aria-label="Tangga jenjang kontributor">
      {urut.map((j) => {
        const lewat = tierSaatIni !== null && j.tier < tierSaatIni
        const kini = tierSaatIni !== null && j.tier === tierSaatIni
        const kelas = kini ? 'kini' : lewat ? 'lewat' : 'nanti'
        return (
          <div
            key={j.tier}
            role="listitem"
            className={`af-tangga-it ${kelas}`}
            style={{ '--tier-warna': (LAMBANG[j.tier] ?? LAMBANG[0]).warna } as Record<string, string>}
            title={`${j.nama} — ${syarat(j)} Kuota ${j.kuota}/hari.${j.hak ? ` Hak: ${j.hak}` : ''}`}
          >
            <span className="af-tangga-ikon"><IkonJenjang tier={j.tier} size={17} /></span>
            <span className="af-tangga-nama">{j.nama}</span>
            <span className="af-tangga-syarat">
              {j.tier === 0 ? 'awal' : `${j.min_disetujui} setoran`}
            </span>
            <span className="af-tangga-kuota">{j.kuota}/hari</span>
          </div>
        )
      })}
    </div>
  )
}
