import { useEffect, useMemo, useState, type CSSProperties } from 'react'
import { useNavigate } from 'react-router-dom'
import type { ChartConfiguration } from 'chart.js/auto'
import { BatangPeringkat } from '../../components/dasbor/BatangPeringkat'
import { Kalender } from '../../components/dasbor/Kalender'
import { Papan } from '../../components/dasbor/Papan'
import { useDataHarian, type TanggalIndex } from '../../lib/dasbor/dataHarian'
import { hitungYtdPct } from '../../lib/dasbor/ytd'
import { fN, fp, fmtNF } from '../../lib/dasbor/format'
import { useChartCanvas } from '../../lib/dasbor/useChartJs'
import { useIhsgBuka } from '../../lib/dasbor/ihsgOhlc'
import { useTheme } from '../../context/ThemeContext'
import { IkonMenu, IKON_PERINGATAN, IKON_GLOBE, IKON_PENGGARIS, IKON_GRAFIK_BATANG } from '../../components/dasbor/IkonMenu'
import { LilinHarian } from '../../components/dasbor/LilinHarian'

/**
 * Grafik mini board-side (Fix #27) — pakai tanggalTersedia (data-idx/json/index.json)
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
/** "12 Feb" dari date_iso — date_id terlalu panjang buat baris info mini. */
function tglSingkat(iso: string) {
  return new Date(`${iso}T12:00:00`).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })
}

/** "12 Feb 2019" — dipakai rentang multi-tahun, di mana "12 Feb" saja tak
 *  memberi tahu tahun berapa titik tertinggi itu terjadi. */
function tglSingkatTahun(iso: string) {
  return new Date(`${iso}T12:00:00`).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })
}

/** Pilihan rentang chart IHSG. `tahun: 0` = seluruh riwayat. */
const RENTANG = [
  { id: 'ytd', chip: 'YTD', judul: 'Tahun Berjalan', tahun: null },
  { id: '1t', chip: '1T', judul: '1 Tahun', tahun: 1 },
  { id: '5t', chip: '5T', judul: '5 Tahun', tahun: 5 },
  { id: '10t', chip: '10T', judul: '10 Tahun', tahun: 10 },
  { id: 'max', chip: 'Semua', judul: 'Sejak 1990', tahun: 0 },
] as const

type RentangId = (typeof RENTANG)[number]['id']

function IhsgYtdChart({ dates }: { dates: TanggalIndex[] }) {
  const { theme } = useTheme()
  const [rentang, setRentang] = useState<RentangId>('ytd')
  // Riwayat panjang (354 KB, 1990-sekarang) BARU diunduh saat rentang selain
  // YTD dipilih — pengunjung yang cuma melihat tahun berjalan tak perlu
  // membayarnya, karena seri YTD sudah ikut index.json yang memang termuat.
  const [riwayat, setRiwayat] = useState<TanggalIndex[] | null>(null)
  useEffect(() => {
    if (rentang === 'ytd' || riwayat) return
    let batal = false
    fetch('/data-idx/json/ihsg_harian.json')
      .then((r) => r.json())
      .then((j: { tutup: Record<string, number> }) => {
        if (batal) return
        setRiwayat(Object.entries(j.tutup).map(([iso, ihsg]) => ({
          date_iso: iso, date_id: tglSingkatTahun(iso), ihsg,
        } as TanggalIndex)))
      })
      .catch(() => {})
    return () => { batal = true }
  }, [rentang, riwayat])

  const pilih = RENTANG.find((r) => r.id === rentang) ?? RENTANG[0]
  // Selagi riwayat masih diunduh, seri YTD tetap ditampilkan — grafik yang
  // berkedip kosong lebih buruk daripada grafik yang sebentar lebih pendek.
  const seri = useMemo(() => {
    if (pilih.tahun === null || !riwayat) return dates
    if (pilih.tahun === 0) return riwayat
    const batas = new Date()
    batas.setFullYear(batas.getFullYear() - pilih.tahun)
    const iso = batas.toISOString().slice(0, 10)
    return riwayat.filter((d) => d.date_iso >= iso)
  }, [pilih, riwayat, dates])

  // High/low/terkini dari seri yang sama dengan chart.
  const info = useMemo(() => {
    if (seri.length === 0) return null
    let hi = seri[0]
    let lo = seri[0]
    seri.forEach((d) => {
      if (d.ihsg > hi.ihsg) hi = d
      if (d.ihsg < lo.ihsg) lo = d
    })
    const last = seri[seri.length - 1]
    // YTD punya definisi resminya sendiri (penutupan tahun lalu, bukan titik
    // pertama yang kebetulan ada di seri); rentang lain memang diukur dari
    // ujung kiri grafiknya.
    const pct = pilih.tahun === null
      ? hitungYtdPct(last.ihsg, seri)
      : ((last.ihsg - seri[0].ihsg) * 100) / seri[0].ihsg
    return { hi, lo, last, ytdPct: pct }
  }, [seri, pilih])

  const config = useMemo<ChartConfiguration<'line', number[], string> | null>(() => {
    if (seri.length === 0 || !info) return null
    const isDark = theme === 'dark'
    const amber = isDark ? '#F0A62B' : '#B87A10'
    const amberFill = isDark ? 'rgba(240,166,43,.22)' : 'rgba(184,122,16,.16)'
    // Garis panduan high/low: warna --text3 tiap tema, alpha lembut.
    const guide = isDark ? 'rgba(92,107,126,.55)' : 'rgba(136,150,168,.55)'
    const guideDs = (nilai: number) => ({
      data: seri.map(() => nilai),
      borderColor: guide,
      borderDash: [4, 4] as number[],
      borderWidth: 1,
      pointRadius: 0,
      fill: false,
    })
    return {
      type: 'line',
      data: {
        labels: seri.map((d) => d.date_id),
        datasets: [{
          data: seri.map((d) => d.ihsg),
          borderColor: amber,
          backgroundColor: amberFill,
          borderWidth: 1.8,
          pointRadius: 0,
          fill: true,
          tension: 0.15,
        },
        // Dua dataset konstanta = garis putus-putus level high & low —
        // cara paling ringan tanpa plugin/dependency tambahan.
        guideDs(info.hi.ihsg),
        guideDs(info.lo.ihsg)],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        // Tanpa ini interaksi default Chart.js `intersect: true` menuntut
        // kursor PAS di garis (pointRadius 0 = area kena nyaris nol, tooltip
        // susah muncul). mode "index" + intersect false = hover di mana pun
        // pada sumbu-x langsung nunjukin titik terdekat kolom itu.
        interaction: { mode: 'index', intersect: false },
        plugins: {
          legend: { display: false },
          tooltip: {
            // Garis panduan bukan data — jangan ikut tooltip.
            filter: (item) => item.datasetIndex === 0,
            callbacks: { label: (ctx) => `IHSG: ${fN(ctx.parsed.y)}` },
          },
        },
        scales: { x: { display: false }, y: { display: false } },
      },
    }
  }, [seri, info, theme])
  const canvasRef = useChartCanvas(config)

  return (
    <div className="board-side">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8, marginBottom: 6, flexWrap: 'wrap' }}>
        <span className="lbl">IHSG — {pilih.judul}</span>
        {info && (
          <span className="num" style={{ fontSize: 12, fontWeight: 700 }}>
            {fN(info.last.ihsg)}{' '}
            {info.ytdPct != null && (
              <span className={info.ytdPct >= 0 ? 'up' : 'dn'}>{fp(info.ytdPct)}</span>
            )}
          </span>
        )}
      </div>
      {/* Pemilih rentang — chip, bukan dropdown: lima pilihan yang semuanya
          pendek lebih cepat dibaca berjajar daripada disembunyikan di balik
          satu klik. */}
      <div className="ihsg-rentang">
        {RENTANG.map((r) => (
          <button
            key={r.id}
            type="button"
            className={'chip-t' + (rentang === r.id ? ' on' : '')}
            aria-pressed={rentang === r.id}
            onClick={() => setRentang(r.id)}
          >
            {r.chip}
          </button>
        ))}
      </div>
      {/* canvas dipaksa display:block+width:100% LEWAT STYLE (bukan andalkan
          Chart.js) — .board-side flex item, canvas default-nya display:inline
          lebar intrinsik 300px; kalau Chart.js sempat baca lebar container
          SEBELUM browser reflow ulang gara-gara canvas inline itu, elemen
          kebaca 300px dan macet di situ (tinggi ikut kanvas resize kanan,
          lebar tidak). Kuncian native CSS ini motong akar masalahnya. */}
      <div className="chart-wrap" style={{ height: 120 }}>
        <canvas ref={canvasRef} style={{ display: 'block', width: '100%', height: '100%' }} />
      </div>
      {info && (
        <div className="num" style={{ display: 'flex', justifyContent: 'space-between', gap: 8, marginTop: 6, fontSize: 10, color: 'var(--text3)', flexWrap: 'wrap' }}>
          <span>Tertinggi <span className="up">{fN(info.hi.ihsg)}</span> · {(pilih.tahun === null ? tglSingkat : tglSingkatTahun)(info.hi.date_iso)}</span>
          <span>Terendah <span className="dn">{fN(info.lo.ihsg)}</span> · {(pilih.tahun === null ? tglSingkat : tglSingkatTahun)(info.lo.date_iso)}</span>
        </div>
      )}
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
/**
 * Nama negara (`WorldRow.c`, data-idx/json/${stem}.json field `world`) →
 * simbol TradingView indeks utama negara itu (#4/#5). Satu peta dipakai
 * BatangPeringkat "YTD Ranking" DAN tabel "Negara–Indeks" — supaya tak ada
 * dua daftar yang bisa berselisih.
 *
 * Tiap simbol diverifikasi satu-satu ke halaman tradingview.com/symbols/
 * (14 Agu, browser sungguhan — bukan tebakan/hafalan) sampai nama indeks di
 * halaman itu cocok dengan `WorldRow.idx` di data kita. 33 negara di berkas
 * harian SEMUA ketemu padanannya; kalau suatu hari ada negara baru yang
 * simbolnya belum diverifikasi, JANGAN ditambah tebakan — biarkan baris itu
 * tidak bisa diklik (lihat `symUntukNegara`).
 */
const SYM_NEGARA: Record<string, string> = {
  Indonesia: 'IDX:COMPOSITE',
  Malaysia: 'FTSEMYX:FBMKLCI',
  Philippines: 'PSE:PSEI',
  Singapore: 'TVC:STI',
  Thailand: 'SET:SET',
  Vietnam: 'HOSE:VNINDEX',
  Australia: 'ASX:XAO',
  China: 'SSE:000001',
  'Hong Kong': 'TVC:HSI',
  India: 'BSE:SENSEX',
  Japan: 'TVC:NI225',
  Korea: 'KRX:KOSPI',
  Taiwan: 'TWSE:IX0001',
  Brazil: 'BMFBOVESPA:IBOV',
  Canada: 'TSX:TSX',
  Colombia: 'BVC:ICAP',
  Mexico: 'BMV:ME',
  US: 'TVC:DJI',
  Austria: 'VIE:ATX',
  France: 'EURONEXT:PX1',
  Germany: 'XETR:DAX',
  Ireland: 'EURONEXT:ISEQ',
  Israel: 'TASE:TA35',
  Norway: 'OSL:OSEBX',
  Poland: 'GPW:WIG',
  Qatar: 'QSE:GNRI',
  'Saudi Arabia': 'TADAWUL:TASI',
  'South Africa': 'JSE:J203',
  Spain: 'BME:IBC',
  Switzerland: 'SIX:SMI',
  Turkey: 'BIST:XU100',
  UAE: 'DFM:DFMGI',
  UK: 'TVC:UKX',
}

/** null = simbol tidak diverifikasi — baris TIDAK dibuat clickable (jangan
 *  menautkan ke chart yang salah/kosong), lihat komentar SYM_NEGARA. */
function symUntukNegara(nama: string): string | null {
  return SYM_NEGARA[nama] ?? null
}

/** Satu blok abu-abu berdenyut — bahan dasar kerangka di bawah. */
function Skel({ w, h, style }: { w?: number | string; h: number; style?: CSSProperties }) {
  return <div className="skel-bar skel-pulse" style={{ width: w, height: h, ...style }} />
}

/**
 * Kerangka panel utama Indeks Dunia selagi `loading && !hari` (#109) —
 * gantikan blok "Memuat data…" di tengah layar. Bentuknya mengikuti tata
 * letak asli (board + grid2 + panel ranking/tabel) SUPAYA tata letak tidak
 * melompat saat data datang — bukan sekadar hiasan. Kalender di kolom kiri
 * tetap komponen ASLI (sudah punya kerangka `.cg.memuat` sendiri, dan
 * `tanggalTersedia` bisa saja sudah terisi duluan sebelum berkas harian
 * datang, lihat useDataHarian).
 */
function PanelSkeleton({ tanggalTersedia, tanggalAktif, pilihTanggal, loading }: {
  tanggalTersedia: TanggalIndex[]
  tanggalAktif: string | null
  pilihTanggal: (iso: string) => void
  loading: boolean
}) {
  return (
    <>
      <div className="board">
        <div className="board-main">
          <Skel w={280} h={11} />
          <div style={{ marginTop: 10 }}><Skel w={210} h={38} /></div>
          <div style={{ marginTop: 12, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <Skel w={96} h={24} style={{ borderRadius: 20 }} />
            <Skel w={76} h={24} style={{ borderRadius: 20 }} />
          </div>
          <div className="board-meta">
            {[0, 1, 2, 3, 4].map((i) => (
              <div className="bm" key={i}>
                <Skel w={54} h={9} />
                <div style={{ marginTop: 5 }}><Skel w={74} h={13} /></div>
              </div>
            ))}
          </div>
        </div>
        <div className="board-side">
          <div style={{ marginBottom: 8 }}><Skel w={150} h={11} /></div>
          <Skel h={120} style={{ width: '100%' }} />
        </div>
      </div>

      <div className="grid2 w-kiri">
        <Kalender tanggalTersedia={tanggalTersedia} tanggalAktif={tanggalAktif} onPilih={pilihTanggal} memuat={loading} />

        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div className="panel">
            <div className="panel-h"><Skel w={100} h={11} /></div>
            <div className="nf-grid">
              {[0, 1].map((i) => (
                <div className="nf-cell" key={i}>
                  <Skel w={40} h={9} />
                  <div style={{ marginTop: 8 }}><Skel w={90} h={22} /></div>
                  <div style={{ marginTop: 6 }}><Skel w={70} h={9} /></div>
                </div>
              ))}
            </div>
          </div>

          <div className="panel" style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
            <div className="panel-h"><Skel w={140} h={11} /></div>
            <div className="nf-grid" style={{ flex: 1, alignItems: 'center' }}>
              {[0, 1].map((i) => (
                <div className="nf-cell" key={i} style={{ textAlign: 'center' }}>
                  <Skel w={80} h={9} style={{ margin: '0 auto' }} />
                  <div style={{ marginTop: 8 }}><Skel w={50} h={24} style={{ margin: '0 auto' }} /></div>
                </div>
              ))}
            </div>
          </div>

          <div className="panel">
            <div className="panel-h"><Skel w={190} h={11} /></div>
            <div className="adt">
              {[0, 1, 2].map((i) => (
                <div className="adt-c" key={i}>
                  <Skel w={70} h={9} />
                  <div style={{ marginTop: 6 }}><Skel w={60} h={20} /></div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="panel">
        <div className="panel-h"><Skel w={220} h={11} /></div>
        <div className="panel-b"><Skel h={160} style={{ width: '100%' }} /></div>
      </div>

      <div className="panel">
        <div className="panel-h"><Skel w={260} h={11} /></div>
        <div className="panel-b" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <Skel key={i} h={20} style={{ width: '100%' }} />
          ))}
        </div>
      </div>
    </>
  )
}

export function IndeksDunia() {
  const { tanggalTersedia, hari, tanggalAktif, pilihTanggal, loading, error } = useDataHarian()
  const navigate = useNavigate()
  // Dipanggil SEBELUM early-return loading/error — hook tak boleh dilewati di
  // sebagian render. `null` kalau tanggalnya belum dipanen Yahoo (panen jalan
  // sore); lilin lalu mundur ke penutupan kemarin seperti sebelum #108.
  const buka = useIhsgBuka(tanggalAktif ?? undefined)

  const world = hari?.world ?? []

  if (loading && !hari) {
    return (
      <div className="lantai">
        <PanelSkeleton tanggalTersedia={tanggalTersedia} tanggalAktif={tanggalAktif} pilihTanggal={pilihTanggal} loading={loading} />
      </div>
    )
  }

  if (error || !hari) {
    return (
      <div className="lantai">
        <Kalender tanggalTersedia={tanggalTersedia} tanggalAktif={tanggalAktif} onPilih={pilihTanggal} memuat={loading && !hari} />
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

          {/* Lilin hari ini di samping angkanya. Angka menyebut di mana IHSG
              berhenti; lilin menyebut jalan yang ditempuhnya ke sana — hari
              yang tutup +1% setelah sempat -2% terbaca sangat berbeda dari
              hari yang naik lurus, dan itu selisih yang hilang kalau cuma ada
              satu angka. */}
          {hari.ihsg_prev != null && hari.ihsg_high != null && hari.ihsg_low != null && (
            <div className="lilin-hari">
              <LilinHarian
                dasar={buka ?? hari.ihsg_prev} tutup={hari.ihsg_value}
                tinggi={hari.ihsg_high} rendah={hari.ihsg_low}
                judul={`Rentang hari: ${fN(hari.ihsg_low)} sampai ${fN(hari.ihsg_high)}, ${buka ? `buka ${fN(buka)}, ` : ''}tutup ${fN(hari.ihsg_value)}`}
              />
              <div className="lilin-ket">
                <span className="lbl">Rentang hari</span>
                <span className="lilin-angka">
                  {fN(hari.ihsg_low)} <span className="muted">→</span> {fN(hari.ihsg_high)}
                </span>
                <span className="lilin-catatan">
                  {buka
                    ? <>Badan dari harga buka {fN(buka)} ke penutupan {fN(hari.ihsg_value)}.</>
                    : <>Badan dari penutupan kemarin ke penutupan hari ini — harga buka hari ini belum dipanen.</>}
                </span>
              </div>
            </div>
          )}
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
        <Kalender tanggalTersedia={tanggalTersedia} tanggalAktif={tanggalAktif} onPilih={pilihTanggal} memuat={loading && !hari} />

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

          {/* Digabung ke kolom ini (user 14 Agu): dulu panel full-width sendiri
              di bawah — satu section dengan Net Foreign + Market Fundamental. */}
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
        </div>
      </div>

      <div className="panel">
        <div className="panel-h">
          <span className="lbl">YTD Ranking — Semua Negara (Indonesia disorot merah)</span>
        </div>
        <BatangPeringkat baris={world.map((w) => ({ nama: w.c, nilai: w.ytd }))} sorot={indonesia?.c} symUntuk={symUntukNegara} />
      </div>

      <div className="panel">
        {/* Jumlah negara dihitung dari data, bukan ditulis tetap: judul lama
            berbunyi "36 Negara" padahal berkas harian berisi 35 baris. */}
        <div className="panel-h">
          {/* Judul penuh membungkus jadi dua baris di telepon dan mendorong
              kepala tabel turun. Bagian "— 33 Negara" yang paling dulu
              dikorbankan: jumlahnya bisa dihitung dari tabel di bawahnya,
              sedangkan tanggalnya tidak ada di tempat lain. */}
          <span className="lbl">
            <span className="hanya-lebar">Perbandingan </span>Indeks Dunia
            <span className="hanya-lebar"> — {world.length} Negara</span>
            {' '}({hari.date_id})
          </span>
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
                // #5: sym null (negara tanpa simbol TV terverifikasi) → baris
                // biasa, tidak diklik — jangan menautkan ke chart yang salah.
                const sym = symUntukNegara(w.c)
                rows.push(
                  <tr
                    key={`${w.r}-${w.c}`}
                    className={`${w.is_idx ? 'kita' : ''}${sym ? ' klik' : ''}`}
                    onClick={sym ? () => navigate(`/chart?sym=${sym}`) : undefined}
                    title={sym ? `Buka chart ${w.c} — ${w.idx}` : undefined}
                  >
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
