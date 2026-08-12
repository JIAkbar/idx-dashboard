import { useMemo } from 'react'
import type { ChartConfiguration } from 'chart.js/auto'
import { BatangPeringkat } from '../../components/dasbor/BatangPeringkat'
import { Kalender } from '../../components/dasbor/Kalender'
import { Papan } from '../../components/dasbor/Papan'
import { useDataHarian, type TanggalIndex } from '../../lib/dasbor/dataHarian'
import { hitungYtdPct } from '../../lib/dasbor/ytd'
import { fN, fp, fmtNF } from '../../lib/dasbor/format'
import { useChartCanvas } from '../../lib/dasbor/useChartJs'
import { useTheme } from '../../context/ThemeContext'
import { IkonMenu, IKON_PERINGATAN, IKON_GLOBE, IKON_PENGGARIS, IKON_GRAFIK_BATANG } from '../../components/dasbor/IkonMenu'

/**
 * Grafik mini board-side (Fix #27) — pakai tanggalTersedia (data/index.json)
 * yang SUDAH berisi seri ihsg per hari bursa tahun berjalan, tidak perlu
 * fetch tambahan. Komponen TERPISAH dari IndeksDunia (pola sama dengan
 * Flow.tsx/Quadrant.tsx) sengaja: IndeksDunia punya early-return
 * loading/error SEBELUM kanvas ini dipasang ke DOM — kalau hook chart
 * dipanggil langsung di IndeksDunia, render pertama yang config-nya
 * terisi terjadi SAAT kanvas belum ada di DOM (masih cabang loading),
 * lalu saat kanvas akhirnya terpasang, dependency [config] sudah sama
 * (referensi tak berubah) jadi effect tidak jalan ulang — chart tak
 * pernah kebentuk. Mount sebagai komponen baru di sini menghindari itu:
 * render pertamanya sudah pasti kanvas ADA sekaligus config terisi.
 */
function IhsgYtdChart({ dates }: { dates: TanggalIndex[] }) {
  const { theme } = useTheme()

  const config = useMemo<ChartConfiguration<'line', number[], string> | null>(() => {
    if (dates.length === 0) return null
    const isDark = theme === 'dark'
    const amber = isDark ? '#F0A62B' : '#B87A10'
    const amberFill = isDark ? 'rgba(240,166,43,.22)' : 'rgba(184,122,16,.16)'
    return {
      type: 'line',
      data: {
        labels: dates.map((d) => d.date_id),
        datasets: [{
          data: dates.map((d) => d.ihsg),
          borderColor: amber,
          backgroundColor: amberFill,
          borderWidth: 1.8,
          pointRadius: 0,
          fill: true,
          tension: 0.15,
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: { callbacks: { label: (ctx) => `IHSG: ${fN(ctx.parsed.y)}` } },
        },
        scales: { x: { display: false }, y: { display: false } },
      },
    }
  }, [dates, theme])
  const canvasRef = useChartCanvas(config)

  return (
    <div className="board-side">
      <span className="lbl" style={{ display: 'block', marginBottom: 6 }}>IHSG — Tahun Berjalan</span>
      {/* canvas dipaksa display:block+width:100% LEWAT STYLE (bukan andalkan
          Chart.js) — .board-side flex item, canvas default-nya display:inline
          lebar intrinsik 300px; kalau Chart.js sempat baca lebar container
          SEBELUM browser reflow ulang gara-gara canvas inline itu, elemen
          kebaca 300px dan macet di situ (tinggi ikut kanvas resize kanan,
          lebar tidak). Kuncian native CSS ini motong akar masalahnya. */}
      <div className="chart-wrap" style={{ height: 120 }}>
        <canvas ref={canvasRef} style={{ display: 'block', width: '100%', height: '100%' }} />
      </div>
    </div>
  )
}

/**
 * Panel "Indeks Dunia" — port buildWorldPanel() index_live.html baris
 * 2740-2836, bergaya papan "Lantai Bursa"
 * (docs/design-lantai-bursa-reimagined.html baris 368-493).
 *
 * Blok dan urutannya beku; yang berubah hanya lapisan tampilan. Dua
 * pengecualian yang tertulis eksplisit di rencana: papan flap IHSG di kepala
 * halaman (spec §4.12, angka IHSG pindah dari panji hijau lama) dan Peringkat
 * YTD yang berhenti memakai kanvas berlabel miring.
 */
export function IndeksDunia() {
  const { tanggalTersedia, hari, tanggalAktif, pilihTanggal, loading, error } = useDataHarian()

  const world = hari?.world ?? []

  if (loading && !hari) {
    return (
      <div className="lantai">
        <Kalender tanggalTersedia={tanggalTersedia} tanggalAktif={tanggalAktif} onPilih={pilihTanggal} />
        <div className="panel panel-b" style={{ textAlign: 'center', padding: '40px 20px' }}>
          <p style={{ fontSize: 28 }}>⏳</p>
          <p className="lbl">Memuat data...</p>
        </div>
      </div>
    )
  }

  if (error || !hari) {
    return (
      <div className="lantai">
        <Kalender tanggalTersedia={tanggalTersedia} tanggalAktif={tanggalAktif} onPilih={pilihTanggal} />
        <div className="panel panel-b" style={{ textAlign: 'center', padding: '40px 20px' }}>
          <p><IkonMenu d={IKON_PERINGATAN} size={28} /></p>
          <p className="lbl">Data tidak tersedia untuk tanggal ini</p>
        </div>
      </div>
    )
  }

  const naik = hari.ihsg_pct >= 0
  const ytdPct = hitungYtdPct(hari.ihsg_value, tanggalTersedia)
  // Perubahan poin dihitung dari ihsg_prev, bukan dibaca dari ihsg_change:
  // ruas itu bolong di 38 dari 93 berkas harian (lihat dataHarian.ts).
  const delta = hari.ihsg_prev == null ? null : hari.ihsg_value - hari.ihsg_prev
  // Ruas hilang tampil "—", bukan 0 — nol terbaca seperti angka nyata.
  const meta: [string, string][] = [
    ['Volume', hari.vol_today == null ? '—' : `${fN(hari.vol_today, 0)} Jt lbr`],
    ['Nilai', hari.val_idr_today == null ? '—' : `${fN(hari.val_idr_today, 0)} M IDR`],
    ['Frekuensi', hari.freq_today == null ? '—' : `${fN(hari.freq_today, 0)} Rb kali`],
    ['Kapitalisasi', hari.mcap_idr == null ? '—' : `${fN(hari.mcap_idr, 0)} T IDR`],
    ['USD/IDR BI', hari.usd_idr == null ? '—' : fN(hari.usd_idr, 0)],
  ]
  const indonesia = world.find((w) => w.is_idx)

  let curR = ''

  return (
    <div className="lantai">
      <div className="board">
        <div className="board-main">
          <span className="lbl">
            Indeks Harga Saham Gabungan · {hari.date_id} · hari bursa ke-{hari.trading_day}
          </span>
          <Papan nilai={hari.ihsg_value} />
          <div style={{ marginTop: 12, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <span className={`chip ${naik ? 'up' : 'dn'}`}>
              {naik ? '▲' : '▼'} {delta === null ? '' : `${fN(delta)} `}({fp(hari.ihsg_pct)})
            </span>
            {/* YTD dulu selalu +0,00% karena dibaca dari ruas ihsg_ytd yang tak
                pernah ada; sekarang dihitung dari index.json — dan kalau tidak
                bisa dihitung, tampil "—" bukan nol. */}
            <span className={`chip${ytdPct === null ? '' : ytdPct >= 0 ? ' up' : ' dn'}`}>
              YTD {ytdPct === null ? '—' : fp(ytdPct)}
            </span>
            {hari.ihsg_high != null && hari.ihsg_low != null && (
              <span className="chip warn">
                Tertinggi {fN(hari.ihsg_high)} · Terendah {fN(hari.ihsg_low)}
              </span>
            )}
          </div>
          <div className="board-meta">
            {meta.map(([label, isi]) => (
              <div className="bm" key={label}>
                <span className="lbl">{label}</span>
                <span className="num">{isi}</span>
              </div>
            ))}
          </div>
        </div>
        <IhsgYtdChart dates={tanggalTersedia} />
      </div>

      <div className="grid2 w-kiri">
        <Kalender tanggalTersedia={tanggalTersedia} tanggalAktif={tanggalAktif} onPilih={pilihTanggal} />

        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div className="panel">
            <div className="panel-h">
              <span className="lbl"><IkonMenu d={IKON_GLOBE} size={13} /> Net Foreign</span>
            </div>
            <div className="nf-grid">
              <div className="nf-cell">
                <span className="lbl">Today</span>
                <div className={`nf-sec ${(hari.nf_today_idr ?? 0) < 0 ? 'dn' : 'up'}`}>{hari.nf_today_status ?? '-'}</div>
                <div className={`num nf-big ${(hari.nf_today_idr ?? 0) < 0 ? 'dn' : 'up'}`}>{fmtNF(hari.nf_today_idr ?? 0)}</div>
                <div className="nf-unit">(billion IDR)</div>
                <div className={`num nf-sec ${(hari.nf_today_usd ?? 0) < 0 ? 'dn' : 'up'}`}>{fmtNF(hari.nf_today_usd ?? 0)}</div>
                <div className="nf-unit">(million USD~)</div>
              </div>
              <div className="nf-cell">
                <span className="lbl">YTD</span>
                <div className={`nf-sec ${(hari.nf_ytd_idr ?? 0) < 0 ? 'dn' : 'up'}`}>{hari.nf_ytd_status ?? '-'}</div>
                <div className={`num nf-big ${(hari.nf_ytd_idr ?? 0) < 0 ? 'dn' : 'up'}`}>{fmtNF(hari.nf_ytd_idr ?? 0)}</div>
                <div className="nf-unit">(billion IDR)</div>
                <div className={`num nf-sec ${(hari.nf_ytd_usd ?? 0) < 0 ? 'dn' : 'up'}`}>{fmtNF(hari.nf_ytd_usd ?? 0)}</div>
                <div className="nf-unit">(million USD)</div>
              </div>
            </div>
          </div>

          {/* flex:1 (Fix #23) — .grid2.w-kiri menyamakan tinggi kolom kanan
              dgn Kalender (kolom terpanjang); tanpa ini sisa ruang di bawah
              kartu ini kosong tak berbingkai. nf-grid ikut flex + align-items
              center biar PER/PBV tidak nempel di atas saat kartu melar. */}
          <div className="panel" style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
            <div className="panel-h">
              <span className="lbl"><IkonMenu d={IKON_PENGGARIS} size={13} /> Market Fundamental</span>
              <span className="num" style={{ fontSize: 11, color: 'var(--text3)' }}>
                ~ USD/IDR BI = {hari.usd_idr == null ? '—' : fN(hari.usd_idr, 0)}
              </span>
            </div>
            <div className="nf-grid" style={{ flex: 1, alignItems: 'center' }}>
              <div className="nf-cell" style={{ textAlign: 'center' }}>
                <span className="lbl">Market PER (x)</span>
                <div className="num mf-big">{(hari.mkt_per ?? 0).toFixed(2)}</div>
              </div>
              <div className="nf-cell" style={{ textAlign: 'center' }}>
                <span className="lbl">Market PBV (x)</span>
                <div className="num mf-big">{(hari.mkt_pbv ?? 0).toFixed(2)}</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="panel">
        <div className="panel-h">
          <span className="lbl"><IkonMenu d={IKON_GRAFIK_BATANG} size={13} /> Average Daily Trading (YTD)</span>
        </div>
        <div className="adt">
          <div className="adt-c">
            <span className="lbl">Avg. Volume</span>
            <div className="num adt-v">{fN(hari.avg_vol, 0)}<span className="adt-u">Jt Lbr</span></div>
          </div>
          <div className="adt-c">
            <span className="lbl">Avg. Value</span>
            <div className="num adt-v">{fN(hari.avg_val_idr, 0)}<span className="adt-u">B IDR</span></div>
            <div className="num adt-s">{fN(hari.avg_val_usd, 0)} Jt USD</div>
          </div>
          <div className="adt-c">
            <span className="lbl">Avg. Frequency</span>
            <div className="num adt-v">{fN(hari.avg_freq, 0)}<span className="adt-u">Rb Kali</span></div>
          </div>
        </div>
      </div>

      <div className="panel">
        <div className="panel-h">
          <span className="lbl">YTD Ranking — Semua Negara (Indonesia disorot merah)</span>
        </div>
        <BatangPeringkat baris={world.map((w) => ({ nama: w.c, nilai: w.ytd }))} sorot={indonesia?.c} />
      </div>

      <div className="panel">
        {/* Jumlah negara dihitung dari data, bukan ditulis tetap: judul lama
            berbunyi "36 Negara" padahal berkas harian berisi 35 baris. */}
        <div className="panel-h">
          <span className="lbl">Perbandingan Indeks Dunia — {world.length} Negara ({hari.date_id})</span>
        </div>
        <div className="board-tbl-wrap">
          <table className="tbl w-tbl">
            <thead>
              <tr>
                <th>Negara</th><th>Indeks</th><th className="r">Nilai</th>
                <th className="r">Hari Ini</th><th className="r">YTD</th>
                <th className="r">A</th><th className="r">AP</th><th className="r">W</th>
              </tr>
            </thead>
            <tbody>
              {world.flatMap((w) => {
                const rows = []
                if (w.r !== curR) {
                  curR = w.r
                  rows.push(<tr key={`r-${w.r}`} className="kawasan"><td colSpan={8}>{w.r}</td></tr>)
                }
                rows.push(
                  <tr key={`${w.r}-${w.c}`} className={w.is_idx ? 'kita' : ''}>
                    <td>{w.c}</td>
                    <td className="rk">{w.idx}</td>
                    <td className="r num">{fN(w.v)}</td>
                    <td className={`r num ${w.d >= 0 ? 'up' : 'dn'}`}>{fp(w.d)}</td>
                    <td className="r">
                      <span className={`ytd-bdg ${w.ytd >= 0 ? 'u' : 'd'}`}>{fp(w.ytd)}</span>
                    </td>
                    <td className="r rk">{w.ra ?? '-'}</td>
                    <td className="r rk">{w.rap ?? '-'}</td>
                    <td className="r rk">{w.rw ?? '-'}</td>
                  </tr>,
                )
                return rows
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
