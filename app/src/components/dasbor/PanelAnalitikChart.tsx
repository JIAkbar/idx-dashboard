import { useMemo } from 'react'
import {
  hitungPivot, hitungCpr, klasifikasiLebarCpr, posisiCpr, relasiCpr, hitungRR,
  jarakKeLevel, returnMultiHorizon, klasifikasiVolumeSurge, cekGating, placeholderGating,
  type KunciGating, type KelasRelasiCpr, type PosisiCpr, type KlasifikasiVolumeSurge,
} from '../../lib/dasbor/chartAnalitik'
import { fN, fp } from '../../lib/dasbor/format'
import { BadgeRapor } from './BadgeRapor'
import type { IndexBt, RunBt } from '../../lib/dasbor/raporBadge'
import './PanelAnalitikChart.css'

/** Bar FINAL (bar t = sesi terakhir tutup) — pemanggil yang menjamin, panel
 *  ini tak menyaring hari berjalan sendiri. */
export interface BarAnalitik {
  tanggal: string
  o: number
  h: number
  l: number
  c: number
  v: number
}

const SLUG_RELASI: Record<KelasRelasiCpr, string> = {
  'Higher Value': 'higher_value',
  'Lower Value': 'lower_value',
  'Outside Value': 'outside_value',
  'Inside Value': 'inside_value',
  'Overlapping Higher': 'overlapping_higher',
  'Overlapping Lower': 'overlapping_lower',
}

const SLUG_POSISI: Record<PosisiCpr, string> = {
  'di-atas': 'di_atas',
  'di-dalam': 'di_dalam',
  'di-bawah': 'di_bawah',
}

const LABEL_POSISI: Record<PosisiCpr, string> = {
  'di-atas': 'Di Atas CPR',
  'di-dalam': 'Di Dalam CPR',
  'di-bawah': 'Di Bawah CPR',
}

const LABEL_SURGE: Record<KlasifikasiVolumeSurge, string> = {
  'sangat-tinggi': 'Sangat Tinggi',
  tinggi: 'Tinggi',
  normal: 'Normal',
  rendah: 'Rendah',
}

/** Kelas warna bull/bear kanonis (`.up`/`.dn` di lantai.css) — bukan warna baru. */
function warnaRelasi(kelas: KelasRelasiCpr): string {
  if (kelas === 'Higher Value' || kelas === 'Overlapping Higher') return 'up'
  if (kelas === 'Lower Value' || kelas === 'Overlapping Lower') return 'dn'
  return ''
}
function warnaPosisi(p: PosisiCpr): string {
  if (p === 'di-atas') return 'up'
  if (p === 'di-bawah') return 'dn'
  return ''
}

/** Satu-satunya pintu cari run BT per kunci — null kalau belum pernah diuji
 *  (`bt/index.json` belum punya entri ini sekarang), BadgeRapor otomatis tak
 *  tampil. JANGAN mengarang angka di sini. */
function cariRun(indexBt: IndexBt | null | undefined, strategi: string): RunBt | null {
  return indexBt?.run.find((r) => r.strategi === strategi) ?? null
}

export function PanelAnalitikChart({ bars, tier, indexBt }: {
  bars: BarAnalitik[]
  tier?: number
  indexBt?: IndexBt | null
}) {
  const n = bars.length
  const t = n > 0 ? bars[n - 1] : null
  const prevBar = n >= 2 ? bars[n - 2] : null

  const gating = useMemo(() => cekGating(n), [n])
  const gagalSet = useMemo(() => new Set(gating.gagal.map((m) => m.kunci)), [gating])
  const gagal = (kunci: KunciGating) => gagalSet.has(kunci)

  const pivot = t ? hitungPivot(t.h, t.l, t.c) : null
  const cpr = t ? hitungCpr(t.h, t.l, t.c) : null
  const posisi = t && cpr ? posisiCpr(t.c, cpr.tc, cpr.bc) : null

  const relasi = useMemo(() => {
    if (!prevBar || !cpr || !pivot) return null
    const pivotPrev = hitungPivot(prevBar.h, prevBar.l, prevBar.c)
    const cprPrev = hitungCpr(prevBar.h, prevBar.l, prevBar.c)
    return relasiCpr({ tc: cpr.tc, bc: cpr.bc, p: pivot.P }, { tc: cprPrev.tc, bc: cprPrev.bc, p: pivotPrev.P })
  }, [prevBar, cpr, pivot])

  // Trailing sampai 60 sesi (termasuk t) — panjangnya sendiri yang menentukan
  // fallback di klasifikasiLebarCpr, bukan parameter terpisah.
  const lebar = useMemo(() => {
    if (!cpr) return null
    const riwayat = bars.slice(Math.max(0, n - 60), n).map((b) => hitungCpr(b.h, b.l, b.c).lebarPct)
    return klasifikasiLebarCpr(cpr.lebarPct, riwayat)
  }, [bars, n, cpr])

  const rr = t && pivot ? hitungRR(t.c, pivot) : null
  const jarak = t && pivot && cpr ? jarakKeLevel(t.c, { r1: pivot.R1, s1: pivot.S1, tc: cpr.tc, bc: cpr.bc }) : null

  const ret = useMemo(() => returnMultiHorizon(bars.map((b) => b.c)), [bars])

  const surge = useMemo(() => {
    if (n < 21) return null
    return klasifikasiVolumeSurge(bars[n - 1].v, bars.slice(n - 21, n - 1).map((b) => b.v))
  }, [bars, n])

  const runRelasi = relasi ? cariRun(indexBt, `pivot_cpr.relasi_${SLUG_RELASI[relasi.kelas]}`) : null
  const runPosisi = posisi ? cariRun(indexBt, `pivot_cpr.posisi_${SLUG_POSISI[posisi]}`) : null
  const runRR = cariRun(indexBt, 'rr_setup.target_before_stop')

  if (!t || !pivot || !cpr) return null

  return (
    <div className="pac-grup">
      {gating.banner && <p className="pac-banner">{gating.banner}</p>}

      <section className="panel pac-panel">
        <div className="panel-h"><span className="lbl">Pivot &amp; CPR</span></div>
        <div className="panel-b">
          {gagal('pivot_cpr') ? (
            <p className="pac-kosong">{placeholderGating(2, n)}</p>
          ) : (
            <>
              <div className="pac-grid-pivot">
                <div><span className="lbl">R3</span><span className="v num">{fN(pivot.R3, 0)}</span></div>
                <div><span className="lbl">R2</span><span className="v num">{fN(pivot.R2, 0)}</span></div>
                <div><span className="lbl">R1</span><span className="v num">{fN(pivot.R1, 0)}</span></div>
                <div><span className="lbl">P</span><span className="v num">{fN(pivot.P, 0)}</span></div>
                <div><span className="lbl">S1</span><span className="v num">{fN(pivot.S1, 0)}</span></div>
                <div><span className="lbl">S2</span><span className="v num">{fN(pivot.S2, 0)}</span></div>
                <div><span className="lbl">S3</span><span className="v num">{fN(pivot.S3, 0)}</span></div>
              </div>

              <p className="pac-baris">
                CPR: TC <b className="num">{fN(cpr.tc, 0)}</b> · BC <b className="num">{fN(cpr.bc, 0)}</b>
                {' · Lebar '}<span className="num">{fp(cpr.lebarPct)}</span>
                {lebar && <span className="pac-sub"> · {lebar.label}</span>}
              </p>

              <p className="pac-baris">
                Posisi: <b className={warnaPosisi(posisi!)}>{LABEL_POSISI[posisi!]}</b>
                {runPosisi && <span className="pac-badge-slot"><BadgeRapor run={runPosisi} tier={tier} /></span>}
              </p>

              {gagal('relasi_cpr') ? (
                <p className="pac-kosong">{placeholderGating(3, n)}</p>
              ) : relasi && (
                <p className="pac-baris">
                  Relasi vs sesi lalu: <b className={warnaRelasi(relasi.kelas)}>{relasi.kelas}</b>
                  {' — '}<span className="pac-sub">{relasi.bias}</span>
                  {runRelasi && <span className="pac-badge-slot"><BadgeRapor run={runRelasi} tier={tier} /></span>}
                </p>
              )}
            </>
          )}
        </div>
      </section>

      <section className="panel pac-panel">
        <div className="panel-h"><span className="lbl">Risk : Reward</span></div>
        <div className="panel-b">
          {gagal('rr_setup') || !rr ? (
            <p className="pac-kosong">{placeholderGating(2, n)}</p>
          ) : (
            <p className="pac-baris">
              Target <span className="num">{fN(rr.target, 0)}</span> · SL <span className="num">{fN(rr.stopLoss, 0)}</span>
              {' · '}<b>{rr.label}</b>
              {runRR && <span className="pac-badge-slot"><BadgeRapor run={runRR} tier={tier} /></span>}
            </p>
          )}
        </div>
      </section>

      <section className="panel pac-panel">
        <div className="panel-h"><span className="lbl">Kinerja &amp; Jarak ke Level</span></div>
        <div className="panel-b">
          <div className="pac-grid-return">
            <div>
              <span className="lbl">1D</span>
              <span className={`v num ${ret.r1d != null ? (ret.r1d >= 0 ? 'up' : 'dn') : ''}`}>
                {gagal('return_1d') || ret.r1d == null ? placeholderGating(2, n) : fp(ret.r1d)}
              </span>
            </div>
            <div>
              <span className="lbl">1W</span>
              <span className={`v num ${ret.r1w != null ? (ret.r1w >= 0 ? 'up' : 'dn') : ''}`}>
                {gagal('return_1w') || ret.r1w == null ? placeholderGating(6, n) : fp(ret.r1w)}
              </span>
            </div>
            <div>
              <span className="lbl">1M</span>
              <span className={`v num ${ret.r1m != null ? (ret.r1m >= 0 ? 'up' : 'dn') : ''}`}>
                {gagal('return_1m') || ret.r1m == null ? placeholderGating(22, n) : fp(ret.r1m)}
              </span>
            </div>
            <div>
              <span className="lbl">3M</span>
              <span className={`v num ${ret.r3m != null ? (ret.r3m >= 0 ? 'up' : 'dn') : ''}`}>
                {gagal('return_3m') || ret.r3m == null ? placeholderGating(64, n) : fp(ret.r3m)}
              </span>
            </div>
          </div>
          {jarak && (
            <p className="pac-baris pac-sub">
              Jarak ke R1 {fp(jarak.r1)} · S1 {fp(jarak.s1)} · TC {fp(jarak.tc)} · BC {fp(jarak.bc)}
            </p>
          )}
        </div>
      </section>

      <section className="panel pac-panel">
        <div className="panel-h"><span className="lbl">Volume Surge</span></div>
        <div className="panel-b">
          {gagal('volume_surge') ? (
            <p className="pac-kosong">{placeholderGating(21, n)}</p>
          ) : !surge ? (
            <p className="pac-kosong">—</p>
          ) : (
            <p className="pac-baris">
              <b>{LABEL_SURGE[surge.klasifikasi]}</b>{' '}
              <span className="num">({fp(surge.surgePct)})</span>
            </p>
          )}
        </div>
      </section>
    </div>
  )
}
