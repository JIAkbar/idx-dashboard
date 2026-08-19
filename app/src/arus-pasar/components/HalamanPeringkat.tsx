import type { Edisi } from '../../lib/skor/types'
import type { SkorMap } from '../skorMap'
import { Band } from './Band'
import { Kaki } from './Kaki'

/** Port 1:1 dari halaman_peringkat() di build.py, termasuk aturan tie-break
 *  "menang-pertama" ala max()/min() Python untuk pendorong/lemah.
 *
 *  Halamannya `.tumbuh` dengan alasan yang sama seperti HalamanRingkasan:
 *  tabelnya memuat seluruh emiten edisi. */
export function HalamanPeringkat({ ed, skorMap }: { ed: Edisi; skorMap: SkorMap }) {
  const urut = [...ed.emiten].sort((a, b) => skorMap[b.ticker].total - skorMap[a.ticker].total)
  const atas = urut[0]
  const bawah = urut[urut.length - 1]
  const skAtas = skorMap[atas.ticker]

  const komponen: [string, number][] = [
    ['struktur teknikal', skAtas.teknikal / 35],
    ['arus dana', skAtas.flow / 30],
    ['rasio risk/reward', skAtas.rr / 20],
  ]
  let pendorong = komponen[0][0]
  let lemah = komponen[0][0]
  let maxV = komponen[0][1]
  let minV = komponen[0][1]
  for (const [k, v] of komponen.slice(1)) {
    if (v > maxV) {
      maxV = v
      pendorong = k
    }
    if (v < minV) {
      minV = v
      lemah = k
    }
  }

  return (
    <div className="page tumbuh">
      <Band ed={ed} eyebrow="Quant Opportunity Ranking" />
      <div className="inner">
        <div className="trow" style={{ marginBottom: '4mm' }}>
          <div className="tk" style={{ fontSize: '14pt' }}>
            Peringkat Peluang
          </div>
          <div className="px" style={{ fontSize: '8pt', color: 'var(--mute)' }}>
            Risk-adjusted · komparatif
          </div>
        </div>
        <p className="lede">
          {atas.ticker} mencetak skor tertinggi ({skAtas.total.toFixed(0)}) — pendorong utamanya{' '}
          {pendorong}, dengan catatan {lemah} bukan kekuatannya. {bawah.ticker} di posisi akhir:{' '}
          {bawah.rationale_rank.toLowerCase()}.
        </p>
        <table className="rank">
          <thead>
            <tr>
              <th>#</th>
              <th>Ticker</th>
              <th>Skor</th>
              <th>Tek/35</th>
              <th>Flow/30</th>
              <th>R:R/20</th>
              <th>Lik/10</th>
              <th>IHSG/5</th>
              <th style={{ textAlign: 'left', paddingLeft: '5mm' }}>Rationale</th>
              <th>Risiko</th>
            </tr>
          </thead>
          <tbody>
            {urut.map((e, i) => {
              const sk = skorMap[e.ticker]
              return (
                <tr key={e.ticker}>
                  <td>{i + 1}</td>
                  <td className="tk">{e.ticker}</td>
                  <td className="total">{sk.total.toFixed(0)}</td>
                  <td>{sk.teknikal.toFixed(0)}</td>
                  <td>{sk.flow.toFixed(0)}</td>
                  <td>{sk.rr.toFixed(0)}</td>
                  <td>{sk.lik}</td>
                  <td>{sk.ihsg.toFixed(0)}</td>
                  <td style={{ textAlign: 'left', paddingLeft: '5mm' }}>{e.rationale_rank}</td>
                  <td>
                    <span className={`risk ${sk.risiko}`}>{sk.risiko}</span>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
        <div className="blok">
          <h3 className="rule">Model</h3>
          <p>
            Technical 35% · Big Money Flow 30% · Risk/reward 20% · Liquidity 10% · IHSG sensitivity 5%.
            Komponen ditampilkan terbuka di tabel — skor bisa diaudit, bukan kotak hitam.
          </p>
        </div>
        <div className="blok">
          <h3 className="rule">Eksekusi</h3>
          <p>
            Prioritaskan emiten yang menahan support atau merebut resistance dengan volume. Tidak ada
            konfirmasi berarti tidak ada ukuran agresif. Peringkat bersifat komparatif antar {urut.length}{' '}
            emiten edisi ini — bukan sinyal beli otomatis.
          </p>
        </div>
        <div className="blok integritas">
          <h3 className="rule">Catatan Integritas Data</h3>
          <p>{ed.catatan_verifikasi}</p>
        </div>
      </div>
      <Kaki ed={ed} />
    </div>
  )
}
