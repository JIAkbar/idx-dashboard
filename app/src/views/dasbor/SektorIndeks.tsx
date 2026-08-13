import { useMemo, useState } from 'react'
import { BatangPeringkat } from '../../components/dasbor/BatangPeringkat'
import { Kalender } from '../../components/dasbor/Kalender'
import { useDataHarian, useDataPembanding } from '../../lib/dasbor/dataHarian'
import { cariTanggalPembanding, hitungPeriodePct } from '../../lib/dasbor/periode'
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
 * 2970-3023, bergaya papan "Lantai Bursa"
 * (docs/design-lantai-bursa-reimagined.html baris 582-598, 240-256).
 *
 * Dua pengecualian struktur-beku yang tertulis eksplisit di rencana (spec
 * §4.4, pola sama dengan Peringkat YTD di IndeksDunia.tsx): kedua chart
 * Chart.js ("Sektor — YTD vs Hari Ini" & "YTD — Perbandingan Semua Indeks
 * Utama") diganti BatangPeringkat, dan tabel Performa Sektor mendapat
 * pemilih periode (Hari Ini/1 Bulan/3 Bulan/YTD) yang mengganti kolom
 * "Hari Ini"+"YTD" tetap jadi SATU kolom persen dinamis — kalau tidak,
 * pemilih periode tidak mengubah apa pun yang terlihat. Indeks Unggulan,
 * Indeks Syariah, dan Board Indices TIDAK dapat pemilih ini (keputusan
 * backlog B1) dan kolomnya tetap Nilai+Hari Ini+YTD seperti semula.
 */
export function SektorIndeks() {
  const { tanggalTersedia, hari, tanggalAktif, pilihTanggal, loading, error } = useDataHarian()
  const [periode, setPeriode] = useState<PeriodeId>('d')

  const tanggalPembanding = useMemo(() => {
    if ((periode !== 'm1' && periode !== 'm3') || !tanggalAktif) return null
    return cariTanggalPembanding(tanggalTersedia, tanggalAktif, HARI_MUNDUR[periode])
  }, [periode, tanggalAktif, tanggalTersedia])

  // Hooks dipanggil tanpa syarat sebelum return dini loading/error (Rules of
  // Hooks) — pola sama dengan SektorIndeks.tsx versi lama & TopStocks.tsx.
  const { data: pembanding } = useDataPembanding(tanggalPembanding?.stem ?? null)

  if (loading && !hari) {
    return (
      <div className="lantai">
        <Kalender varian="strip" tanggalTersedia={tanggalTersedia} tanggalAktif={tanggalAktif} onPilih={pilihTanggal} />
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
        <Kalender varian="strip" tanggalTersedia={tanggalTersedia} tanggalAktif={tanggalAktif} onPilih={pilihTanggal} />
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

  // Urutan baris beku (sama dengan versi lama): berdasar "Hari Ini" naik,
  // TIDAK ikut berubah waktu pemilih periode diganti.
  const secRows = [...sectors].sort((a, b) => a.d - b.d)

  const periodeLabel = PERIODE.find((p) => p.id === periode)!.label

  function nilaiPeriode(x: SectorRow): number | null {
    if (periode === 'd') return x.d
    if (periode === 'ytd') return x.ytd
    if (!tanggalPembanding) return null
    const cmp = pembanding?.sectors?.find((s) => s.n === x.n)?.v
    return hitungPeriodePct(x.v, cmp)
  }

  // Baris tabel 4-kolom (Nama | Nilai | Hari Ini | YTD) — dipakai Indeks
  // Unggulan/Syariah/Board Indices, struktur beku, TIDAK dipakai tabel sektor.
  const perfRowFull = (x: SectorRow) => (
    <tr key={x.n}>
      <td>{x.n}</td>
      <td className="r num muted">{fN(x.v)}</td>
      <td className={`r num ${x.d >= 0 ? 'up' : 'dn'}`}>{fp(x.d)}</td>
      <td className="r"><span className={`ytd-bdg ${x.ytd >= 0 ? 'u' : 'd'}`}>{fp(x.ytd)}</span></td>
    </tr>
  )

  const indeksUtama = [...featured, ...sharia]
  const sorotUtama = indeksUtama.find((x) => x.n.includes('IDX Composite') || x.n.includes('IHSG'))?.n

  return (
    <div className="lantai">
      <Kalender varian="strip" tanggalTersedia={tanggalTersedia} tanggalAktif={tanggalAktif} onPilih={pilihTanggal} />

      <div className="tiles">
        {sectors.map((s) => {
          const kode = s.n.match(/^\[(.)\]/)?.[1] ?? ''
          const nama = s.n.replace(/^\[.\] /, '')
          const naik = s.d >= 0
          // Intensitas warna: port rumus tile artifact lama (design-lantai-
          // bursa-reimagined.html baris 980) — alpha 0,06-0,38 sebanding |d|,
          // dijenuhkan di 2,2%. --green/--red sudah ikut tema via lantai.css.
          const alpha = Math.min(Math.abs(s.d) / 2.2, 1) * 0.32 + 0.06
          return (
            <div
              key={s.n}
              className="tile"
              style={{ background: `color-mix(in srgb, var(${naik ? '--green' : '--red'}) ${(alpha * 100).toFixed(0)}%, transparent)` }}
            >
              <span className="t-code">{kode}</span>
              <span className="t-name">{nama}</span>
              <span className={`t-val ${naik ? 'up' : 'dn'}`}>{fp(s.d)}</span>
            </div>
          )
        })}
      </div>

      <div className="panel">
        <div className="panel-h">
          <span className="lbl"><IkonMenu d={IKON_GRAFIK_BATANG} size={13} /> Performa Sektor</span>
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
        </div>
        <div className="board-tbl-wrap">
          <table className="tbl">
            <thead><tr><th>Sektor</th><th className="r">Nilai Indeks</th><th className="r">{periodeLabel}</th></tr></thead>
            <tbody>
              {secRows.map((s) => {
                const val = nilaiPeriode(s)
                return (
                  <tr key={s.n}>
                    <td>{s.n}</td>
                    <td className="r num muted">{fN(s.v)}</td>
                    <td className="r">
                      {val === null
                        ? <span className="muted">—</span>
                        : <span className={`ytd-bdg ${val >= 0 ? 'u' : 'd'}`}>{fp(val)}</span>}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div className="panel">
        <div className="panel-h"><span className="lbl">Sektor — YTD vs Hari Ini</span></div>
        <BatangPeringkat baris={sectors.map((s) => ({ nama: s.n.replace(/\[.\] /, ''), nilai: s.ytd }))} />
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
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div className="panel" style={{ flex: 1 }}>
            <div className="panel-h"><span className="lbl"><IkonMenu d={IKON_BULAN_SABIT} size={13} /> Indeks Syariah</span></div>
            <div className="board-tbl-wrap">
              <table className="tbl">
                <thead><tr><th>Indeks</th><th className="r">Nilai</th><th className="r">Hari Ini</th><th className="r">YTD</th></tr></thead>
                <tbody>{sharia.map((x) => perfRowFull(x))}</tbody>
              </table>
            </div>
          </div>
          <div className="panel" style={{ flex: 1 }}>
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
        </div>
      </div>

      <div className="panel">
        <div className="panel-h"><span className="lbl">YTD — Perbandingan Semua Indeks Utama</span></div>
        <BatangPeringkat baris={indeksUtama.map((x) => ({ nama: x.n, nilai: x.ytd }))} sorot={sorotUtama} />
      </div>
    </div>
  )
}
