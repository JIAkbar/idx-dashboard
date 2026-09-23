import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { fp, persen, tanggalRingkas } from '../../lib/dasbor/format'
import {
  layakPersen, muatRaporUji, vonis,
  type Horizon, type Kelompok, type PilihanRapor, type RaporUji, type SumberRapor,
} from '../../lib/dasbor/raporUji'
import './RaporUji.css'

/**
 * Rapor Uji (`/rapor-uji`, #221 opsi a, docs/spek-dev-papan/spek_rapor_uji_221.md)
 * — pilihan dan sinyal PAPAN dinilai SESUDAH kejadian lewat
 * `scripts/riset/rapor_uji.py`, dibandingkan dengan pilihan acak pada tanggal
 * yang sama dan IHSG. Sinyal mesin dicatat pada hari terjadinya dan catatan
 * lama TIDAK PERNAH ditulis ulang, jadi angkanya tak bisa disetel sesudah
 * hasilnya kelihatan (Johan 22 Sep 2026: "hasil dari benchmark data bukan
 * hanya data angan-angan"). Halaman ini murni memformat; seluruh hitungan
 * trade dan pembanding acak ada di skrip Python.
 */

const LABEL_KELOMPOK: Record<Kelompok, string> = { redaksi: 'Redaksi', obv: 'Sinyal OBV', rbs: 'Sinyal RBS' }
const LABEL_HORIZON: Record<Horizon, string> = { h5: 'H+5', h20: 'H+20' }
const LABEL_STATUS: Record<PilihanRapor['status'], string> = { selesai: 'Selesai', menunggu: 'Menunggu' }

const fPf = (v: number | null): string =>
  v == null ? '—' : `${v.toLocaleString('id-ID', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}×`
const fpRet = (v: number | null): string => (v == null ? '—' : fp(v * 100))
const arah = (v: number | null): string => (v == null ? '' : v > 0 ? 'up' : v < 0 ? 'dn' : '')

export function RaporUji() {
  const [data, setData] = useState<RaporUji | null | undefined>(undefined)
  const [horizon, setHorizon] = useState<Horizon>('h5')

  useEffect(() => {
    let hidup = true
    muatRaporUji().then((d) => { if (hidup) setData(d) })
    return () => { hidup = false }
  }, [])

  return (
    <div className="lantai hal-rapor-uji">
      <div className="vhead">
        <h1>Rapor Uji</h1>
        <span className="sub">
          Pilihan dan sinyal PAPAN dinilai sesudah kejadian, dibandingkan dengan pilihan acak dan IHSG.
        </span>
      </div>

      {data === undefined && (
        <div className="panel"><div className="panel-b muted">Memuat rapor…</div></div>
      )}

      {data === null && (
        <div className="panel">
          <div className="panel-b">
            Rapor belum tersedia. Angkanya baru muncul sesudah panen mesin menuliskannya.
          </div>
        </div>
      )}

      {data && <IsiRapor data={data} horizon={horizon} setHorizon={setHorizon} />}
    </div>
  )
}

function IsiRapor({ data, horizon, setHorizon }: {
  data: RaporUji
  horizon: Horizon
  setHorizon: (h: Horizon) => void
}) {
  return (
    <>
      <div className="panel">
        <div className="panel-b">
          <div className="bilah-kendali rpu-alat">
            <div className="grup-k" role="group" aria-label="Horizon">
              {(['h5', 'h20'] as Horizon[]).map((h) => (
                <button key={h} type="button" className={'chip-t' + (horizon === h ? ' on' : '')}
                  aria-pressed={horizon === h} onClick={() => setHorizon(h)}>
                  {LABEL_HORIZON[h]}
                </button>
              ))}
            </div>
            {data.data_per && (
              <div className="grup-kanan muted">Data per {tanggalRingkas(data.data_per)}</div>
            )}
          </div>
        </div>
      </div>

      <div className="grid3 rpu-kartu">
        {(['redaksi', 'obv', 'rbs'] as Kelompok[]).map((k) => (
          <KartuKelompok key={k} kelompok={k} sumber={data.sumber[k]} horizon={horizon} />
        ))}
      </div>

      <section className="panel">
        <div className="panel-h"><span className="lbl">Pilihan terbaru</span></div>
        <div className="panel-b">
          <div className="board-tbl-wrap">
            <table className="tbl rpu-tbl">
              <thead>
                <tr>
                  <th scope="col">Tanggal</th><th scope="col">Kode</th><th scope="col">Sumber</th>
                  <th scope="col" className="r">Masuk</th><th scope="col" className="r">H+5</th>
                  <th scope="col" className="r">H+20</th><th scope="col">Status</th>
                </tr>
              </thead>
              <tbody>
                {[...data.pilihan].reverse().map((p, i) => (
                  <tr key={`${p.kode}-${p.tanggal}-${p.sumber}-${i}`}>
                    <td className="num">{tanggalRingkas(p.tanggal)}</td>
                    <td><Link to={`/grafik?kode=${p.kode}`} className="tick">{p.kode}</Link></td>
                    <td>{LABEL_KELOMPOK[p.sumber]}</td>
                    <td className="r num">{p.masuk == null ? '—' : p.masuk.toLocaleString('id-ID')}</td>
                    <td className={`r num ${arah(p.h5)}`}>{fpRet(p.h5)}</td>
                    <td className={`r num ${arah(p.h20)}`}>{fpRet(p.h20)}</td>
                    <td className={p.status === 'menunggu' ? 'muted' : undefined}>{LABEL_STATUS[p.status]}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {data.pilihan.length === 0 && <p className="muted" style={{ padding: '10px 14px' }}>Belum ada pilihan tercatat.</p>}
        </div>
      </section>

      <KartuRiset data={data} />

      <p className="muted rpu-metode">
        Masuk di harga buka hari berikutnya, keluar di harga tutup hari ke-5 atau ke-20, tanpa biaya
        transaksi.{data.mulai && <> Sinyal mesin dicatat sejak {tanggalRingkas(data.mulai)} dan catatan lama tidak pernah diubah.</>}
      </p>
    </>
  )
}

function KartuKelompok({ kelompok, sumber, horizon }: { kelompok: Kelompok; sumber: SumberRapor; horizon: Horizon }) {
  const s = sumber[horizon]
  const nSelesai = horizon === 'h5' ? sumber.n_selesai_h5 : sumber.n_selesai_h20
  const winRateTeks = layakPersen(nSelesai)
    ? persen((s.win_rate ?? 0) * 100, 0)
    : `${Math.round((s.win_rate ?? 0) * nSelesai)} dari ${nSelesai} — terlalu sedikit untuk dipersenkan`

  return (
    <div className="panel rpu-kartu-kelompok">
      <div className="panel-h"><span className="lbl">{LABEL_KELOMPOK[kelompok]}</span></div>
      <div className="panel-b">
        <div className="rpu-pf">
          <span className="t-name">Profit factor {LABEL_HORIZON[horizon]}</span>
          <span className="t-val num">{fPf(s.pf)}</span>
        </div>
        <table className="tbl rpu-tbl-mini">
          <tbody>
            <tr><td>Win rate</td><td className="r num">{winRateTeks}</td></tr>
            <tr><td>Rata-rata return</td><td className={`r num ${arah(s.rata)}`}>{fpRet(s.rata)}</td></tr>
            <tr><td>Median return</td><td className={`r num ${arah(s.median)}`}>{fpRet(s.median)}</td></tr>
            <tr><td>Acak — median PF</td><td className="r num">{fPf(s.acak_p50_pf)}</td></tr>
            <tr><td>Acak — persentil 95 PF</td><td className="r num">{fPf(s.acak_p95_pf)}</td></tr>
            <tr><td>IHSG periode sama</td><td className={`r num ${arah(s.ihsg_rata)}`}>{fpRet(s.ihsg_rata)}</td></tr>
          </tbody>
        </table>
        <p className="rpu-vonis">{vonis(sumber, horizon)}</p>
      </div>
    </div>
  )
}

function KartuRiset({ data }: { data: RaporUji }) {
  const riset = data.riset
  return (
    <section className="panel">
      <div className="panel-h"><span className="lbl">Riset formula</span></div>
      <div className="panel-b">
        {!riset && <p className="muted">Riset lanjutan sedang berjalan.</p>}
        {riset?.arah && riset.arah.length > 0 && (
          <ul className="rpu-daftar">
            {riset.arah.map((a, i) => (
              <li key={i}><b>{String(a.nama ?? `Arah ${i + 1}`)}</b> — {String(a.vonis ?? 'belum ada vonis.')}</li>
            ))}
          </ul>
        )}
        {riset && !riset.arah && <p className="muted">Riset tersedia, belum ada rincian arah untuk ditampilkan.</p>}
      </div>
    </section>
  )
}
