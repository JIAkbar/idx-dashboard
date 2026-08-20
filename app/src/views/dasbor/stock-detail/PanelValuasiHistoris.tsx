import type { ReactNode } from 'react'
import type { StockFundamental } from '../../../lib/dasbor/stockDetailData'
import {
  LABEL_VONIS,
  MIN_TAHUN,
  rasioKini,
  ringkasRasio,
  useValuasiHistoris,
  valuasiEmiten,
  type RingkasRasio,
} from '../../../lib/dasbor/valuasiHistoris'

/** Baris label + nilai rata-kanan — bentuk yang sama dengan panel Key Stats lain. */
function TR(lbl: string, val: ReactNode) {
  return (
    <tr>
      <td>{lbl}</td>
      <td className="r">{val}</td>
    </tr>
  )
}

function fx(v: number | null | undefined): string {
  return v != null ? Number(v).toFixed(2) + 'x' : '—'
}

/**
 * Satu rasio: nilai kini, jangkar median, ambang kuartil, dan vonisnya.
 *
 * Vonis tak pernah ditebak dari riwayat pendek — kalau titiknya kurang dari
 * `MIN_TAHUN`, yang tampil alasannya, bukan kata "wajar" yang kelihatan
 * berwibawa padahal cuma hasil dari tiga angka.
 */
function BlokRasio({ nama, r }: { nama: string; r: RingkasRasio }) {
  return (
    <>
      <tr className="vh-sub">
        <td colSpan={2}>
          {nama}
          {r.vonis && <span className={`vh-vonis vh-${r.vonis}`}>{LABEL_VONIS[r.vonis]}</span>}
        </td>
      </tr>
      {TR('Sekarang', fx(r.kini))}
      {TR(
        r.n ? `Median ${r.tahunAwal}–${r.tahunAkhir} (${r.n} th)` : 'Median historis',
        fx(r.median),
      )}
      {TR('Ambang murah / mahal', r.n >= MIN_TAHUN ? `< ${fx(r.q1)} / > ${fx(r.q3)}` : '—')}
      {TR('Rentang historis', r.n ? `${fx(r.min)} – ${fx(r.max)}` : '—')}
      {r.alasan && (
        <tr>
          <td colSpan={2} className="vh-alasan">{r.alasan}</td>
        </tr>
      )}
    </>
  )
}

/**
 * Panel "Valuasi vs Sejarah" (backlog A1).
 *
 * Memberi setiap angka valuasi seorang PEMBANDING: "P/E 17x" jadi terbaca
 * relatif terhadap rentang emiten itu sendiri, bukan sebagai angka telanjang
 * yang cuma bisa dinilai oleh orang yang sudah hafal sektornya.
 *
 * Deret & rumus ambangnya di `lib/dasbor/valuasiHistoris.ts` — termasuk alasan
 * kenapa jangkarnya median, kenapa ambangnya kuartil emiten itu sendiri, dan
 * kenapa riwayat pendek tak diberi vonis.
 *
 * Rasio "Sekarang" DIHITUNG ULANG di sini dari harga terkini dan laba/ekuitas
 * tahun buku terakhir, bukan diambil dari `fd.pe`/`fd.pb` yfinance. `fd.pe` itu
 * P/E TTM dengan definisi laba yang berbeda; membandingkannya dengan deret yang
 * dibangun dari laporan tahunan bursa akan menampilkan selisih DEFINISI sebagai
 * kalau-kalau perubahan valuasi.
 */
export function PanelValuasiHistoris({ fd }: { fd: StockFundamental }) {
  const daftar = useValuasiHistoris()
  const deret = valuasiEmiten(daftar, fd.ticker)

  if (!deret) {
    return (
      <div className="panel">
        <div className="panel-h"><span className="lbl">Valuasi vs Sejarah</span></div>
        <div className="panel-b">
          <p className="vh-alasan">
            {daftar
              ? 'Belum tersedia — riwayat laporan tahunan emiten ini belum cukup untuk membangun deret valuasi.'
              : 'Memuat…'}
          </p>
        </div>
      </div>
    )
  }

  const harga = fd.last_price ?? null
  const pe = ringkasRasio(deret.pe, rasioKini(harga, deret.eps_dasar))
  const pb = ringkasRasio(deret.pb, rasioKini(harga, deret.bv_dasar))

  return (
    <div className="panel">
      <div className="panel-h"><span className="lbl">Valuasi vs Sejarah</span></div>
      <div className="panel-b">
        <table>
          <tbody>
            <BlokRasio nama="P/E" r={pe} />
            <BlokRasio nama="P/BV" r={pb} />
          </tbody>
        </table>
        <p className="vh-alasan">
          Ambangnya kuartil 25/75 dari sebaran emiten ini sendiri, bukan angka baku lintas
          sektor. Dasar laba &amp; ekuitas: laporan tahunan resmi bursa
          {deret.tahun_terakhir ? ` s.d. tahun buku ${deret.tahun_terakhir}` : ''}.
        </p>
      </div>
    </div>
  )
}
