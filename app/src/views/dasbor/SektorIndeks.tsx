import { useMemo, useState, type CSSProperties } from 'react'
import { BatangPeringkat } from '../../components/dasbor/BatangPeringkat'
import { Kalender, fmtTanggalPendek } from '../../components/dasbor/Kalender'
import { useDataHarian, useDataPembanding } from '../../lib/dasbor/dataHarian'
import { cariTanggalPembanding, hitungPeriodePct, type RentangTanggal } from '../../lib/dasbor/periode'
import { fN, fp } from '../../lib/dasbor/format'
import type { SectorRow } from '../../lib/dasbor/dataHarian'
import { IkonMenu, IKON_JAM, IKON_PERINGATAN, IKON_GRAFIK_BATANG, IKON_GRAFIK_NAIK, IKON_BULAN_SABIT, IKON_KOTAK_ARSIP } from '../../components/dasbor/IkonMenu'

type PeriodeId = 'd' | 'm1' | 'm3' | 'ytd'

const PERIODE: { id: PeriodeId; label: string }[] = [
  { id: 'd', label: 'Hari Ini' },
  { id: 'm1', label: '1 Bulan' },
  { id: 'm3', label: '3 Bulan' },
  { id: 'ytd', label: 'YTD' },
]

const HARI_MUNDUR: Record<'m1' | 'm3', number> = { m1: 30, m3: 91 }

/**
 * Panel "Sektor & Indeks" — port buildSectorPanel() index_live.html baris
 * 2970-3023, bergaya papan "Lantai Bursa".
 *
 * Task #75 — dua perombakan sekaligus:
 *
 * 1. MODE RENTANG (via Kalender strip): % perubahan nilai indeks tiap sektor
 *    titik-awal vs titik-akhir rentang (`sectors[].v`, reuse useDataPembanding
 *    untuk berkas titik-awal — cuma 2 fetch, bukan multi). Heatmap tile +
 *    daftar performa ikut, label jujur "Perf 3 Agu – 12 Agu". Saat rentang
 *    aktif, tab periode disembunyikan (rentang menggantikan perannya).
 *
 * 2. RE-LAYOUT (feedback user "tabel-tabel gak rapi"):
 *    (a) Tabel "Performa Sektor" 11 baris full-width → daftar kompak
 *        .rank-wrap 2 kolom (±6+5 berdampingan di desktop, 1 kolom mobile)
 *        dengan bar mini divergen + badge persen; kolom Nilai Indeks tetap.
 *        Urutan menurun sesuai nilai periode terpilih (dulu beku by hari-ini).
 *    (b) Panel "Sektor — YTD vs Hari Ini" DIHAPUS — redundan: tab YTD di
 *        Performa Sektor (yang sekarang juga pakai bar) menampilkan data yang
 *        persis sama.
 *    (c) Indeks Unggulan | Indeks Syariah kini grid 2 kolom sejajar; Board
 *        Indices dipasangkan dengan panel "YTD — Perbandingan Semua Indeks
 *        Utama" di baris grid berikutnya. Mobile tetap 1 kolom (grid2).
 *    (d) Kontras: kolom Nilai tidak lagi .muted (--text3) — angka penting
 *        pakai warna teks utama.
 */
export function SektorIndeks() {
  const { tanggalTersedia, hari, tanggalAktif, pilihTanggal, loading, error } = useDataHarian()
  const [periode, setPeriode] = useState<PeriodeId>('d')
  const [rentang, setRentang] = useState<RentangTanggal | null>(null)

  // Rentang dipilih → data utama pindah ke tanggal AKHIR rentang (nilai
  // indeks & tile dihitung akhir vs awal).
  function gantiRentang(r: RentangTanggal | null) {
    setRentang(r)
    if (r) pilihTanggal(r.akhir)
  }

  const tanggalPembanding = useMemo(() => {
    if (rentang) return tanggalTersedia.find((t) => t.date_iso === rentang.mulai) ?? null
    if ((periode !== 'm1' && periode !== 'm3') || !tanggalAktif) return null
    return cariTanggalPembanding(tanggalTersedia, tanggalAktif, HARI_MUNDUR[periode])
  }, [rentang, periode, tanggalAktif, tanggalTersedia])

  // Hooks dipanggil tanpa syarat sebelum return dini loading/error (Rules of
  // Hooks) — pola sama dengan TopStocks.tsx.
  const { data: pembanding } = useDataPembanding(tanggalPembanding?.stem ?? null)

  if (loading && !hari) {
    return (
      <div className="lantai">
        <Kalender varian="strip" tanggalTersedia={tanggalTersedia} tanggalAktif={tanggalAktif} onPilih={pilihTanggal} onRentang={gantiRentang} rentangAktif={rentang} />
        <div className="panel panel-b" style={{ textAlign: 'center', padding: '40px 20px' }}>
          <p><IkonMenu d={IKON_JAM} size={28} /></p>
          <p className="lbl">Memuat data...</p>
        </div>
      </div>
    )
  }

  if (error || !hari) {
    return (
      <div className="lantai">
        <Kalender varian="strip" tanggalTersedia={tanggalTersedia} tanggalAktif={tanggalAktif} onPilih={pilihTanggal} onRentang={gantiRentang} rentangAktif={rentang} />
        <div className="panel panel-b" style={{ textAlign: 'center', padding: '40px 20px' }}>
          <p><IkonMenu d={IKON_PERINGATAN} size={28} /></p>
          <p className="lbl">Data tidak tersedia untuk tanggal ini</p>
        </div>
      </div>
    )
  }

  const sectors = hari.sectors ?? []
  const featured = hari.featured ?? []
  const sharia = hari.sharia ?? []
  const board = hari.board ?? []

  const labelRentang = rentang ? `Perf ${fmtTanggalPendek(rentang.mulai)} – ${fmtTanggalPendek(rentang.akhir)}` : null
  const nHariRentang = rentang
    ? tanggalTersedia.filter((t) => t.date_iso >= rentang.mulai && t.date_iso <= rentang.akhir).length
    : 0
  /** % perubahan sektor untuk periode/rentang terpilih — null = pembanding
   * belum ada/tidak ketemu, tampilkan "—" (bukan 0). */
  function nilaiPeriode(x: SectorRow): number | null {
    if (!rentang) {
      if (periode === 'd') return x.d
      if (periode === 'ytd') return x.ytd
      if (!tanggalPembanding) return null
    }
    const cmp = pembanding?.sectors?.find((s) => s.n === x.n)?.v
    return hitungPeriodePct(x.v, cmp)
  }

  // ─── Daftar Performa Sektor kompak (re-layout a) ─────────
  const secVals = sectors.map((s) => ({ s, val: nilaiPeriode(s) }))
    .sort((a, b) => (b.val ?? -Infinity) - (a.val ?? -Infinity))
  const angka = secVals.map((x) => x.val).filter((v): v is number => v !== null)
  const lo = Math.min(0, ...angka)
  const hi = Math.max(0, ...angka)
  const span = hi - lo || 1
  const nol = ((0 - lo) / span) * 100

  // Baris tabel 4-kolom (Nama | Nilai | Hari Ini | YTD) — dipakai Indeks
  // Unggulan/Syariah/Board Indices, struktur beku.
  const perfRowFull = (x: SectorRow) => (
    <tr key={x.n}>
      <td>{x.n}</td>
      <td className="r num">{fN(x.v)}</td>
      <td className={`r num ${x.d >= 0 ? 'up' : 'dn'}`}>{fp(x.d)}</td>
      <td className="r"><span className={`ytd-bdg ${x.ytd >= 0 ? 'u' : 'd'}`}>{fp(x.ytd)}</span></td>
    </tr>
  )

  const indeksUtama = [...featured, ...sharia]
  const sorotUtama = indeksUtama.find((x) => x.n.includes('IDX Composite') || x.n.includes('IHSG'))?.n

  return (
    <div className="lantai">
      <Kalender varian="strip" tanggalTersedia={tanggalTersedia} tanggalAktif={tanggalAktif} onPilih={pilihTanggal} onRentang={gantiRentang} rentangAktif={rentang} />

      {labelRentang && (
        <div className="lbl" style={{ margin: '2px 2px -8px' }}>
          Heatmap Sektor — {labelRentang} ({nHariRentang} hari bursa)
        </div>
      )}
      <div className="tiles">
        {sectors.map((s) => {
          const kode = s.n.match(/^\[(.)\]/)?.[1] ?? ''
          const nama = s.n.replace(/^\[.\] /, '')
          // Mode rentang: tile pakai % rentang (bukan harian). null = netral.
          const v = rentang ? nilaiPeriode(s) : s.d
          const naik = (v ?? 0) >= 0
          // Intensitas warna: port rumus tile artifact lama (design-lantai-
          // bursa-reimagined.html baris 980) — alpha 0,06-0,38 sebanding |v|,
          // dijenuhkan di 2,2%.
          const alpha = Math.min(Math.abs(v ?? 0) / 2.2, 1) * 0.32 + 0.06
          return (
            <div
              key={s.n}
              className="tile"
              style={{ background: v === null ? undefined : `color-mix(in srgb, var(${naik ? '--green' : '--red'}) ${(alpha * 100).toFixed(0)}%, transparent)` }}
            >
              <span className="t-code">{kode}</span>
              <span className="t-name">{nama}</span>
              <span className={`t-val ${naik ? 'up' : 'dn'}`}>{v === null ? '—' : fp(v)}</span>
            </div>
          )
        })}
      </div>

      <div className="panel">
        <div className="panel-h">
          <span className="lbl"><IkonMenu d={IKON_GRAFIK_BATANG} size={13} /> Performa Sektor</span>
          {rentang ? (
            <span className="chip warn">{labelRentang} · {nHariRentang} hari bursa</span>
          ) : (
            <div className="tabs" role="tablist" aria-label="Periode Performa Sektor">
              {PERIODE.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  role="tab"
                  aria-selected={periode === p.id}
                  className={'tab' + (periode === p.id ? ' on' : '')}
                  onClick={() => setPeriode(p.id)}
                >
                  {p.label}
                </button>
              ))}
            </div>
          )}
        </div>
        {/* Daftar kompak 2 kolom (re-layout a): nama | nilai indeks | bar mini
            | badge %. Sumbu nol proporsional, pola BatangPeringkat. */}
        <div className="rank-wrap">
          {secVals.map(({ s, val }) => {
            const positif = (val ?? 0) >= 0
            const lebar = val === null ? 0 : (Math.abs(val) / span) * 100
            return (
              <div className="rk-row sek" key={s.n}>
                <span className="rk-nm" title={s.n}>{s.n.replace(/^\[.\] /, '')}</span>
                <span className="rk-nv num" title="Nilai indeks">{fN(s.v)}</span>
                <span className="rk-tr" style={{ '--nol': `${nol}%` } as CSSProperties}>
                  {val !== null && (
                    <i
                      className={`rk-b ${positif ? 'p' : 'n'}`}
                      style={positif ? { left: `${nol}%`, width: `${lebar}%` } : { right: `${100 - nol}%`, width: `${lebar}%` }}
                    />
                  )}
                </span>
                {val === null
                  ? <span className="rk-v">—</span>
                  : <span className={`ytd-bdg ${positif ? 'u' : 'd'}`}>{fp(val)}</span>}
              </div>
            )
          })}
        </div>
      </div>

      <div className="grid2">
        <div className="panel">
          <div className="panel-h"><span className="lbl"><IkonMenu d={IKON_GRAFIK_NAIK} size={13} /> Indeks Unggulan</span></div>
          <div className="board-tbl-wrap">
            <table className="tbl">
              <thead><tr><th>Indeks</th><th className="r">Nilai</th><th className="r">Hari Ini</th><th className="r">YTD</th></tr></thead>
              <tbody>{featured.map((x) => perfRowFull(x))}</tbody>
            </table>
          </div>
        </div>
        <div className="panel">
          <div className="panel-h"><span className="lbl"><IkonMenu d={IKON_BULAN_SABIT} size={13} /> Indeks Syariah</span></div>
          <div className="board-tbl-wrap">
            <table className="tbl">
              <thead><tr><th>Indeks</th><th className="r">Nilai</th><th className="r">Hari Ini</th><th className="r">YTD</th></tr></thead>
              <tbody>{sharia.map((x) => perfRowFull(x))}</tbody>
            </table>
          </div>
        </div>
      </div>

      <div className="grid2">
        <div className="panel">
          <div className="panel-h"><span className="lbl"><IkonMenu d={IKON_KOTAK_ARSIP} size={13} /> Board Indices</span></div>
          <div className="board-tbl-wrap">
            <table className="tbl">
              <thead><tr><th>Board</th><th className="r">Nilai</th><th className="r">Hari Ini</th><th className="r">YTD</th></tr></thead>
              <tbody>
                {board.map((x) => perfRowFull({
                  ...x,
                  n: x.n.replace('Main Board', 'Papan Utama').replace('Development Board', 'Papan Pengembangan').replace('Acceleration Board', 'Papan Akselerasi'),
                }))}
              </tbody>
            </table>
          </div>
        </div>
        <div className="panel">
          <div className="panel-h"><span className="lbl">YTD — Perbandingan Semua Indeks Utama</span></div>
          <BatangPeringkat baris={indeksUtama.map((x) => ({ nama: x.n, nilai: x.ytd }))} sorot={sorotUtama} />
        </div>
      </div>
    </div>
  )
}
