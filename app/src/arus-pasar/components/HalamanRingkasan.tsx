import type { Edisi } from '../../lib/skor/types'
import type { SkorMap } from '../skorMap'
import { fmt } from '../format'
import { Band } from './Band'
import { Kaki } from './Kaki'

/** Port 1:1 dari halaman_ringkasan() di build.py. Baris "Tiga emiten..." dan blok
 *  IHSG sengaja hardcode — sama seperti build.py, belum menyambung ke data live. */
export function HalamanRingkasan({ ed, skorMap }: { ed: Edisi; skorMap: SkorMap }) {
  const urut = [...ed.emiten].sort((a, b) => skorMap[b.ticker].total - skorMap[a.ticker].total)

  return (
    <div className="page">
      <Band ed={ed} eyebrow="Ringkasan Edisi" />
      <div className="inner">
        <div className="trow" style={{ marginBottom: '4mm' }}>
          <div className="tk" style={{ fontSize: '14pt' }}>
            Ringkasan Edisi
          </div>
          <div className="px" style={{ fontSize: '8pt', color: 'var(--mute)' }}>
            {ed.emiten.length} emiten
          </div>
        </div>
        <p className="lede">
          Tiga emiten dibedah dengan kerangka yang sama: struktur harga terhadap EMA50 dan Pivot Points,
          kualitas arus dana broker (siapa yang membeli — bukan hanya berapa), rasio risk/reward,
          likuiditas, dan sensitivitas terhadap IHSG.
        </p>
        <table className="ring">
          <tbody>
            <tr>
              <th>Ticker</th>
              <th>Emiten</th>
              <th>Close</th>
              <th>±%</th>
              <th>Bias</th>
              <th>Skor</th>
              <th>Risiko</th>
            </tr>
            {urut.map((e) => {
              const o = e.ohlc_hari
              const naik = o.chg >= 0
              return (
                <tr key={e.ticker}>
                  <td className="tk">{e.ticker}</td>
                  <td>{e.nama.replace('PT ', '').replace(' Tbk.', '')}</td>
                  <td className="num">{fmt(o.c)}</td>
                  <td className={`num ${naik ? 'bull' : 'bear'}`}>
                    {naik ? '+' : '−'}
                    {fmt(Math.abs(o.pct), 2)}%
                  </td>
                  <td>{e.label}</td>
                  <td className="num">{skorMap[e.ticker].total.toFixed(0)}</td>
                  <td>
                    <span className={`risk ${skorMap[e.ticker].risiko}`}>{skorMap[e.ticker].risiko}</span>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
        <div className="ihsgbar">
          <span>
            <span className="l">IHSG</span>
            <b>6.409,65</b> <span className="bull">+1,04%</span>
          </span>
          <span>
            <span className="l">Net Foreign Buy Reguler</span>
            <b className="bull">Rp917,23 miliar</b> (7 Agu)
          </span>
          <span>
            <span className="l">Konteks</span>Bullish fluktuatif selama 6.376–6.380 bertahan
          </span>
        </div>
        <h3 className="rule">Metodologi</h3>
        <p className="metode">
          <b>Skor komposit 0–100:</b> Technical 35% · Big Money Flow 30% · Risk/reward 20% · Liquidity
          10% · IHSG sensitivity 5%. Pemetaan risiko: ≥80 Menengah · 55–79 Tinggi · &lt;55 Ekstrem.{' '}
          <b>Sumber data:</b> harga Yahoo Finance; pivot &amp; EMA dari chart TradingView; arus broker
          dari orderbook Stockbit (transkripsi manual, diverifikasi). Komponen data yang tidak tersedia
          tidak pernah diisi perkiraan — halaman terkait akan menampilkan penanda kesenjangan data dan
          skor diberi penalti. Peringkat bersifat komparatif antar emiten edisi ini, bukan sinyal beli
          otomatis.
        </p>
      </div>
      <Kaki ed={ed} />
    </div>
  )
}
