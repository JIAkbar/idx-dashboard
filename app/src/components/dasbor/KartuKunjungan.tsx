import { useEffect, useState } from 'react'
import type { ExtendedFeatureCollection } from 'd3'
import { BATAS_KUNJUNGAN, MULAI_NEGARA, namaNegara, ringkasNegara, useKunjungan, type AngkaKunjungan } from '../../lib/dasbor/kunjungan'

/**
 * Kartu "Pengunjung" (#112 A, Johan 8 Sep 2026: "sudah kmu pasang soal setiap
 * hari pengunjung PAPAN berapa orang ?") + sebaran negara (#213, Johan 22 Sep
 * 2026: "publik, kartu beranda, boleh unduh. kerjakan #213").
 *
 * Dua aturan yang membentuk komponen ini:
 *
 * 1. **Angkanya disertai batasnya.** "Unik per hari" di sini perangkat +
 *    jaringan, bukan orang — dan angka pengunjung adalah jenis angka yang
 *    paling gampang dibaca lebih besar daripada yang sebenarnya diukur. Batas
 *    itu tinggal di `lib/dasbor/kunjungan.ts` supaya dua tempat yang kelak
 *    menampilkannya tak bisa menjelaskan dengan dua cara berbeda.
 * 2. **Gagal = tak tampil.** Kalau endpoint diam (503, jaringan putus, pagar
 *    laju), kartunya HILANG, bukan menampilkan nol. Nol yang dikarang lebih
 *    buruk daripada tak ada angka — dan di halaman yang seluruh isinya angka
 *    terukur, satu nol palsu meracuni yang lain.
 */
export function KartuKunjungan() {
  const k = useKunjungan()
  if (!k) return null
  const f = (n: number) => n.toLocaleString('id-ID')
  return (
    <div className="kjg" title={BATAS_KUNJUNGAN}>
      <span className="kjg-l">Pengunjung</span>
      <span className="kjg-a num">{f(k.hari_ini)}</span>
      <span className="kjg-s">hari ini</span>
      <span className="kjg-p" aria-hidden="true">·</span>
      <span className="kjg-a num">{f(k.bulan_ini)}</span>
      <span className="kjg-s">bulan ini</span>
      <span className="kjg-s kjg-batas">unik per perangkat + jaringan, bukan orang</span>
      {k.negara && <SebaranNegara negara={k.negara} />}
    </div>
  )
}

const LEBAR = 960
const TINGGI = 470
const TGL_MULAI = new Date(`${MULAI_NEGARA}T00:00:00`).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })

function SebaranNegara({ negara }: { negara: NonNullable<AngkaKunjungan['negara']> }) {
  const baris = ringkasNegara(negara.daftar)
  const diketahui = baris.reduce((a, b) => a + b.n, 0)
  const pct = (x: number) => x.toLocaleString('id-ID', { maximumFractionDigits: 1, minimumFractionDigits: 1 })
  return (
    <div className="kjg-negara">
      <PetaKunjungan daftar={negara.daftar} />
      <div className="kjg-daftar-wrap">
        <div className="kjg-sub">
          Negara pengunjung sejak {TGL_MULAI}
          {diketahui > 0 && <> · {diketahui.toLocaleString('id-ID')} kunjungan</>}
        </div>
        {baris.length ? (
          <ol className="kjg-daftar">
            {baris.map((b) => (
              <li key={b.kode || 'lain'}>
                <span className="kjg-nm">{b.nama}</span>
                <span className="num">{b.n.toLocaleString('id-ID')}</span>
                <span className="num kjg-pct">{pct(b.persen)}%</span>
              </li>
            ))}
          </ol>
        ) : (
          <p className="kjg-kosong-teks">Belum ada kunjungan yang negaranya tercatat.</p>
        )}
        <p className="kjg-batas-negara">
          Negara dibaca dari jaringan pengunjung; VPN menggesernya.
          {negara.tak_diketahui > 0 && <> {negara.tak_diketahui.toLocaleString('id-ID')} kunjungan sebelum {TGL_MULAI} tak punya catatan negara.</>}
        </p>
      </div>
    </div>
  )
}

/** Peta dunia satu rona. Batas negara (Natural Earth 110m, domain publik) dan
 *  pustaka proyeksi dimuat malas, jadi halaman depan tak menunggunya. */
function PetaKunjungan({ daftar }: { daftar: { kode: string; n: number }[] }) {
  const [jalur, setJalur] = useState<{ id: string | null; d: string }[] | null>(null)
  useEffect(() => {
    let batal = false
    Promise.all([
      fetch('/peta/negara-110m.json').then((r) => (r.ok ? (r.json() as Promise<ExtendedFeatureCollection>) : null)),
      import('d3'),
    ])
      .then(([fc, d3]) => {
        if (batal || !fc) return
        const jalan = d3.geoPath(d3.geoNaturalEarth1().fitSize([LEBAR, TINGGI], fc))
        setJalur(fc.features.map((ft) => ({ id: (ft.id as string | null) ?? null, d: jalan(ft) ?? '' })))
      })
      .catch(() => {})
    return () => { batal = true }
  }, [])
  const n = new Map(daftar.map((d) => [d.kode, d.n]))
  const maks = Math.max(1, ...daftar.map((d) => d.n))
  return (
    <svg className="kjg-peta" viewBox={`0 0 ${LEBAR} ${TINGGI}`} role="img" aria-label="Peta sebaran negara pengunjung">
      {jalur?.map((j, i) => {
        const v = j.id ? n.get(j.id) : undefined
        return (
          <path key={i} d={j.d} className={v ? 'kjg-ada' : 'kjg-tanah'}
            style={v ? { fillOpacity: 0.3 + 0.7 * Math.sqrt(v / maks) } : undefined}>
            {j.id && <title>{`${namaNegara(j.id)}: ${(v ?? 0).toLocaleString('id-ID')} kunjungan`}</title>}
          </path>
        )
      })}
    </svg>
  )
}
