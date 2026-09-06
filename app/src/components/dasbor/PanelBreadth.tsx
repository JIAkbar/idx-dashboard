import { useMemo, useRef, useState } from 'react'
import type { ChartConfiguration } from 'chart.js/auto'
import { useDataHarian, useDataRentang } from '../../lib/dasbor/dataHarian'
import { hitungBreadth, susunHistoriBreadth, type Breadth } from '../../lib/dasbor/breadth'
import { PRESET_RENTANG, rentangPreset, type PresetRentang } from '../../lib/dasbor/periode'
import { useChartCanvas } from '../../lib/dasbor/useChartJs'
import { useTheme } from '../../context/ThemeContext'
import { PemilihRentang } from './PemilihRentang'
import { DatePicker } from './DatePicker'
import { LabelRentang } from './LabelRentang'
import { IkonMenu, IKON_JAM } from './IkonMenu'

/**
 * Panel "Market Breadth" (advance/decline) — backlog C4.
 *
 * Kenapa ini ada: IHSG berbobot kapitalisasi, jadi bisa naik walau mayoritas
 * saham turun (atau sebaliknya) — itu yang tak kelihatan dari angka indeks
 * saja. Sumber & urutan lima keranjang `price_movement.stocks` dijelaskan di
 * `lib/dasbor/breadth.ts`.
 *
 * Mandiri (tak menerima props): dipanggil langsung dari Beranda seperti
 * `RingkasanPasar`, memanggil `useDataHarian()` sendiri.
 */

/** Poin persentase dengan tanda — bukan `fp()` (itu untuk PERSEN, sudah
 *  menyisipkan '%'; menempel 'pp' di belakangnya jadi ambigu "-12,7%pp"). */
function fpp(v: number): string {
  return `${v >= 0 ? '+' : '−'}${Math.abs(v).toFixed(1).replace('.', ',')}pp`
}

function bacaToken(el: HTMLElement | null, nama: string, fallback: string): string {
  if (!el) return fallback
  const v = getComputedStyle(el).getPropertyValue(nama).trim()
  return v || fallback
}

/** Bar tiga-warna turun/tetap/naik — tak ada padanan kanonis (`.bar-fl`
 *  cuma satu warna), jadi inline style di sini, bukan kelas baru di lantai.css. */
function BarSebaran({ b }: { b: Breadth }) {
  const w = (n: number) => `${(n / b.total) * 100}%`
  return (
    <div style={{ display: 'flex', height: 14, borderRadius: 3, overflow: 'hidden', background: 'var(--bg3)' }}>
      <div style={{ width: w(b.turun), background: 'var(--red)' }} title={`${b.turun} saham turun`} />
      <div style={{ width: w(b.tetap), background: 'var(--text3)', opacity: 0.4 }} title={`${b.tetap} saham tak berubah`} />
      <div style={{ width: w(b.naik), background: 'var(--green)' }} title={`${b.naik} saham naik`} />
    </div>
  )
}

export function PanelBreadth() {
  const { hari, tanggalTersedia, tanggalAktif, loading } = useDataHarian()
  const [preset, setPreset] = useState<PresetRentang>('b1')
  // Rentang BEBAS dari kalender, di samping preset (Johan 30 Agu 2026:
  // "sediakan komponen kalender rentang seperti di harian Papan"). Bukan
  // pengganti preset: pintasan tetap yang paling sering dipakai, kalender
  // menjawab pertanyaan yang tak ada pintasannya — "dua pekan sekitar rilis
  // laporan itu". Pola sama Broker Summary v2 (pintasan + rentang bebas).
  //
  // Kalender MENANG kalau terisi; memilih preset mengosongkannya kembali,
  // supaya tak pernah ada dua sumber rentang yang aktif bersamaan.
  const [rentangBebas, setRentangBebas] = useState<{ dari: string; sampai: string } | null>(null)

  // DatePicker menerima himpunan ISO, sementara `useDataHarian` memberi larik
  // objek — dikonversi sekali di sini, bukan di dalam render kalender.
  const isoTersedia = useMemo(
    () => new Set(tanggalTersedia.map((t) => t.date_iso)),
    [tanggalTersedia],
  )
  const { theme } = useTheme()
  const wrapRef = useRef<HTMLDivElement>(null)

  // PRESET_RENTANG (w1/b1/b3/ytd) snap ke hari BERDATA lewat rentangPreset —
  // pola sama Kalender.tsx/SektorIndeks.tsx, bukan preset ketikan sendiri.
  const rentangTanggal = useMemo(() => {
    if (rentangBebas) {
      return tanggalTersedia.filter(
        (t) => t.date_iso >= rentangBebas.dari && t.date_iso <= rentangBebas.sampai,
      )
    }
    if (!tanggalAktif) return []
    const r = rentangPreset(tanggalTersedia, tanggalAktif, preset)
    if (!r) return []
    return tanggalTersedia.filter((t) => t.date_iso >= r.mulai && t.date_iso <= r.akhir)
  }, [tanggalTersedia, tanggalAktif, preset, rentangBebas])

  const { days, error: errorRentang } = useDataRentang(rentangTanggal)

  const titik = useMemo(() => {
    if (!days) return []
    return susunHistoriBreadth(rentangTanggal, days)
      .filter((h): h is { tanggal: string; breadth: Breadth } => h.breadth != null)
  }, [days, rentangTanggal])

  const chartConfig = useMemo<ChartConfiguration<'line'> | null>(() => {
    if (titik.length < 2) return null
    const el = wrapRef.current
    const green = bacaToken(el, '--green', '#38b77e')
    const red = bacaToken(el, '--red', '#e6635a')
    const text3 = bacaToken(el, '--text3', '#6b7688')
    const text2 = bacaToken(el, '--text2', '#9aa7b8')
    const line = bacaToken(el, '--line', '#232e3f')
    const warna = titik[titik.length - 1].breadth.selisihPp >= 0 ? green : red
    const reduceMotion = typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
    return {
      type: 'line',
      data: {
        labels: titik.map((t) => t.tanggal),
        datasets: [
          { label: 'Nol', data: titik.map(() => 0), borderColor: text3, borderDash: [4, 4], borderWidth: 1, pointRadius: 0 },
          {
            label: 'Breadth',
            data: titik.map((t) => t.breadth.selisihPp),
            borderColor: warna,
            borderWidth: 2,
            pointRadius: 0,
            tension: 0.15,
            fill: false,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: reduceMotion ? false : undefined,
        plugins: {
          legend: { display: false },
          tooltip: {
            filter: (ctx) => ctx.datasetIndex === 1,
            callbacks: { label: (ctx) => `Breadth: ${fpp(Number(ctx.parsed.y))}` },
          },
        },
        scales: {
          x: { grid: { display: false }, ticks: { color: text2, font: { size: 9 }, maxTicksLimit: 8 } },
          y: { grid: { color: line }, ticks: { color: text2, font: { size: 10 }, callback: (v) => `${v}pp` } },
        },
      },
      // theme wajib di deps (warnanya dibaca dari CSS var via bacaToken, bukan langsung dari `theme`)
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }
  }, [titik, theme])

  const canvasRef = useChartCanvas(chartConfig)

  // Rentang tanggal yang SEDANG tergambar di chart — dihitung dari titik yang
  // benar-benar ada, bukan dari nama preset (pola PanelAliranAsing.tsx).
  const rentangChart = titik.length >= 1
    ? { mulai: titik[0].tanggal, akhir: titik[titik.length - 1].tanggal, hari: titik.length }
    : null

  // Cakupan grafik. `titik` sudah menyaring hari tanpa breadth, dan itu benar
  // secara aritmetika - tapi menyaring diam-diam membuat garis 20 hari yang
  // sebenarnya digambar dari 16 hari terbaca seolah utuh. Johan 7 Sep 2026:
  // "jika bisa data rentang waktu maka akan jadi data tebakan, BAHAYA".
  // Ditulis hanya saat ADA yang hilang; rentang utuh tak perlu dibebani angka.
  const hariDiminta = rentangTanggal.length
  const hariHilang = hariDiminta - titik.length

  if (loading && !hari) return null
  if (!hari) return null

  const b = hitungBreadth(hari)

  return (
    // Tanpa marginBottom: jarak antar-section diurus gap `.lantai` (16px)
    // saja. Margin sendiri di sini menambahnya jadi 28px, dan celah yang
    // berbeda-beda antar section terbaca sebagai "ada yang kosong di sini"
    // (Johan 30 Agu 2026).
    <section className="panel" ref={wrapRef}>
      <div className="panel-h">
        <span className="lbl">
          Market Breadth (Advance/Decline) · {hari.date_id}
          {hariHilang > 0 && (
            <em
              style={{ color: 'var(--amber)', fontStyle: 'normal', marginLeft: 6 }}
              title="Hari bursa tanpa rincian naik/turun di berkas statistiknya tidak digambar. Garisnya menyambung antar hari yang ada — bukan menebak hari yang hilang."
            >
              · {titik.length} dari {hariDiminta} hari berdata
            </em>
          )}
        </span>
        <div className="grup-k">
          <DatePicker
            value={rentangBebas?.sampai ?? tanggalAktif ?? ''}
            onChange={(iso) => {
              // Klik SATU tanggal memindahkan jendela, bukan menyempitkannya
              // jadi satu hari: panel ini menggambar grafik, dan satu titik
              // membuat seluruh panel kosong tanpa penjelasan. Lebar jendela
              // diambil dari preset yang sedang aktif, jadi kalender menjawab
              // "geser periode ini ke sana" — pola sama Broker Summary v2.
              const r = rentangPreset(tanggalTersedia, iso, preset)
              setRentangBebas(r ? { dari: r.mulai, sampai: r.akhir } : { dari: iso, sampai: iso })
            }}
            tersedia={isoTersedia}
            ariaLabel="Rentang tanggal Market Breadth"
            rentang={rentangBebas}
            onGantiRentang={(dari, sampai) => setRentangBebas({ dari, sampai })}
          />
          <PemilihRentang
            opsi={PRESET_RENTANG}
            nilai={rentangBebas ? ('' as PresetRentang) : preset}
            onGanti={(p) => { setRentangBebas(null); setPreset(p) }}
            ariaLabel="Rentang Market Breadth"
          />
        </div>
      </div>
      <div className="panel-b">
        {b ? (
          <>
            <div className="rasio">
              <div>
                <span className="lbl">Naik</span>
                <div className="v num up">{b.naik}</div>
                <span className="sub">{((b.naik / b.total) * 100).toFixed(0)}% saham</span>
              </div>
              <div>
                <span className="lbl">Tak Berubah</span>
                <div className="v num">{b.tetap}</div>
                <span className="sub">{((b.tetap / b.total) * 100).toFixed(0)}% saham</span>
              </div>
              <div>
                <span className="lbl">Turun</span>
                <div className="v num dn">{b.turun}</div>
                <span className="sub">{((b.turun / b.total) * 100).toFixed(0)}% saham</span>
              </div>
              <div>
                <span className="lbl">Selisih</span>
                <div className={`v num ${b.selisihPp >= 0 ? 'up' : 'dn'}`}>{fpp(b.selisihPp)}</div>
                <span className="sub">dari {b.total} saham</span>
              </div>
            </div>
            <div style={{ marginTop: 10 }}>
              <BarSebaran b={b} />
            </div>
          </>
        ) : (
          <p style={{ fontSize: 11, color: 'var(--text3)' }}>
            Sebaran gerak harga belum tersedia untuk {hari.date_id}.
          </p>
        )}

        {errorRentang && (
          <p style={{ fontSize: 10, color: 'var(--text3)', marginTop: 10 }}>{errorRentang}</p>
        )}
        {!errorRentang && chartConfig ? (
          <>
            {rentangChart && (
              <LabelRentang mulai={rentangChart.mulai} akhir={rentangChart.akhir} n={rentangChart.hari} />
            )}
            <div className="chart-wrap" style={{ height: 180, margin: '14px 0' }}>
              <canvas ref={canvasRef} />
            </div>
          </>
        ) : !errorRentang && (
          <p style={{ fontSize: 10, color: 'var(--text3)', marginTop: 10 }}>
            Riwayat breadth belum cukup untuk grafik rentang ini.
          </p>
        )}

        <p style={{ fontSize: 10, color: 'var(--text3)', marginTop: 6 }}>
          <IkonMenu d={IKON_JAM} size={10} /> Sebaran gerak harga seluruh saham di papan — bisa berlawanan
          dengan arah IHSG karena indeks berbobot kapitalisasi. Hari tanpa data dilompati, bukan dihitung nol.
        </p>
      </div>
    </section>
  )
}
