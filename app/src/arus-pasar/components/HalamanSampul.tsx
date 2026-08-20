import type { Edisi } from '../../lib/skor/types'
import type { SkorMap } from '../skorMap'

/** Port 1:1 dari halaman_sampul() di build.py. Baris IHSG/Net Foreign di bawah
 *  sengaja hardcode — build.py juga begitu (belum menyambung ke data live). */
export function HalamanSampul({ ed, skorMap }: { ed: Edisi; skorMap: SkorMap }) {
  const urut = [...ed.emiten].sort((a, b) => skorMap[b.ticker].total - skorMap[a.ticker].total)

  return (
    <div className="page" style={{ background: 'var(--brand)', color: '#fff' }}>
      <div style={{ padding: '22mm 20mm 0', flex: 1, display: 'flex', flexDirection: 'column' }}>
        {/* Hero IHSG (#A6, 20 Agu): elemen paling menonjol sampul, dipindah ke
            atas — dulu kotak IHSG/NF ini nangkring kecil di kaki halaman dan
            tak ada satupun elemen dominan (semua sama besar = terbaca sebagai
            daftar isi). IHSG dipilih jadi hero karena mewakili SELURUH pasar
            edisi ini, bukan performa satu emiten (alasan lengkap di build.py
            halaman_sampul()). Wordmark di bawah diperkecil relatif. */}
        <div style={{ borderBottom: '1px solid rgba(255,255,255,.35)', paddingBottom: '6mm' }}>
          <div
            style={{
              fontSize: '7pt',
              letterSpacing: '.24em',
              textTransform: 'uppercase',
              color: 'rgba(255,255,255,.6)',
            }}
          >
            IHSG
          </div>
          <div
            style={{
              fontFamily: 'Consolas,monospace',
              fontWeight: 700,
              fontSize: '40pt',
              lineHeight: 1,
              marginTop: '2mm',
              display: 'flex',
              alignItems: 'baseline',
              gap: '6mm',
            }}
          >
            <span>6.409,65</span>
            <b style={{ fontSize: '14pt' }}>+1,04%</b>
          </div>
          <div style={{ marginTop: '3mm', fontSize: '9pt' }}>
            <span
              style={{
                fontSize: '6.3pt',
                letterSpacing: '.16em',
                textTransform: 'uppercase',
                color: 'rgba(255,255,255,.6)',
                marginRight: '2.5mm',
              }}
            >
              Net Foreign Buy Reguler
            </span>
            <b style={{ fontFamily: 'Consolas,monospace', fontSize: '10pt' }}>Rp917,23 miliar</b> (7 Agu)
          </div>
        </div>
        <div
          style={{
            fontSize: '7pt',
            letterSpacing: '.24em',
            textTransform: 'uppercase',
            color: 'rgba(255,255,255,.6)',
            marginTop: '6mm',
          }}
        >
          Tinjauan Teknikal &amp; Arus Dana Harian
        </div>
        <div
          style={{
            fontFamily: 'Georgia,Cambria,serif',
            fontSize: '20pt',
            fontWeight: 700,
            lineHeight: 1.1,
            marginTop: '2mm',
          }}
        >
          ARUS PASAR
        </div>
        <div style={{ marginTop: '4mm', fontSize: '9.5pt' }}>{ed.tanggal_id}</div>
        <div
          style={{
            fontFamily: 'Consolas,monospace',
            fontSize: '8pt',
            color: 'rgba(255,255,255,.75)',
            marginTop: '1.5mm',
          }}
        >
          {ed.edisi}
        </div>
        <div style={{ marginTop: '10mm' }}>
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
          <div style={{ fontSize: '7pt', color: 'rgba(255,255,255,.55)', lineHeight: 1.7 }}>
            Analisis probabilistik, bukan ajakan transaksi.
            <br />
            Data: TradingView &amp; Stockbit (transkripsi manual terverifikasi), Yahoo Finance.
          </div>
        </div>
      </div>
    </div>
  )
}
