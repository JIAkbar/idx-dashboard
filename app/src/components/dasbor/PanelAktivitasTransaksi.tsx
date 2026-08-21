import { useMemo } from 'react'
import { useStockAsing, type StockFundamental } from '../../lib/dasbor/stockDetailData'
import { ringkasTransaksi } from '../../lib/dasbor/bedahEmiten'
import { fRingkas, fMC, fv } from '../../lib/dasbor/stockDetailFormat'
import { tanggalPendek } from '../../lib/dasbor/statistikBerkala'

/**
 * Panel "Aktivitas Transaksi" — dipindah dari halaman Bedah Emiten (pensiun
 * 21 Agu 2026, isinya digabung ke Stock Detail). Seberapa ramai emiten ini
 * benar-benar diperdagangkan — angka valuasi apa pun tak berarti kalau
 * sahamnya tak bisa dilepas. Hitungannya (`ringkasTransaksi`) dari
 * `lib/dasbor/bedahEmiten.ts`, sudah diuji di sana.
 */
export function PanelAktivitasTransaksi({ ticker, fd }: { ticker: string; fd: StockFundamental }) {
  const { data: asing, loading } = useStockAsing(ticker)
  const r = useMemo(() => ringkasTransaksi(asing?.d ?? [], fd.shares), [asing, fd.shares])

  return (
    <div className="panel" style={{ marginBottom: 12 }}>
      <div className="panel-h"><span className="lbl">Aktivitas Transaksi</span></div>
      <div className="panel-b">
        <p style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 10, lineHeight: 1.6 }}>
          Seberapa ramai emiten ini benar-benar diperdagangkan — angka valuasi apa pun tak berarti
          kalau sahamnya tak bisa dilepas.
        </p>

        {loading && <p style={{ fontSize: 11, color: 'var(--text3)' }}>Memuat riwayat transaksi…</p>}

        {!loading && !r && (
          <p style={{ fontSize: 11, color: 'var(--text3)' }}>
            Riwayat transaksi harian emiten ini belum dipanen. Panen berjalan bertahap dan belum
            menjangkau seluruh emiten.
          </p>
        )}

        {!loading && r && (
          <>
            <div className="rasio">
              <div>
                <span className="lbl">Volume</span>
                <div className="v num">{fRingkas(r.volume)}</div>
                <span className="sub">lembar · {tanggalPendek(r.tanggal)}</span>
              </div>
              <div>
                <span className="lbl">Nilai</span>
                <div className="v num">{fMC(r.value)}</div>
                <span className="sub">rupiah transaksi</span>
              </div>
              <div>
                <span className="lbl">Frekuensi</span>
                <div className="v num">{fv(r.frekuensi)}</div>
                <span className="sub">kali transaksi</span>
              </div>
              <div>
                <span className="lbl">Vs Rerata 20H</span>
                <div className={'v num' + (r.banding20 != null ? (r.banding20 >= 1 ? ' up' : ' dn') : '')}>
                  {r.banding20 != null ? `${r.banding20.toFixed(2)}x` : '—'}
                </div>
                <span className="sub">{r.volume20 != null ? `rerata ${fRingkas(r.volume20)}` : 'riwayat < 5 hari'}</span>
              </div>
              <div>
                <span className="lbl">Turnover</span>
                <div className="v num">{r.turnover != null ? `${r.turnover.toFixed(3)}%` : '—'}</div>
                <span className="sub">saham beredar berpindah</span>
              </div>
              <div>
                <span className="lbl">Saham Beredar</span>
                <div className="v num">{fd.shares ? `${(fd.shares / 1e9).toFixed(2)} M` : '—'}</div>
                <span className="sub">lembar tercatat di bursa</span>
              </div>
            </div>
            <p style={{ fontSize: 10, color: 'var(--text3)', marginTop: 8, lineHeight: 1.6 }}>
              Volume, nilai, dan frekuensi hari bursa terakhir yang terpanen. Jumlah saham beredar dari
              ruas <b>ListedShares</b> bursa, bukan dari agregator.
            </p>
          </>
        )}
      </div>
    </div>
  )
}
