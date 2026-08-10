import { Fragment } from 'react'
import type { Edisi, Emiten, OhlcMap, Skor } from '../../lib/skor/types'
import { fmt, fmtRp } from '../format'
import { Band } from './Band'
import { Kaki } from './Kaki'
import { StatsRow } from './StatsRow'
import { ArusBroker } from './ArusBroker'
import { Chart } from '../Chart'

const KUNCI_SUPPORT = ['P', 'S1', 'S2', 'S3'] as const
const KUNCI_RESISTANCE = ['R1', 'R2', 'R3'] as const

function DerentPivot({ kunci, pivot }: { kunci: readonly string[]; pivot: Emiten['pivot'] }) {
  return (
    <>
      {kunci.map((k, i) => (
        <span key={k}>
          {i > 0 && <span> | </span>}
          {fmt(pivot[k as keyof typeof pivot])}
        </span>
      ))}
    </>
  )
}

/** Port 1:1 dari halaman_emiten() di build.py. */
export function HalamanEmiten({
  em,
  sk,
  ed,
  ohlc,
}: {
  em: Emiten
  sk: Skor
  ed: Edisi
  ohlc: OhlcMap
}) {
  const o = em.ohlc_hari
  const naik = o.chg >= 0
  const chgCls = naik ? 'bull' : 'bear'
  const tanda = naik ? '+' : '−'
  const kataTrim = em.label.split('—')[0].trim()
  const sisa = em.label.slice(kataTrim.length)

  const tb = em.beli.reduce((s, r) => s + r[1], 0)
  const tj = em.jual.reduce((s, r) => s + r[1], 0)
  const net = tb - tj
  const netCls = net >= 0 ? 'bull' : 'bear'
  const netTxt =
    (net >= 0 ? '+' : '−') + 'Rp' + fmtRp(Math.abs(net)).replace('B', ' miliar').replace('M', ' juta')

  const segmen: { flex: number; sisa: number }[] = [
    { flex: sk.teknikal, sisa: 35 - sk.teknikal },
    { flex: sk.flow, sisa: 30 - sk.flow },
    { flex: sk.rr, sisa: 20 - sk.rr },
    { flex: sk.lik, sisa: 10 - sk.lik },
    { flex: sk.ihsg, sisa: 5 - sk.ihsg },
  ]

  return (
    <div className="page">
      <Band ed={ed} />
      <div className="inner">
        <div className="trow">
          <div className="tk">
            {em.ticker}
            <small>{em.nama}</small>
          </div>
          <div className="px">
            <span className="h">{fmt(o.c)}</span>
            <br />
            <span className={`c ${chgCls}`}>
              {tanda}
              {fmt(Math.abs(o.chg))} ({tanda}
              {fmt(Math.abs(o.pct), 2)}%)
            </span>
          </div>
        </div>
        <StatsRow em={em} ohlc={ohlc} />
        <div className="chartwrap">
          <div className="cap">IDX · Harian · 3 bulan · EMA50 &amp; Pivot Points</div>
          <Chart bars={ohlc[em.ticker]} pivot={em.pivot} />
        </div>
        <div className="cols">
          <ArusBroker em={em} ed={ed} />
          <section style={{ display: 'flex', flexDirection: 'column', minHeight: 0 }}>
            <div className="bias">
              <div className="lbl">
                <span className={em.arah}>{kataTrim}</span>
                {sisa}
              </div>
              <div className={`risk ${sk.risiko}`}>Risiko {sk.risiko}</div>
            </div>
            <div className="sec">
              <h3 className="rule">Arus Dana</h3>
              <p className="flowline">
                {em.flow_kelas} · <span className={netCls}>≈ {netTxt}</span> (top-10)
              </p>
              <p>{em.narasi_flow}</p>
            </div>
            <div className="sec">
              <h3 className="rule">Teknikal</h3>
              <p>{em.narasi_teknikal}</p>
            </div>
            <div className="sr">
              <div className="k sup">Support</div>
              <div className="v">
                <DerentPivot kunci={KUNCI_SUPPORT} pivot={em.pivot} />
                {em.pivot_ragu.length > 0 && (
                  <span className="ragu"> verifikasi: {em.pivot_ragu.join(', ')}</span>
                )}
              </div>
              <div className="k res">Resistance</div>
              <div className="v">
                <DerentPivot kunci={KUNCI_RESISTANCE} pivot={em.pivot} />
              </div>
            </div>
            <div className="strategi">{em.strategi}</div>
            <div className="invtar">
              <span className="inv">
                <span className="l">Invalidation</span>
                <b>{em.invalidation}</b>
              </span>
              <span className="tar">
                <span className="l">Target</span>
                <b>{em.target}</b>
              </span>
            </div>
            <p className="konsek">{em.konsekuensi}</p>
            <div className="skor">
              <div className="head">
                <span className="t">Skor Komposit</span>
                <span className="n">
                  {sk.total.toFixed(0)}
                  <small style={{ fontSize: '7pt', color: 'var(--mute)' }}>/100</small>
                </span>
              </div>
              <div className="barrow">
                {segmen.map((s, i) => (
                  <Fragment key={i}>
                    <i style={{ flex: s.flex }} />
                    <i className="sisa" style={{ flex: s.sisa }} />
                  </Fragment>
                ))}
              </div>
              <div className="leg">
                <span>Teknikal {sk.teknikal.toFixed(0)}/35</span>
                <span>Flow {sk.flow.toFixed(0)}/30</span>
                <span>R/R {sk.rr.toFixed(0)}/20</span>
                <span>Likuiditas {sk.lik}/10</span>
                <span>IHSG {sk.ihsg.toFixed(0)}/5</span>
              </div>
            </div>
          </section>
        </div>
      </div>
      <Kaki ed={ed} />
    </div>
  )
}
