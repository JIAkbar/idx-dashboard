import { IkonJenjang, warnaJenjang } from './IkonJenjang'
import type { JenjangRow } from '../../lib/jenjang'

// Lencananya memakai `IkonJenjang` yang sudah ada (medali bertakik, satu takik
// per tier). Sempat digambar ulang di sini sebagai enam bentuk berbeda —
// dibuang: lencana jenjang sudah punya satu sumber bentuk, dan dua himpunan
// lambang untuk konsep yang sama akan menyimpang begitu salah satunya diubah.

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
      {urut.map((j, i) => {
        const lewat = tierSaatIni !== null && j.tier < tierSaatIni
        const kini = tierSaatIni !== null && j.tier === tierSaatIni
        const kelas = kini ? 'kini' : lewat ? 'lewat' : 'nanti'
        return (
          <div
            key={j.tier}
            role="listitem"
            className={`af-tangga-it ${kelas}`}
            style={{
              '--tier-warna': warnaJenjang(j.tier),
              '--i': String(i),
            } as Record<string, string>}
            title={`${j.nama} — ${syarat(j)} Kuota ${j.kuota}/hari.${j.hak ? ` Hak: ${j.hak}` : ''}`}
          >
            <span className="af-tangga-ikon"><IkonJenjang tier={j.tier} nama={j.nama} size={30} /></span>
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
