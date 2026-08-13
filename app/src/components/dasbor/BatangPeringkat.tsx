import type { CSSProperties } from 'react'
import { fp } from '../../lib/dasbor/format'

/**
 * Daftar batang mendatar divergen dari sumbu nol. Menggantikan grafik kanvas
 * berlabel miring: puluhan label diputar ~60° bertumpuk sampai tak terbaca —
 * kegagalan yang sama di Peringkat YTD 35 negara dan grafik sektor.
 *
 * Teks HTML ikut token tema otomatis, bisa disalin, dan terbaca pembaca layar;
 * label yang digambar ke kanvas tidak punya satu pun dari ketiganya.
 *
 * Port skrip artifact baris 892-908: sumbu nol diletakkan proporsional lewat
 * variabel CSS `--nol`, bukan dipaku 50%. Kalau semua nilai searah (35 negara
 * bisa positif semua), batang memakai seluruh lebar lajur, bukan separuh.
 *
 * Diurutkan menurun di dalam komponen — nomor peringkat yang dicetak di kolom
 * pertama hanya benar kalau urutannya dijamin di sini, bukan dititipkan ke
 * setiap pemanggil.
 */
export function BatangPeringkat({
  baris,
  sorot,
}: {
  /** nilai null = data tidak tersedia (#88) — tampil "—" tanpa batang, urut terbawah. */
  baris: { nama: string; nilai: number | null }[]
  sorot?: string
}) {
  const urut = [...baris].sort((a, b) => (b.nilai ?? -Infinity) - (a.nilai ?? -Infinity))
  const nilai = urut.map((b) => b.nilai).filter((v): v is number => v !== null)
  const lo = Math.min(0, ...nilai)
  const hi = Math.max(0, ...nilai)
  const rentang = hi - lo || 1
  const nol = ((0 - lo) / rentang) * 100

  return (
    <div className="rank-wrap">
      {urut.map((b, i) => {
        const positif = (b.nilai ?? 0) >= 0
        const lebar = b.nilai === null ? 0 : (Math.abs(b.nilai) / rentang) * 100
        return (
          <div className={`rk-row${b.nama === sorot ? ' kita' : ''}`} key={b.nama}>
            <span className="rk-no">{i + 1}</span>
            <span className="rk-nm" title={b.nama}>{b.nama}</span>
            <span className="rk-tr" style={{ '--nol': `${nol}%` } as CSSProperties}>
              {b.nilai !== null && (
                <i
                  className={`rk-b ${positif ? 'p' : 'n'}`}
                  style={positif ? { left: `${nol}%`, width: `${lebar}%` } : { right: `${100 - nol}%`, width: `${lebar}%` }}
                />
              )}
            </span>
            {b.nilai === null
              ? <span className="rk-v">—</span>
              : <span className={`rk-v ${positif ? 'up' : 'dn'}`}>{fp(b.nilai)}</span>}
          </div>
        )
      })}
    </div>
  )
}
