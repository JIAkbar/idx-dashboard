import type { Edisi } from '../../lib/skor/types'
import type { SkorMap } from '../skorMap'

/** Port 1:1 dari halaman_sampul() di build.py. Baris IHSG/Net Foreign di bawah
 *  sengaja hardcode — build.py juga begitu (belum menyambung ke data live). */
export function HalamanSampul({ ed, skorMap }: { ed: Edisi; skorMap: SkorMap }) {
  const urut = [...ed.emiten].sort((a, b) => skorMap[b.ticker].total - skorMap[a.ticker].total)

  return (
    <div className="page" style={{ background: 'var(--brand)', color: '#fff' }}>
      <div style={{ padding: '22mm 20mm 0', flex: 1, display: 'flex', flexDirection: 'column' }}>
        <div style={{ borderBottom: '1px solid rgba(255,255,255,.35)', paddingBottom: '6mm' }}>
          <div
            style={{
              fontSize: '8pt',
              letterSpacing: '.3em',
              textTransform: 'uppercase',
              color: 'rgba(255,255,255,.7)',
            }}
          >
            Tinjauan Teknikal &amp; Arus Dana Harian
          </div>
          <div
            style={{
              fontFamily: 'Georgia,Cambria,serif',
              fontSize: '46pt',
              fontWeight: 700,
              lineHeight: 1.05,
              marginTop: '4mm',
            }}
          >
            ARUS PASAR
          </div>
        </div>
        <div style={{ marginTop: '8mm', fontSize: '13pt' }}>{ed.tanggal_id}</div>
        <div
          style={{
            fontFamily: 'Consolas,monospace',
            fontSize: '9pt',
            color: 'rgba(255,255,255,.75)',
            marginTop: '1.5mm',
          }}
        >
          {ed.edisi} · Edisi Ujicoba
        </div>
        <div style={{ marginTop: '14mm' }}>
          <div
            style={{
              fontSize: '7pt',
              letterSpacing: '.24em',
              textTransform: 'uppercase',
              color: 'rgba(255,255,255,.6)',
              borderBottom: '1px solid rgba(255,255,255,.35)',
              paddingBottom: '2mm',
              marginBottom: '3mm',
              display: 'flex',
              justifyContent: 'space-between',
            }}
          >
            <span>Dalam Edisi Ini</span>
            <span>Skor</span>
          </div>
          <style>{`
            .c-row{display:flex;align-items:baseline;gap:6mm;padding:2.8mm 0;
              border-bottom:1px solid rgba(255,255,255,.16);font-variant-numeric:tabular-nums}
            .c-tk{font-size:14pt;font-weight:800;width:24mm}
            .c-lbl{flex:1;font-size:9.5pt;color:rgba(255,255,255,.85)}
            .c-skor{font-size:14pt;font-weight:800}
          `}</style>
          {urut.map((e) => (
            <div className="c-row" key={e.ticker}>
              <span className="c-tk">{e.ticker}</span>
              <span className="c-lbl">{e.label}</span>
              <span className="c-skor">{skorMap[e.ticker].total.toFixed(0)}</span>
            </div>
          ))}
          <div className="c-row">
            <span className="c-tk" style={{ fontSize: '9.5pt', fontWeight: 700 }}>
              Peringkat
            </span>
            <span className="c-lbl">Quant Opportunity Ranking — komponen skor terbuka</span>
            <span className="c-skor" />
          </div>
        </div>
        <div style={{ marginTop: 'auto', paddingBottom: '16mm' }}>
          <div
            style={{
              background: 'rgba(255,255,255,.08)',
              padding: '4mm 5mm',
              fontSize: '9pt',
              display: 'flex',
              gap: '10mm',
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            <span>
              <span
                style={{
                  display: 'block',
                  fontSize: '6.3pt',
                  letterSpacing: '.16em',
                  textTransform: 'uppercase',
                  color: 'rgba(255,255,255,.6)',
                }}
              >
                IHSG
              </span>
              <b>6.409,65</b> +1,04%
            </span>
            <span>
              <span
                style={{
                  display: 'block',
                  fontSize: '6.3pt',
                  letterSpacing: '.16em',
                  textTransform: 'uppercase',
                  color: 'rgba(255,255,255,.6)',
                }}
              >
                Net Foreign Buy Reguler
              </span>
              <b>Rp917,23 miliar</b> (7 Agu)
            </span>
          </div>
          <div style={{ fontSize: '7pt', color: 'rgba(255,255,255,.55)', marginTop: '5mm', lineHeight: 1.7 }}>
            Analisis probabilistik, bukan ajakan transaksi.
            <br />
            Data: TradingView &amp; Stockbit (transkripsi manual terverifikasi), Yahoo Finance.
          </div>
        </div>
      </div>
    </div>
  )
}
